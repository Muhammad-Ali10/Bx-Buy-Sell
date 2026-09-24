/**
 * Placing a video call from anywhere in the app.
 *
 * Every call — two people, or the team with both sides of a conversation — is
 * run by the one CallCenter at the root of the app, on the connection kept
 * open for the whole session. A screen that offers a call button only asks for
 * one; it does not hold the call itself, so leaving that screen does not drop
 * it and the person called can answer from any page.
 */
export interface StartCallRequest {
  chatId: string;
  /** The one person to ring. Left out, it is a group call (team only). */
  to?: string;
}

export const START_CALL_EVENT = "ex:start-call";

export function startCall(request: StartCallRequest) {
  window.dispatchEvent(new CustomEvent<StartCallRequest>(START_CALL_EVENT, { detail: request }));
}
