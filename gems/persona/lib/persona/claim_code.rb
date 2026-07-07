require 'digest'
require 'securerandom'

module Persona
  # Single-use claim codes (docs/spec §6): generation, input
  # normalization, display formatting, and digest-at-rest. Codes use
  # Crockford base32 (no I, L, O, U) so they survive being read aloud or
  # typed. Storage keeps only the digest; consumption is the consumer's
  # concern (single-use, atomic — P-7).
  module ClaimCode
    ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'.freeze

    module_function

    # 16 chars ≈ 80 bits — fine for a short-lived, single-use code. Raise
    # the length for codes expected to sit unused for long periods.
    def generate(length: 16)
      Array.new(length) { ALPHABET[SecureRandom.random_number(ALPHABET.length)] }.join
    end

    # Accept a pasted code in any spacing or case.
    def normalize(input)
      input.to_s.upcase.gsub(/[^0-9A-Z]/, '')
    end

    # Group into 4-char blocks for display: "3F7K-9B2D-…".
    def format(code)
      normalize(code).scan(/.{1,4}/).join('-')
    end

    # What gets persisted instead of the code (P-7).
    def digest(code)
      Digest::SHA256.hexdigest(normalize(code))
    end
  end
end
