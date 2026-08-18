import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "admin-sidebar-collapsed";
/** Screens that need the width more than they need the labels. */
const COLLAPSED_BY_DEFAULT = ["/admin/chats"];

/** Fired when one component toggles, so any other mounted sidebar follows. */
const CHANGE_EVENT = "admin-sidebar-collapsed-changed";

const readStored = (): boolean | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return null;
};

/**
 * Whether the admin sidebar is showing as an icon-only rail.
 *
 * All Chats needs three columns side by side, so it starts collapsed. That is
 * only a starting point: the moment someone chooses for themselves the choice
 * is remembered and applies everywhere, because a sidebar that keeps
 * reopening itself is worse than one that is simply narrow.
 */
export const useSidebarCollapsed = () => {
  const { pathname } = useLocation();
  const defaultForRoute = COLLAPSED_BY_DEFAULT.some((p) => pathname.startsWith(p));

  const [collapsed, setCollapsed] = useState<boolean>(
    () => readStored() ?? defaultForRoute,
  );

  // Only follow the route while the user has expressed no preference.
  useEffect(() => {
    if (readStored() === null) {
      setCollapsed(defaultForRoute);
    }
  }, [defaultForRoute]);

  useEffect(() => {
    const sync = () => {
      const stored = readStored();
      setCollapsed(stored ?? defaultForRoute);
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [defaultForRoute]);

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return next;
    });
  }, []);

  const expand = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "0");
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setCollapsed(false);
  }, []);

  return { collapsed, toggle, expand };
};
