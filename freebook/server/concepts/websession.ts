import { SessionData } from "express-session";
import { NotAllowedError, UnauthenticatedError } from "../framework/errors";

export type WebSessionDoc = SessionData;

// This allows us to overload express session data type.
// Express session does not support non-string values over requests.
// We'll be using this to store the user by username in the session.
declare module "express-session" {
  export interface SessionData {
    user?: string; // Username as a string
  }
}

export default class WebSessionConcept {
  start(session: WebSessionDoc, username: string) {
    this.isLoggedOut(session);
    session.user = username; // Directly store the username as a string
  }

  end(session: WebSessionDoc) {
    this.isLoggedIn(session);
    session.user = undefined;
  }

  getUser(session: WebSessionDoc): string {
    this.isLoggedIn(session);
    if (!session.user) {
      throw new UnauthenticatedError("Session does not exist!");
    }
    return session.user; // Return the username as is
  }

  isLoggedIn(session: WebSessionDoc) {
    if (session.user === undefined) {
      throw new UnauthenticatedError("Must be logged in!");
    }
  }

  isLoggedOut(session: WebSessionDoc) {
    if (session.user !== undefined) {
      throw new NotAllowedError("Must be logged out!");
    }
  }
}
