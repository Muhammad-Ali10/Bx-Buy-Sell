import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A titled card with an edit pencil.
 *
 * The Account Details page is a stack of these — Personal Information, Your
 * Address — and each one is read-only until its pencil is pressed. Editing one
 * card at a time keeps the page calm and makes it obvious what a Save applies
 * to, which the old single-form page could not.
 */

interface AccountSectionProps {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  children: ReactNode;
}

export const AccountSection = ({
  title,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
  children,
}: AccountSectionProps) => (
  <section className="rounded-2xl border border-[#E9EBF2] bg-white p-5">
    <div className="flex items-start justify-between gap-3">
      <h3 className="m-0 text-[15px] font-semibold text-[#0F172A]" style={{ fontFamily: 'Lufga' }}>
        {title}
      </h3>

      {editing ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-60"
            style={{ fontFamily: 'Lufga' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg px-3.5 py-1.5 text-[12px] font-medium text-black hover:brightness-95 disabled:opacity-60"
            style={{ background: 'rgba(174, 243, 31, 1)', fontFamily: 'Lufga' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${title}`}
          className="rounded-lg p-1.5 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>

    <dl className="mt-4 flex flex-col gap-3.5">{children}</dl>
  </section>
);

interface AccountFieldProps {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  /** Some fields are shown but never editable here, e.g. the account role. */
  readOnly?: boolean;
  max?: string;
}

export const AccountField = ({
  label,
  value,
  editing,
  onChange,
  type = "text",
  placeholder,
  readOnly,
  max,
}: AccountFieldProps) => (
  <div className="flex items-center justify-between gap-4">
    <dt
      className="shrink-0 text-[13px] text-[#64748B]"
      style={{ fontFamily: 'Lufga' }}
    >
      {label}
    </dt>
    <dd className="m-0 min-w-0 flex-1 text-right">
      {editing && !readOnly ? (
        <input
          type={type}
          value={value}
          max={max}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full max-w-[220px] rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[13px] text-[#0F172A] outline-none focus:border-[#94A3B8]"
          style={{ fontFamily: 'Lufga' }}
        />
      ) : (
        <span
          className="block truncate text-[13px] font-medium text-[#0F172A]"
          style={{ fontFamily: 'Lufga' }}
        >
          {value?.trim() ? value : <span className="text-[#94A3B8]">Not set</span>}
        </span>
      )}
    </dd>
  </div>
);
