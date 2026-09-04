/**
 * Text a seller typed, shown the way they laid it out.
 *
 * These blocks render with `white-space: pre-wrap` so the blank line between
 * two paragraphs survives instead of collapsing. That fixed the spacing and
 * introduced a smaller problem in its place: pre-wrap keeps *every* space,
 * including the ones sitting at the start of a line. Text pasted out of a word
 * processor often carries one, and those paragraphs then render indented while
 * the first one does not.
 *
 * So the blank lines are kept and the leading spaces are not. Trailing spaces
 * go too — invisible, but they push a line's wrap point around.
 *
 * Only for display. What the seller wrote is stored exactly as they wrote it,
 * and editing the listing shows it back to them unchanged.
 */
export const tidySellerText = (text: string | null | undefined): string => {
  if (typeof text !== "string" || text === "") return "";
  return text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
};
