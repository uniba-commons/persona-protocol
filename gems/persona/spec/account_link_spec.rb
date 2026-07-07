describe Persona::AccountLink do
  let(:store) { FakeAccountLinkStore.new }
  let(:identity) { Persona::Oidc::Identity.new(provider: 'example-idp', subject: 'person-1') }

  def perform(current_user:, agent_uid:, confirm_merge: false)
    described_class.perform(
      identity: identity, current_user: current_user, agent_uid: agent_uid,
      confirm_merge: confirm_merge, store: store,
    )
  end

  def bind_account(user, provider: 'example-idp', subject: 'person-1')
    store.add_account_binding!(user, provider: provider, subject: subject)
  end

  describe '.perform' do
    it 'raises ConfigurationError when no store is configured' do
      expect {
        described_class.perform(identity: identity, current_user: nil, agent_uid: 'agent-a')
      }.to raise_error(Persona::ConfigurationError, /account_link_store/)
    end

    context 'with an anonymous browser (no current_user)' do
      context 'when the subject has no holder yet' do
        it 'creates a guest bound to both the subject and the agent_uid (sign-up)' do
          result = nil
          expect {
            result = perform(current_user: nil, agent_uid: 'agent-new')
          }.to change { store.users.count }.by(1)

          expect(store.holder_for(provider: 'example-idp', subject: 'person-1').id).to eq result.user.id
          expect(store.agent_binding?(result.user, agent_uid: 'agent-new')).to be true
          expect(result.agent_uid).to eq 'agent-new'
          expect(result.merged).to eq false
          expect(result.merge_preview).to be_nil
        end
      end

      context 'when the subject already has a holder' do
        it "adopts the holder and adds this browser's agent_uid (restore from another browser)" do
          holder = store.create_guest!(agent_uid: 'agent-holder')
          bind_account(holder)

          result = nil
          expect {
            result = perform(current_user: nil, agent_uid: 'agent-second')
          }.not_to(change { store.users.count })

          expect(result.user.id).to eq holder.id
          expect(store.agent_binding?(holder, agent_uid: 'agent-second')).to be true
          expect(result.agent_uid).to eq 'agent-second'
          expect(result.merged).to eq false
        end
      end
    end

    context 'with a joined browser (current_user = Y)' do
      let(:current_user) { store.create_guest!(agent_uid: 'agent-y') }

      context 'when the subject is not yet bound to anyone' do
        it 'links the account to the acting persona (no merge, no agent_uid echo)' do
          result = perform(current_user: current_user, agent_uid: 'agent-y')

          expect(result.user.id).to eq current_user.id
          expect(store.holder_for(provider: 'example-idp', subject: 'person-1').id).to eq current_user.id
          expect(result.merged).to eq false
          expect(result.agent_uid).to be_nil
        end
      end

      context 'when the subject is already bound to the acting persona' do
        it 'is an idempotent no-op (no duplicate binding)' do
          bind_account(current_user)

          expect {
            result = perform(current_user: current_user, agent_uid: 'agent-y')
            expect(result.user.id).to eq current_user.id
            expect(result.merged).to eq false
          }.not_to(change { store.account_bindings.count })
        end
      end

      context 'when the subject is bound to a different persona X (conflict)' do
        let!(:holder) do
          x = store.create_guest!(agent_uid: 'agent-x')
          bind_account(x)
          x
        end

        it 'returns a preview and changes nothing without confirm_merge' do
          current_user # force creation before measuring, so the count reflects only .perform
          result = nil
          expect {
            result = perform(current_user: current_user, agent_uid: 'agent-y')
          }.not_to(change { store.agent_bindings.count })

          expect(result.merge_preview).not_to be_nil
          expect(result.merge_preview.target_id).to eq holder.id
          expect(result.merged).to eq false
          # Y is still alive, and X gained no bindings.
          expect(store.user(current_user.id)).not_to be_nil
        end

        it 'with confirm_merge: true folds Y into X, and the browser now points at X' do
          result = perform(current_user: current_user, agent_uid: 'agent-y', confirm_merge: true)

          expect(result.merged).to eq true
          expect(result.user.id).to eq holder.id
          # Y has been retired.
          expect(store.user(current_user.id)).to be_nil
          # This browser's agent_uid has moved over to X.
          expect(store.user_for_agent('agent-y').id).to eq holder.id
          # The subject's binding stays on X.
          expect(store.holder_for(provider: 'example-idp', subject: 'person-1').id).to eq holder.id
        end
      end
    end
  end

  describe '.holder_for' do
    it 'resolves the persona bound to the identity through the store' do
      holder = store.create_guest!(agent_uid: 'agent-holder')
      bind_account(holder)

      expect(described_class.holder_for(identity, store: store).id).to eq holder.id
    end

    it 'returns nil for an unbound identity' do
      expect(described_class.holder_for(identity, store: store)).to be_nil
    end
  end
end
