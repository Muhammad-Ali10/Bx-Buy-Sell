import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { getChatListingImage, getChatListingTitle } from "@/lib/chatListing";
import { formatNumber } from "@/lib/formatNumber";

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
      return rows.filter((row: any) => row?.userId === user?.id && row?.selectedPackage);
    },
    enabled: Boolean(user),
  });

  const planTitle = subscription?.plan?.title || subscription?.plan?.name || "Minimum";
  const planPrice = Number(subscription?.plan?.monthlyPrice ?? 0);

  return (
    <div className="mt-6 rounded-2xl border border-[#E9EBF2] bg-white p-5">
      <h2
        className="m-0 text-[16px] font-semibold text-[#0F172A]"
        style={{ fontFamily: 'Lufga' }}
      >
        Manage Your Subscriptions
      </h2>

      <div className="mt-4 flex flex-col gap-3">
        {listings.map((listing: any) => (
          <Row
            key={listing.id}
            image={getChatListingImage(listing)}
            title={getChatListingTitle(listing) || "Your listing"}
            description="Seller package for this listing. Manage the package or its add-ons."
            badge={listing.packageActive ? "Active Subscription" : "Inactive"}
            amount={`${String(listing.selectedPackage || "").toLowerCase()} package`}
            onManage={() => navigate("/my-listings")}
          />
        ))}

        <Row
          title={`Buyer: ${planTitle} Plan`}
          description="Manage your buyer subscription, change your billing cycle, or upgrade and downgrade your plan."
          amount={planPrice > 0 ? `$${formatNumber(planPrice)} monthly` : "Free"}
          onManage={() => navigate("/manage-subscription")}
        />
      </div>

      {listings.length === 0 && (
        <p
          className="mt-4 mb-0 text-[12.5px] text-[#64748B]"
          style={{ fontFamily: 'Lufga' }}
        >
          None of your listings carry a paid package yet. You choose one when you publish a
          listing, and can change it from My Listings.
        </p>
      )}
    </div>
  );
};

const Row = ({
  image,
  title,
  description,
  badge,
  amount,
  onManage,
}: {
  image?: string;
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
        style={{ width: '78px', height: '58px' }}
      >
        {image && (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
        {badge && (
          <span
            className="absolute bottom-0 left-0 right-0 truncate bg-black/65 px-1 py-0.5 text-center text-[8.5px] text-white"
            style={{ fontFamily: 'Lufga' }}
          >
            {badge}
          </span>
        )}
      </div>
    )}

    <div className="min-w-0 flex-1">
      <p
        className="m-0 truncate text-[13.5px] font-semibold text-[#0F172A]"
        style={{ fontFamily: 'Lufga' }}
      >
        {title}
      </p>
      <p
        className="m-0 mt-0.5 text-[11.5px] leading-relaxed text-[#64748B]"
        style={{ fontFamily: 'Lufga' }}
      >
        {description}
      </p>
      <p
        className="m-0 mt-1 text-[13px] font-semibold text-[#0F172A]"
        style={{ fontFamily: 'Lufga' }}
      >
        {amount}
      </p>
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
