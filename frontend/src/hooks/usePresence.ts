import { useEffect } from "react";
import { openPresenceConnection, closePresenceConnection } from "@/lib/socket";

/**
 * Keeps one socket open for as long as someone is signed in.
 *
 * Presence used to ride on the chat screens' own sockets, so a member reading
 * listings counted as offline and every navigation flipped their status. This
 * is mounted once at the root instead, which makes "online" mean "on the
 * platform" rather than "looking at a chat".
 */
export const usePresence = () => {
  useEffect(() => {
    let currentToken = localStorage.getItem("auth_token");
    if (currentToken) {
      openPresenceConnection(currentToken);
    }

    // The token changes without this component ever remounting: signing in or
    // out here, or in another tab.
    const sync = () => {
      const token = localStorage.getItem("auth_token");
      if (token === currentToken) return;
      currentToken = token;
      if (token) {
        openPresenceConnection(token);
      } else {
        closePresenceConnection();
      }
    };

    const interval = setInterval(sync, 5000);
    window.addEventListener("storage", sync);
    window.addEventListener("auth:logout", sync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth:logout", sync);
      closePresenceConnection();
    };
  }, []);
};
