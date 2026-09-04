/**
 * The invitation to begin an assisted deal.
 *
 * Drawn in one place because it now appears in two: once at the head of every
 * conversation, and again in the thread each time the platform posts a reminder
 * — the reminder that used to repeat the keep-it-on-the-platform policy, which
 * the page above it was already saying permanently.
 *
 * The design is the client's: a cream card with a black rule down its left
 * edge, rather than the green one this used to be. That rule is what separates
 * it from the warning card it sits beneath.
 */
interface DealProcessCardProps {
  onStartDeal: () => void;
}

const DealProcessCard = ({ onStartDeal }: DealProcessCardProps) => (
  <div
    className="rounded-xl px-4 py-3.5"
    style={{
      background: 'rgba(254, 242, 235, 1)',
      borderLeft: '3px solid rgba(0, 0, 0, 1)',
    }}
  >
    <h4
      className="m-0 flex items-center gap-1.5 text-[14px] font-semibold text-[#0F172A]"
      style={{ fontFamily: 'Lufga' }}
    >
      <span aria-hidden>&raquo;</span>
      Ready to start the deal process?
    </h4>
    <p
      className="mt-1 mb-0 text-[12.5px] leading-relaxed text-[#7C5A45]"
      style={{ fontFamily: 'Lufga' }}
    >
      Once both parties are ready to move forward, simply click{' '}
      <strong>&ldquo;Start Deal Process&rdquo;</strong>. We will assist with negotiations,
      contracts and closing.
    </p>
    <button
      type="button"
      onClick={onStartDeal}
      className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-black transition-colors hover:brightness-95"
      style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
    >
      <span aria-hidden>🤝</span> Start Deal Process
    </button>
  </div>
);

export default DealProcessCard;
