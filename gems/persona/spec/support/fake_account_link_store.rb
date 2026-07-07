# In-memory implementation of the Persona::AccountLink storage port, used to
# exercise the decision logic without a database. Mirrors the semantics the
# port documents: create_guest! returns a persona already bound to its
# agent_uid; merge! moves every binding from source to target and retires the
# source persona.
class FakeAccountLinkStore
  FakeUser = Struct.new(:id, keyword_init: true)
  MergePreview = Struct.new(:source_id, :target_id, keyword_init: true)

  attr_reader :users, :account_bindings, :agent_bindings

  def initialize
    @next_id = 0
    @users = []
    @account_bindings = [] # { user_id:, provider:, subject: }
    @agent_bindings = []   # { user_id:, agent_uid:, user_agent: }
  end

  def holder_for(provider:, subject:)
    binding = @account_bindings.find { |b| b[:provider] == provider && b[:subject] == subject }
    binding && user(binding[:user_id])
  end

  def within_transaction
    yield
  end

  def create_guest!(agent_uid:, user_agent: nil)
    guest = FakeUser.new(id: (@next_id += 1))
    @users << guest
    @agent_bindings << { user_id: guest.id, agent_uid: agent_uid, user_agent: user_agent }
    guest
  end

  def add_account_binding!(user, provider:, subject:)
    @account_bindings << { user_id: user.id, provider: provider, subject: subject }
  end

  def agent_binding?(user, agent_uid:)
    @agent_bindings.any? { |b| b[:user_id] == user.id && b[:agent_uid] == agent_uid }
  end

  def add_agent_binding!(user, agent_uid:, user_agent: nil)
    @agent_bindings << { user_id: user.id, agent_uid: agent_uid, user_agent: user_agent }
  end

  def merge_preview(source:, target:)
    MergePreview.new(source_id: source.id, target_id: target.id)
  end

  def merge!(source:, target:)
    @agent_bindings.each { |b| b[:user_id] = target.id if b[:user_id] == source.id }
    @account_bindings.each { |b| b[:user_id] = target.id if b[:user_id] == source.id }
    @users.delete_if { |u| u.id == source.id }
  end

  # Spec helpers (not part of the port).

  def user(id)
    @users.find { |u| u.id == id }
  end

  def user_for_agent(agent_uid)
    binding = @agent_bindings.find { |b| b[:agent_uid] == agent_uid }
    binding && user(binding[:user_id])
  end
end
