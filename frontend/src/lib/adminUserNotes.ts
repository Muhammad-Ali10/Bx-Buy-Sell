export interface AdminUserNote {
  text: string;
  updatedAt?: string;
}

const STORAGE_KEY = "admin-user-notes";

export const getAdminUserNotes = (): Record<string, AdminUserNote> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Failed to read admin user notes:", error);
    return {};
  }
};

export const getAdminUserNote = (userId: string): string => {
  const notes = getAdminUserNotes();
  return notes[userId]?.text || "";
};

export const setAdminUserNote = (userId: string, text: string) => {
  if (typeof window === "undefined") return;
  const current = getAdminUserNotes();
  if (text && text.trim()) {
    current[userId] = {
      text: text.trim(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    delete current[userId];
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (error) {
    console.error("Failed to save admin user notes:", error);
  }
};
