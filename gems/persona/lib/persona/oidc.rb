require 'cgi'

module Persona
  # OIDC account linking — the verification half of binding a persona to an
  # external identity provider. persona-protocol owns the flow (doc/protocol.md
  # §7); the application registers one provider object per IdP via
  # Persona.config.register_oidc_provider, and gains new providers by
  # updating this gem and registering them — not by reimplementing the flow.
  #
  # A provider is any object exposing:
  #
  #   name              -> String   stable identifier stored on account
  #                                 bindings ('google', 'uniba-auth', ...)
  #   authorize(state)  -> AuthorizeStart   the authorize URL plus any per-flow
  #                                         secrets (PKCE verifier, nonce) to
  #                                         stash with the state
  #   verify(params, stash = nil) -> Identity | nil   callback verification,
  #                                                   using the stashed secrets
  #
  # Persona::Oidc::Verifier is the production implementation (code exchange +
  # JWKS validation); StubProvider is the local stand-in.
  module Oidc
    # The verified outcome of an OIDC round-trip: which provider vouched for
    # the browser, and the stable subject the token was issued for. This
    # pair becomes an account binding.
    Identity = Struct.new(:provider, :subject, keyword_init: true)

    # What #authorize returns: where to send the browser, and the per-flow
    # secrets to stash with the state and hand back to #verify on the
    # callback. The stub needs no stash; a real code+PKCE flow does.
    AuthorizeStart = Struct.new(:url, :stash, keyword_init: true)

    # Local / development stand-in for a real provider. Its authorize URL
    # points at an app-local page, and #verify trusts a subject handed
    # straight through the callback params — NO cryptographic verification.
    # It exists so the whole bind / adopt / merge flow can be exercised
    # before any real IdP is wired up. MUST NOT be deployed to production
    # (protocol.md P-16).
    class StubProvider
      attr_reader :name

      def initialize(name: 'stub', authorize_path: '/auth/oidc/start')
        @name = name
        @authorize_path = authorize_path
      end

      def authorize(state)
        AuthorizeStart.new(url: "#{@authorize_path}?state=#{CGI.escape(state)}", stash: nil)
      end

      def verify(params, _stash = nil)
        subject = params[:sub] || params['sub']
        return nil if subject.nil? || subject.to_s.empty?

        Identity.new(provider: name, subject: subject)
      end
    end
  end
end
