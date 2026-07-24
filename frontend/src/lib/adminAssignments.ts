export interface LocalListingAssignment {
  userId: string;
  full_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  role?: string | null;
  assignedAt?: string;
}

const STORAGE_KEY = "admin-listing-assignments";

export const getLocalListingAssignments = (): Record<string, LocalListingAssignment> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Failed to read local listing assignments:", error);
    return {};
  }
};

export const setLocalListingAssignment = (
  listingId: string,
  assignment: LocalListingAssignment | null
) => {
  if (typeof window === "undefined") return;
  const current = getLocalListingAssignments();
  if (assignment) {
    current[listingId] = { ...assignment, assignedAt: assignment.assignedAt || new Date().toISOString() };
  } else {
    delete current[listingId];
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (error) {
    console.error("Failed to save local listing assignments:", error);
  }
};
