/**
 * Telling a withheld answer from a real one.
 *
 * The server does not send a locked value and a flag beside it; it sends the
 * prompt *as* the value — a seller's name comes back as "Unlock Confidential
 * Details", and so does a domain, and so does a portfolio link. So the front
 * end has to recognise the prompt to know it is looking at a lock rather than
 * at somebody's answer.
 *
 * That recognition used to be `value.includes("to unlock")`, which was a guess
 * about the wording and broke the moment the wording changed: renaming the
 * agreement prompt would have left every locked field rendering the sentence as
 * though the seller had typed it, and clicking one would have done nothing.
 *
 * These are the two prompts the server can send, kept together so the check is
 * a comparison against known values rather than a search for an English phrase
 * that might one day appear in a real answer. They must match
 * `listing-visibility.ts` on the server.
 */
export const REGISTER_LOCK_LABEL = 'register to unlock 🔓';
export const AGREEMENT_LOCK_LABEL = 'Unlock Confidential Details';

/**
 * What the agreement prompt used to say.
 *
 * The prompt is generated on every response and never stored, so this should
 * stop appearing the moment the server restarts — except that the listing feed
 * is cached in Redis, which outlives a restart. Ten seconds of a page rendering
 * the sentence as though a seller had typed it is ten seconds too many for the
 * one line it takes to keep reading it.
 */
const LEGACY_AGREEMENT_LABEL = 'accept the agreement to unlock 🔓';

/** Emoji and spacing vary by where the prompt is rendered; the words do not. */
const normalise = (value: string) =>
  value.replace(/[🔓🔒]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const LOCK_LABELS = [
  REGISTER_LOCK_LABEL,
  AGREEMENT_LOCK_LABEL,
  LEGACY_AGREEMENT_LABEL,
].map(normalise);

/**
 * True when this value is the server's lock prompt rather than an answer.
 *
 * Prefer a structured `locked` flag where the surrounding object carries one —
 * `maskSection` sets it on every withheld item. This is for the places that
 * only have the string.
 */
export const isLockedValue = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const text = normalise(value);
  return LOCK_LABELS.some((label) => text === label || text.includes(label));
};
