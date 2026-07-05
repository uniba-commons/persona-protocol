describe Persona do
  describe 'wire protocol constants' do
    it 'names the header, the websocket param, and the not-joined code' do
      expect(Persona::AGENT_ID_HEADER).to eq 'X-Agent-Id'
      expect(Persona::AGENT_ID_PARAM).to eq 'agent_id'
      expect(Persona::NOT_JOINED_CODE).to eq 'NOT_JOINED'
    end
  end

  describe '.generate_nickname' do
    it 'builds an adjective-noun-hex handle' do
      expect(Persona.generate_nickname).to match(/\A[a-z]+-[a-z]+-\h{4}\z/)
    end
  end

  describe Persona::Config do
    it 'defaults every seam to a self-contained generic' do
      config = Persona::Config.new

      expect(config.on_join.call(:user)).to be_nil
      expect(config.guest_nickname_generator.call).to match(/\A[a-z]+-[a-z]+-\h{4}\z/)
      expect(config.guest_email_factory.call).to match(/\Aagent-\h{16}@guest\.local\z/)
      expect(config.oidc_providers).to eq({})
      expect(config.account_link_store).to be_nil
      expect(config.link_store).to be_nil
    end
  end

  describe '.configure / .reset_config!' do
    it 'yields the singleton config and can reset it' do
      Persona.configure { |c| c.guest_nickname_generator = -> { 'fixed' } }
      expect(Persona.config.guest_nickname_generator.call).to eq 'fixed'

      Persona.reset_config!
      expect(Persona.config.guest_nickname_generator.call).not_to eq 'fixed'
    end
  end
end
