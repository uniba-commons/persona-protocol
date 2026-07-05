// Coordinates the join handshake between the Apollo error link and the
// JoinDialog React component. The link calls requestJoin() and waits on
// the returned promise; the dialog calls resolvePendingJoins() once the
// user decides. Module-level state because Apollo links live outside
// React.

type Resolver = (success: boolean) => void;

let pendingResolvers: Resolver[] = [];
let openDialogFn: (() => void) | null = null;

// Registered by the JoinDialog component on mount.
export const registerJoinDialogOpener = (fn: () => void): void => {
  openDialogFn = fn;
};

// Called by the Apollo link when a mutation receives NOT_JOINED. The
// returned promise resolves true if the user accepted (and the dialog
// completed the joinAsGuest call) or false on cancel.
export const requestJoin = (): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    pendingResolvers.push(resolve);
    openDialogFn?.();
  });
};

// Called by the JoinDialog component after the user's choice. A single
// dialog session may have queued multiple in-flight mutations — resolve
// them all at once.
export const resolvePendingJoins = (success: boolean): void => {
  const resolvers = pendingResolvers;
  pendingResolvers = [];
  resolvers.forEach((r) => r(success));
};
