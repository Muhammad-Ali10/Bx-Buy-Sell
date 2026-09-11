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
  | "CONFIDENTIAL_ACCESS_REQUESTED"
  | "CONFIDENTIAL_ACCESS_APPROVED"
  | "CONFIDENTIAL_ACCESS_DECLINED";

export interface SystemMessageMeta {
  kind?: SystemMessageKind;
  /** Who asked, so each side reads the sentence written for them. */
  buyerId?: string;
  blockedSenderId?: string;
  requesterId?: string;
  atMessage?: number;
}

/**
 * Whether a conversation gets the two standing notices at its head.
 *
 * Between two members, always: the warning about keeping the deal on the
 * platform is true of every such conversation, and either of them may want to
 * start the deal process. With the platform's own team — an admin or a
 * moderator on one side — neither notice makes sense: telling somebody to keep
 * the conversation on the platform while they are talking to the platform
 * reads as a machine that has not noticed who it is speaking to, and there is
 * no deal to begin with support.
 *
 * This used to be decided by whether the conversation had a listing attached,
 * which was only ever a stand-in for the question and got it wrong both ways.
 * Twenty of the forty-nine conversations in this database carry no listing id,
 * and five of those are two members talking to each other — shown nothing,
 * while the client asked for these on every new chat.
 */
export function showsWelcomeNotices(participants: {
  viewerRole?: string | null;
  otherRole?: string | null;
}): boolean {
  const isStaff = (role?: string | null) => role === "ADMIN" || role === "MONITER";
  return !isStaff(participants.viewerRole) && !isStaff(participants.otherRole);
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
// The client's own sentence, word for word.
const CONFIDENTIAL_APPROVED_FOR_BUYER =
  "The seller has accepted your request. You can now view the confidential details of the listing.";

const CONFIDENTIAL_APPROVED_FOR_SELLER =
  "You approved this buyer. They can now see the confidential details of your listing.";

/**
 * Written when a buyer asks, into the conversation they are then taken to.
 * Without it they land in an empty chat with the listing's details still
 * hidden and nothing to say why.
 */
const CONFIDENTIAL_REQUESTED_FOR_BUYER =
  "Your request to view the confidential details has been sent to the seller. You'll see their answer here.";

const CONFIDENTIAL_REQUESTED_FOR_SELLER =
  "This buyer has asked to see the confidential details of your listing.";

/**
 * The other outcome. The client asked only for the acceptance, but a buyer who
 * is refused and told nothing waits in that conversation indefinitely.
 */
const CONFIDENTIAL_DECLINED_FOR_BUYER =
  "The seller has declined your request to view the confidential details of this listing.";

const CONFIDENTIAL_DECLINED_FOR_SELLER = "You declined this buyer's request.";

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
/**
 * The words a viewer could actually search for in one message.
 *
 * `content` is not always a string. The platform's own notices deliberately
 * store it as null, because the two people in a conversation are told
 * different things about the same event — the sender that their message was
 * blocked, the other that something was withheld — and the wording is chosen
 * from the metadata when the thread is drawn.
 *
 * Searching therefore has to ask for that wording rather than reach for
 * `content`, which is what crashed the whole chat window the moment a
 * conversation contained a blocked message.
 */
export function messageSearchText(message: any, viewerId?: string): string {
  const rendered = systemMessageText(message, viewerId);
  if (rendered) return rendered;
  return typeof message?.content === 'string' ? message.content : '';
}

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

  if (meta.kind === "CONFIDENTIAL_ACCESS_REQUESTED") {
    return viewerId && meta.buyerId === viewerId
      ? CONFIDENTIAL_REQUESTED_FOR_BUYER
      : CONFIDENTIAL_REQUESTED_FOR_SELLER;
  }

  if (meta.kind === "CONFIDENTIAL_ACCESS_DECLINED") {
    return viewerId && meta.buyerId === viewerId
      ? CONFIDENTIAL_DECLINED_FOR_BUYER
      : CONFIDENTIAL_DECLINED_FOR_SELLER;
  }

  if (meta.kind === "CONFIDENTIAL_ACCESS_APPROVED") {
    return viewerId && meta.buyerId === viewerId
      ? CONFIDENTIAL_APPROVED_FOR_BUYER
      : CONFIDENTIAL_APPROVED_FOR_SELLER;
  }

  return null;
}
