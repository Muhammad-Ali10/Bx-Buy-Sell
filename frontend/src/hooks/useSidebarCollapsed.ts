import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/** Screens that need the width more than they need the labels. */
const COLLAPSED_BY_DEFAULT = ["/admin/chats"];

/** Fired when one component toggles, so any other mounted sidebar follows. */
const CHANGE_EVENT = "admin-sidebar-collapsed-changed";

/**
 * The three-column screens remember their own answer.
 *
 * One shared key meant a choice made on the dashboard — where the labels are
 * useful and there is room for them — followed the person onto All Chats and
 * pushed the third column off the screen. Which is exactly the space the chat
 * functions need. Two keys, so each kind of screen keeps what suits it.
 */
const storageKeyFor = (wide: boolean) =>
  wide ? "admin-sidebar-collapsed-wide" : "admin-sidebar-collapsed";

const readStored = (key: string): boolean | null => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    // Private windows and blocked site data both throw here; a sidebar that
    // falls back to the route's default is better than one that crashes.
  }
  return null;
};

const writeStored = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // The width still applies for this session; it just is not remembered.
  }
};

/**
 * Whether the admin sidebar is showing as an icon-only rail.
 *
 * All Chats needs three columns side by side, so it starts collapsed. That is
 * only a starting point: the moment someone chooses for themselves the choice
 * is remembered — but only for screens of the same kind, so All Chats cannot be
 * forced open by a decision made somewhere that had room to spare.
 */
export const useSidebarCollapsed = () => {
  const { pathname } = useLocation();
  const wantsWidth = COLLAPSED_BY_DEFAULT.some((p) => pathname.startsWith(p));
  const storageKey = storageKeyFor(wantsWidth);

  const [collapsed, setCollapsed] = useState<boolean>(
    () => readStored(storageKeyFor(wantsWidth)) ?? wantsWidth,
  );

  // Follow the route until this kind of screen has an answer of its own.
  useEffect(() => {
    setCollapsed(readStored(storageKey) ?? wantsWidth);
  }, [storageKey, wantsWidth]);

  useEffect(() => {
    const sync = () => setCollapsed(readStored(storageKey) ?? wantsWidth);
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [storageKey, wantsWidth]);

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      writeStored(storageKey, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return next;
    });
  }, [storageKey]);

  const expand = useCallback(() => {
    writeStored(storageKey, false);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setCollapsed(false);
  }, [storageKey]);

  return { collapsed, toggle, expand };
};
