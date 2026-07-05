require 'rails_helper'

describe Persona::AccountLink do
  let(:identity) { Persona::Oidc::Identity.new(provider: 'uniba-auth', subject: 'person-1') }

  def bind_account(user, subject: 'person-1', provider: 'uniba-auth')
    user.account_bindings.create!(provider: provider, subject: subject)
  end

  describe '.perform' do
    context '匿名ブラウザ（current_user なし）' do
      context 'その subject の holder がまだ居ないとき' do
        it 'ゲストを新規作成して subject と agent_uid を紐づける（サインアップ）' do
          result = nil
          expect {
            result = described_class.perform(identity: identity, current_user: nil, agent_uid: 'agent-new')
          }.to change { User.unscoped.count }.by(1)

          expect(result.user.account_bindings.find_by(provider: 'uniba-auth', subject: 'person-1')).to be_present
          expect(result.user.agent_bindings.find_by(agent_uid: 'agent-new')).to be_present
          expect(result.agent_uid).to eq 'agent-new'
          expect(result.merged).to eq false
          expect(result.merge_preview).to be_nil
        end
      end

      context 'その subject の holder が既に居るとき' do
        it 'holder を採用し、このブラウザの agent_uid を holder に足す（別ブラウザからの復元）' do
          holder = User.join_as_guest!('agent-holder')
          bind_account(holder)

          result = nil
          expect {
            result = described_class.perform(identity: identity, current_user: nil, agent_uid: 'agent-second')
          }.not_to(change { User.unscoped.count })

          expect(result.user.id).to eq holder.id
          expect(holder.agent_bindings.find_by(agent_uid: 'agent-second')).to be_present
          expect(result.agent_uid).to eq 'agent-second'
          expect(result.merged).to eq false
        end
      end
    end

    context '参加済みブラウザ（current_user = Y）' do
      let(:current_user) { User.join_as_guest!('agent-y') }

      context 'その subject がまだ誰にも紐づいていないとき' do
        it '現ペルソナにアカウントをリンクする（merge なし・agent_uid 変更なし）' do
          result = described_class.perform(identity: identity, current_user: current_user, agent_uid: 'agent-y')

          expect(result.user.id).to eq current_user.id
          expect(current_user.account_bindings.find_by(subject: 'person-1')).to be_present
          expect(result.merged).to eq false
          expect(result.agent_uid).to be_nil
        end
      end

      context 'その subject が既に自分に紐づいているとき' do
        it '冪等に no-op（binding は重複しない）' do
          bind_account(current_user)

          expect {
            result = described_class.perform(identity: identity, current_user: current_user, agent_uid: 'agent-y')
            expect(result.user.id).to eq current_user.id
            expect(result.merged).to eq false
          }.not_to(change { AccountBinding.count })
        end
      end

      context 'その subject が別ペルソナ X に紐づいているとき（衝突）' do
        let!(:holder) do
          x = User.join_as_guest!('agent-x')
          bind_account(x)
          x
        end

        it 'confirm_merge なしでは preview を返し、何も変更しない' do
          current_user # force creation before measuring, so the count reflects only .perform
          result = nil
          expect {
            result = described_class.perform(identity: identity, current_user: current_user, agent_uid: 'agent-y')
          }.not_to(change { AgentBinding.count })

          expect(result.merge_preview).to be_present
          expect(result.merge_preview.target_username).to eq holder.username
          expect(result.merged).to eq false
          # Y はまだ生きているし、X の binding も増えていない
          expect(User.find_by(id: current_user.id)).to be_present
        end

        it 'confirm_merge: true で Y を X に統合し、ブラウザは X を指すようになる' do
          create(:agenda, creator: current_user, in_container: create(:meeting))

          result = described_class.perform(
            identity: identity, current_user: current_user, agent_uid: 'agent-y', confirm_merge: true,
          )

          expect(result.merged).to eq true
          expect(result.user.id).to eq holder.id
          # Y は discard 済み
          expect(User.find_by(id: current_user.id)).to be_nil
          # このブラウザの agent_uid は X に移っている
          expect(AgentBinding.find_by(agent_uid: 'agent-y')&.user_id).to eq holder.id
          # subject の binding は X 側に残る
          expect(holder.account_bindings.find_by(subject: 'person-1')).to be_present
        end
      end
    end
  end
end
