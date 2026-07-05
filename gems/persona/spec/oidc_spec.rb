require 'rails_helper'

describe Persona::Oidc::StubVerifier do
  it 'sub からペルソナ identity を組み立てる' do
    identity = described_class.new.verify(sub: 'person_1')
    expect(identity.provider).to eq 'uniba-auth'
    expect(identity.subject).to eq 'person_1'
  end

  it 'sub が無ければ nil（検証失敗扱い）' do
    expect(described_class.new.verify({})).to be_nil
    expect(described_class.new.verify(sub: '')).to be_nil
  end
end

describe Persona, '.account_linking_enabled?' do
  around do |example|
    original = ENV.fetch('PERSONA_ACCOUNT_LINKING', nil)
    example.run
    ENV['PERSONA_ACCOUNT_LINKING'] = original
  end

  it 'PERSONA_ACCOUNT_LINKING が truthy なら true' do
    ENV['PERSONA_ACCOUNT_LINKING'] = '1'
    expect(Persona.account_linking_enabled?).to eq true
  end

  it '未設定 / falsy なら false' do
    ENV['PERSONA_ACCOUNT_LINKING'] = nil
    expect(Persona.account_linking_enabled?).to eq false
    ENV['PERSONA_ACCOUNT_LINKING'] = '0'
    expect(Persona.account_linking_enabled?).to eq false
  end
end
