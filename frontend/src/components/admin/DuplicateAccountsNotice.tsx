import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { apiClient } from "@/lib/api";

interface DuplicateAccount {
  id: string;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  blocked: boolean;
  /** Only one account per address is reachable at sign-in: the oldest. */
  isActiveOnSignIn: boolean;
}

interface DuplicateGroup {
  email: string;
  count: number;
  accounts: DuplicateAccount[];
}

/**
 * Warns about addresses held by more than one account.
 *
 * These are not merged automatically because each account can own listings and
 * conversations, and picking a survivor is a judgement call. They matter
 * because sign-in only ever reaches the oldest one: a password changed on any
 * of the others looks like it silently failed.
 */
export const DuplicateAccountsNotice = ({ isAdmin }: { isAdmin: boolean }) => {
  const [expanded, setExpanded] = useState(false);

  const { data } = useQuery<DuplicateGroup[]>({
    queryKey: ["admin-duplicate-accounts"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await apiClient.getDuplicateAccounts();
      if (!response.success) return [];
      const payload = response.data as any;
      return Array.isArray(payload) ? payload : (payload?.data ?? []);
    },
  });

  if (!isAdmin || !data?.length) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            {data.length === 1
              ? "One email address is used by more than one account"
              : `${data.length} email addresses are used by more than one account`}
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Only the oldest account on each address can sign in. Changing the password on
            any of the others will appear to do nothing.
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 flex-shrink-0 text-amber-700" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-amber-700" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-amber-200 pt-3">
          {data.map((group) => (
            <div key={group.email}>
              <p className="text-xs font-semibold text-amber-900">{group.email}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {group.accounts.map((account) => (
                  <li key={account.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <Link
                      to={`/admin/users/${account.id}`}
                      className="font-medium text-amber-900 underline underline-offset-2"
                    >
                      {[account.first_name, account.last_name].filter(Boolean).join(" ") ||
                        account.id.slice(0, 8)}
                    </Link>
                    <span className="text-amber-700">{account.role}</span>
                    <span className="text-amber-700">
                      joined {new Date(account.created_at).toLocaleDateString("en-US")}
                    </span>
                    {account.isActiveOnSignIn ? (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 font-medium text-amber-900">
                        signs in
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                        unreachable
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-amber-800">
            Decide which account to keep and delete the other. New duplicates can no longer
            be created.
          </p>
        </div>
      )}
    </div>
  );
};
