// persona-core — the browser-side "anonymous identity you carry per browser"
// module: the agent_uid holder, the opt-in join handshake, and the wire
// protocol names. Transport glue (Apollo links, ActionCable param, ...)
// lives in the sibling adapter packages; this package must stay free of
// framework and transport dependencies.
export {
  AGENT_ID_HEADER,
  AGENT_ID_PARAM,
  NOT_JOINED_CODE,
  ACCOUNT_LINKING_DISABLED_CODE,
  INVALID_ACCOUNT_LINK_CODE,
  BINDING_NOT_FOUND_CODE,
} from './protocol.js';
export { getAgentId, setAgentId, generateAgentId, clearAgentId } from './agent_id.js';
export { registerJoinDialogOpener, requestJoin, resolvePendingJoins } from './join_orchestrator.js';
