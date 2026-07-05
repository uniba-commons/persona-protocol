module Persona
  # OIDC account linking — the verification half of binding a persona to an
  # external identity provider (initially uniba/auth). Only the seam and a
  # local stub live here; the account-binding logic itself is elsewhere.
  #
  # See doc/development/auth-removal-plan.md and Issue #17.
  module Oidc
    # Where beginAccountLink sends the browser to authenticate. With the stub
    # verifier this is our own local authorize page; the real integration
    # builds uniba/auth's /authorize URL (client_id, redirect_uri, scope,
    # PKCE, nonce) here instead.
    def self.authorize_url(state:)
      "/auth/oidc/start?state=#{CGI.escape(state)}"
    end

    # The verified outcome of an OIDC round-trip: which provider vouched for
    # the browser, and the stable subject (personId) the token was issued
    # for. This pair becomes an AccountBinding.
    Identity = Struct.new(:provider, :subject, keyword_init: true)

    # Local / development stand-in for a real OIDC verifier. Trusts a subject
    # handed straight through the callback params — it performs NO
    # cryptographic verification. Mirrors auth's "prod = verify / local =
    # fallback principal" convention so the whole bind / adopt / merge flow
    # can be exercised before uniba/auth exists.
    #
    # The production verifier (added once auth publishes JWKS) will instead
    # exchange the authorization code, validate the id_token against
    # /.well-known/jwks.json, check iss / aud / hd = uniba.jp, and read sub.
    # It must expose the same #verify(params) -> Identity | nil contract.
    class StubVerifier
      PROVIDER = 'uniba-auth'.freeze

      def verify(params)
        subject = params[:sub].presence
        return nil unless subject

        Identity.new(provider: PROVIDER, subject: subject)
      end
    end
  end
end
