module Persona
  # Revocation (docs/spec P-20..P-23) and the read behind it (P-24 "list").
  #
  # The two things a persona can revoke are different operations: dropping an
  # account binding leaves the browser joined, while dropping an agent binding
  # removes one browser's access and, for the acting browser, ends with its
  # credential discarded (P-23).
  #
  # Revocation extends the AccountLink storage port with an optional half. A
  # store implementing it gains the moves; one that does not is simply a store
  # without revocation — ask Revocation.supported?(store) before offering them,
  # rather than discovering it at request time. The optional methods are:
  #
  #   account_bindings_for(user)                   -> [{ provider:, subject: }]
  #   revoke_account_binding!(user, provider:, subject:) -> boolean
  #   revoke_agent_binding!(user, agent_uid:)      -> boolean
  #   agent_bindings_count(user)                   -> Integer
  #   outstanding_claim_code?(user)                -> boolean
  #
  # The two revoke_* methods return false when the persona holds no such
  # binding, which is also the answer when it belongs to someone else (P-25).
  module Revocation
    STORE_METHODS = %i[
      account_bindings_for
      revoke_account_binding!
      revoke_agent_binding!
      agent_bindings_count
      outstanding_claim_code?
    ].freeze

    # What P-22a requires the preview to state: the recovery routes that
    # survive the removal.
    Preview = Struct.new(:last_account_binding, :remaining_account_bindings,
                         :outstanding_claim_code, :remaining_agent_bindings,
                         keyword_init: true)

    # preview is present only when confirmation is required, in which case
    # NOTHING was changed. code is a protocol state (P-25) or nil on success.
    # clear_credential is P-23: the acting browser's own binding went, so its
    # stored credential must be discarded.
    Result = Struct.new(:revoked, :preview, :code, :clear_credential, keyword_init: true)

    module_function

    # Whether this store implements the optional revocation port.
    def supported?(store)
      !store.nil? && STORE_METHODS.all? { |m| store.respond_to?(m) }
    end

    # Removes one binding from the acting persona.
    #
    # Only the persona that holds a binding can revoke it (P-20), so every
    # decision here is scoped to current_user: a binding held by someone else
    # is indistinguishable from one that does not exist (P-25). Revoking the
    # last account binding is two-step (P-22) — the first call returns a
    # preview and changes nothing, the caller re-sends with confirm: true.
    #
    # "Is this the last one" is evaluated on the call that would remove it,
    # not carried over from an earlier response, which is the re-evaluation
    # P-22 asks for: a binding that became the last one while the user was
    # deciding gets a preview rather than a silent removal.
    #
    # target is either { provider:, subject: } for an account binding or
    # { agent_uid: } for an agent binding. acting_agent_uid is the agent_uid
    # the request arrived on, so an agent revocation can tell whether it
    # removed the acting browser's own access.
    def perform(target:, current_user:, acting_agent_uid: nil, confirm: false,
                store: Persona.config.account_link_store)
      # P-8: identity decisions happen on credentialed requests. An anonymous
      # browser has no persona whose bindings it could revoke.
      return Result.new(revoked: false, preview: nil, code: NOT_JOINED_CODE,
                        clear_credential: false) if current_user.nil?

      store = require_store!(store)

      if target[:agent_uid]
        return revoke_agent(target[:agent_uid], current_user, acting_agent_uid, store)
      end

      revoke_account(target.fetch(:provider), target.fetch(:subject), current_user, confirm, store)
    end

    # --- internals ---

    def require_store!(store)
      return store if supported?(store)

      missing = store.nil? ? STORE_METHODS : STORE_METHODS.reject { |m| store.respond_to?(m) }
      raise ConfigurationError,
            'this store does not implement the revocation port ' \
            "(missing: #{missing.join(', ')}). Call Persona::Revocation.supported?(store) " \
            'before offering the revoke/list moves'
    end

    # P-23's counterpart to an account revocation: removes one browser's
    # access, and is single-step — P-22 governs the last *account* binding.
    def revoke_agent(agent_uid, current_user, acting_agent_uid, store)
      removed = store.within_transaction do
        store.revoke_agent_binding!(current_user, agent_uid: agent_uid)
      end
      return not_found unless removed

      Result.new(revoked: true, preview: nil, code: nil,
                 clear_credential: acting_agent_uid == agent_uid)
    end

    def revoke_account(provider, subject, current_user, confirm, store)
      bindings = store.account_bindings_for(current_user)
      held = bindings.any? { |b| b[:provider] == provider && b[:subject] == subject }
      return not_found unless held

      remaining = bindings.length - 1
      if remaining.zero? && !confirm
        return Result.new(revoked: false, code: nil, clear_credential: false,
                          preview: preview_for(store, current_user, remaining))
      end

      removed = store.within_transaction do
        store.revoke_account_binding!(current_user, provider: provider, subject: subject)
      end
      return not_found unless removed

      Result.new(revoked: true, preview: nil, code: nil, clear_credential: false)
    end

    def preview_for(store, user, remaining)
      Preview.new(
        last_account_binding: remaining.zero?,
        remaining_account_bindings: remaining,
        outstanding_claim_code: store.outstanding_claim_code?(user),
        remaining_agent_bindings: store.agent_bindings_count(user),
      )
    end

    def not_found
      Result.new(revoked: false, preview: nil, code: BINDING_NOT_FOUND_CODE, clear_credential: false)
    end
  end
end
