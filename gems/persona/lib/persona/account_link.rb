module Persona
  # Binds a verified OIDC identity (provider + subject) to a persona.
  #
  # Structurally the same event as redeeming a recovery code: the subject
  # identifies a "holder" — the persona already bound to it, if any — and the
  # acting browser is either adopted into that holder or has the subject
  # linked to it. When the browser is already a *different* joined persona
  # with contributions, the two are folded together via the store's merge,
  # gated by a confirmation preview.
  #
  # Callers pass the browser's agent_uid so an anonymous browser can be
  # bound; current_user (resolved from the X-Agent-Id header or the session
  # cookie, depending on transport) is the persona the browser is currently
  # acting as, or nil when still anonymous.
  #
  # All persistence goes through a storage port so the decision logic stays
  # host-agnostic. The port is an object implementing:
  #
  #   holder_for(provider:, subject:)            -> user | nil
  #   within_transaction { ... }                 atomic scope; yields
  #   create_guest!(agent_uid:, user_agent:)     -> user, already bound to
  #                                              agent_uid, with the app's
  #                                              usual join side effects run
  #   add_account_binding!(user, provider:, subject:)
  #   agent_binding?(user, agent_uid:)           -> boolean
  #   add_agent_binding!(user, agent_uid:, user_agent:)
  #   merge_preview(source:, target:)            -> opaque preview object,
  #                                              MUST NOT change data
  #   merge!(source:, target:)                   move all bindings and domain
  #                                              records from source to
  #                                              target, then retire source
  #
  # User objects are the host's own; the only requirement is a stable #id.
  # Consumers register their implementation via
  # Persona.config.account_link_store (an ActiveRecord example lives in
  # examples/ at the repository root).
  module AccountLink
    # agent_uid is set only when the browser must persist a (new) one via
    # setAgentId — i.e. the anonymous cases. merge_preview is present only
    # when confirmation is required, in which case NOTHING was changed.
    Result = Struct.new(:user, :agent_uid, :merged, :merge_preview, keyword_init: true)

    module_function

    def perform(identity:, current_user:, agent_uid:, user_agent: nil, confirm_merge: false,
                store: Persona.config.account_link_store)
      raise ConfigurationError, 'Persona.config.account_link_store is not configured — ' \
                                'provide an object implementing the AccountLink storage port' if store.nil?

      holder = holder_for(identity, store: store)

      # Conflict peek: the browser is joined as someone other than the
      # subject's current holder. Return the preview without touching data so
      # the user can still cancel; the client re-sends with confirm_merge.
      if current_user && holder && current_user.id != holder.id && !confirm_merge
        return Result.new(
          user: current_user,
          agent_uid: nil,
          merged: false,
          merge_preview: store.merge_preview(source: current_user, target: holder),
        )
      end

      store.within_transaction do
        # Subject not yet linked to any persona: bind it to the acting
        # persona, creating a fresh guest first if the browser is anonymous.
        if holder.nil?
          holder = current_user || store.create_guest!(agent_uid: agent_uid, user_agent: user_agent)
          store.add_account_binding!(holder, provider: identity.provider, subject: identity.subject)
        end

        merged = false
        if current_user && current_user.id != holder.id
          store.merge!(source: current_user, target: holder)
          merged = true
        end

        # Ensure this browser's agent_uid resolves to the holder. For a joined
        # browser that was just merged, merge! already moved its binding; for
        # an anonymous browser adopting an existing holder, add it now.
        unless store.agent_binding?(holder, agent_uid: agent_uid)
          store.add_agent_binding!(holder, agent_uid: agent_uid, user_agent: user_agent)
        end

        Result.new(
          user: holder,
          agent_uid: current_user ? nil : agent_uid,
          merged: merged,
          merge_preview: nil,
        )
      end
    end

    def holder_for(identity, store: Persona.config.account_link_store)
      store.holder_for(provider: identity.provider, subject: identity.subject)
    end
  end
end
