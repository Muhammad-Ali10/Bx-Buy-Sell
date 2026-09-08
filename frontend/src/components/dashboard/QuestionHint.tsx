/**
 * The administrator's note for a question, where the field itself cannot carry it.
 *
 * The note belongs inside the input — in place of "Enter a number" — and that is
 * where it goes for anything a seller types or picks from a list. Some questions
 * have no such box: yes/no, tick boxes, a date picker, an upload area. Written
 * for one of those, the note would be saved and never seen, so it is printed
 * under the question instead.
 *
 * Renders nothing when there is no note, which is every question until somebody
 * writes one — no step gains a blank line today.
 */
const TYPES_THAT_CARRY_THE_HINT_THEMSELVES = new Set([
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "URL",
  "SELECT",
]);

export const QuestionHint = ({ question }: { question?: any }) => {
  const text = String(question?.hint ?? "").trim();
  if (!text) return null;
  if (TYPES_THAT_CARRY_THE_HINT_THEMSELVES.has(String(question?.answer_type))) {
    return null;
  }

  return (
    <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
      {text}
    </p>
  );
};

/** The note to show inside a field, or the wording the field already had. */
export const hintPlaceholder = (question: any, fallback: string): string =>
  String(question?.hint ?? "").trim() || fallback;
