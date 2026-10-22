/**
 * Desktop browsers used to inspect local Mailpit emails cannot open the
 * `coffeefast://` mobile deep link. In development, finish confirmation in
 * the browser and return to the app to sign in. Production keeps the app link.
 */
export const authEmailRedirectTo = __DEV__
  ? 'http://127.0.0.1:54324'
  : 'coffeefast://auth/callback';
