/**
 * The two notices that head every conversation.
 *
 * Rendered rather than posted as messages. They are a standing notice, not
 * something either party said, so they belong above the thread where they
 * cannot be scrolled past, deleted, or duplicated — and every existing
 * conversation gets them too, without writing a row into anyone's history.
 */

interface ChatWelcomeCardsProps {
  onStartDeal: () => void;
}

const ChatWelcomeCards = ({ onStartDeal }: ChatWelcomeCardsProps) => (
  <div className="flex flex-col gap-3 mb-4">
    <div
      className="rounded-xl px-4 py-3.5"
      style={{ background: 'rgba(254, 242, 235, 1)', border: '1px solid rgba(253, 216, 194, 1)' }}
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="text-[15px] leading-none mt-0.5">
          ⚠️
        </span>
        <div className="min-w-0">
          <h4
            className="m-0 text-[14px] font-semibold text-[#0F172A]"
            style={{ fontFamily: 'Lufga' }}
          >
            Please Read Before Chatting
          </h4>
          <p
            className="mt-1 mb-0 text-[12.5px] leading-relaxed text-[#7C5A45]"
            style={{ fontFamily: 'Lufga' }}
          >
            Please keep all communication within the platform. Communicating or transacting
            outside the platform may violate our <strong>Terms and Conditions</strong> and could
            result in penalties, legal consequences, or financial fines.
          </p>
        </div>
      </div>
    </div>

    <div
      className="rounded-xl px-4 py-3.5"
      style={{ background: 'rgba(240, 253, 244, 1)', border: '1px solid rgba(187, 240, 200, 1)' }}
    >
      <h4
        className="m-0 text-[14px] font-semibold text-[#0F172A]"
        style={{ fontFamily: 'Lufga' }}
      >
        Ready to start the deal process?
      </h4>
      <p
        className="mt-1 mb-0 text-[12.5px] leading-relaxed text-[#3F6B4B]"
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
  </div>
);

export default ChatWelcomeCards;
