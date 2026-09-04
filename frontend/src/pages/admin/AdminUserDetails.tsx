import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Settings, MessageSquare, Trash2, CheckCircle, Edit2, ChevronRight,
  Loader2, Ban, ShieldCheck, KeyRound, UserRound, Mail, Smartphone, Info,
  Wallet, Lock as LockIcon, IdCard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatPresence } from "@/lib/lastSeen";
import { formatMoney } from "@/lib/formatNumber";
import { TeamMemberStatistics } from "@/components/admin/TeamMemberStatistics";
import { UserSubscriptionsList } from "@/components/admin/UserSubscriptionsPanel";
import { ChangePasswordDialog } from "@/components/admin/ChangePasswordDialog";
import { UserInvoiceList } from "@/components/admin/UserInvoiceList";

const ACCOUNT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "billing", label: "Billing" },
] as const;

type AccountTab = (typeof ACCOUNT_TABS)[number]["key"];


/** The database calls a moderator a "MONITER"; the interface should not. */
/**
 * One line of the account card: an icon, what it says, and how it stands.
 *
 * The card used to be a column of "X Verified" rows with a control beside each
 * one. The design puts the value first — the address, the number, the type —
 * and the verdict beside it, which is the order someone reads them in.
 */
const DetailLine = ({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: LucideIcon;
  label: string | null;
  value: string;
  badge?: { text: string; className: string };
}) => (
  <div className="flex items-center justify-between gap-3">
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <span
        className="truncate text-sm"
        style={{ fontFamily: 'ABeeZee', color: '#000000' }}
        title={label ? `${label}: ${value}` : value}
      >
        {label ? `${label}: ` : ''}
        {value}
      </span>
    </span>
    {badge && (
      <span
        className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.className}`}
      >
        {badge.text}
      </span>
    )}
  </div>
);

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MONITER: "Moderator",
  SELLER: "Seller",
  USER: "User",
};
import proIcon from "@/assets/fi_5076417.svg";
import simIcon from "@/assets/sim icon.svg";
import verifiedTick from "@/assets/Tick.svg";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useUserListings } from "@/hooks/useUserListings";
import { useUserFavorites } from "@/hooks/useUserFavorites";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { getAdminUserNote, setAdminUserNote } from "@/lib/adminUserNotes";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminUserDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const { data, isLoading, refetch } = useUserDetails(id);
  const { data: userFavorites } = useUserFavorites(id);
  // The Subscriptions tab lists a card per listing this member pays for.
  const { data: userListings } = useUserListings(id);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    state: "",
    zip_code: "",
  });
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [prefsForm, setPrefsForm] = useState({
    background: "",
    businessCategories: "",
    niches: "",
    listingPriceMin: "",
    listingPriceMax: "",
    sellerLocation: "",
    targetLocation: "",
    businessAgeMin: "",
    businessAgeMax: "",
    yearlyProfitMin: "",
    yearlyProfitMax: "",
    profitMultipleMin: "",
    profitMultipleMax: "",
  });
  const [adminNote, setAdminNote] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<any>(null);
  // Every hook must run on every render, so these live above the loading and
  // not-found returns below. Declared after them, they only ran once data had
  // arrived, and React refused to render the page at all.
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>("overview");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setAdminNote(getAdminUserNote(id));
  }, [id]);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!id) return;
      try {
        const response = await (apiClient as any).request(`/subscription/user/${id}`);
        if (response.success && response.data) {
          const data = response.data as any;
          setIsPro(data.plan?.slug === 'pro' && data.status === 'ACTIVE');
          
          // Fetch payment method if user has active subscription
          if (data.stripeCustomerId && data.status === 'ACTIVE') {
            const pmResponse = await (apiClient as any).request(`/subscription/payment-method/${id}`);
            if (pmResponse.success && pmResponse.data) {
              setPaymentMethod(pmResponse.data);
            }
          }
        }
      } catch (error) {
        console.error('Error checking user subscription:', error);
      }
    };
    checkSubscription();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">User not found</p>
        </main>
      </div>
    );
  }

  const { profile, listingsCount, favoritesCount, chatsCount } = data;
  const resolvedFavoritesCount = userFavorites?.length ?? favoritesCount;
  const preferences = (profile as any)?.preferences || null;
  const currentRole = currentUser?.role?.toUpperCase();
  const isModerator = currentRole === "MONITER" || currentRole === "MODERATOR";
  const targetRole = (profile as any)?.role?.toUpperCase() || "";
  // Sellers are ordinary members too; only the team is out of a moderator's
  // reach. This mirrors what the server allows.
  const canModerateTarget =
    !isModerator || targetRole === "USER" || targetRole === "SELLER";

  const formatRange = (range?: { min?: string | null; max?: string | null }, suffix = "") => {
    if (!range) return "-";
    const min = range.min ?? "";
    const max = range.max ?? "";
    if (!min && !max) return "-";
    const minText = min ? `${min}${suffix}` : "";
    const maxText = max ? `${max}${suffix}` : "";
    return `${minText}${minText && maxText ? " - " : ""}${maxText}`.trim() || "-";
  };

  const backgroundValue = profile.background || "None of the Above";
  const businessCategoriesValue = preferences?.businessCategory?.map((c: any) => c.name).join(", ") || "None";
  const nichesValue = preferences?.niche?.map((n: any) => n.name).join(", ") || "None";
  const sellerLocationValue = preferences?.financial?.seller_location || profile.country || "Not set";
  const targetLocationValue = preferences?.financial?.revenue_multiple_range?.country || profile.country || "Not set";
  const listingPriceValue = formatRange(preferences?.financial?.revenue_multiple_range);
  const businessAgeValue = formatRange(preferences?.financial?.age_range);
  const yearlyProfitValue = formatRange(preferences?.financial?.yearly_profit_range);
  const profitMultipleValue = formatRange(preferences?.financial?.profit_multiple_range, "x");

  const openPreferencesEditor = () => {
    setPrefsForm({
      background: profile.background || "",
      businessCategories: preferences?.businessCategory?.map((c: any) => c.name).join(", ") || "",
      niches: preferences?.niche?.map((n: any) => n.name).join(", ") || "",
      listingPriceMin: preferences?.financial?.revenue_multiple_range?.min || "",
      listingPriceMax: preferences?.financial?.revenue_multiple_range?.max || "",
      sellerLocation: preferences?.financial?.seller_location || "",
      targetLocation: preferences?.financial?.revenue_multiple_range?.country || "",
      businessAgeMin: preferences?.financial?.age_range?.min || "",
      businessAgeMax: preferences?.financial?.age_range?.max || "",
      yearlyProfitMin: preferences?.financial?.yearly_profit_range?.min || "",
      yearlyProfitMax: preferences?.financial?.yearly_profit_range?.max || "",
      profitMultipleMin: preferences?.financial?.profit_multiple_range?.min || "",
      profitMultipleMax: preferences?.financial?.profit_multiple_range?.max || "",
    });
    setIsPrefsOpen(true);
  };

  const savePreferences = async () => {
    if (!id) return;
    await apiClient.updateUserPreferences(id, {
      background: prefsForm.background || null,
      businessCategories: prefsForm.businessCategories
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      niches: prefsForm.niches
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      sellerLocation: prefsForm.sellerLocation || null,
      targetLocation: prefsForm.targetLocation || null,
      listingPriceRange: {
        min: prefsForm.listingPriceMin || null,
        max: prefsForm.listingPriceMax || null,
      },
      businessAgeRange: {
        min: prefsForm.businessAgeMin || null,
        max: prefsForm.businessAgeMax || null,
      },
      yearlyProfitRange: {
        min: prefsForm.yearlyProfitMin || null,
        max: prefsForm.yearlyProfitMax || null,
      },
      profitMultipleRange: {
        min: prefsForm.profitMultipleMin || null,
        max: prefsForm.profitMultipleMax || null,
      },
    });
    await refetch();
    setIsPrefsOpen(false);
  };

  const openInfoEditor = () => {
    setInfoForm({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      address: profile.address || "",
      city: profile.city || "",
      country: profile.country || "",
      state: profile.state || "",
      zip_code: profile.zip || profile.zip_code || "",
    });
    setIsEditingInfo(true);
  };

  const saveInfo = async () => {
    if (!id) return;
    setIsSavingInfo(true);
    try {
      const response = await apiClient.updateUserByAdmin(id, {
        first_name: infoForm.first_name || "",
        last_name: infoForm.last_name || "",
        email: infoForm.email || "",
        phone: infoForm.phone || "",
        address: infoForm.address || "",
        city: infoForm.city || "",
        country: infoForm.country || "",
        state: infoForm.state || "",
        zip_code: infoForm.zip_code || "",
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to update user");
      }
      toast.success("User information updated");
      await refetch();
      setIsEditingInfo(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update user");
    } finally {
      setIsSavingInfo(false);
    }
  };

  /**
   * Role changes take effect on the user's next request — the permission check
   * reads the database rather than their token — so there is no need for them
   * to sign out and back in.
   */
  const handleChangeUserType = async (nextRole: "USER" | "MONITER" | "ADMIN") => {
    if (!id || nextRole === targetRole) return;
    const label = ROLE_LABELS[nextRole] ?? nextRole;
    if (!window.confirm(`Change this account's user type to ${label}?`)) return;

    setIsChangingRole(true);
    try {
      const response = await apiClient.updateUserByAdmin(id, { role: nextRole });
      if (!response.success) {
        throw new Error(response.error || "Failed to change the user type");
      }
      toast.success(`User type changed to ${label}`);
      await refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to change the user type");
    } finally {
      setIsChangingRole(false);
    }
  };


  const handleMessageUser = () => {
    if (!id) return;
    // Straight into the conversation with this person, not the chat list — and
    // deliberately the general thread, not one attached to a listing.
    navigate(`/admin/users/${id}/chats?direct=1`);
  };

  const handleBlockUser = async () => {
    if (!id) return;
    if (!canModerateTarget) {
      toast.error("You can only block normal users.");
      return;
    }
    const alreadyBlocked = (data as any)?.blocked === true;
    const confirmed = window.confirm(
      alreadyBlocked ? "Unblock this user?" : "Block this user?",
    );
    if (!confirmed) return;
    try {
      // The real moderation action: refuses sign-in and ends their sessions.
      // This used to flip `verified`, which stopped nothing.
      const response = alreadyBlocked
        ? await apiClient.unblockAccount(id)
        : await apiClient.blockAccount(id);
      if (!response.success) {
        throw new Error(response.error || "Failed to update this user");
      }
      toast.success(alreadyBlocked ? "User unblocked" : "User blocked");
      await refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to update this user");
    }
  };

  const handleDeleteUser = async () => {
    if (!id) return;
    if (!canModerateTarget) {
      toast.error("You can only delete normal users.");
      return;
    }
    const confirmed = window.confirm("Delete this user? This action cannot be undone.");
    if (!confirmed) return;
    try {
      const response = await apiClient.deleteUser(id);
      if (!response.success) {
        throw new Error(response.error || "Failed to delete user");
      }
      toast.success("User deleted");
      navigate("/admin/users");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
    }
  };
  const isOnline = Boolean((profile as any)?.is_online);
  const lastSeen =
    (profile as any)?.last_seen ?? (profile as any)?.last_offline ?? null;
  const isBlocked = (profile as any)?.blocked === true;
  const verifiedFunds =
    typeof (profile as any)?.verified_funds === "number"
      ? (profile as any).verified_funds
      : null;
  /**
   * Where the verified figure sits against the bands the team judges by.
   *
   * Nothing verified is not "a little": it is the first mark, and the bar stays
   * empty. The thresholds are the same ones the acquisition-capacity screen
   * uses to describe a buyer.
   */
  const capacityBand = verifiedFunds === null || verifiedFunds <= 0
    ? 0
    : verifiedFunds < 100_000
      ? 1
      : 2;
  const capacityFill = capacityBand === 0 ? 0 : capacityBand === 1 ? 50 : 100;

  const statusBadge = (verified: boolean) =>
    verified
      ? { text: 'Verified', className: 'bg-accent text-black' }
      : { text: 'Not Verified', className: 'bg-red-100 text-red-600' };

  const emailBadge = statusBadge(Boolean((profile as any)?.email_verified));
  const phoneBadge = statusBadge(Boolean((profile as any)?.phone_verified));
  const idBadge = statusBadge(Boolean((profile as any)?.id_verified));

  // "Moniter" is what the database calls it; nobody should have to read that.
  const userType = ROLE_LABELS[targetRole] ?? null;
  const userTypeLabel = userType ?? 'User';
  const isTeamMember = targetRole === "ADMIN" || targetRole === "MONITER";
  // Only admins may change a user type, and the control is hidden rather than
  // shown-and-refused so a moderator is not invited to try.
  const canChangeUserType = currentRole === "ADMIN" && targetRole !== "";
  // Admins and moderators may reset an ordinary member's password; a team
  // member's password is an admin's business only. The server enforces the
  // same rule, so this only decides whether the entry is worth showing.
  const canChangePassword = currentRole === "ADMIN" || !isTeamMember;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      
      <main className="flex-1 min-w-0">
        <AdminHeader title="User Details" />

        <div className="p-8 space-y-6">
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 p-0 hover:bg-transparent"
            onClick={() => navigate("/admin/users")}
          >
            <ArrowLeft className="h-4 w-4 text-black" />
            <span
              className="font-outfit font-bold text-[18px] leading-[100%] text-black"
            >
              All Users
            </span>
          </Button>

          {/* The account splits into three views rather than one long scroll:
              who they are, what they pay for, and how they pay. */}
          <div className="flex flex-col gap-1">
            {/* Settings sits level with the title, as the design has it: it
                acts on the account, not on the profile card below. */}
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold">Your Account Details</h2>
                {/* Moderators see this menu too — they police ordinary members,
                    including resetting a forgotten password. Which entries they
                    get is decided per action below, and enforced server-side. */}
                {(
                  <div className="flex items-center gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="bg-accent text-black hover:bg-accent/90 rounded-full px-6">
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl border-border p-2">
                        <DropdownMenuItem className="rounded-xl" onClick={handleMessageUser}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Chat
                        </DropdownMenuItem>
                        {canChangePassword && (
                          <DropdownMenuItem
                            className="rounded-xl"
                            onClick={() => setIsPasswordDialogOpen(true)}
                          >
                            <KeyRound className="h-4 w-4 mr-2" />
                            Change password
                          </DropdownMenuItem>
                        )}
                        {canModerateTarget && (
                          <DropdownMenuItem className="rounded-xl" onClick={handleBlockUser}>
                            <Ban className="h-4 w-4 mr-2" />
                            {isBlocked ? "Unblock" : "Block"}
                          </DropdownMenuItem>
                        )}
                        {canModerateTarget && (
                          <DropdownMenuItem className="rounded-xl text-destructive" onClick={handleDeleteUser}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                        {/* Promoting a member to the team, or returning a team
                            member to an ordinary account, is an admin-only act —
                            the backend refuses it for anyone else. */}
                        {canChangeUserType && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">User type</div>
                            {(["USER", "MONITER", "ADMIN"] as const).map((role) => (
                              <DropdownMenuItem
                                key={role}
                                className="rounded-xl"
                                disabled={targetRole === role || isChangingRole}
                                onClick={() => handleChangeUserType(role)}
                              >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                {ROLE_LABELS[role]}
                                {targetRole === role && (
                                  <span className="ml-auto text-xs text-muted-foreground">current</span>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
            </div>
            <div className="flex items-center gap-6 border-b border-border">
              {ACCOUNT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`-mb-px border-b-2 px-1 pb-2 text-sm transition-colors ${
                    activeTab === tab.key
                      ? "border-accent font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "overview" && (
          <Card
            className="p-6 bg-card border-border"
            style={{
              borderRadius: '24px',
              background: '#FFFFFF',
              boxShadow: '0px 3px 33px 0px #00000017',
              height: 'auto',
            }}
          >
            {/* Wraps on narrow screens: the avatar, the two verification
                columns, the notes box and the menu add up to roughly 1100px,
                which pushed a phone's whole page sideways. */}
            {/* Three panels, as the design stands them: who this is,
                what we know about them, and what they are watching for.
                They stack on a narrow screen — side by side the row runs
                to about 1100px and used to push a phone sideways. */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.75fr)]">

              <div className="flex flex-col gap-5 rounded-2xl border border-border p-5">
              <div className="flex items-start gap-[20px]">
                <div className="relative flex-shrink-0">
                  <Avatar
                    className="h-20 w-20"
                    style={{ width: '72px', height: '72px', borderRadius: '80px' }}
                  >
                    {profile.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
                    <AvatarFallback className="text-xl">
                      {profile.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {isPro && (
                    <div
                      className="absolute"
                      style={{
                        width: '48px',
                        height: '21px',
                        borderRadius: '13.04px',
                        paddingTop: '1.96px',
                        paddingBottom: '1.96px',
                        background: '#C6FE1F',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2.61px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        bottom: '-10px',
                      }}
                    >
                      <img src={proIcon} alt="Pro" style={{ width: '12px', height: '12px' }} />
                      <span
                        className="font-lufga"
                        style={{
                          fontWeight: 500,
                          fontSize: '11px',
                          lineHeight: '120%',
                          letterSpacing: '0%',
                          color: '#000000',
                        }}
                      >
                        Pro
                      </span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2
                      className="truncate font-lufga"
                      style={{
                        fontWeight: 700,
                        fontSize: '24px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#000000',
                      }}
                    >
                      {profile.full_name || "Unknown User"}
                    </h2>
                    <img src={verifiedTick} alt="Verified" style={{ width: '18px', height: '18px' }} />
                  </div>
                  {/* The star rating was removed: the platform has no rating
                      system behind it, so five filled stars said nothing. */}
                  <div className="flex items-center gap-2 mt-3">
                    {userType && (
                      <Badge
                        variant="accent"
                        className="rounded-full px-3 py-0.5 text-xs bg-muted text-foreground border-border"
                      >
                        {userType}
                      </Badge>
                    )}
                    <Badge
                      variant="accent"
                      className={`rounded-full px-3 py-0.5 text-xs whitespace-nowrap ${
                        isOnline
                          ? "bg-accent/20 text-accent border-accent/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {/* "Offline" alone is not useful; when they were last here is. */}
                      {formatPresence(isOnline, lastSeen)}
                    </Badge>
                    {isBlocked && (
                      <Badge
                        variant="accent"
                        className="rounded-full px-3 py-0.5 text-xs bg-red-500 text-white border-0"
                      >
                        Blocked
                      </Badge>
                    )}
                  </div>
                  {/* The design keeps the note beside the presence pill rather
                      than in a column of its own — it is a line about the
                      person, and it belongs with their name. */}
                  <div className="mt-3">
                  <p
                    className="mb-2"
                    style={{
                      fontFamily: 'Outfit',
                      fontWeight: 400,
                      fontSize: '14px',
                      lineHeight: '100%',
                      letterSpacing: '0px',
                      color: '#000000',
                    }}
                  >
                    Notes (Text Field)
                  </p>
                  <Textarea
                    placeholder="Type important notes about this user..."
                    className="min-h-[44px] resize-none bg-muted/30 border-border"
                    value={adminNote}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setAdminNote(nextValue);
                      if (id) {
                        setAdminUserNote(id, nextValue);
                      }
                    }}
                  />
                  </div>
                </div>

              </div>

              {/* The account, as the design lists it: what the person is,
                  how to reach them, and what has been checked.

                  These read; they do not act. Email and phone verification used
                  to be switches here, so a moderator could mark an address
                  verified without anyone having opened the mail — which is the
                  one thing verification is supposed to mean. The client asked
                  for status, and status is what a record of a check should be. */}
              <div className="flex min-w-[260px] flex-col gap-3">
                <DetailLine icon={UserRound} label="User Type" value={userTypeLabel} />
                <DetailLine icon={Mail} label={null} value={profile.email || '—'} badge={emailBadge} />
                <DetailLine icon={LockIcon} label="Password" value="••••••" />
                <DetailLine
                  icon={Smartphone}
                  label={null}
                  value={profile.phone || 'No phone number'}
                  badge={phoneBadge}
                />
                <DetailLine
                  icon={IdCard}
                  label={null}
                  value={(profile as any)?.id_verified ? 'ID Verified' : 'ID not Verified'}
                  badge={idBadge}
                />

                {/* What the buyer can actually put behind an offer. A tick would
                    say only that somebody looked; the figure is the answer. */}
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-[11px] font-medium text-white">
                      <Wallet className="h-3 w-3" />
                      Acquisition Capacity
                      <span title="Funds this buyer has had verified by the team">
                        <Info className="h-3 w-3 opacity-70" />
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        verifiedFunds !== null
                          ? 'bg-accent text-black'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {verifiedFunds !== null ? formatMoney(verifiedFunds) : 'Not verified'}
                    </span>
                  </div>

                  {/* Three marks rather than a number line: the bands are what
                      the team judges by, and a bar pretends to a precision the
                      figure behind it does not have. */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${capacityFill}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span className={capacityBand === 0 ? 'font-semibold text-foreground' : ''}>
                      Not Verified
                    </span>
                    <span className={capacityBand === 1 ? 'font-semibold text-foreground' : ''}>
                      Moderate
                    </span>
                    <span className={capacityBand === 2 ? 'font-semibold text-foreground' : ''}>
                      High
                    </span>
                  </div>
                </div>
              </div>


              </div>

              <div className="flex flex-col gap-5">
                <div className="rounded-2xl border border-border p-5">
                  <h3 className="font-lufga mb-4" style={{ fontWeight: 500, fontSize: 20, color: "#000000" }}>
                    Personal Information
                  </h3>
                  <div className="space-y-3">
                {/* The design opens Personal Information with the company.
                    Stored as `business_name`; most accounts have not filled it
                    in, so it reads as a dash rather than disappearing — a row
                    that comes and goes makes two users' cards different shapes. */}
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Company Name</span>
                  <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{(profile as any)?.business_name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>First Name</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.first_name}
                      onChange={(e) => setInfoForm({ ...infoForm, first_name: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.first_name || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Last Name</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.last_name}
                      onChange={(e) => setInfoForm({ ...infoForm, last_name: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.last_name || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Email</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.email}
                      onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
                      className="h-8 max-w-[260px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.email || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Phone Nr.</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.phone}
                      onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.phone || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Birthday</span>
                  <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>{profile.birthday || "-"}</span>
                </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-lufga" style={{ fontWeight: 500, fontSize: 20, color: "#000000" }}>
                      Your Address
                    </h3>
                    {isEditingInfo ? (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setIsEditingInfo(false)} disabled={isSavingInfo}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveInfo} disabled={isSavingInfo}>
                          {isSavingInfo ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={openInfoEditor}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Street</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.address}
                      onChange={(e) => setInfoForm({ ...infoForm, address: e.target.value })}
                      className="h-8 max-w-[260px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.address || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>City</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.city}
                      onChange={(e) => setInfoForm({ ...infoForm, city: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.city || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Country</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.country}
                      onChange={(e) => setInfoForm({ ...infoForm, country: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.country || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>State</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.state}
                      onChange={(e) => setInfoForm({ ...infoForm, state: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.state || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Zip Code</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.zip_code}
                      onChange={(e) => setInfoForm({ ...infoForm, zip_code: e.target.value })}
                      className="h-8 max-w-[160px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.zip || "-"}</span>
                  )}
                </div>
                  </div>
                </div>
              </div>

              {/* Kept as a panel rather than dropped, so the column the
                  design gives it is accounted for rather than silently
                  collapsing the row to two. */}
              <div className="rounded-2xl border border-border p-5">
                <h3 className="font-lufga mb-2" style={{ fontWeight: 500, fontSize: 20, color: "#000000" }}>
                  Buying Profile &amp; Alerts
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  EX will notify you when new listings match your criteria.
                </p>
                <Button className="h-10 rounded-full bg-accent px-5 font-medium text-black hover:bg-accent/90" disabled>
                  Coming Soon
                </Button>
              </div>
            </div>
          </Card>
          )}

          {activeTab === "subscriptions" && (
            <UserSubscriptionsList
              listings={(userListings as any[]) ?? []}
              subscription={(profile as any)?.subscription ?? null}
            />
          )}

          {/* How they pay lives under Billing, not on the overview. */}
          {activeTab === "billing" && (
          <Card
            className="p-5 bg-card border-border"
            style={{
              borderRadius: '20px',
              background: '#FFFFFF',
              boxShadow: '0px 3px 33px 0px #00000017',
            }}
          >
            <h3
              className="font-lufga mb-4"
              style={{
                fontWeight: 500,
                fontSize: '20px',
                lineHeight: '140%',
                letterSpacing: '0%',
                color: '#000000',
              }}
            >
              Payment Information
            </h3>
            <div className="flex items-start" style={{ columnGap: '50px' }}>
              <div
                className="p-5"
                style={{
                  width: '389px',
                  height: '218px',
                  borderRadius: '19.55px',
                  background: '#C6FE1F',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div className="flex items-start justify-between">
                  <img src={simIcon} alt="SIM" style={{ width: '50px', height: '35px' }} />
                  <span style={{ fontFamily: 'Helvetica Now Display', fontWeight: 700, fontSize: '16px', color: '#000000' }}>
                    {paymentMethod?.brand?.toUpperCase() || 'VISA'}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'Helvetica Now Display',
                    fontWeight: 700,
                    fontSize: '19.55px',
                    lineHeight: '100%',
                    letterSpacing: '7%',
                    color: '#000000',
                  }}
                >
                  **** **** **** {paymentMethod?.last4 || '****'}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div
                      style={{
                        fontFamily: 'Helvetica Now Display',
                        fontWeight: 400,
                        fontSize: '11.73px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#00000099',
                      }}
                    >
                      Exp {paymentMethod ? `${paymentMethod.expMonth}/${paymentMethod.expYear?.toString().slice(-2)}` : '-/-'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      style={{
                        fontFamily: 'Helvetica Neue',
                        fontWeight: 700,
                        fontSize: '12px',
                        lineHeight: '100%',
                        letterSpacing: '7%',
                        color: '#000000',
                      }}
                    >
                      CVV
                    </div>
                    <div
                      style={{
                        fontFamily: 'Helvetica Neue',
                        fontWeight: 400,
                        fontSize: '12px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#00000099',
                      }}
                    >
                      ***
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: 'auto auto',
                  columnGap: '40px',
                  rowGap: '14px',
                  marginRight: '40px',
                }}
              >
                <div style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Card Type</div>
                <div style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
                  {paymentMethod ? (paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)) : '-'}
                </div>
                <div style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Card Holder</div>
                <div style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
                  {paymentMethod?.holderName || profile.full_name || "-"}
                </div>
                <div style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Expire</div>
                <div style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
                  {paymentMethod ? `${String(paymentMethod.expMonth).padStart(2, '0')}/${paymentMethod.expYear}` : '-'}
                </div>
                <div style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Card Number</div>
                <div style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
                  **** **** **** {paymentMethod?.last4 || '****'}
                </div>
              </div>
            </div>

            {/* What they were actually charged, so a billing question can be
                answered here instead of in the Stripe dashboard. */}
            <div className="mt-8 border-t border-border pt-6">
              {id && <UserInvoiceList userId={id} />}
            </div>
          </Card>
          )}

          {activeTab === "overview" && (
            <>
          {/* Team members are managed on this page too, so their workload
              appears here rather than on a screen of its own. */}
          {isTeamMember && id && (
            <TeamMemberStatistics memberId={id} memberName={profile.full_name} />
          )}

          {/* User Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-4">User Stats</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[24px]">
              <Card 
                className="p-5 bg-card border-border cursor-pointer"
                style={{
                  width: '100%',
                  maxWidth: '316px',
                  height: '148px',
                  borderRadius: '24px',
                  background: '#FFFFFF',
                  boxShadow: '0px 3px 33px 0px #00000012',
                }}
                onClick={() => navigate(`/admin/users/${id}/listings`)}
              >
                <div className="flex h-full justify-between">
                  <div className="flex flex-col" style={{ gap: '32px' }}>
                    <p
                      style={{
                        fontFamily: 'ABeeZee',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      Users Listings
                    </p>
                    <p
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 700,
                        fontSize: '24px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#000000',
                      }}
                    >
                      {listingsCount}
                    </p>
                  </div>
                  <ChevronRight
                    className="self-center"
                    style={{
                      width: '23.000001907348633px',
                      height: '23.00000000000002px',
                      color: '#000000',
                      marginRight: '4px',
                    }}
                  />
                </div>
              </Card>
              <Card 
                className="p-5 bg-card border-border cursor-pointer"
                style={{
                  width: '100%',
                  maxWidth: '316px',
                  height: '148px',
                  borderRadius: '24px',
                  background: '#FFFFFF',
                  boxShadow: '0px 3px 33px 0px #00000012',
                }}
                onClick={() => navigate(`/admin/users/${id}/favorites`)}
              >
                <div className="flex h-full justify-between">
                  <div className="flex flex-col" style={{ gap: '32px' }}>
                    <p
                      style={{
                        fontFamily: 'ABeeZee',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      Users Favorite's
                    </p>
                    <p
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 700,
                        fontSize: '24px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#000000',
                      }}
                    >
                      {resolvedFavoritesCount}
                    </p>
                  </div>
                  <ChevronRight
                    className="self-center"
                    style={{
                      width: '23.000001907348633px',
                      height: '23.00000000000002px',
                      color: '#000000',
                      marginRight: '4px',
                    }}
                  />
                </div>
              </Card>
              <Card 
                className="p-5 bg-card border-border cursor-pointer"
                style={{
                  width: '100%',
                  maxWidth: '316px',
                  height: '148px',
                  borderRadius: '24px',
                  background: '#FFFFFF',
                  boxShadow: '0px 3px 33px 0px #00000012',
                }}
                onClick={() => navigate(`/admin/users/${id}/chats`)}
              >
                <div className="flex h-full justify-between">
                  <div className="flex flex-col" style={{ gap: '32px' }}>
                    <p
                      style={{
                        fontFamily: 'ABeeZee',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      Users Chats
                    </p>
                    <p
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 700,
                        fontSize: '24px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#000000',
                      }}
                    >
                      {chatsCount}
                    </p>
                  </div>
                  <ChevronRight
                    className="self-center"
                    style={{
                      width: '23.000001907348633px',
                      height: '23.00000000000002px',
                      color: '#000000',
                      marginRight: '4px',
                    }}
                  />
                </div>
              </Card>
            </div>
          </div>

            </>
          )}

          {id && (
            <ChangePasswordDialog
              userId={id}
              userName={profile.full_name}
              open={isPasswordDialogOpen}
              onOpenChange={setIsPasswordDialogOpen}
            />
          )}

        </div>
      </main>
    </div>
  );
}
