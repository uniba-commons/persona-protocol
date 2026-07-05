# Persona — the app-agnostic core of the "anonymous identity you carry per
# browser" mechanism, factored out of the SGMs domain so the same primitives
# can be reused by other services. See doc/development/auth-removal-plan.md.
#
# The identity records themselves (agent_uid -> User resolution, guest
# creation, bindings, recovery codes, merge) still live on the app's models
# for now. This module owns the *seams* where app-specific concerns plug in:
#
#   - on_join                  domain side effects to run when a browser joins
#   - guest_nickname_generator what a fresh guest is named when none is given
#   - guest_email_factory      the placeholder identifier stored on a new guest
#   - AGENT_ID_HEADER / AGENT_ID_PARAM  the wire protocol carrying the identity
#
# App wiring lives in config/initializers/persona.rb.
module Persona
  # HTTP header (GraphQL requests) and WebSocket query param (ActionCable
  # can't set custom headers) that carry the browser-generated agent_uid.
  # The value itself is never echoed back in responses — see the lock-in
  # avoidance protocol in auth-removal-plan.md.
  AGENT_ID_HEADER = 'X-Agent-Id'.freeze
  AGENT_ID_PARAM = 'agent_id'.freeze

  # Default guest-nickname vocabulary: adjective-noun-hex, readable and
  # collision-resistant enough for a display handle. Consumers can replace
  # the whole generator via Persona.config.guest_nickname_generator.
  NICKNAME_ADJECTIVES = %w[
    azure crimson emerald golden silver violet amber coral indigo jade
    onyx pearl ruby sapphire topaz cobalt scarlet teal magenta saffron
  ].freeze

  NICKNAME_NOUNS = %w[
    otter falcon mantis lynx ibis pangolin heron badger marmot newt
    raven sparrow tapir gecko axolotl puffin lemur kestrel quokka tern
  ].freeze

  # Injection points for the app-specific parts of the persona flow. Every
  # default is a self-contained generic — the module has no domain
  # dependencies until the app overrides a seam.
  class Config
    # Called with the freshly-resolved guest User on every join (both the
    # first join and returning visits). Must be idempotent. Defaults to a
    # no-op; the app injects its membership side effects here.
    attr_accessor :on_join

    # Builds the display nickname for a new guest when the caller supplies
    # none.
    attr_accessor :guest_nickname_generator

    # Builds the placeholder email/identifier persisted on a new guest User.
    attr_accessor :guest_email_factory

    # Verifies an OIDC callback into a Persona::Oidc::Identity. Defaults to
    # the local stub; production swaps in a JWKS-checking verifier.
    attr_accessor :oidc_verifier

    def initialize
      @on_join = -> (_user) {}
      @guest_nickname_generator = -> { Persona.generate_nickname }
      @guest_email_factory = -> { "agent-#{SecureRandom.hex(8)}@guest.local" }
      @oidc_verifier = Oidc::StubVerifier.new
    end
  end

  class << self
    def config
      @config ||= Config.new
    end

    def configure
      yield config
    end

    def generate_nickname
      "#{NICKNAME_ADJECTIVES.sample}-#{NICKNAME_NOUNS.sample}-#{SecureRandom.hex(2)}"
    end

    # Account linking (OIDC binding to an external IdP) is opt-in and off by
    # default — until it is enabled, no /auth/oidc routes or link mutations
    # do anything. Toggled by the PERSONA_ACCOUNT_LINKING env var.
    def account_linking_enabled?
      ActiveModel::Type::Boolean.new.cast(ENV.fetch('PERSONA_ACCOUNT_LINKING', nil)) || false
    end
  end
end
