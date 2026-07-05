require 'json'

# Shared cross-language vectors (conformance/ at the repository root); see
# conformance/README.md for the vector formats.
CONFORMANCE_DIR = File.expand_path('../../../conformance', __dir__)

def conformance_fixture(name)
  JSON.parse(File.read(File.join(CONFORMANCE_DIR, name)), symbolize_names: true)
end

describe 'conformance: wire names' do
  let(:fixture) { conformance_fixture('wire-names.json') }

  it 'matches the exported constants' do
    expect(Persona::AGENT_ID_HEADER).to eq fixture[:agent_id_header]
    expect(Persona::AGENT_ID_PARAM).to eq fixture[:agent_id_param]
    expect(Persona::NOT_JOINED_CODE).to eq fixture[:not_joined_code]
  end
end

describe 'conformance: claim codes' do
  let(:fixture) { conformance_fixture('claim-code.json') }

  it 'normalizes pasted input' do
    fixture[:normalize].each do |vector|
      expect(Persona::ClaimCode.normalize(vector[:input])).to eq(vector[:normalized]),
        "normalize(#{vector[:input].inspect})"
    end
  end

  it 'formats for display' do
    fixture[:format].each do |vector|
      expect(Persona::ClaimCode.format(vector[:input])).to eq(vector[:formatted]),
        "format(#{vector[:input].inspect})"
    end
  end

  it 'digests the normalized code' do
    fixture[:digest].each do |vector|
      expect(Persona::ClaimCode.digest(vector[:input])).to eq(vector[:sha256_hex]),
        "digest(#{vector[:input].inspect})"
    end
  end
end

describe 'conformance: claim decision table' do
  let(:fixture) { conformance_fixture('claim-decision.json') }
  let(:identity) do
    Persona::Oidc::Identity.new(
      provider: fixture[:identity][:provider],
      subject: fixture[:identity][:subject],
    )
  end

  it 'satisfies every case' do
    fixture[:cases].each do |kase|
      store = FakeAccountLinkStore.new
      given = kase[:given]
      expected = kase[:expect]

      # Arrange the holder and the acting browser per the vector.
      holder =
        if given[:holder].is_a?(Hash)
          h = store.create_guest!(agent_uid: given[:holder][:agent_uid])
          store.add_account_binding!(h, provider: identity.provider, subject: identity.subject)
          h
        end
      current_user =
        if given[:browser] == 'joined'
          u = store.create_guest!(agent_uid: given[:agent_uid])
          if given[:holder] == 'current'
            store.add_account_binding!(u, provider: identity.provider, subject: identity.subject)
            holder = u
          end
          u
        end

      personas_before = store.users.count
      agent_bindings_before = store.agent_bindings.count
      account_bindings_before = store.account_bindings.count

      result = Persona::AccountLink.perform(
        identity: identity,
        current_user: current_user,
        agent_uid: given[:agent_uid],
        confirm_merge: given[:confirm_merge],
        store: store,
      )

      ctx = "case #{kase[:id]}"
      if expected.key?(:personas_delta)
        expect(store.users.count - personas_before).to eq(expected[:personas_delta]), "#{ctx}: personas_delta"
      end
      if expected.key?(:result_user)
        case expected[:result_user]
        when 'current' then expect(result.user.id).to eq(current_user.id), "#{ctx}: result_user=current"
        when 'holder' then expect(result.user.id).to eq(holder.id), "#{ctx}: result_user=holder"
        when 'new'
          expect(result.user.id).not_to eq(current_user&.id), "#{ctx}: result_user=new"
          expect(result.user.id).not_to eq(holder&.id), "#{ctx}: result_user=new"
        end
      end
      if expected.key?(:subject_holder)
        subject_holder = store.holder_for(provider: identity.provider, subject: identity.subject)
        target =
          case expected[:subject_holder]
          when 'result' then result.user
          when 'current' then current_user
          when 'holder' then holder
          end
        expect(subject_holder.id).to eq(target.id), "#{ctx}: subject_holder"
      end
      if expected.key?(:result_has_agent_binding)
        expect(store.agent_binding?(result.user, agent_uid: given[:agent_uid]))
          .to eq(expected[:result_has_agent_binding]), "#{ctx}: result_has_agent_binding"
      end
      if expected.key?(:agent_bindings_delta)
        expect(store.agent_bindings.count - agent_bindings_before)
          .to eq(expected[:agent_bindings_delta]), "#{ctx}: agent_bindings_delta"
      end
      if expected.key?(:account_bindings_delta)
        expect(store.account_bindings.count - account_bindings_before)
          .to eq(expected[:account_bindings_delta]), "#{ctx}: account_bindings_delta"
      end
      expect(result.merged).to eq(expected[:merged]), "#{ctx}: merged" if expected.key?(:merged)
      if expected.key?(:merge_preview)
        expect(!result.merge_preview.nil?).to eq(expected[:merge_preview]), "#{ctx}: merge_preview"
      end
      if expected.key?(:echoed_agent_uid)
        expect(result.agent_uid).to eq(expected[:echoed_agent_uid]), "#{ctx}: echoed_agent_uid"
      end
      if expected.key?(:current_retired)
        expect(store.user(current_user.id).nil?).to eq(expected[:current_retired]), "#{ctx}: current_retired"
      end
      if expected[:browser_binding_moved_to_holder]
        expect(store.user_for_agent(given[:agent_uid]).id).to eq(holder.id),
          "#{ctx}: browser_binding_moved_to_holder"
      end
    end
  end
end
