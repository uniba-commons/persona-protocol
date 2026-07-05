import { ApolloLink, Observable, type Operation, fromPromise } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { AGENT_ID_HEADER, NOT_JOINED_CODE, getAgentId, requestJoin } from '@uniba-commons/persona-core';

// Apollo transport adapter for persona-kit: carries the agent_uid as the
// X-Agent-Id header and drives the join handshake off the NOT_JOINED
// GraphQL extension code. The names themselves live in persona-core —
// this package only owns their GraphQL/Apollo carriage.

export { NOT_JOINED_CODE };

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
