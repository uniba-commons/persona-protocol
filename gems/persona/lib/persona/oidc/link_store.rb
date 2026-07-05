module Persona
  module Oidc
    # Short-lived Redis storage that ties the OIDC redirect round-trip to the
    # browser that started it — without ever putting the agent_uid in a URL.
    #
    #   beginAccountLink : put_pending(state, agent_uid)
    #   /auth/oidc/callback : take_pending(state) -> agent_uid  (single use)
    #                         put_result(link_token, ...)       hands the
    #                                                            verified subject
    #                                                            back to the app
    #   completeAccountLink : peek_result(link_token) -> {...}  (non-destructive,
    #                                                            so the merge
    #                                                            confirm can re-read)
    #                         drop_result(link_token)           on final success
    module LinkStore
      PENDING_PREFIX = 'persona:oidc:pending:'.freeze
      RESULT_PREFIX = 'persona:oidc:result:'.freeze
      PENDING_TTL = 600 # 10 min to complete the IdP round-trip
      RESULT_TTL = 300  # 5 min to finish the client-side confirm

      module_function

      def generate_token
        SecureRandom.urlsafe_base64(32)
      end

      def put_pending(state, agent_uid)
        write(PENDING_PREFIX + state, { agent_uid: agent_uid }, PENDING_TTL)
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
        RedisPool.app.with { |conn| conn.del(RESULT_PREFIX + link_token) }
      end

      def write(key, hash, ttl)
        RedisPool.app.with { |conn| conn.set(key, hash.to_json, ex: ttl) }
      end
      private_class_method :write

      def read(key)
        raw = RedisPool.app.with { |conn| conn.get(key) }
        return nil if raw.blank?

        JSON.parse(raw, symbolize_names: true)
      end
      private_class_method :read

      def take(key)
        RedisPool.app.with do |conn|
          raw = conn.get(key)
          conn.del(key)
          return nil if raw.blank?

          JSON.parse(raw, symbolize_names: true)
        end
      end
      private_class_method :take
    end
  end
end
