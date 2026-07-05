describe Persona::ClaimCode do
  describe '.generate' do
    it 'emits Crockford base32 of the requested length' do
      code = described_class.generate
      expect(code).to match(/\A[0-9A-HJKMNP-TV-Z]{16}\z/)
      expect(described_class.generate(length: 24).length).to eq 24
    end

    it 'never emits the ambiguous letters I, L, O, U' do
      50.times { expect(described_class.generate).not_to match(/[ILOU]/) }
    end
  end

  it 'round-trips generate → format → normalize → digest' do
    code = described_class.generate
    shown = described_class.format(code)
    expect(described_class.normalize(shown)).to eq code
    expect(described_class.digest(shown)).to eq described_class.digest(code)
  end
end
