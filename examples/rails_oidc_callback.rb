# The redirect half of account linking — example for a Rails consumer on the
# header profile. The third piece next to rails-initializer.rb and
# rails_account_link_store.rb.
#
# The gem covers the decisions — verify the IdP's answer, then run the claim
# table. What stays with the application is the pair of endpoints the browser
# and the IdP actually visit, and that is what this shows. Two rules shape the
# whole controller:
#
#   P-14  only opaque, short-lived tokens may appear in URLs. The agent_uid,
#         the persona id and the subject never do.
#   P-8   identity decisions happen on credentialed requests. The callback
#         arrives from the IdP without the browser's credential, so it parks
#         its result and redirects; the browser then completes on a request
#         of its own.
#
# Routes:
#
#   get  '/auth/oidc/:provider'          => 'oidc#create'
#   get  '/auth/oidc/:provider/callback' => 'oidc#callback'
#   post '/auth/oidc/complete'           => 'oidc#complete'
class OidcController < ApplicationController
  # begin — a credentialed request naming a registered provider (P-24).
  def create
    return render_code(Persona::ACCOUNT_LINKING_DISABLED_CODE, :not_found) unless linking_available?
    return render_code(Persona::NOT_JOINED_CODE, :unauthorized) if agent_uid.blank?

    provider = Persona.oidc_provider(params[:provider])
    state = link_store.generate_token
    start = provider.authorize(state)

    # state -> (this browser, this provider), server-side and single-use
    # (P-15). Keeping the agent_uid here rather than in the URL is what lets
    # the round-trip stay tied to one browser without exposing the credential
    # (P-3, P-14); stash carries the provider's per-flow secrets (PKCE
    # verifier, nonce) through to verify.
    link_store.put_pending(state, agent_uid: agent_uid, provider: params[:provider], stash: start.stash)
    redirect_to start.url, allow_other_host: true
  end

  # callback — arrives from the IdP. Consumes the state once, verifies, and
  # hands the browser back into the app with only an opaque link_token.
  def callback
    pending = link_store.take_pending(params[:state])
    return render_code(Persona::INVALID_ACCOUNT_LINK_CODE, :unprocessable_entity) if pending.nil?

    provider = Persona.oidc_provider(pending[:provider])
    identity = provider.verify(request.query_parameters, pending[:stash])
    return render_code(Persona::INVALID_ACCOUNT_LINK_CODE, :unprocessable_entity) if identity.nil?

    link_token = link_store.generate_token
    link_store.put_result(
      link_token,
      provider: identity.provider,
      subject: identity.subject,
      agent_uid: pending[:agent_uid],
    )
    redirect_to settings_account_path(link: link_token)
  end

  # complete — a credentialed request presenting the link_token. Reading it is
  # non-destructive because a merge preview may need a second pass (P-6); the
  # token is dropped on final success (P-15).
  def complete
    result_data = link_store.peek_result(params[:link_token])
    return render_code(Persona::INVALID_ACCOUNT_LINK_CODE, :unprocessable_entity) if result_data.nil?

    # The browser finishing the flow must be the one that began it. Without
    # this the link_token alone would complete the round-trip, and a token
    # that leaked from the redirect URL would be enough to graft someone
    # else's verified identity onto this browser's persona.
    return render_code(Persona::INVALID_ACCOUNT_LINK_CODE, :unprocessable_entity) \
      unless result_data[:agent_uid] == agent_uid

    result = Persona::AccountLink.perform(
      identity: Persona::Oidc::Identity.new(
        provider: result_data[:provider],
        subject: result_data[:subject],
      ),
      current_user: current_user,
      agent_uid: agent_uid,
      confirm_merge: params[:confirm].present?,
    )

    # A preview means nothing was changed (P-6). Show it and come back with
    # confirm; the link_token is deliberately still valid.
    return render(json: { merge_preview: result.merge_preview }) if result.merge_preview

    link_store.drop_result(params[:link_token])
    # result.agent_uid is non-nil only when an anonymous browser just acquired
    # a persona — the one moment the credential may be echoed (P-3 / H-3).
    render json: { linked: true, agent_uid: result.agent_uid }
  end

  private

  def link_store
    Persona.config.link_store
  end

  def agent_uid
    request.headers[Persona::AGENT_ID_HEADER]
  end

  def linking_available?
    Persona.account_linking_enabled? && Persona.config.oidc_providers.any?
  end

  # The link flow's protocol states (P-25). Names, not transports — this app
  # carries them as JSON error codes; a GraphQL consumer would put the same
  # names in an extension, and a server-rendered one in a flash.
  def render_code(code, status)
    render json: { code: code }, status: status
  end
end
