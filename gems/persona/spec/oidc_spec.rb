describe Persona::Oidc::StubProvider do
  it 'builds a persona identity from the sub param' do
    identity = described_class.new.verify(sub: 'person_1')
    expect(identity.provider).to eq 'stub'
    expect(identity.subject).to eq 'person_1'
  end

  it 'returns nil (verification failure) when sub is missing' do
    expect(described_class.new.verify({})).to be_nil
    expect(described_class.new.verify(sub: '')).to be_nil
  end

  it 'can impersonate a named provider for local development' do
    identity = described_class.new(name: 'example-idp').verify(sub: 'person_1')
    expect(identity.provider).to eq 'example-idp'
  end

  it 'escapes the state into its authorize URL (with no stash)' do
    start = described_class.new.authorize('a b&c')
    expect(start.url).to eq '/auth/oidc/start?state=a+b%26c'
    expect(start.stash).to be_nil
  end
end

describe Persona, 'OIDC provider registry' do
  it 'resolves providers by name' do
    provider = Persona.config.register_oidc_provider(Persona::Oidc::StubProvider.new(name: 'example-idp'))
    expect(Persona.oidc_provider('example-idp')).to be provider
  end

  it 'raises ConfigurationError for a provider that was never registered' do
    expect { Persona.oidc_provider('google') }
      .to raise_error(Persona::ConfigurationError, /register_oidc_provider/)
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
