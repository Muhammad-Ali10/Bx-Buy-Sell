/**
 * The wording the platform itself posts into a conversation.
 *
 * Kept out of the components because the same notice is read by two people who
 * must be told different things: the person whose message was stopped, and the
 * person who was expecting it. Both texts are the client's own wording.
 */

export const POLICY_SENDER_NAME = "Policy Department";

/** What the platform posted, read out of the message's metadata. */
export type SystemMessageKind =
  | "BLOCKED_MESSAGE"
  /**
   * The periodic prompt, under the name it was first written with.
   *
   * It used to repeat the platform's policy and now offers to start a deal, so
   * the rows already sitting in people's conversations carry the old name for
   * the new slot. They are read as prompts rather than migrated: the row only
   * ever recorded *that* the platform spoke at message N, and what it says is
   * decided here. Leaving it out would turn every reminder already posted into
   * an empty bubble.
   */
  | "GUIDELINE_REMINDER"
  | "DEAL_PROMPT"
  | "DEAL_STARTED"
  | "CONFIDENTIAL_ACCESS_APPROVED";

export interface SystemMessageMeta {
  kind?: SystemMessageKind;
  /** Who asked, so each side reads the sentence written for them. */
  buyerId?: string;
  blockedSenderId?: string;
  requesterId?: string;
  atMessage?: number;
}

/** True when this row is the platform's periodic offer to begin a deal. */
export function isDealPrompt(message: any): boolean {
  const kind = readSystemMeta(message).kind;
  return kind === "DEAL_PROMPT" || kind === "GUIDELINE_REMINDER";
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

/**
 * The seller has approved the buyer's request.
 *
 * Approving used to change what the buyer could see and say nothing about it:
 * the listing quietly opened up, with no way to tell whether the seller had
 * agreed or the page had simply refreshed. Written into the conversation so
 * both of them can see when it happened, and so it stays in the record.
 */
const CONFIDENTIAL_APPROVED_FOR_BUYER =
  "The seller approved your request. The confidential details of this listing are now visible to you.";

const CONFIDENTIAL_APPROVED_FOR_SELLER =
  "You approved this buyer. They can now see the confidential details of your listing.";

/**
 * The prompt in words, for anywhere that can only render a sentence.
 *
 * The chat draws it as a card with a working button; the admin views and any
 * plain list fall back to this. Without it they would render nothing at all,
 * which is what happened to the deal-started notice below.
 */
const DEAL_PROMPT =
  "Ready to start the deal process? Once both parties are ready to move forward, " +
  "simply click “Start Deal Process”. We will assist with negotiations, " +
  "contracts and closing.";

/**
 * Written when someone presses the button.
 *
 * The row was being created and nothing knew how to read it, so the message
 * rendered as an empty bubble attributed to “Admin” — the one
 * confirmation that the deal had begun, invisible to both parties.
 */
const DEAL_STARTED =
  "The deal process has started. Our team will be in touch to assist with " +
  "negotiations, contracts and closing.";

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

  if (meta.kind === "DEAL_PROMPT" || meta.kind === "GUIDELINE_REMINDER") {
    return DEAL_PROMPT;
  }

  if (meta.kind === "DEAL_STARTED") return DEAL_STARTED;

  if (meta.kind === "CONFIDENTIAL_ACCESS_APPROVED") {
    return viewerId && meta.buyerId === viewerId
      ? CONFIDENTIAL_APPROVED_FOR_BUYER
      : CONFIDENTIAL_APPROVED_FOR_SELLER;
  }

  return null;
}
