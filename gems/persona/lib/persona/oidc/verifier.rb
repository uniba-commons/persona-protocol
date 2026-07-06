require 'json'
require 'uri'
require 'net/http'
require 'digest'
require 'base64'
require 'securerandom'
require 'jwt'

module Persona
  module Oidc
    # Default HTTP client (Net::HTTP) used by Verifier for discovery, JWKS, and
    # the token exchange. Injectable — tests pass a fake responding to the same
    # #get / #post_form contract. Returns the response body on 2xx, nil otherwise.
    class NetHttpClient
      def get(url)
        uri = URI(url)
        request(uri, Net::HTTP::Get.new(uri))
      end

      def post_form(url, params)
        uri = URI(url)
        req = Net::HTTP::Post.new(uri)
        req['Accept'] = 'application/json'
        req.set_form_data(params)
        request(uri, req)
      end

      private

      def request(uri, req)
        res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') { |http| http.request(req) }
        res.is_a?(Net::HTTPSuccess) ? res.body : nil
      end
    end

    # Production OIDC verifier provider (doc/protocol.md §7, P-16): the
    # authorization-code + PKCE flow, OIDC discovery, code exchange, and
    # id_token validation against the IdP's published JWKS. Mirrors the
    # TypeScript createOidcVerifierProvider.
    #
    # Signature verification uses the jwt gem's OpenSSL backend and covers
    # RS256 and ES256. EdDSA (Ed25519) is intentionally not enabled here — it
    # needs rbnacl in Ruby — so an IdP signing with EdDSA must expose an
    # RS256/ES256 key or wait for that follow-up (doc/roadmap.md Phase 2).
    #
    # The clock (#now) is injectable so expiry is checked here rather than by
    # the jwt gem, matching the TS verifier and keeping tests deterministic.
    class Verifier
      ALLOWED_ALGS = %w[RS256 ES256].freeze

      attr_reader :name

      def initialize(
        name:, issuer:, client_id:, redirect_uri:,
        client_secret: nil, scope: 'openid email',
        authorization_endpoint: nil, token_endpoint: nil, jwks_uri: nil,
        authorize_params: {}, require_hosted_domain: nil, allowed_email_domain: nil,
        http: NetHttpClient.new, now: -> { Time.now.to_i }, clock_tolerance: 60
      )
        @name = name
        @issuer = issuer.to_s.sub(%r{/\z}, '')
        @client_id = client_id
        @redirect_uri = redirect_uri
        @client_secret = client_secret
        @scope = scope
        @explicit_endpoints = { authorization_endpoint: authorization_endpoint,
                                token_endpoint: token_endpoint, jwks_uri: jwks_uri }
        @authorize_params = authorize_params
        @require_hosted_domain = require_hosted_domain
        @allowed_email_domain = allowed_email_domain
        @http = http
        @now = now
        @clock_tolerance = clock_tolerance
        @discovery = nil
        @jwks = nil
      end

      # Preset for uniba/auth (github.com/uniba/auth): the uniba.jp shared OIDC
      # AS. Fills in the name, scope, and hd=uniba.jp upstream constraint; the
      # issuer and client credentials stay per-deployment. auth is not yet
      # published, so the token-claim domain check defaults to the email domain
      # (provisional). Pass allowed_email_domain: nil to disable it.
      def self.uniba_auth(issuer:, client_id:, redirect_uri:, client_secret: nil,
                          allowed_email_domain: 'uniba.jp',
                          http: NetHttpClient.new, now: -> { Time.now.to_i })
        new(
          name: 'uniba-auth', issuer: issuer, client_id: client_id, redirect_uri: redirect_uri,
          client_secret: client_secret, scope: 'openid email',
          authorize_params: { hd: 'uniba.jp' }, allowed_email_domain: allowed_email_domain,
          http: http, now: now,
        )
      end

      def authorize(state)
        code_verifier = SecureRandom.urlsafe_base64(32)
        nonce = SecureRandom.urlsafe_base64(16)
        query = {
          response_type: 'code', client_id: @client_id, redirect_uri: @redirect_uri,
          scope: @scope, state: state, nonce: nonce,
          code_challenge: base64url(Digest::SHA256.digest(code_verifier)),
          code_challenge_method: 'S256',
        }.merge(@authorize_params)
        url = "#{discovery.fetch(:authorization_endpoint)}?#{URI.encode_www_form(query)}"
        AuthorizeStart.new(url: url, stash: { code_verifier: code_verifier, nonce: nonce })
      end

      def verify(params, stash = nil)
        code = params[:code] || params['code']
        return nil if code.nil? || code.to_s.empty?

        tokens = exchange_code(code, stash)
        id_token = tokens && (tokens['id_token'] || tokens[:id_token])
        return nil if id_token.nil?

        validate_id_token(id_token, stash)
      end

      private

      def discovery
        return @discovery if @discovery

        if @explicit_endpoints.values.all?
          return @discovery = @explicit_endpoints
        end

        body = @http.get("#{@issuer}/.well-known/openid-configuration")
        raise "OIDC discovery failed for #{@issuer}" if body.nil?

        doc = JSON.parse(body)
        if doc['issuer'] && doc['issuer'].sub(%r{/\z}, '') != @issuer
          raise "OIDC issuer mismatch: expected #{@issuer}, got #{doc['issuer']}"
        end

        @discovery = {
          authorization_endpoint: @explicit_endpoints[:authorization_endpoint] || doc['authorization_endpoint'],
          token_endpoint: @explicit_endpoints[:token_endpoint] || doc['token_endpoint'],
          jwks_uri: @explicit_endpoints[:jwks_uri] || doc['jwks_uri'],
        }
      end

      def exchange_code(code, stash)
        form = { grant_type: 'authorization_code', code: code,
                 redirect_uri: @redirect_uri, client_id: @client_id }
        code_verifier = stash && stash_value(stash, :code_verifier)
        form[:code_verifier] = code_verifier if code_verifier
        form[:client_secret] = @client_secret if @client_secret

        body = @http.post_form(discovery.fetch(:token_endpoint), form)
        return nil if body.nil?

        JSON.parse(body)
      rescue JSON::ParserError
        nil
      end

      def validate_id_token(id_token, stash)
        loader = lambda do |options|
          @jwks = nil if options[:invalidate]
          { keys: jwks_keys }
        end
        # Verify the signature (and restrict algorithms) with the jwt gem; check
        # every claim here, against the injected clock.
        payload, = JWT.decode(id_token, nil, true, algorithms: ALLOWED_ALGS, jwks: loader,
                                                   verify_expiration: false)
        return nil unless valid_claims?(payload, stash)

        Identity.new(provider: @name, subject: payload['sub'])
      rescue JWT::DecodeError, JWT::JWKError
        nil
      end

      def valid_claims?(payload, stash)
        now = @now.call
        return false unless payload['iss'].to_s.sub(%r{/\z}, '') == @issuer

        aud = payload['aud']
        return false unless aud == @client_id || (aud.is_a?(Array) && aud.include?(@client_id))

        exp = payload['exp']
        return false unless exp.is_a?(Numeric) && exp + @clock_tolerance > now

        nbf = payload['nbf']
        return false if nbf.is_a?(Numeric) && nbf - @clock_tolerance > now

        if stash
          nonce = stash_value(stash, :nonce)
          return false unless nonce.nil? || payload['nonce'] == nonce
        end

        return false if @require_hosted_domain && payload['hd'] != @require_hosted_domain

        if @allowed_email_domain
          email = payload['email'].to_s.downcase
          return false unless payload['email_verified'] == true &&
                              email.end_with?("@#{@allowed_email_domain.downcase}")
        end

        sub = payload['sub']
        !(sub.nil? || sub.to_s.empty?)
      end

      def jwks_keys
        return @jwks if @jwks

        body = @http.get(discovery.fetch(:jwks_uri))
        raise 'JWKS fetch failed' if body.nil?

        @jwks = JSON.parse(body)['keys']
      end

      # Stash may come back from JSON storage with either symbol or string keys.
      def stash_value(stash, key)
        stash[key] || stash[key.to_s]
      end

      def base64url(bytes)
        Base64.urlsafe_encode64(bytes, padding: false)
      end
    end
  end
end
