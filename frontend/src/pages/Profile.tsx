import { orUnknown } from "@/lib/emptyValue";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { capacityRowStatus } from "@/lib/capacityStatus";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Mail, Lock, Smartphone, IdCard, Wallet } from "lucide-react";
import { ListingsSidebar } from "@/components/listings/ListingsSidebar";
import Header from "@/components/Header";
import { AccountSection, AccountField } from "@/components/account/AccountSection";
import { DangerZone } from "@/components/account/DangerZone";
import { AccountSubscriptions } from "@/components/account/AccountSubscriptions";
import { AccountBilling } from "@/components/account/AccountBilling";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { VerificationDialog } from "@/components/account/VerificationDialog";
import { ChangePasswordDialog } from "@/components/account/ChangePasswordDialog";
import { IdentityVerificationDialog } from "@/components/account/IdentityVerificationDialog";
import {ActPhone, ActEmail ,FaceId, LockIcon, PassLock} from "@/assets/svg";
/**
 * Account Details — everything about the account in one place.
 *
 * Settings used to be a second page covering much the same ground, which meant
 * two places to look for one thing. Its contents live here now, split across
 * three tabs so the page does not become a wall.
 */

type TabId = "overview" | "subscriptions" | "billing";

interface ProfileState {
  first_name: string;
  last_name: string;
  company_name: string;
  birthday: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  state: string;
  zip_code: string;
}

const EMPTY: ProfileState = {
  first_name: "",
  last_name: "",
  company_name: "",
  birthday: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  state: "",
  zip_code: "",
};

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  /*
   * No Verification tab. Its checks already sit under the name on Overview —
   * phone, ID and funds each with their own Verify Now, e-mail behind Change —
   * and the client asked not to have them twice. `AccountVerification` and
   * /verify-account are kept; nothing on this page links to them.
   */
  { id: "subscriptions", label: "Subscriptions" },
  { id: "billing", label: "Billing" },
];

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, logout, refreshUser } = useAuth();
  const { tier } = useSubscriptionTier();

  /*
   * A link can open a tab directly: a finished buyer-plan checkout sends the
   * member to ?tab=subscriptions, so what they just bought is the first thing
   * they see.
   */
  const [tab, setTab] = useState<TabId>(() => {
    const asked = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((t) => t.id === asked) ? (asked as TabId) : "overview";
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileState>(EMPTY);
  /** The values as last loaded, so Cancel can put them back. */
  const [pristine, setPristine] = useState<ProfileState>(EMPTY);
  const [editingSection, setEditingSection] = useState<"personal" | "address" | null>(null);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false);
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const identityReturnRef = useRef(false);

  /*
   * Proof of funds has a state of its own — sent, under review, verified. The
   * row said "Verify Now" through all of them, so someone who had just sent
   * their documents came back here to be asked for them again.
   */
  const { data: verification } = useQuery<any>({
    queryKey: ["verification-overview", user?.id],
    queryFn: async () => {
      const response: any = await apiClient.getVerificationOverview();
      if (response?.success === false) return null;
      const payload = response?.data;
      return payload?.funds ? payload : payload?.data ?? null;
    },
    enabled: Boolean(user?.id),
  });
  const fundsState = capacityRowStatus(verification?.funds);

  /**
   * The api client answers with a payload rather than throwing, so the dialog's
   * promise contract needs the failure turned back into a rejection — that is
   * what puts the server's own wording in front of the person.
   */
  const unwrap = async (call: Promise<any>) => {
    const response: any = await call;
    if (response?.success === false) {
      throw new Error(response?.error || response?.message || 'Something went wrong.');
    }
    return response;
  };

  /**
   * Load once per account, not every time the `user` object changes identity.
   *
   * This effect used to depend on the whole object and re-fetch on any change
   * to it. The session is re-checked every few seconds, so a half-typed phone
   * number was wiped out from under the person entering it — the only way to
   * save was to type and click in the same breath. Whatever causes the object
   * to change, a form being edited must not be re-seeded from the server.
   */
  const loadedProfileForRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!user?.id || loadedProfileForRef.current === user.id) return;

    loadedProfileForRef.current = user.id;
    loadProfile(user.id);
  }, [isAuthenticated, authLoading, user?.id, navigate]);

  /*
   * Back from didit. The result arrives separately, on the provider's webhook,
   * so all this can say is that the check is under way — and look again a
   * little later, by when it has usually landed.
   */
  useEffect(() => {
    if (identityReturnRef.current || searchParams.get("identity") !== "done") return;
    identityReturnRef.current = true;
    toast.success(
      "Thanks — your ID check has been submitted. Your status updates here as soon as it is confirmed.",
    );
    const next = new URLSearchParams(searchParams);
    next.delete("identity");
    setSearchParams(next, { replace: true });
    void refreshUser();
    const again = window.setTimeout(() => void refreshUser(), 15000);
    return () => window.clearTimeout(again);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const response = await apiClient.getUserById(userId);
      if (response.success && response.data) {
        const data = response.data as any;
        const next: ProfileState = {
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          company_name: data.business_name || "",
          birthday: data.birthday || "",
          phone: data.phone || "",
          address: data.address || "",
          city: data.city || "",
          country: data.country || "",
          state: data.state || "",
          zip_code: data.zip_code || "",
        };
        setProfile(next);
        setPristine(next);
      }
    } catch (error: any) {
      toast.error("Could not load your details.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const response = await apiClient.updateUser(user.id, {
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        business_name: profile.company_name || undefined,
        // `null`, not `undefined`: an omitted field leaves the stored value
        // alone, so clearing the date would never take.
        birthday: profile.birthday || null,
        phone: profile.phone || undefined,
        address: profile.address || undefined,
        city: profile.city || undefined,
        country: profile.country || undefined,
        state: profile.state || undefined,
        zip_code: profile.zip_code || undefined,
      });

      if (response.success) {
        toast.success("Saved.");
        setPristine(profile);
        setEditingSection(null);
        // Keep the header and everything else reading `user` in step. Safe now
        // that the form only re-seeds when the account changes, not the object.
        await refreshUser();
      } else {
        toast.error(response.error || "Could not save your details.");
      }
    } catch (error: any) {
      toast.error(error.message || "Could not save your details.");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setProfile(pristine);
    setEditingSection(null);
  };

  const set = (key: keyof ProfileState) => (value: string) =>
    setProfile((prev) => ({ ...prev, [key]: value }));

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-muted-foreground">Loading your details…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  const displayName =
    `${profile.first_name} ${profile.last_name}`.trim() || user.email?.split("@")[0] || "User";

  return (
    <div className="flex min-h-screen bg-background">
      <ListingsSidebar />

      <div className="flex-1 min-w-0 md:w-auto lg:ml-[240px] xl:ml-[280px]">
        <Header inColumn />

        <main className="px-4 py-6 sm:px-6 lg:px-10">
          <h1
            className="m-0 text-[22px] font-bold text-[#0F172A] sm:text-[26px]"
            style={{ fontFamily: 'Lufga' }}
          >
            Your Account Details
          </h1>

          <div className="mt-4 flex gap-6 border-b border-[#E9EBF2]">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={`-mb-px border-b-2 pb-2.5 text-[14px] transition-colors ${
                  tab === entry.id
                    ? "border-[#AEF31F] font-semibold text-[#0F172A]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
                style={{ fontFamily: 'Lufga' }}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="mt-6 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)_280px]">
              <div className="flex flex-col gap-5">
                <section className="rounded-2xl border border-[#E9EBF2] bg-white p-5">
                  <div className="flex flex-col items-center text-center">
                    <img
                      src={user.profile_pic || "/placeholder.svg"}
                      alt=""
                      className="h-[84px] w-[84px] rounded-full object-cover"
                    />
                    {tier !== "MINIMUM" && (
                      <span
                        className="-mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-black"
                        style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
                      >
                        {tier === "PREMIUM" ? "Premium" : "Starter"}
                      </span>
                    )}
                    <h2
                      className="mt-3 mb-0 text-[17px] font-semibold text-[#0F172A]"
                      style={{ fontFamily: 'Lufga' }}
                    >
                      {displayName}
                    </h2>
                  </div>

                  <ul className="mt-5 flex flex-col gap-3 border-t border-[#F1F5F9] pt-4">
                    {/* An unconfirmed address is offered the check first; the
                        Verification tab used to be the only place saying so. */}
                    <StatusRow
                      icon={<ActEmail className="h-4 w-4" />}
                      label={orUnknown(user.email)}
                      action={
                        (user as any).is_email_verified
                          ? { text: "Change", onClick: () => setEmailDialogOpen(true) }
                          : { text: "Verify Now", onClick: () => setEmailConfirmOpen(true) }
                      }
                      pending={!(user as any).is_email_verified}
                    />
                    {/* The one row in this column with nothing to press. The
                        rest all offer the thing they describe. */}
                    <StatusRow
                      icon={<PassLock className="h-4 w-4" />}
                      label="Password: ••••••"
                      action={{ text: "Edit", onClick: () => setPasswordDialogOpen(true) }}
                    />
                    <StatusRow
                      icon={<ActPhone className="h-4 w-4" />}
                      label={profile.phone || "No phone number"}
                      action={
                        (user as any).is_phone_verified && profile.phone
                          ? undefined
                          : { text: "Verify Now", onClick: () => setPhoneDialogOpen(true) }
                      }
                      pending={!(user as any).is_phone_verified}
                    />
                    <StatusRow
                      icon={<FaceId className="h-4 w-4" />}
                      label={(user as any).verified ? "ID verified" : "ID not verified"}
                      action={
                        (user as any).verified
                          ? undefined
                          : { text: "Verify Now", onClick: () => setIdentityDialogOpen(true) }
                      }
                      pending={!(user as any).verified}
                    />
                    {/* Sent documents read "In Review", a finished review
                        "Verified"; both open the page listing the documents
                        and their verdicts, where more can be added. */}
                    <StatusRow
                      icon={<LockIcon className="h-4 w-4" />}
                      label="Acquisition Capacity"
                      action={
                        fundsState === "VERIFIED"
                          ? {
                              text: "Verified",
                              tone: "green",
                              title: "See your documents",
                              onClick: () => navigate("/verify-funds"),
                            }
                          : fundsState === "IN_REVIEW"
                            ? {
                                text: "In Review",
                                tone: "amber",
                                title: "See your documents",
                                onClick: () => navigate("/verify-funds"),
                              }
                            : { text: "Verify Now", onClick: () => navigate("/verify-funds") }
                      }
                    />
                  </ul>
                </section>

                <DangerZone
                  onClosed={async () => {
                    await logout();
                    navigate("/");
                  }}
                />
              </div>

              <div className="flex flex-col gap-5">
                <AccountSection
                  title="Personal Information"
                  editing={editingSection === "personal"}
                  onEdit={() => setEditingSection("personal")}
                  onCancel={cancelEdit}
                  onSave={save}
                  saving={saving}
                >
                  <AccountField
                    label="Company Name"
                    value={profile.company_name}
                    editing={editingSection === "personal"}
                    onChange={set("company_name")}
                  />
                  <AccountField
                    label="First Name"
                    value={profile.first_name}
                    editing={editingSection === "personal"}
                    onChange={set("first_name")}
                  />
                  <AccountField
                    label="Last Name"
                    value={profile.last_name}
                    editing={editingSection === "personal"}
                    onChange={set("last_name")}
                  />
                  {/* A native date input is the date selection window: it opens
                      the platform's own calendar, speaks the reader's locale,
                      and hands back exactly the YYYY-MM-DD the column stores. */}
                  <AccountField
                    label="Birthday"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={profile.birthday}
                    editing={editingSection === "personal"}
                    onChange={set("birthday")}
                  />
                </AccountSection>

                <AccountSection
                  title="Your Address"
                  editing={editingSection === "address"}
                  onEdit={() => setEditingSection("address")}
                  onCancel={cancelEdit}
                  onSave={save}
                  saving={saving}
                >
                  <AccountField
                    label="Street"
                    value={profile.address}
                    editing={editingSection === "address"}
                    onChange={set("address")}
                  />
                  <AccountField
                    label="Zip Code"
                    value={profile.zip_code}
                    editing={editingSection === "address"}
                    onChange={set("zip_code")}
                  />
                  <AccountField
                    label="City"
                    value={profile.city}
                    editing={editingSection === "address"}
                    onChange={set("city")}
                  />
                  <AccountField
                    label="State"
                    value={profile.state}
                    editing={editingSection === "address"}
                    onChange={set("state")}
                  />
                  <AccountField
                    label="Country"
                    value={profile.country}
                    editing={editingSection === "address"}
                    onChange={set("country")}
                  />
                </AccountSection>
              </div>

              <section className="h-fit rounded-2xl border border-[#E9EBF2] bg-white p-5">
                <h3
                  className="m-0 text-[15px] font-semibold text-[#0F172A]"
                  style={{ fontFamily: 'Lufga' }}
                >
                  Buying Profile &amp; Alerts
                </h3>
                <p
                  className="mt-1.5 mb-0 text-[12.5px] leading-relaxed text-[#64748B]"
                  style={{ fontFamily: 'Lufga' }}
                >
                  EX will notify you when new listings match your criteria.
                </p>
                <span
                  className="mt-4 inline-block rounded-full px-4 py-2 text-[12.5px] font-medium text-black"
                  style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
                >
                  Coming Soon
                </span>
              </section>
            </div>
          )}

          <IdentityVerificationDialog
            open={identityDialogOpen}
            onOpenChange={setIdentityDialogOpen}
          />

          {/* Same flow, different channel — the client asked for the email
              change to walk the path already built for SMS. */}
          <ChangePasswordDialog
            open={passwordDialogOpen}
            onOpenChange={setPasswordDialogOpen}
          />

          <VerificationDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            channel="email"
            onSend={(value) => unwrap(apiClient.sendEmailChangeCode(value)).then(() => undefined)}
            onVerify={(code) => unwrap(apiClient.verifyEmailChangeCode(code)).then(() => undefined)}
            onVerified={async () => {
              // Changing the sign-in address ends other sessions, so this one
              // has to be re-established rather than silently carrying on.
              toast.success("Email changed. Please sign in again.");
              await logout();
              navigate("/login");
            }}
          />

          <VerificationDialog
            open={emailConfirmOpen}
            onOpenChange={setEmailConfirmOpen}
            channel="email-confirm"
            initialValue={user?.email || ""}
            onSend={() => unwrap(apiClient.sendEmailConfirmCode()).then(() => undefined)}
            onVerify={(code) => unwrap(apiClient.confirmEmailCode(code)).then(() => undefined)}
            onVerified={async () => {
              await refreshUser();
            }}
          />

          <VerificationDialog
            open={phoneDialogOpen}
            onOpenChange={setPhoneDialogOpen}
            channel="sms"
            initialValue={profile.phone}
            onSend={(value) => unwrap(apiClient.sendPhoneCode(value)).then(() => undefined)}
            onVerify={(code) => unwrap(apiClient.verifyPhoneCode(code)).then(() => undefined)}
            onVerified={async () => {
              await refreshUser();
              // Re-read the account: the pending number is now the real one.
              // Called directly rather than by clearing the ref — that would
              // leave a window where the effect could fetch a second time.
              if (user?.id) await loadProfile(user.id);
            }}
          />

          {tab === "subscriptions" && <AccountSubscriptions />}
          {tab === "billing" && <AccountBilling />}
        </main>
      </div>
    </div>
  );
};

/** The row's button: the accent for something to do, or the state itself. */
const PILL_TONES = {
  lime: { background: 'rgba(174, 243, 31, 1)', color: '#000000' },
  amber: { background: '#FEF3C7', color: '#92400E' },
  green: { background: '#DCFCE7', color: '#166534' },
} as const;

const StatusRow = ({
  icon,
  label,
  pending,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  pending?: boolean;
  action?: {
    text: string;
    onClick: () => void;
    tone?: keyof typeof PILL_TONES;
    title?: string;
  };
}) => (
  <li className="flex items-center gap-2.5">
    <span className="shrink-0 text-[#94A3B8]">{icon}</span>
    <span
      className="min-w-0 flex-1 truncate text-[12.5px] text-[#475569]"
      style={{ fontFamily: 'Lufga' }}
    >
      {label}
    </span>
    {action ? (
      <button
        type="button"
        onClick={action.onClick}
        title={action.title}
        className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-medium hover:brightness-95"
        style={{ ...PILL_TONES[action.tone ?? 'lime'], fontFamily: 'Lufga' }}
      >
        {action.text}
      </button>
    ) : (
      pending && (
        // Shown as a state, not a button, until the flow behind it exists —
        // a "Verify Now" that goes nowhere is worse than none.
        <span
          className="shrink-0 rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[10.5px] font-medium text-[#92400E]"
          style={{ fontFamily: 'Lufga' }}
        >
          Not verified
        </span>
      )
    )}
  </li>
);

export default Profile;
