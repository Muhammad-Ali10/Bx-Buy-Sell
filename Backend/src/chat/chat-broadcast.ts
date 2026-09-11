/**
 * Push a message to everyone in a conversation, from anywhere in the API.
 *
 * The chat gateway owns the socket server. The listing module — which decides
 * confidential-access requests and posts the notices about them — cannot import
 * the chat module, because the chat module already imports the listing module
 * and asking for it back would close a circle. So the gateway hands its emitter
 * to this plain module when it starts, and anything can call it.
 *
 * Without it those notices were written to the database and nobody was told: a
 * buyer with the chat open did not see "the seller has accepted your request"
 * until they reloaded the page, which defeats the point of sending it.
 */

type Emitter = (room: string, event: string, payload: string) => void;

let emitter: Emitter | null = null;

export function registerChatBroadcaster(emit: Emitter | null): void {
  emitter = emit;
}

/**
 * Send a saved message to its conversation's room, as the gateway does for any
 * other message. A no-op when no gateway is running (scripts, tests), and it
 * never throws: a missed live update is not worth failing the decision that
 * caused it — the message is in the database and appears on the next load.
 */
export function broadcastChatMessage(
  message: { chatId?: string | null } | null | undefined,
): void {
  if (!emitter || !message?.chatId) return;
  try {
    emitter(message.chatId, 'message', JSON.stringify(message));
  } catch {
    // See above.
  }
}
