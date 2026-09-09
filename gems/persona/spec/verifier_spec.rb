require 'openssl'
require 'jwt'

# Contract tests for the production OIDC verifier, run entirely offline: a
# locally generated RS256 keypair signs id_tokens, and a fake HTTP client
# stands in for the IdP's discovery, token, and JWKS endpoints. This proves the
# full validation path (signature, iss/aud/exp/nonce, claim checks, key
# rotation) without a live authorization server. Mirrors the TypeScript
# oidc_verifier.test.ts.
describe Persona::Oidc::Verifier do
  ISSUER = 'https://auth.example.test'.freeze
  CLIENT_ID = 'example-client'.freeze
  REDIRECT = 'https://app.example.test/auth/oidc/callback'.freeze
  NOW = 1_800_000_000

  # A stubbed IdP: discovery + JWKS + a token endpoint returning the queued
  # id_token. `jwks` and `id_token` are mutable so a test can rotate keys.
  class FakeHttp
    attr_accessor :jwks, :id_token
    attr_reader :token_form, :jwks_gets

    def initialize(jwks:, id_token:)
      @jwks = jwks
      @id_token = id_token
      @jwks_gets = 0
    end

    def get(url)
      if url.end_with?('/.well-known/openid-configuration')
        { issuer: ISSUER, authorization_endpoint: "#{ISSUER}/authorize",
          token_endpoint: "#{ISSUER}/token", jwks_uri: "#{ISSUER}/jwks" }.to_json
      elsif url.end_with?('/jwks')
        @jwks_gets += 1
        @jwks.to_json
      end
    end

    def post_form(_url, params)
      @token_form = params
      @id_token ? { id_token: @id_token }.to_json : nil
    end
  end

  def make_key(kid)
    rsa = OpenSSL::PKey::RSA.generate(2048)
    public_jwk = JWT::JWK.new(rsa, kid: kid).export.merge('alg' => 'RS256', 'use' => 'sig')
    [rsa, public_jwk]
  end

  def sign(rsa, kid, claims)
    JWT.encode(claims, rsa, 'RS256', { kid: kid })
  end

  def base_claims(over = {})
    { iss: ISSUER, aud: CLIENT_ID, sub: 'person-1', exp: NOW + 300, iat: NOW, nonce: 'n-1' }.merge(over)
  end

  def build(claims: {}, config: {}, kid: 'key-1')
    rsa, jwk = make_key(kid)
    http = FakeHttp.new(jwks: { keys: [jwk] }, id_token: sign(rsa, kid, base_claims(claims)))
    verifier = described_class.new(
      name: 'x', issuer: ISSUER, client_id: CLIENT_ID, redirect_uri: REDIRECT,
      http: http, now: -> { NOW }, **config
    )
    [verifier, http]
  end

  describe '#authorize' do
    it 'builds a PKCE authorize URL and stashes verifier + nonce' do
      verifier, = build
      start = verifier.authorize('state-123')
      params = URI.decode_www_form(URI(start.url).query).to_h

      expect("#{URI(start.url).scheme}://#{URI(start.url).host}#{URI(start.url).path}").to eq "#{ISSUER}/authorize"
      expect(params['response_type']).to eq 'code'
      expect(params['client_id']).to eq CLIENT_ID
      expect(params['state']).to eq 'state-123'
      expect(params['code_challenge_method']).to eq 'S256'
      expect(params['code_challenge']).not_to be_empty
      expect(start.stash[:code_verifier]).not_to be_empty
      expect(start.stash[:nonce]).to eq params['nonce']
    end
  end

  describe '#verify' do
    it 'exchanges the code (sending PKCE) and returns the verified identity' do
      verifier, http = build
      identity = verifier.verify({ code: 'auth-code' }, { code_verifier: 'cv-1', nonce: 'n-1' })

      expect(identity.provider).to eq 'x'
      expect(identity.subject).to eq 'person-1'
      expect(http.token_form[:grant_type]).to eq 'authorization_code'
      expect(http.token_form[:code]).to eq 'auth-code'
      expect(http.token_form[:code_verifier]).to eq 'cv-1'
    end

    it 'rejects a token signed by an unknown key' do
      _good_rsa, good_jwk = make_key('key-1')
      attacker_rsa, = make_key('key-1') # same kid, different key
      http = FakeHttp.new(jwks: { keys: [good_jwk] }, id_token: sign(attacker_rsa, 'key-1', base_claims))
      verifier = described_class.new(name: 'x', issuer: ISSUER, client_id: CLIENT_ID,
                                     redirect_uri: REDIRECT, http: http, now: -> { NOW })
      expect(verifier.verify({ code: 'c' }, { nonce: 'n-1' })).to be_nil
    end

    it 'rejects a nonce mismatch (replay defense)' do
      verifier, = build
      expect(verifier.verify({ code: 'c' }, { nonce: 'different' })).to be_nil
    end

    it 'rejects a wrong audience' do
      verifier, = build(claims: { aud: 'someone-else' })
      expect(verifier.verify({ code: 'c' }, { nonce: 'n-1' })).to be_nil
    end

    it 'rejects an expired token' do
      verifier, = build(claims: { exp: NOW - 3600 })
      expect(verifier.verify({ code: 'c' }, { nonce: 'n-1' })).to be_nil
    end

    it 'rejects a wrong issuer' do
      verifier, = build(claims: { iss: 'https://evil.test' })
      expect(verifier.verify({ code: 'c' }, { nonce: 'n-1' })).to be_nil
    end

    it 'accepts an audience array containing the client id' do
      verifier, = build(claims: { aud: ['other', CLIENT_ID] })
      expect(verifier.verify({ code: 'c' }, { nonce: 'n-1' }).subject).to eq 'person-1'
    end

    it 'enforces an allowed email domain when configured' do
      ok, = build(claims: { email: 'a@uniba.jp', email_verified: true }, config: { allowed_email_domain: 'uniba.jp' })
      expect(ok.verify({ code: 'c' }, { nonce: 'n-1' })).not_to be_nil

      wrong, = build(claims: { email: 'a@gmail.com', email_verified: true }, config: { allowed_email_domain: 'uniba.jp' })
      expect(wrong.verify({ code: 'c' }, { nonce: 'n-1' })).to be_nil

      unverified, = build(claims: { email: 'a@uniba.jp', email_verified: false }, config: { allowed_email_domain: 'uniba.jp' })
      expect(unverified.verify({ code: 'c' }, { nonce: 'n-1' })).to be_nil
    end

    it 'refetches the JWKS once when a cached keyset misses the kid (rotation)' do
      old_rsa, old_jwk = make_key('old')
      new_rsa, new_jwk = make_key('new')
      http = FakeHttp.new(jwks: { keys: [old_jwk] }, id_token: sign(old_rsa, 'old', base_claims(sub: 'person-old')))
      verifier = described_class.new(name: 'x', issuer: ISSUER, client_id: CLIENT_ID,
                                     redirect_uri: REDIRECT, http: http, now: -> { NOW })

      expect(verifier.verify({ code: 'c' }, { nonce: 'n-1' }).subject).to eq 'person-old'
      expect(http.jwks_gets).to eq 1

      http.jwks = { keys: [new_jwk] }
      http.id_token = sign(new_rsa, 'new', base_claims(sub: 'person-new'))
      expect(verifier.verify({ code: 'c' }, { nonce: 'n-1' }).subject).to eq 'person-new'
      expect(http.jwks_gets).to eq 2
    end

    it 'returns nil when the token endpoint has no id_token' do
      http = FakeHttp.new(jwks: { keys: [] }, id_token: nil)
      verifier = described_class.new(name: 'x', issuer: ISSUER, client_id: CLIENT_ID,
                                     redirect_uri: REDIRECT, http: http, now: -> { NOW })
      expect(verifier.verify({ code: 'c' }, { nonce: 'n-1' })).to be_nil
    end
  end

  describe '.uniba_auth preset' do
    it 'names itself uniba-auth, sends hd=uniba.jp, and enforces the email domain' do
      rsa, jwk = make_key('key-1')
      claims = base_claims(email: 'a@uniba.jp', email_verified: true)
      http = FakeHttp.new(jwks: { keys: [jwk] }, id_token: sign(rsa, 'key-1', claims))
      verifier = described_class.uniba_auth(issuer: ISSUER, client_id: CLIENT_ID,
                                            redirect_uri: REDIRECT, http: http, now: -> { NOW })
      expect(verifier.name).to eq 'uniba-auth'

      params = URI.decode_www_form(URI(verifier.authorize('s').url).query).to_h
      expect(params['hd']).to eq 'uniba.jp'

      identity = verifier.verify({ code: 'c' }, { nonce: 'n-1' })
      expect(identity.provider).to eq 'uniba-auth'
      expect(identity.subject).to eq 'person-1'
    end
  end
end
