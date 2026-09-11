/**
 * Saving an attachment, rather than letting the browser preview it.
 *
 * Attachments are delivered straight from the CDN, and the CDN sends no
 * `Content-Disposition` — so a link to a .txt, .png or .csv opened it in the
 * tab instead of downloading it. Only the listing page's own button forced a
 * save; every other route was a bare `window.open`.
 *
 * Two ways to force it, and both are here because neither suits every file:
 *
 *  - fetch into a blob, then click a local link. The file name is ours to set,
 *    which is what keeps a `.jpeg` called `.jpeg` — the CDN would name it
 *    `.jpg`. But the whole file sits in memory first.
 *  - ask the CDN for it with `fl_attachment`, which sets the header itself and
 *    streams. Nothing is held in memory; the name comes from the CDN.
 *
 * Video is allowed up to 100 MB, and a 100 MB blob in a phone's tab is how a
 * download fails silently, so video takes the second route and everything else
 * takes the first.
 */

import { toast } from "sonner";
import { apiBaseUrl } from "./apiBase";
import { getFileExtension } from "./fileTypes";
import { fileNameFromUrl } from "./mediaUtils";

const STREAMED_EXTENSIONS = ["mp4", "mov"];

/**
 * A private document, served by our own API rather than the CDN.
 *
 * These are the files that used to sit on a public CDN URL. They are only
 * readable now by someone the server has checked, which means the request
 * carries a session — a bare `window.open` would arrive without one and be
 * refused.
 */
const ATTACHMENT_PATH = /^\/attachments\/[^/]+\/download(?:\/.*)?$/;

export const isPrivateAttachment = (url: string): boolean =>
  ATTACHMENT_PATH.test(String(url || "").split("?")[0]);

/** The absolute address of a private attachment. */
export const attachmentUrl = (url: string): string =>
  isPrivateAttachment(url) ? `${apiBaseUrl}${url}` : url;

/**
 * The same asset, asked for as an attachment.
 *
 * Cloudinary reads `fl_attachment` as a delivery flag and answers with
 * `Content-Disposition: attachment`. Left alone for anything not on the CDN,
 * where the flag would only corrupt the path.
 */
export const asAttachmentUrl = (url: string): string => {
  if (!/^https?:\/\/res\.cloudinary\.com\//i.test(url)) return url;
  if (!url.includes("/upload/")) return url;
  if (url.includes("/fl_attachment")) return url;
  return url.replace("/upload/", "/upload/fl_attachment/");
};

/** True for the files that are streamed rather than held in memory. */
const shouldStream = (url: string): boolean =>
  STREAMED_EXTENSIONS.includes(getFileExtension(url));

/**
 * Save the file behind this URL.
 *
 * `fileName` overrides the name taken from the URL — pass it where the real
 * name is known from somewhere better than the last path segment.
 */
export async function downloadAttachment(url: string, fileName?: string): Promise<void> {
  if (!url || url === "#") return;

  const name = fileName || fileNameFromUrl(url);

  /*
   * A private document is fetched with the session attached.
   *
   * Streaming it from the CDN is not an option here, and neither is opening
   * it in a tab: the server checks who is asking, and a plain navigation
   * carries no Authorization header. So it always comes through the blob
   * route, which is also where the file name we hold is applied.
   */
  if (isPrivateAttachment(url)) {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(attachmentUrl(url), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.status === 401 || response.status === 403) {
        toast.error("You do not have access to this file.");
        return;
      }
      if (!response.ok) {
        toast.error(`This file could not be downloaded (${response.status}).`);
        return;
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = name || "attachment";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("This file could not be downloaded.");
    }
    return;
  }

  if (shouldStream(url)) {
    // Let the CDN send it with the header, so a large video never has to fit
    // in a blob first.
    window.open(asAttachmentUrl(url), "_blank", "noopener,noreferrer");
    return;
  }

  try {
    const response = await fetch(url);

    /*
     * Do not save a refusal as if it were the file.
     *
     * The CDN answers 401 for a document it is not allowed to deliver, and
     * that response has a body like any other — so this saved it under the
     * file's own name and handed the buyer a "PDF" of nothing, which is what
     * "the file is destroyed, I can't open it" actually was. Say so instead.
     */
    if (!response.ok) {
      toast.error(
        `This file could not be downloaded (${response.status}). Please tell the seller.`,
      );
      return;
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = name || "attachment";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error("Error downloading file:", error);
    // The blob route failed — the CDN can still send it with the header, and
    // that at least saves rather than previewing.
    window.open(asAttachmentUrl(url), "_blank", "noopener,noreferrer");
  }
}
