# An ActiveRecord implementation of the Persona::AccountLink storage port —
# example for a Rails consumer, equivalent to the inline model calls
# Persona::AccountLink made before the extraction (another-sgms branch
# sgms-17). The host models are:
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
end
