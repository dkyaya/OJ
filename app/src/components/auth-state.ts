type AuthSession<User> = { user: User };
type AuthSubscription = { data: { subscription: { unsubscribe(): void } } };

export type AuthObserver<User, Event extends string> = {
  getUser(): Promise<{ data: { user: User | null } }>;
  onAuthStateChange(callback: (event: Event, session: AuthSession<User> | null) => void): AuthSubscription;
};

export function observeAuthState<User, Event extends string>(
  auth: AuthObserver<User, Event> | undefined,
  onState: (event: Event | 'INITIAL_USER', user: User | null) => void,
) {
  if (!auth) return () => undefined;
  let active = true;
  void auth.getUser().then(({ data }) => {
    if (active) onState('INITIAL_USER', data.user);
  });
  const listener = auth.onAuthStateChange((event, session) => {
    if (active) onState(event, session?.user || null);
  });
  return () => {
    active = false;
    listener.data.subscription.unsubscribe();
  };
}
