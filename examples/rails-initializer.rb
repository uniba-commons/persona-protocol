# Wire an application's domain into the generic Persona core — example for a
# Rails consumer.
#
# to_prepare (not a plain initializer body) so the wiring is re-applied on
# every code reload in development; otherwise reloadable app classes
# referenced from the config would go stale after the first reload.
Rails.application.config.to_prepare do
  Persona.configure do |config|
    # Domain side effects to run when a browser joins. Keep request-scoped
    # concerns (tracing which page triggered the join, etc.) in the app's
    # join endpoint instead — this hook only sees the user.
    config.on_join = ->(user) { user.join_default_team! }

    # Account linking (only needed when PERSONA_ACCOUNT_LINKING is on):
    #
    # The OIDC round-trip store, backed by the app's Redis. Accepts a raw
    # client or a connection pool responding to #with.
    config.link_store = Persona::Oidc::LinkStore.new(redis: RedisPool.app)

    # The AccountLink storage port, implemented on the app's models —
    # see rails_account_link_store.rb next to this file.
    config.account_link_store = RailsAccountLinkStore.new

    # Identity providers, one registration per IdP the deployment links to.
    # Registering nothing means no provider can ever verify. The stub trusts
    # callback params — development only, never production.
    if Rails.env.development?
      config.register_oidc_provider(Persona::Oidc::StubProvider.new(name: 'example-idp'))
    end
  end
end
