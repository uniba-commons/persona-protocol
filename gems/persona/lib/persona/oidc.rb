require 'cgi'

module Persona
  # OIDC account linking — the verification half of binding a persona to an
  # external identity provider. persona-kit owns the flow (doc/protocol.md
  # §7); the application registers one provider object per IdP via
  # Persona.config.register_oidc_provider, and gains new providers by
  # updating this gem and registering them — not by reimplementing the flow.
  #
  # A provider is any object exposing:
  #
  #   name                  -> String   stable identifier stored on account
  #                                     bindings ('google', 'my-org-idp', ...)
  #   authorize_url(state:) -> String   where the begin step sends the browser
  #   verify(params)        -> Identity | nil   callback verification
  #
  # Production providers (added per IdP) perform the code exchange and
  # validate the token against the IdP's published keys — issuer, audience,
  # expiry, subject, plus any deployment-specific claims — behind the same
  # three-method contract.
  module Oidc
    # The verified outcome of an OIDC round-trip: which provider vouched for
    # the browser, and the stable subject the token was issued for. This
    # pair becomes an account binding.
    Identity = Struct.new(:provider, :subject, keyword_init: true)

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

      def authorize_url(state:)
        "#{@authorize_path}?state=#{CGI.escape(state)}"
      end

      def verify(params)
        subject = params[:sub]
        return nil if subject.nil? || subject.to_s.empty?

        Identity.new(provider: name, subject: subject)
      end
    end
  end
end
