// Client-safe: the sign-in page imports this, so no node:crypto here.

/** Error code the session.create hook throws and the login page keys on. */
export const ACCOUNT_FLAGGED_CODE = "ACCOUNT_FLAGGED";

/** Shown on the sign-in page the next time a flagged person tries to log in. */
export const ACCOUNT_FLAGGED_MESSAGE =
  "Your account has been flagged as suspicious, so sign-in is paused for now. We emailed you the details. You can reply to that email or verify a credit card to get back in.";
