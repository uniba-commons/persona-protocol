require_relative 'lib/persona/version'

Gem::Specification.new do |spec|
  # Distribution name: the flat `persona` is taken on RubyGems by an unrelated,
  # abandoned gem, so we publish under the differentiated `persona-protocol`
  # (matching the repo and the npm scope story). The require path and namespace
  # stay `require 'persona'` / `Persona::` — only the install name changes, so a
  # consumer's existing code keeps working unchanged.
  spec.name = 'persona-protocol'
  spec.version = Persona::VERSION
  spec.authors = ['UNIBA COMMONS']
  spec.email = ['haruma@uniba.jp']

  spec.summary = 'Portable anonymous identity: browser-carried personas with optional OIDC account linking'
  spec.description = 'Seams, OIDC verifier contract, and account-link decision logic for the ' \
                     'persona-protocol: start using an app with no login, carry a per-browser ' \
                     'persona, and optionally graft it onto a verified account later.'
  spec.homepage = 'https://github.com/uniba-commons/persona-protocol'
  spec.license = 'MIT'

  spec.required_ruby_version = '>= 3.1'

  spec.files = Dir['lib/**/*.rb'] + ['LICENSE']
  spec.require_paths = ['lib']

  # For the production OIDC verifier (JWKS signature verification, RS256/ES256).
  # The stub provider and the rest of the gem need no runtime dependencies.
  spec.add_dependency 'jwt', '~> 2.7'

  spec.metadata['rubygems_mfa_required'] = 'true'
end
