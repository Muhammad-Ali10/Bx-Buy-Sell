export type CapacityStatus = "UNASSIGNED" | "IN_REVIEW" | "COMPLETED";
export type DocumentStatus = "IN_REVIEW" | "VERIFIED" | "DECLINED";

export interface CapacityUpload {
  id: string;
  name: string;
  url: string;
  status: DocumentStatus;
  note?: string | null;
  /** What this one document proves, as judged by the moderator. */
  verifiedCapital?: number | null;
  reviewedAt?: string | null;
  created_at?: string | null;
}

export interface CapacityCase {
  id: string;
  documents: string[];
  uploads?: CapacityUpload[];
  /** The sum of the verified documents — computed on the server, never typed. */
  verifiedFunds: number | null;
  status: CapacityStatus;
  notes: string | null;
  created_at: string;
  buyer?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    profile_pic?: string | null;
  };
  reviewer?: {
    id: string;
    first_name?: string;
    last_name?: string;
    profile_pic?: string | null;
  } | null;
}

export const STATUS_LABEL: Record<CapacityStatus, string> = {
  UNASSIGNED: "Unassigned",
  IN_REVIEW: "In Review",
  COMPLETED: "Completed",
};

export const STATUS_STYLE: Record<CapacityStatus, string> = {
  UNASSIGNED: "bg-red-100 text-red-700",
  IN_REVIEW: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
};

export const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  IN_REVIEW: "In Review",
  VERIFIED: "Verified",
  DECLINED: "Declined",
};

/** Dot colours matching the design's document rows. */
export const DOC_STATUS_DOT: Record<DocumentStatus, string> = {
  IN_REVIEW: "bg-yellow-500",
  VERIFIED: "bg-green-600",
  DECLINED: "bg-red-600",
};

export const DOC_STATUS_TEXT: Record<DocumentStatus, string> = {
  IN_REVIEW: "text-yellow-700",
  VERIFIED: "text-green-700",
  DECLINED: "text-red-700",
};

/** Whole dollars, pinned to en-US so the format matches the rest of the admin. */
export const money = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
