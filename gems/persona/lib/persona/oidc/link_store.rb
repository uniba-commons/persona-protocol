require 'json'
require 'securerandom'

module Persona
  module Oidc
    # Short-lived Redis storage that ties the OIDC redirect round-trip to the
    # browser that started it — without ever putting the agent_uid in a URL.
    #
    #   begin            : put_pending(state, agent_uid:, provider:)
    #   /auth/oidc/callback : take_pending(state) -> {agent_uid:, provider:}
    #                                                            (single use)
    #                         put_result(link_token, ...)       hands the
    #                                                            verified subject
    #                                                            back to the app
    #   complete         : peek_result(link_token) -> {...}     (non-destructive,
    #                                                            so the merge
    #                                                            confirm can re-read)
    #                         drop_result(link_token)           on final success
    #
    # The Redis dependency is injected: pass either a raw client (responds to
    # #get / #set / #del) or a connection pool (responds to #with yielding a
    # client). Consumers register the instance via Persona.config.link_store.
    class LinkStore
      PENDING_PREFIX = 'persona:oidc:pending:'.freeze
      RESULT_PREFIX = 'persona:oidc:result:'.freeze
      PENDING_TTL = 600 # 10 min to complete the IdP round-trip
      RESULT_TTL = 300  # 5 min to finish the client-side confirm

      def initialize(redis:)
        @redis = redis
      end

      def generate_token
        SecureRandom.urlsafe_base64(32)
      end

      # provider records which registered IdP this round-trip was begun for,
      # so the callback verifies against the same provider (multi-provider
      # deployments; docs/spec §7). stash carries the provider's per-flow
      # secrets (PKCE code_verifier, nonce) from authorize to verify.
      def put_pending(state, agent_uid:, provider:, stash: nil)
        write(PENDING_PREFIX + state, { agent_uid: agent_uid, provider: provider, stash: stash }, PENDING_TTL)
      end

      # Consumes the pending entry (state is single-use, CSRF-style).
      def take_pending(state)
        take(PENDING_PREFIX + state)
      end

      def put_result(link_token, provider:, subject:, agent_uid:)
        write(
          RESULT_PREFIX + link_token,
          { provider: provider, subject: subject, agent_uid: agent_uid },
          RESULT_TTL,
        )
      end

      # Non-destructive: the merge-preview first call must leave the token
      # valid for the confirm call.
      def peek_result(link_token)
        read(RESULT_PREFIX + link_token)
      end

      def drop_result(link_token)
        with_redis { |conn| conn.del(RESULT_PREFIX + link_token) }
      end

      private

      def with_redis(&block)
        if @redis.respond_to?(:with)
          @redis.with(&block)
        else
          yield @redis
        end
      end

      def write(key, hash, ttl)
        with_redis { |conn| conn.set(key, hash.to_json, ex: ttl) }
      end

      def read(key)
        raw = with_redis { |conn| conn.get(key) }
        return nil if raw.nil?

        JSON.parse(raw, symbolize_names: true)
      end

      def take(key)
        with_redis do |conn|
          raw = conn.get(key)
          conn.del(key)
          return nil if raw.nil?

          JSON.parse(raw, symbolize_names: true)
        end
      end
    end
  end
end
