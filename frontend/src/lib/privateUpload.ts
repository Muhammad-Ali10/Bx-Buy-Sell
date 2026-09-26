import { apiClient } from "@/lib/api";

export interface PrivateUploadResult {
  success: boolean;
  /** An API path — `/attachments/<id>/download/<name>` — never a CDN address. */
  url?: string;
  error?: string;
}

/**
 * Listing documents, sent through the server rather than straight to the CDN.
 *
 * The browser used to upload them itself with an unsigned preset, which can
 * only ever make a public file: every contract and P&L was readable by anyone
 * holding the link. The server stores them privately and hands back the path
 * of the protected download route.
 *
 * One at a time, so a large video does not compete with the documents beside
 * it, and so a failure is reported for the file it belongs to.
 */
export async function uploadListingDocuments(files: File[]): Promise<PrivateUploadResult[]> {
  const results: PrivateUploadResult[] = [];
  for (const file of files) {
    const response = await apiClient.uploadDraftAttachment(file);
    results.push(
      response.success && response.data?.url
        ? { success: true, url: response.data.url }
        : { success: false, error: response.error || `"${file.name}" could not be uploaded` },
    );
  }
  return results;
}
