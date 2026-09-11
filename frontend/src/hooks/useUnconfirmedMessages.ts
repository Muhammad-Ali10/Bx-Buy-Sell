import { useCallback, useEffect, useMemo, useRef } from "react";

export interface UnconfirmedMessage {
  tempId: string;
  content: string;
  /** Typed text can go back in the box; an attachment cannot. */
  restorable: boolean;
}

/**
 * Messages on screen that the server has not saved yet.
 *
 * A chat window shows what you send at once, and swaps it for the saved copy
 * when the server sends that back. When the server refused a message instead,
 * nothing came back: it sat on screen as though sent, and was gone after the
 * next refresh — with no word to anyone. Every message is now watched until it
 * is confirmed, and one that is refused, or not confirmed in time, goes to
 * `onFail` so the window can take it back down and say so.
 */
export function useUnconfirmedMessages(
  onFail: (message: UnconfirmedMessage, reason?: string) => void,
  timeoutMs = 15000,
) {
  const pending = useRef(
    new Map<string, { message: UnconfirmedMessage; timer: ReturnType<typeof setTimeout> }>(),
  );
  // The latest callback, without re-creating everything that uses it.
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  const fail = useCallback((tempId: string, reason?: string) => {
    const entry = pending.current.get(tempId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.current.delete(tempId);
    onFailRef.current(entry.message, reason);
  }, []);

  const track = useCallback(
    (message: UnconfirmedMessage) => {
      const timer = setTimeout(() => fail(message.tempId), timeoutMs);
      pending.current.set(message.tempId, { message, timer });
    },
    [fail, timeoutMs],
  );

  /** The saved copy arrived: stop watching. Safe to call more than once. */
  const confirm = useCallback((tempId: string) => {
    const entry = pending.current.get(tempId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.current.delete(tempId);
  }, []);

  /** The server refused something — everything still waiting is what it refused. */
  const failAll = useCallback(
    (reason?: string) => {
      [...pending.current.keys()].forEach((tempId) => fail(tempId, reason));
    },
    [fail],
  );

  useEffect(() => {
    const entries = pending.current;
    return () => {
      entries.forEach(({ timer }) => clearTimeout(timer));
      entries.clear();
    };
  }, []);

  // One object for the life of the window, so the handlers that use it can
  // name it as a dependency without being re-created on every render.
  return useMemo(() => ({ track, confirm, failAll }), [track, confirm, failAll]);
}
