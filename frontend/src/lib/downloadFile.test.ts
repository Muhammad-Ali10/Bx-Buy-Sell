// The real module reads `import.meta.env`, which this runner cannot parse.
jest.mock("./apiBase", () => ({ apiBaseUrl: "http://api.test" }));

import { asAttachmentUrl, isPrivateAttachment } from "./downloadFile";
import { fileNameFromUrl } from "./mediaUtils";

/**
 * The CDN sends no `Content-Disposition`, so a link to a .txt, .png or .csv
 * opened it in the tab instead of saving it. `fl_attachment` makes the CDN
 * send the header itself — verified against the real account, where it comes
 * back as `attachment; filename="…"` for raw, image and video alike.
 */
describe("asAttachmentUrl", () => {
  const CDN = "https://res.cloudinary.com/dtfwkgpcc";

  it("asks the CDN to send it as an attachment", () => {
    expect(asAttachmentUrl(`${CDN}/raw/upload/v1/listings/report.xlsx`)).toBe(
      `${CDN}/raw/upload/fl_attachment/v1/listings/report.xlsx`,
    );
    expect(asAttachmentUrl(`${CDN}/image/upload/v1/listings/photo.png`)).toBe(
      `${CDN}/image/upload/fl_attachment/v1/listings/photo.png`,
    );
    expect(asAttachmentUrl(`${CDN}/video/upload/v1/listings/clip.mp4`)).toBe(
      `${CDN}/video/upload/fl_attachment/v1/listings/clip.mp4`,
    );
  });

  it("does not add the flag twice", () => {
    const once = asAttachmentUrl(`${CDN}/raw/upload/v1/a.csv`);
    expect(asAttachmentUrl(once)).toBe(once);
  });

  it("leaves anything that is not on the CDN alone", () => {
    // The flag is a path segment; adding it elsewhere only breaks the URL.
    expect(asAttachmentUrl("https://example.com/files/report.pdf")).toBe(
      "https://example.com/files/report.pdf",
    );
    expect(asAttachmentUrl("")).toBe("");
    expect(asAttachmentUrl("#")).toBe("#");
  });

  it("leaves a CDN url with no upload segment alone", () => {
    const odd = `${CDN}/raw/authenticated/v1/a.csv`;
    expect(asAttachmentUrl(odd)).toBe(odd);
  });
});

/**
 * A private document is served by our own API, not the CDN.
 *
 * The name rides in the path so every screen that reads a file's name out of
 * its URL keeps working — the server ignores that segment and takes the name
 * from the row.
 */
describe("isPrivateAttachment", () => {
  it("recognises the API's own paths", () => {
    expect(isPrivateAttachment("/attachments/abc123/download")).toBe(true);
    expect(isPrivateAttachment("/attachments/abc123/download/Agreement.pdf")).toBe(true);
    expect(isPrivateAttachment("/attachments/abc123/download/My%20P%26L.xlsx")).toBe(true);
  });

  it("leaves CDN urls and anything else alone", () => {
    expect(isPrivateAttachment("https://res.cloudinary.com/x/raw/upload/v1/a.pdf")).toBe(false);
    expect(isPrivateAttachment("/listings/attachments/a.pdf")).toBe(false);
    expect(isPrivateAttachment("")).toBe(false);
  });

  it("keeps the file's real name readable from the path", () => {
    // The listing page reads a name out of the url; "download" is not a name.
    expect(fileNameFromUrl("/attachments/abc/download/Agreement.pdf")).toBe("Agreement.pdf");
    expect(fileNameFromUrl("/attachments/abc/download/My%20P%26L.xlsx")).toBe("My P&L.xlsx");
  });
});
