# Wire the SGMs domain into the generic Persona core.
#
# to_prepare (not a plain initializer body) so the wiring is re-applied on
# every code reload in development — Persona lives in app/lib and is
# reloadable, so its Config would otherwise reset to the no-op default after
# the first reload.
Rails.application.config.to_prepare do
  Persona.configure do |config|
    # When a browser joins, enroll it in the default team. Project / track
    # (会議体) tracing happens in the JoinAsGuest mutation instead, which
    # has the request's project_id / track_id context.
    config.on_join = ->(user) { user.join_default_team! }
  end
end
