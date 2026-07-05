module Persona
  # Binds a verified OIDC identity (provider + subject) to a persona.
  #
  # Structurally the same event as redeeming a recovery code
  # (Mutations::ClaimRecoveryCode): the subject identifies a "holder" — the
  # persona already bound to it, if any — and the acting browser is either
  # adopted into that holder or has the subject linked to it. When the
  # browser is already a *different* joined persona with contributions, the
  # two are folded together via UserMerge, gated by a confirmation preview.
  #
  # Callers pass the browser's agent_uid (as claimRecoveryCode does) so an
  # anonymous browser can be bound; current_user (resolved from the
  # X-Agent-Id header) is the persona the browser is currently acting as, or
  # nil when still anonymous.
  #
  # See doc/development/auth-removal-plan.md and Issue #17.
  module AccountLink
    # agent_uid is set only when the browser must persist a (new) one via
    # setAgentId — i.e. the anonymous cases. merge_preview is present only
    # when confirmation is required, in which case NOTHING was changed.
    Result = Struct.new(:user, :agent_uid, :merged, :merge_preview, keyword_init: true)

    module_function

    def perform(identity:, current_user:, agent_uid:, user_agent: nil, confirm_merge: false)
      holder = holder_for(identity)

      # Conflict peek: the browser is joined as someone other than the
      # subject's current holder. Return the preview without touching data so
      # the user can still cancel; the client re-sends with confirm_merge.
      if current_user && holder && current_user.id != holder.id && !confirm_merge
        return Result.new(
          user: current_user,
          agent_uid: nil,
          merged: false,
          merge_preview: ::UserMerge.preview(source: current_user, target: holder),
        )
      end

      ActiveRecord::Base.transaction do
        # Subject not yet linked to any persona: bind it to the acting
        # persona, creating a fresh guest first if the browser is anonymous.
        if holder.nil?
          holder = current_user || ::User.join_as_guest!(agent_uid, user_agent: user_agent)
          holder.account_bindings.create!(provider: identity.provider, subject: identity.subject)
        end

        merged = false
        if current_user && current_user.id != holder.id
          ::UserMerge.merge!(source: current_user, target: holder)
          merged = true
        end

        # Ensure this browser's agent_uid resolves to the holder. For a joined
        # browser that was just merged, merge! already moved its binding; for
        # an anonymous browser adopting an existing holder, add it now.
        unless holder.agent_bindings.exists?(agent_uid: agent_uid)
          holder.add_binding!(agent_uid: agent_uid, user_agent: user_agent)
        end

        Result.new(
          user: holder,
          agent_uid: current_user ? nil : agent_uid,
          merged: merged,
          merge_preview: nil,
        )
      end
    end

    def holder_for(identity)
      ::AccountBinding.find_by(provider: identity.provider, subject: identity.subject)&.user
    end
  end
end
