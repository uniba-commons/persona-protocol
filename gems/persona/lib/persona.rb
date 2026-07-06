require 'securerandom'

require_relative 'persona/version'
require_relative 'persona/claim_code'
require_relative 'persona/oidc'
require_relative 'persona/oidc/verifier'
require_relative 'persona/oidc/link_store'
require_relative 'persona/account_link'

# Persona — the app-agnostic core of the "anonymous identity you carry per
# browser" mechanism. The protocol itself is specified in doc/protocol.md;
# this gem is one adapter around it.
#
# The identity records themselves (agent_uid -> user resolution, guest
# creation, bindings, recovery codes, merge) live on the consumer's models.
# This gem owns the *seams* where app-specific concerns plug in:
#
#   - on_join                  domain side effects to run when a browser joins
#   - guest_nickname_generator what a fresh guest is named when none is given
#   - guest_email_factory      the placeholder identifier stored on a new guest
#   - oidc_providers           registered identity providers (see oidc.rb)
#   - account_link_store       the AccountLink storage port (see account_link.rb)
#   - link_store               the OIDC round-trip store (see oidc/link_store.rb)
#   - AGENT_ID_HEADER / AGENT_ID_PARAM / NOT_JOINED_CODE  the wire protocol
#
# Consumer wiring examples live in examples/ at the repository root.
module Persona
  class ConfigurationError < StandardError; end

  # HTTP header and WebSocket query param (for transports that can't set
  # custom headers) that carry the browser-generated agent_uid. The value
  # itself is never echoed back in responses — doc/protocol.md P-3 / H-3.
  AGENT_ID_HEADER = 'X-Agent-Id'.freeze
  AGENT_ID_PARAM = 'agent_id'.freeze

  # Error code returned when a write is attempted by a visitor who hasn't
  # opted in yet; the client reacts by starting the join handshake and
  # retrying. How the code travels (GraphQL extension, HTTP status + body,
  # HTML fragment) is transport-specific — the name is the protocol.
  NOT_JOINED_CODE = 'NOT_JOINED'.freeze

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

  # Env values treated as "off" for feature flags, mirroring the usual
  # Rails-style boolean casting so consumers coming from ActiveModel see no
  # behavior change. Anything else non-empty counts as "on".
  FALSEY_ENV_VALUES = %w[0 f F false FALSE off OFF].freeze

  # Injection points for the app-specific parts of the persona flow. Every
  # default is a self-contained generic — the gem has no domain dependencies
  # until the app overrides a seam.
  class Config
    # Called with the freshly-resolved guest user on every join (both the
    # first join and returning visits). Must be idempotent. Defaults to a
    # no-op; the app injects its membership side effects here.
    attr_accessor :on_join

    # Builds the display nickname for a new guest when the caller supplies
    # none.
    attr_accessor :guest_nickname_generator

    # Builds the placeholder email/identifier persisted on a new guest user.
    attr_accessor :guest_email_factory

    # Registered OIDC providers by name (see Persona::Oidc for the provider
    # contract). Empty by default: register providers explicitly, including
    # the development stub — an unregistered provider can never verify.
    attr_reader :oidc_providers

    def register_oidc_provider(provider)
      @oidc_providers[provider.name] = provider
      provider
    end

    # Storage port for AccountLink — an object implementing the contract
    # documented in Persona::AccountLink. No default: consumers that enable
    # account linking must provide one backed by their own persistence.
    attr_accessor :account_link_store

    # Storage for the OIDC redirect round-trip, e.g.
    # Persona::Oidc::LinkStore.new(redis: <client or pool>). No default:
    # consumers that enable account linking must provide one.
    attr_accessor :link_store

    def initialize
      @on_join = ->(_user) {}
      @guest_nickname_generator = -> { Persona.generate_nickname }
      @guest_email_factory = -> { "agent-#{SecureRandom.hex(8)}@guest.local" }
      @oidc_providers = {}
      @account_link_store = nil
      @link_store = nil
    end
  end

  class << self
    def config
      @config ||= Config.new
    end

    def configure
      yield config
    end

    # Discards all wiring and returns to defaults. Intended for test suites.
    def reset_config!
      @config = Config.new
    end

    def generate_nickname
      "#{NICKNAME_ADJECTIVES.sample}-#{NICKNAME_NOUNS.sample}-#{SecureRandom.hex(2)}"
    end

    # Resolves a registered OIDC provider by name; unknown names raise so a
    # begin/callback for a provider the app never registered fails loudly.
    def oidc_provider(name)
      config.oidc_providers.fetch(name) do
        raise ConfigurationError, "unknown OIDC provider #{name.inspect} — " \
                                  'register it via Persona.config.register_oidc_provider'
      end
    end

    # Account linking (OIDC binding to an external IdP) is opt-in and off by
    # default — until it is enabled, no /auth/oidc routes or link mutations
    # do anything. Toggled by the PERSONA_ACCOUNT_LINKING env var.
    def account_linking_enabled?
      value = ENV.fetch('PERSONA_ACCOUNT_LINKING', nil)
      return false if value.nil? || value.empty?

      !FALSEY_ENV_VALUES.include?(value)
    end
  end
end
