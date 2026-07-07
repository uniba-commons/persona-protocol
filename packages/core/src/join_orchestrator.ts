// Coordinates the join handshake between the transport (which sees the
// NOT_JOINED signal) and the app's join UI. The transport calls
// requestJoin() and waits on the returned promise; the UI calls
// resolvePendingJoins() once the user decides. Module-level state because
// transports live outside any UI framework — e.g. an Apollo link outside
// the React tree.

type Resolver = (success: boolean) => void;

let pendingResolvers: Resolver[] = [];
let openDialogFn: (() => void) | null = null;

// Registered by the app's join UI when it becomes available (e.g. on mount).
export const registerJoinDialogOpener = (fn: () => void): void => {
  openDialogFn = fn;
};

// Called by the transport when a write receives NOT_JOINED. The returned
// promise resolves true if the user accepted (and the join UI completed the
// join call) or false on cancel.
export const requestJoin = (): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    pendingResolvers.push(resolve);
    openDialogFn?.();
  });
};

// Called by the join UI after the user's choice. A single dialog session may
// have queued multiple in-flight writes — resolve them all at once.
export const resolvePendingJoins = (success: boolean): void => {
  const resolvers = pendingResolvers;
  pendingResolvers = [];
  resolvers.forEach((r) => r(success));
};
