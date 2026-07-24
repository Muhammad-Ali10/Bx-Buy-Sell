export type LocalNotification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "message";
  read: boolean;
  link: string | null;
  createdAt: string;
};

const keyForUser = (userId: string) => `local-notifications:${userId}`;

const safeParse = (raw: string | null): LocalNotification[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to parse local notifications:", error);
    return [];
  }
};

export const getLocalNotifications = (userId: string): LocalNotification[] => {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(keyForUser(userId)));
};

export const addLocalNotification = (
  userId: string,
  notification: Omit<LocalNotification, "id" | "read" | "createdAt">
) => {
  if (typeof window === "undefined") return null;
  const current = getLocalNotifications(userId);
  let suffix: string;
  try {
    const c = globalThis.crypto;
    suffix =
      c && typeof c.randomUUID === "function"
        ? c.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  const id = `local-${suffix}`;
  const newNotification: LocalNotification = {
    id,
    read: false,
    createdAt: new Date().toISOString(),
    ...notification,
  };
  const next = [newNotification, ...current];
  window.localStorage.setItem(keyForUser(userId), JSON.stringify(next));
  return newNotification;
};

export const markLocalNotificationAsRead = (userId: string, notificationId: string) => {
  if (typeof window === "undefined") return [];
  const current = getLocalNotifications(userId);
  const next = current.map((n) =>
    n.id === notificationId ? { ...n, read: true } : n
  );
  window.localStorage.setItem(keyForUser(userId), JSON.stringify(next));
  return next;
};

export const markAllLocalNotificationsAsRead = (userId: string) => {
  if (typeof window === "undefined") return [];
  const current = getLocalNotifications(userId);
  const next = current.map((n) => ({ ...n, read: true }));
  window.localStorage.setItem(keyForUser(userId), JSON.stringify(next));
  return next;
};

export const deleteLocalNotification = (userId: string, notificationId: string) => {
  if (typeof window === "undefined") return [];
  const current = getLocalNotifications(userId);
  const next = current.filter((n) => n.id !== notificationId);
  window.localStorage.setItem(keyForUser(userId), JSON.stringify(next));
  return next;
};
