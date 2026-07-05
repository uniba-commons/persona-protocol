describe Persona::Oidc::LinkStore do
  let(:redis) { FakeRedis.new }
  let(:store) { described_class.new(redis: redis) }

  describe '#put_pending / #take_pending' do
    it 'round-trips the initiating browser and provider keyed by state' do
      store.put_pending('state-1', agent_uid: 'agent-a', provider: 'example-idp')
      expect(store.take_pending('state-1')).to eq(agent_uid: 'agent-a', provider: 'example-idp')
    end

    it 'is single use: the second take returns nil' do
      store.put_pending('state-1', agent_uid: 'agent-a', provider: 'example-idp')
      store.take_pending('state-1')
      expect(store.take_pending('state-1')).to be_nil
    end

    it 'returns nil for an unknown state' do
      expect(store.take_pending('state-unknown')).to be_nil
    end

    it 'writes with the pending TTL' do
      store.put_pending('state-1', agent_uid: 'agent-a', provider: 'example-idp')
      expect(redis.ttls.values).to eq [described_class::PENDING_TTL]
    end
  end

  describe '#put_result / #peek_result / #drop_result' do
    before do
      store.put_result('token-1', provider: 'example-idp', subject: 'person-1', agent_uid: 'agent-a')
    end

    it 'peeks non-destructively so the merge confirm can re-read' do
      expected = { provider: 'example-idp', subject: 'person-1', agent_uid: 'agent-a' }
      expect(store.peek_result('token-1')).to eq expected
      expect(store.peek_result('token-1')).to eq expected
    end

    it 'drops the result on final success' do
      store.drop_result('token-1')
      expect(store.peek_result('token-1')).to be_nil
    end

    it 'writes with the result TTL' do
      expect(redis.ttls.values).to eq [described_class::RESULT_TTL]
    end
  end

  describe 'redis injection styles' do
    it 'accepts a connection pool responding to #with' do
      pooled = described_class.new(redis: FakeRedisPool.new(redis))
      pooled.put_pending('state-1', agent_uid: 'agent-a', provider: 'example-idp')
      expect(pooled.take_pending('state-1')).to eq(agent_uid: 'agent-a', provider: 'example-idp')
    end
  end

  describe '#generate_token' do
    it 'produces a url-safe token' do
      expect(store.generate_token).to match(/\A[A-Za-z0-9_-]{40,}\z/)
    end
  end
end
