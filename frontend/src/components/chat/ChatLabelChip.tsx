/**
 * How a seller has marked the person they are talking to.
 *
 * Two lists in the same sidebar show this chip, one directly below the other:
 * the confidential access queue and the conversation rows beneath it. Each used
 * to draw it itself, and they disagreed — a bright #22BF15 on a 10% green tint
 * in one, a darker #15803D on #DCFCE7 in the other. Stacked in one column that
 * reads as two different states rather than one.
 *
 * The darker palette is the one kept. It is the one in the design, and it is
 * the readable one: full-saturation green on a near-white tint is thin at this
 * size.
 */
export type ChatLabelValue = 'GOOD' | 'MEDIUM' | 'BAD';

const CHIPS: Record<ChatLabelValue, { text: string; className: string }> = {
  GOOD: { text: 'Good', className: 'bg-[#DCFCE7] text-[#15803D]' },
  MEDIUM: { text: 'Medium', className: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  BAD: { text: 'Bad', className: 'bg-[#FEE2E2] text-[#DC2626]' },
};

/**
 * Nothing when they have not been labelled — an empty chip would read as a
 * fourth state rather than as no state.
 *
 * `flex-shrink-0` matters at the call sites: the chip sits after a name that
 * truncates, and the name is what should give way, not the label.
 */
export const ChatLabelChip = ({
  label,
}: {
  label?: ChatLabelValue | null;
}) => {
  const chip = label ? CHIPS[label] : null;
  if (!chip) return null;

  return (
    <span
      className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none ${chip.className}`}
      style={{ fontFamily: 'Lufga' }}
    >
      {chip.text}
    </span>
  );
};
