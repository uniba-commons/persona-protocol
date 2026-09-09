# An ActiveRecord implementation of the Persona::AccountLink storage port —
# example for a Rails consumer whose models look like:
#
#   User            the persona; User.join_as_guest! creates a guest already
#                   bound to its agent_uid and runs the app's join side
#                   effects (Persona.config.on_join among them)
#   AgentBinding    (user, agent_uid) — self-asserted, kept secret
#   AccountBinding  (user, provider, subject) — IdP-verified, safe to expose
#   UserMerge       preview / merge! service folding one persona into another
class RailsAccountLinkStore
  def holder_for(provider:, subject:)
    AccountBinding.find_by(provider: provider, subject: subject)&.user
  end

  def within_transaction(&block)
    ActiveRecord::Base.transaction(&block)
  end

  def create_guest!(agent_uid:, user_agent: nil)
    User.join_as_guest!(agent_uid, user_agent: user_agent)
  end

  def add_account_binding!(user, provider:, subject:)
    user.account_bindings.create!(provider: provider, subject: subject)
  end

  def agent_binding?(user, agent_uid:)
    user.agent_bindings.exists?(agent_uid: agent_uid)
  end

  def add_agent_binding!(user, agent_uid:, user_agent: nil)
    user.add_binding!(agent_uid: agent_uid, user_agent: user_agent)
  end

  def merge_preview(source:, target:)
    UserMerge.preview(source: source, target: target)
  end

  def merge!(source:, target:)
    UserMerge.merge!(source: source, target: target)
  end

  # --- optional revocation port (docs/spec P-20..P-23, P-24 "list") ---
  #
  # Leave these out and the store is simply a store without revocation:
  # Persona::Revocation.supported?(store) reports false and the app does not
  # offer the revoke/list moves. Implement them and the moves work with no
  # other change.

  # Named _for, not account_bindings, so the port cannot collide with the
  # association of the same name on a consumer's own store object.
  def account_bindings_for(user)
    user.account_bindings.pluck(:provider, :subject)
        .map { |provider, subject| { provider: provider, subject: subject } }
  end

  # Scoped to the user, so a binding held by another persona is reported as
  # absent (P-20 / P-25) rather than removed.
  def revoke_account_binding!(user, provider:, subject:)
    user.account_bindings.where(provider: provider, subject: subject).destroy_all.any?
  end

  def revoke_agent_binding!(user, agent_uid:)
    user.agent_bindings.where(agent_uid: agent_uid).destroy_all.any?
  end

  def agent_bindings_count(user)
    user.agent_bindings.count
  end

  # P-22a: whether a code would be accepted if presented now — unconsumed
  # (P-7) and still within its expiry (P-15). A schema without an expiry
  # column cannot answer the second half, so it answers this optimistically
  # and the preview overstates what survives.
  def redeemable_claim_code?(user)
    user.claim_codes.unconsumed.where('expires_at IS NULL OR expires_at > ?', Time.current).exists?
  end
end
