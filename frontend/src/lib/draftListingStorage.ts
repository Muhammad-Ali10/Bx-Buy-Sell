export const DRAFT_LISTING_STORAGE_KEY = "draft_listing";

const DRAFT_VERSION = 1;

/** Must stay in sync with `DashboardStep` in `pages/Dashboard.tsx`. */
export type StoredListingStep =
  | "category"
  | "brand-information"
  | "tools"
  | "financials"
  | "statistics"
  | "products"
  | "management"
  | "accounts"
  | "ad-informations"
  | "handover"
  | "packages";

export type DraftListingPayload = {
  v: number;
  savedAt: number;
  activeStep: StoredListingStep;
  formData: Record<string, unknown>;
  /** When true, user clicked Publish while logged out; resume after auth. */
  pendingPublish?: boolean;
};

function isStoredListingStep(value: unknown): value is StoredListingStep {
  const steps: StoredListingStep[] = [
    "category",
    "brand-information",
    "tools",
    "financials",
    "statistics",
    "products",
    "management",
    "accounts",
    "ad-informations",
    "handover",
    "packages",
  ];
  return typeof value === "string" && steps.includes(value as StoredListingStep);
}

/**
 * Read and validate draft_listing from localStorage. Returns null if missing or invalid.
 */
export function readDraftListing(): DraftListingPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_LISTING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.v !== DRAFT_VERSION) return null;
    if (typeof o.savedAt !== "number") return null;
    const activeStep =
      o.activeStep === "additional-information" ? "statistics" : o.activeStep;
    if (!isStoredListingStep(activeStep)) return null;
    if (!o.formData || typeof o.formData !== "object" || Array.isArray(o.formData)) {
      return null;
    }
    return {
      v: DRAFT_VERSION,
      savedAt: o.savedAt,
      activeStep,
      formData: o.formData as Record<string, unknown>,
      pendingPublish: o.pendingPublish === true,
    };
  } catch {
    return null;
  }
}

export function writeDraftListing(payload: Omit<DraftListingPayload, "v" | "savedAt"> & { savedAt?: number }) {
  if (typeof window === "undefined") return;
  const full: DraftListingPayload = {
    v: DRAFT_VERSION,
    savedAt: payload.savedAt ?? Date.now(),
    activeStep: payload.activeStep,
    formData: payload.formData,
    pendingPublish: payload.pendingPublish,
  };
  try {
    localStorage.setItem(DRAFT_LISTING_STORAGE_KEY, JSON.stringify(full));
  } catch {
    // Quota exceeded or private mode — ignore
  }
}

export function clearDraftListing() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_LISTING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** If JSON is corrupted, remove the key so the UI can start clean. */
export function clearInvalidDraftListing() {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(DRAFT_LISTING_STORAGE_KEY);
  if (!raw) return;
  if (readDraftListing() === null) {
    localStorage.removeItem(DRAFT_LISTING_STORAGE_KEY);
  }
}
