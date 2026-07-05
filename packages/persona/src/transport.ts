import { ApolloLink, Observable, type Operation, fromPromise } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { getAgentId } from './agent_id';
import { requestJoin } from './join_orchestrator';

// HTTP header carrying the browser's agent_uid. Kept here so the persona
// module owns its wire protocol; the server reads the same name.
const AGENT_ID_HEADER = 'X-Agent-Id';

// GraphQL extension code the server raises when a mutation is attempted by a
// visitor who hasn't opted in yet. A normal opt-in handshake signal, not an
// exception worth surfacing (e.g. to Sentry).
export const NOT_JOINED_CODE = 'NOT_JOINED';

// Attaches the browser's agent_uid as the X-Agent-Id header when the visitor
// has joined. Read-only visitors carry no id and stay anonymous.
export const createAgentIdLink = (): ApolloLink =>
  new ApolloLink((operation, forward) => {
    const agentId = getAgentId();
    if (agentId) {
      operation.setContext(({ headers = {} }) => ({
        headers: {
          ...headers,
          [AGENT_ID_HEADER]: agentId
        }
      }));
    }
    return forward(operation);
  });

const isMutation = (operation: Operation): boolean =>
  operation.query.definitions.some((d: any) => d.kind === 'OperationDefinition' && d.operation === 'mutation');

// On NOT_JOINED for a mutation, pause and open the join dialog. If the user
// joins, retry the original operation transparently; if they cancel, surface
// the original error so the caller can no-op.
export const createJoinRetryLink = (): ApolloLink =>
  onError(({ graphQLErrors, operation, forward }) => {
    if (!graphQLErrors) return;
    const notJoined = graphQLErrors.find((e) => e.extensions?.code === NOT_JOINED_CODE);
    if (!notJoined) return;
    if (!isMutation(operation)) return;

    return fromPromise(requestJoin()).flatMap((didJoin) => {
      if (!didJoin) {
        return new Observable<any>((observer) => {
          observer.next({ data: null, errors: [notJoined] });
          observer.complete();
        });
      }
      return forward(operation);
    });
  });
