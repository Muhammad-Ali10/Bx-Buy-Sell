/**
 * Where the API lives.
 *
 * Its own module so that code needing only this — the attachment downloader,
 * for one — does not have to pull in the whole API client. That client reads
 * `import.meta.env`, which the test runner cannot parse, so importing it for a
 * single string took an otherwise pure module out of reach of its own tests.
 */
export const apiBaseUrl: string =
  (import.meta as any)?.env?.VITE_API_BASE_URL || "http://localhost:5000";
