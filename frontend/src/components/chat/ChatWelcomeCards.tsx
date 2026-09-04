/**
 * The two notices that head every conversation.
 *
 * Rendered rather than posted as messages. They are a standing notice, not
 * something either party said, so they belong above the thread where they
 * cannot be scrolled past, deleted, or duplicated — and every existing
 * conversation gets them too, without writing a row into anyone's history.
 */

import DealProcessCard from "./DealProcessCard";

interface ChatWelcomeCardsProps {
  onStartDeal: () => void;
  /**
   * True once someone has pressed the button and the deal is under way.
   *
   * The invitation goes when it does. Asking a pair who have already started
   * whether they are ready to start reads as the platform not having noticed.
   */
  dealStarted?: boolean;
}

const ChatWelcomeCards = ({ onStartDeal, dealStarted }: ChatWelcomeCardsProps) => (
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

    {!dealStarted && <DealProcessCard onStartDeal={onStartDeal} />}
  </div>
);

export default ChatWelcomeCards;
