describe Persona::Oidc::StubVerifier do
  it 'builds a persona identity from the sub param' do
    identity = described_class.new.verify(sub: 'person_1')
    expect(identity.provider).to eq 'uniba-auth'
    expect(identity.subject).to eq 'person_1'
  end

  it 'returns nil (verification failure) when sub is missing' do
    expect(described_class.new.verify({})).to be_nil
    expect(described_class.new.verify(sub: '')).to be_nil
  end
end

describe Persona::Oidc, '.authorize_url' do
  it 'escapes the state into the local authorize path' do
    expect(described_class.authorize_url(state: 'a b&c')).to eq '/auth/oidc/start?state=a+b%26c'
  end
end

describe Persona, '.account_linking_enabled?' do
  around do |example|
    original = ENV.fetch('PERSONA_ACCOUNT_LINKING', nil)
    example.run
    ENV['PERSONA_ACCOUNT_LINKING'] = original
  end

  it 'is true when PERSONA_ACCOUNT_LINKING is truthy' do
    ENV['PERSONA_ACCOUNT_LINKING'] = '1'
    expect(Persona.account_linking_enabled?).to eq true
    ENV['PERSONA_ACCOUNT_LINKING'] = 'true'
    expect(Persona.account_linking_enabled?).to eq true
  end

  it 'is false when unset, empty, or falsy' do
    ENV['PERSONA_ACCOUNT_LINKING'] = nil
    expect(Persona.account_linking_enabled?).to eq false
    ENV['PERSONA_ACCOUNT_LINKING'] = ''
    expect(Persona.account_linking_enabled?).to eq false
    ENV['PERSONA_ACCOUNT_LINKING'] = '0'
    expect(Persona.account_linking_enabled?).to eq false
    ENV['PERSONA_ACCOUNT_LINKING'] = 'false'
    expect(Persona.account_linking_enabled?).to eq false
    ENV['PERSONA_ACCOUNT_LINKING'] = 'off'
    expect(Persona.account_linking_enabled?).to eq false
  end
end
