# Wire an app's domain into the generic Persona core — example for a Rails
# consumer (adapted from another-sgms).
#
# to_prepare (not a plain initializer body) so the wiring is re-applied on
# every code reload in development; otherwise reloadable app classes
# referenced from the config would go stale after the first reload.
Rails.application.config.to_prepare do
  Persona.configure do |config|
    # When a browser joins, enroll it in the default team. Project / track
    # (会議体) tracing happens in the app's join mutation instead, which
    # has the request's project_id / track_id context.
    config.on_join = ->(user) { user.join_default_team! }

    # Account linking (only needed when PERSONA_ACCOUNT_LINKING is on):
    #
    # The OIDC round-trip store, backed by the app's Redis. Accepts a raw
    # client or a connection pool responding to #with.
    config.link_store = Persona::Oidc::LinkStore.new(redis: RedisPool.app)

    # The AccountLink storage port, implemented on the app's models —
    # see rails_account_link_store.rb next to this file.
    config.account_link_store = RailsAccountLinkStore.new
  end
end
