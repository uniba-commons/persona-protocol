// persona — the browser-side "anonymous identity you carry per browser"
// module: the agent_uid holder, the opt-in join handshake, and the transport
// glue (Apollo header link, NOT_JOINED retry link, ActionCable param) that
// carries the identity over the wire. App-agnostic; see
// doc/development/auth-removal-plan.md.
export { getAgentId, setAgentId, generateAgentId, clearAgentId } from './agent_id';
export { registerJoinDialogOpener, requestJoin, resolvePendingJoins } from './join_orchestrator';
export { createAgentIdLink, createJoinRetryLink, NOT_JOINED_CODE } from './transport';
export { appendAgentId } from './cable';
