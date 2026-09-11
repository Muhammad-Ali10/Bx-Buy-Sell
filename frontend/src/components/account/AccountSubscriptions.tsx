import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  getChatListingDescription,
  getChatListingImage,
  getChatListingPrice,
  getChatListingTitle,
} from "@/lib/chatListing";
import { getListingCurrencySymbol } from "@/lib/listingCurrency";
import { formatNumber } from "@/lib/formatNumber";
import {
  activeSubscriptionCount,
  buyerPlanPriceText,
  subscriptionBadge,
} from "@/lib/accountSubscriptions";

/**
 * A rough overview of what the member is paying for.
 *
 * Deliberately read-only: every "Manage" here hands off to the page that
 * actually changes things, so the rules about when an upgrade or downgrade
 * takes effect live in exactly one place.
 */

export const AccountSubscriptions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: subscription } = useQuery<any>({
    queryKey: ["subscription-current", user?.id],
    queryFn: async () => {
      const response = await apiClient.getCurrentSubscription();
      return response.success ? response.data : null;
    },
    enabled: Boolean(user),
  });

  // Seller packages are per listing, so the listings themselves are the rows.
  const { data: listings = [] } = useQuery<any[]>({
    queryKey: ["my-paid-listings", user?.id],
    queryFn: async () => {
      const response = await apiClient.getSecureListings({ userId: user?.id, limit: 500 });
      const payload: any = response.data;
      const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      /*
       * Paying, not merely having chosen: a live paid package, or a placement
       * bought for the listing. Every published listing carries a
       * `selectedPackage`, most of them the free one.
       */
      return rows.filter(
        (row: any) => row?.userId === user?.id && activeSubscriptionCount(row) > 0,
      );
    },
    enabled: Boolean(user),
  });

  const planTitle = subscription?.plan?.title || subscription?.plan?.name || "Minimum";
  const planPrice = Number(subscription?.plan?.monthlyPrice ?? 0);
  /**
   * The free plan is not a subscription, so it does not belong on this page.
   *
   * The server marks it two ways — an `isFree` flag and a plan that costs
   * nothing — and either is enough on its own; a member with no subscription
   * row at all arrives as the free plan too.
   */
  const buyerPlanIsPaid = Boolean(subscription) && !subscription?.isFree && planPrice > 0;

  return (
    <div className="mt-6 rounded-2xl border border-[#E9EBF2] bg-white p-5">
      <h2
        className="m-0 text-[16px] font-semibold text-[#0F172A]"
        style={{ fontFamily: 'Lufga' }}
      >
        Manage Your Subscriptions
      </h2>

      <div className="mt-4 flex flex-col gap-3">
        {/* The listing as the member knows it — its own title, its own words,
            its own price. */}
        {listings.map((listing: any) => {
          const price = getChatListingPrice(listing);
          const priceNumber = Number(String(price).replace(/[^0-9.\-]/g, ''));

          return (
            <Row
              key={listing.id}
              // The box is drawn even without a photo: the badge lives on it.
              image={getChatListingImage(listing) || ""}
              title={getChatListingTitle(listing) || "Your listing"}
              description={getChatListingDescription(listing)}
              badge={subscriptionBadge(activeSubscriptionCount(listing))}
              amount={
                Number.isFinite(priceNumber) && priceNumber > 0
                  ? `${getListingCurrencySymbol(listing)}${formatNumber(priceNumber)}`
                  : ""
              }
              // Straight to this listing's package and placements, as the
              // client asked; it went to the whole My Listings page.
              onManage={() => navigate(`/manage-subscription/${listing.id}`)}
            />
          );
        })}

        {buyerPlanIsPaid && (
          <Row
            avatar={user?.profile_pic || null}
            avatarFallback={(user?.first_name || "B").charAt(0).toUpperCase()}
            title={`Buyer: ${planTitle} Plan`}
            description="Manage your buyer subscription, change your billing cycle, or upgrade and downgrade your plan."
            amount={buyerPlanPriceText(
              planPrice,
              subscription?.billingCycle,
              Number(subscription?.plan?.yearlyPrice ?? 0),
            )}
            onManage={() => navigate("/manage-subscription")}
          />
        )}
      </div>

      {/* Both halves can be empty at once, and a heading with nothing under
          it reads as a page that failed to load. */}
      {listings.length === 0 && !buyerPlanIsPaid && (
        <p
          className="mt-4 mb-0 text-[12.5px] text-[#64748B]"
          style={{ fontFamily: 'Lufga' }}
        >
          You have no active subscriptions. Seller packages are chosen when you publish a
          listing and can be changed from My Listings; a buyer plan is chosen under Manage
          Subscription.
        </p>
      )}
    </div>
  );
};

const Row = ({
  image,
  avatar,
  avatarFallback,
  title,
  description,
  badge,
  amount,
  onManage,
}: {
  image?: string;
  /** The member's own picture, round, for the buyer plan — as in the design. */
  avatar?: string | null;
  avatarFallback?: string;
  title: string;
  description: string;
  badge?: string;
  amount: string;
  onManage: () => void;
}) => (
  <div className="flex flex-col gap-3 rounded-xl bg-[#FAFAFA] p-3.5 sm:flex-row sm:items-center">
    {image !== undefined && (
      <div
        className="relative shrink-0 overflow-hidden rounded-lg bg-black/5"
        style={{ width: '96px', height: '64px' }}
      >
        {image && (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
        {/* Wraps rather than clipping: "2 Active Subscriptions" is wider
            than the picture it sits on. */}
        {badge && (
          <span
            className="absolute bottom-0 left-0 right-0 bg-black/65 px-1 py-0.5 text-center text-[9px] leading-tight text-white"
            style={{ fontFamily: 'Lufga' }}
          >
            {badge}
          </span>
        )}
      </div>
    )}

    {avatar !== undefined && (
      <div className="flex shrink-0 justify-center" style={{ width: '96px' }}>
        <div
          className="flex items-center justify-center overflow-hidden rounded-full bg-black/5 text-[18px] font-semibold text-[#0F172A]"
          style={{
            width: '58px',
            height: '58px',
            boxShadow: '0 0 0 2px rgba(174, 243, 31, 1)',
            fontFamily: 'Lufga',
          }}
        >
          {avatar ? (
            <img src={avatar} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            avatarFallback
          )}
        </div>
      </div>
    )}

    <div className="min-w-0 flex-1">
      <p
        className="m-0 truncate text-[13.5px] font-semibold text-[#0F172A]"
        style={{ fontFamily: 'Lufga' }}
      >
        {title}
      </p>
      {/* Both come off the seller's own answers now, and an answer can be
          missing. An empty paragraph still takes its line and pushes the row
          out of shape, so it is left out rather than rendered blank. */}
      {description && (
        <p
          className="m-0 mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-[#64748B]"
          style={{ fontFamily: 'Lufga' }}
        >
          {description}
        </p>
      )}
      {amount && (
        <p
          className="m-0 mt-1 text-[13px] font-semibold text-[#0F172A]"
          style={{ fontFamily: 'Lufga' }}
        >
          {amount}
        </p>
      )}
    </div>

    <button
      type="button"
      onClick={onManage}
      className="shrink-0 rounded-lg px-4 py-2 text-[12.5px] font-medium text-black hover:brightness-95"
      style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
    >
      Manage Subscription
    </button>
  </div>
);

export default AccountSubscriptions;
