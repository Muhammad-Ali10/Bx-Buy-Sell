/**
 * The wording the platform itself posts into a conversation.
 *
 * Kept out of the components because the same notice is read by two people who
 * must be told different things: the person whose message was stopped, and the
 * person who was expecting it. Both texts are the client's own wording.
 */

export const POLICY_SENDER_NAME = "Policy Department";

/** What the platform posted, read out of the message's metadata. */
export type SystemMessageKind = "BLOCKED_MESSAGE" | "GUIDELINE_REMINDER";

export interface SystemMessageMeta {
  kind?: SystemMessageKind;
  blockedSenderId?: string;
  atMessage?: number;
}

const BLOCKED_FOR_SENDER =
  "Your message was blocked because it likely violates our community guidelines. " +
  "Sharing email addresses, phone numbers, third-party messaging apps, or any other " +
  "personal contact details for communication outside our platform is strictly " +
  "prohibited and may result in account restrictions, penalties, legal consequences, " +
  "or financial fines. All communication between buyers and sellers must remain " +
  "exclusively on the platform.";

const BLOCKED_FOR_RECIPIENT =
  "The other chat user's message was blocked, possibly because it violates the EX " +
  "Community Guidelines. Please remember that sharing email addresses, phone numbers, " +
  "third-party messaging apps, or any other personal contact details for communication " +
  "outside our platform is strictly prohibited and may result in account restrictions, " +
  "penalties, legal consequences, or financial fines. All communication between buyers " +
  "and sellers must remain exclusively on the platform.";

const GUIDELINE_REMINDER =
  "A reminder from the platform: please keep all communication here. Sharing email " +
  "addresses, phone numbers or other contact details to continue elsewhere is not " +
  "permitted, and it removes the protection this platform gives both sides of a deal.";

/** Read the metadata off a message however the transport happened to encode it. */
export function readSystemMeta(message: any): SystemMessageMeta {
  const raw = message?.metadata;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as SystemMessageMeta;
    } catch {
      return {};
    }
  }
  return raw as SystemMessageMeta;
}

/** True when this row was posted by the platform rather than by a person. */
export function isSystemMessage(message: any): boolean {
  return message?.type === "SYSTEM" || Boolean(readSystemMeta(message).kind);
}

/**
 * The text this particular viewer should see.
 *
 * `viewerId` decides which side of a blocked message they are on. Returns null
 * when the message is not one of ours, so callers can fall through to their
 * normal rendering.
 */
export function systemMessageText(message: any, viewerId?: string): string | null {
  const meta = readSystemMeta(message);

  if (meta.kind === "BLOCKED_MESSAGE") {
    return viewerId && meta.blockedSenderId === viewerId
      ? BLOCKED_FOR_SENDER
      : BLOCKED_FOR_RECIPIENT;
  }

  if (meta.kind === "GUIDELINE_REMINDER") return GUIDELINE_REMINDER;

  return null;
}
