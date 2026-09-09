# Mirrors packages/server-core/test/revocation.test.ts so both languages pin the
# same reading of P-20..P-23.
describe Persona::Revocation do
  IDP = { provider: 'example-idp', subject: 'person-1' }.freeze
  OTHER = { provider: 'other-idp', subject: 'person-2' }.freeze

  let(:store) { FakeAccountLinkStore.new }

  # A persona with one browser and the account bindings named.
  def persona(store, agent_uid, *subjects)
    user = store.create_guest!(agent_uid: agent_uid)
    subjects.each { |s| store.add_account_binding!(user, provider: s[:provider], subject: s[:subject]) }
    user
  end

  def revoke_account(current_user, subject, confirm: false)
    described_class.perform(target: subject, current_user: current_user, confirm: confirm, store: store)
  end

  describe 'who may revoke (P-20)' do
    it 'rejects an anonymous browser as NOT_JOINED' do
      persona(store, 'agent-1', IDP)

      result = revoke_account(nil, IDP)

      expect(result.code).to eq Persona::NOT_JOINED_CODE
      expect(result.revoked).to be false
      expect(store.account_bindings.length).to eq 1
    end

    it 'reports a binding held by another persona exactly as an absent one' do
      other = persona(store, 'agent-other', IDP)
      me = persona(store, 'agent-me', OTHER)

      not_mine = revoke_account(me, IDP)
      absent = revoke_account(me, { provider: 'nobody', subject: 'nothing' })

      # Indistinguishable to the caller (P-25) — otherwise revocation is a
      # probe for bindings held by other personas.
      expect(not_mine.to_h).to eq absent.to_h
      expect(not_mine.code).to eq Persona::BINDING_NOT_FOUND_CODE
      expect(store.holder_for(provider: IDP[:provider], subject: IDP[:subject])).to eq other
    end
  end

  describe 'account bindings (P-21, P-22)' do
    it 'removes a binding that is not the last one in a single step' do
      me = persona(store, 'agent-me', IDP, OTHER)

      result = revoke_account(me, IDP)

      expect(result.revoked).to be true
      expect(result.preview).to be_nil
      expect(store.account_bindings_for(me)).to eq [{ provider: OTHER[:provider], subject: OTHER[:subject] }]
    end

    it 'previews the last binding and changes nothing until confirmed' do
      me = persona(store, 'agent-me', IDP)

      preview = revoke_account(me, IDP)

      expect(preview.revoked).to be false
      expect(preview.preview.to_h).to eq(
        last_account_binding: true,
        remaining_account_bindings: 0,
        redeemable_claim_code: false,
        remaining_agent_bindings: 1,
      )
      expect(store.account_bindings.length).to eq 1

      confirmed = revoke_account(me, IDP, confirm: true)

      expect(confirmed.revoked).to be true
      expect(store.account_bindings).to be_empty
    end

    it 'reports a redeemable claim code, so the preview does not read as stranding (P-22a)' do
      me = persona(store, 'agent-me', IDP)
      store.redeemable_claim_codes << me.id

      expect(revoke_account(me, IDP).preview.redeemable_claim_code).to be true
    end

    it 'frees the subject, so a later link is a fresh bind (P-21)' do
      me = persona(store, 'agent-me', IDP)

      revoke_account(me, IDP, confirm: true)

      expect(store.holder_for(provider: IDP[:provider], subject: IDP[:subject])).to be_nil
    end

    it 're-evaluates "is this the last one" on the call that would remove it (P-22)' do
      me = persona(store, 'agent-me', IDP, OTHER)
      # Another browser revokes the second binding while the user is deciding.
      store.revoke_account_binding!(me, provider: OTHER[:provider], subject: OTHER[:subject])

      result = revoke_account(me, IDP)

      expect(result.revoked).to be false
      expect(result.preview.last_account_binding).to be true
    end
  end

  describe 'agent bindings (P-23)' do
    def revoke_agent(current_user, agent_uid, acting:)
      described_class.perform(target: { agent_uid: agent_uid }, current_user: current_user,
                              acting_agent_uid: acting, store: store)
    end

    it "clears the credential when the acting browser revokes its own binding" do
      me = persona(store, 'agent-me', IDP)
      store.add_agent_binding!(me, agent_uid: 'agent-laptop')

      result = revoke_agent(me, 'agent-me', acting: 'agent-me')

      expect(result.revoked).to be true
      expect(result.clear_credential).to be true
      expect(store.agent_bindings_count(me)).to eq 1
    end

    it 'leaves the acting credential alone when another browser is revoked' do
      me = persona(store, 'agent-me', IDP)
      store.add_agent_binding!(me, agent_uid: 'agent-laptop')

      result = revoke_agent(me, 'agent-laptop', acting: 'agent-me')

      expect(result.revoked).to be true
      expect(result.clear_credential).to be false
    end

    it 'is single-step even when it removes the only browser' do
      me = persona(store, 'agent-me', IDP)

      result = revoke_agent(me, 'agent-me', acting: 'agent-me')

      # P-22 governs the last *account* binding; an agent binding is not it.
      expect(result.revoked).to be true
      expect(result.preview).to be_nil
    end

    it 'reports an unknown browser as BINDING_NOT_FOUND' do
      me = persona(store, 'agent-me', IDP)

      expect(revoke_agent(me, 'agent-never-seen', acting: 'agent-me').code)
        .to eq Persona::BINDING_NOT_FOUND_CODE
    end
  end

  describe 'the gem owns the ownership check (P-20)' do
    it "refuses another persona's browser even when the store forgets to scope" do
      other = persona(store, 'agent-other', IDP)
      me = persona(store, 'agent-me', OTHER)
      # A store whose delete ignores the user, the way a hand-written
      # "delete from agent_bindings where agent_uid = ?" would.
      def store.revoke_agent_binding!(_user, agent_uid:)
        before = @agent_bindings.length
        @agent_bindings.reject! { |b| b[:agent_uid] == agent_uid }
        @agent_bindings.length < before
      end

      result = described_class.perform(target: { agent_uid: 'agent-other' }, current_user: me,
                                       acting_agent_uid: 'agent-me', store: store)

      expect(result.code).to eq Persona::BINDING_NOT_FOUND_CODE
      expect(store.agent_bindings_count(other)).to eq 1
    end

    # No TypeScript counterpart: there the options union makes actingAgentUid
    # required at compile time for an agent target, so there is nothing to
    # assert at runtime.
    it 'requires acting_agent_uid on an agent revocation rather than defaulting it' do
      me = persona(store, 'agent-me', IDP)

      expect {
        described_class.perform(target: { agent_uid: 'agent-me' }, current_user: me, store: store)
      }.to raise_error(ArgumentError, /acting_agent_uid/)
    end
  end

  describe 'the last-binding decision is atomic (P-22)' do
    it 'decides and removes inside one transaction' do
      me = persona(store, 'agent-me', IDP, OTHER)
      # Reads that inform the decision must be inside the transaction, or two
      # concurrent revocations can each see a binding that is not the last and
      # together take the last one with no preview.
      seen = []
      depth = 0
      store.define_singleton_method(:within_transaction) do |&block|
        depth += 1
        begin
          block.call
        ensure
          depth -= 1
        end
      end
      store.define_singleton_method(:account_bindings_for) do |user|
        seen << (depth.positive? ? :in : :out)
        @account_bindings.select { |b| b[:user_id] == user.id }
                         .map { |b| { provider: b[:provider], subject: b[:subject] } }
      end

      revoke_account(me, IDP)

      expect(seen).to eq [:in]
    end
  end

  describe 'stores without the optional port' do
    # A store from before revocation existed: the link half only.
    let(:legacy_store) do
      Class.new(FakeAccountLinkStore) do
        undef_method(*Persona::Revocation::STORE_METHODS)
      end.new
    end

    it 'is detectable before the moves are offered' do
      expect(described_class.supported?(legacy_store)).to be false
      expect(described_class.supported?(store)).to be true
    end

    it 'names the missing methods when called anyway' do
      expect {
        described_class.perform(target: IDP, current_user: FakeAccountLinkStore::FakeUser.new(id: 1),
                                store: legacy_store)
      }.to raise_error(Persona::ConfigurationError, /revocation port.*account_bindings_for/m)
    end
  end
end
