import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Mail, ScanFace, Wallet } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { VerificationDialog } from "@/components/account/VerificationDialog";
import { IdentityVerificationDialog } from "@/components/account/IdentityVerificationDialog";
import AcquisitionCapacityUpload from "@/components/AcquisitionCapacityUpload";
import { toast } from "sonner";

/**
 * Verify Your Account — the four things an account can prove about itself.
 *
 * All four states come from one request. Four badges that must agree cannot be
 * assembled from four independent calls without occasionally showing a set that
 * never existed together.
 *
 * Each unverified row opens the flow that fixes it, so the badge is not just a
 * label — it is the way in.
 */

interface VerificationState {
  sms: { verified: boolean; value: string | null };
  email: { verified: boolean; value: string | null };
  identity: { verified: boolean; status: string | null };
  funds: { verified: boolean; status: string | null };
}

type RowId = "sms" | "email" | "identity" | "funds";

const ROWS: { id: RowId; icon: React.ReactNode; title: string; description: string }[] = [
  {
    id: "sms",
    icon: <MessageSquare className="h-5 w-5" />,
    title: "SMS Verification",
    description: "Secure your account with SMS verification",
  },
  {
    id: "email",
    icon: <Mail className="h-5 w-5" />,
    title: "E-Mail Verification",
    description:
      "Enhance your account security with email verification to ensure you receive important notifications",
  },
  {
    id: "identity",
    icon: <ScanFace className="h-5 w-5" />,
    title: "ID - Identity Verification",
    description: "Earn trust and verify your identity to show other users that you're a real person",
  },
  {
    id: "funds",
    icon: <Wallet className="h-5 w-5" />,
    title: "Funds Verification",
    description:
      "Confirm that you have the financial credibility to purchase or finance this business",
  },
];

export const AccountVerification = () => {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [smsOpen, setSmsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [fundsOpen, setFundsOpen] = useState(false);

  const { data } = useQuery<VerificationState | null>({
    queryKey: ["verification-overview", user?.id],
    queryFn: async () => {
      const response: any = await apiClient.getVerificationOverview();
      return response?.success === false ? null : (response?.data ?? response);
    },
    enabled: Boolean(user),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["verification-overview"] });

  /** The api client reports failures as a payload; the dialogs expect a throw. */
  const unwrap = async (call: Promise<any>) => {
    const response: any = await call;
    if (response?.success === false) {
      throw new Error(response?.error || response?.message || "Something went wrong.");
    }
    return response;
  };

  const isVerified = (id: RowId) => Boolean(data?.[id]?.verified);

  const open = (id: RowId) => {
    if (id === "sms") setSmsOpen(true);
    if (id === "email") setEmailOpen(true);
    if (id === "identity") setIdentityOpen(true);
    if (id === "funds") setFundsOpen((current) => !current);
  };

  return (
    <div className="rounded-2xl border border-[#E9EBF2] bg-white p-5 sm:p-6">
      <h2
        className="m-0 text-[19px] font-bold text-[#0F172A]"
        style={{ fontFamily: 'Lufga' }}
      >
        Verify Your Account
      </h2>
      <p
        className="mt-1 mb-0 text-[12.5px] text-[#64748B]"
        style={{ fontFamily: 'Lufga' }}
      >
        Verify your account to increase trust and access platform features securely
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {ROWS.map((row) => {
          const verified = isVerified(row.id);
          return (
            <div key={row.id}>
              <button
                type="button"
                onClick={() => (verified ? undefined : open(row.id))}
                disabled={verified}
                className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-4 text-left transition-colors sm:gap-4 ${
                  verified ? "cursor-default" : "hover:bg-[#F1F3F7]"
                }`}
                style={{ background: 'rgba(250, 250, 250, 1)' }}
              >
                <span
                  className="flex shrink-0 items-center justify-center rounded-xl bg-white text-[#0F172A]"
                  style={{ width: '44px', height: '44px' }}
                >
                  {row.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[14px] font-semibold text-[#0F172A]"
                    style={{ fontFamily: 'Lufga' }}
                  >
                    {row.title}
                  </span>
                  <span
                    className="mt-0.5 block text-[11.5px] leading-relaxed text-[#64748B]"
                    style={{ fontFamily: 'Lufga' }}
                  >
                    {row.description}
                  </span>
                </span>

                <span
                  className="shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-medium"
                  style={{
                    fontFamily: 'Lufga',
                    background: verified ? 'rgba(197, 253, 31, 1)' : 'rgba(255, 226, 226, 1)',
                    color: verified ? 'rgba(0, 0, 0, 1)' : 'rgba(220, 38, 38, 1)',
                  }}
                >
                  {verified ? 'Verified' : 'Not Verified'}
                </span>
              </button>

              {/* Funds is the one that cannot be settled in a dialog: documents
                  are uploaded, then a moderator decides. So it opens in place. */}
              {row.id === "funds" && fundsOpen && !verified && (
                <div className="mt-3 rounded-xl border border-[#E9EBF2] p-4">
                  <AcquisitionCapacityUpload />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <VerificationDialog
        open={smsOpen}
        onOpenChange={setSmsOpen}
        channel="sms"
        initialValue={data?.sms.value ?? ""}
        onSend={(value) => unwrap(apiClient.sendPhoneCode(value)).then(() => undefined)}
        onVerify={(code) => unwrap(apiClient.verifyPhoneCode(code)).then(() => undefined)}
        onVerified={async () => {
          await refreshUser();
          refresh();
        }}
      />

      <VerificationDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        channel="email"
        onSend={(value) => unwrap(apiClient.sendEmailChangeCode(value)).then(() => undefined)}
        onVerify={(code) => unwrap(apiClient.verifyEmailChangeCode(code)).then(() => undefined)}
        onVerified={() => {
          // Changing the sign-in address ends other sessions, so this one has to
          // be re-established rather than quietly carrying on.
          toast.success("Email verified. Please sign in again.");
          window.location.href = "/login";
        }}
      />

      <IdentityVerificationDialog open={identityOpen} onOpenChange={setIdentityOpen} />
    </div>
  );
};

export default AccountVerification;
