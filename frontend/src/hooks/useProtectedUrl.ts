import { useEffect, useState } from "react";
import { toast } from "sonner";
import { attachmentUrl, isPrivateAttachment } from "@/lib/downloadFile";

/**
 * A private file, fetched with the viewer's token, as an object URL.
 *
 * Files are only readable through the protected download route now, and an
 * `<img>`, `<iframe>` or `<a href>` cannot send the token that route needs —
 * pointing one at it shows a broken image. So the bytes are fetched here and
 * handed over as a `blob:` URL the element can use. Anything that is not a
 * private attachment (a listing photo, an old public link) is returned as it
 * is and costs nothing.
 */
export async function fetchProtectedBlob(url: string): Promise<Blob | null> {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(attachmentUrl(url), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return null;
  return response.blob();
}

export function useProtectedUrl(url: string | null | undefined): {
  src: string | null;
  loading: boolean;
  failed: boolean;
} {
  const isPrivate = Boolean(url && isPrivateAttachment(url));
  const [state, setState] = useState<{ src: string | null; loading: boolean; failed: boolean }>(
    () => ({ src: isPrivate ? null : url ?? null, loading: isPrivate, failed: false }),
  );

  useEffect(() => {
    if (!url) {
      setState({ src: null, loading: false, failed: false });
      return;
    }
    if (!isPrivateAttachment(url)) {
      setState({ src: url, loading: false, failed: false });
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ src: null, loading: true, failed: false });
    fetchProtectedBlob(url)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setState({ src: null, loading: false, failed: true });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setState({ src: objectUrl, loading: false, failed: false });
      })
      .catch(() => !cancelled && setState({ src: null, loading: false, failed: true }));

    return () => {
      cancelled = true;
      // The bytes are held in memory until the URL is let go.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return state;
}

/**
 * Open a file in a new tab — through the protected route when it is private.
 *
 * The tab is opened first, while the click still counts as the viewer's own,
 * and pointed at the file once it has arrived; opening it afterwards is what a
 * pop-up blocker refuses.
 */
export async function openProtected(url: string | null | undefined): Promise<void> {
  if (!url) return;
  if (!isPrivateAttachment(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!localStorage.getItem("auth_token")) {
    // A guest's upload waits for the account they sign up with before anyone
    // can read it — them included.
    toast.error("Sign in to open this file.");
    return;
  }
  const tab = window.open("", "_blank");
  try {
    const blob = await fetchProtectedBlob(url);
    if (!blob) {
      tab?.close();
      toast.error("You do not have access to this file.");
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    if (tab) tab.location.href = objectUrl;
    else window.open(objectUrl, "_blank");
    // Long enough for the tab to load it; the tab keeps its own copy.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch {
    tab?.close();
    toast.error("This file could not be opened.");
  }
}
