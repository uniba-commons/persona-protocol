import { getAgentId } from './agent_id';

// ActionCable can't set custom headers, so the browser's agent_uid rides as a
// query param on the cable URL instead. Appends &agent_id=... when the visitor
// has joined; anonymous visitors connect without it and receive updates as a
// nil user. The caller supplies a base URL that already carries its own query
// string (e.g. `/cable?session_id=...`).
export const appendAgentId = (baseUrl: string): string => {
  const agentId = getAgentId();
  return agentId ? `${baseUrl}&agent_id=${encodeURIComponent(agentId)}` : baseUrl;
};
