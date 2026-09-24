import { asAllowedAttachment, refusedAttachmentsMessage } from "./fileTypes";

/**
 * Files of the client's fifteen formats were turned away when their name did
 * not say so: a JPEG saved by Windows as ".jfif", or a PDF from a phone or a
 * cloud drive with no extension at all. The type the browser reports now
 * decides, and the file is renamed so the listing page draws the right icon.
 */
const file = (name: string, type: string) => new File(["x"], name, { type });

describe("recognising an allowed file by what it is", () => {
  it("passes a file whose name already says its format, untouched", () => {
    const pdf = file("Report.PDF", "application/pdf");
    expect(asAllowedAttachment(pdf)).toBe(pdf);
  });

  it("takes a Windows .jfif as the JPEG it is", () => {
    expect(asAllowedAttachment(file("photo.jfif", "image/jpeg"))?.name).toBe("photo.jpg");
  });

  it("takes an iPhone .heif as HEIC", () => {
    expect(asAllowedAttachment(file("IMG_0001.heif", "image/heif"))?.name).toBe("IMG_0001.heic");
  });

  it("names a file that came without an extension after its format", () => {
    expect(asAllowedAttachment(file("Invoice", "application/pdf"))?.name).toBe("Invoice.pdf");
    expect(
      asAllowedAttachment(file("P&L 2025", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))?.name,
    ).toBe("P&L 2025.xlsx");
    // A dot in the name is not an extension.
    expect(asAllowedAttachment(file("Report v1.2", "application/pdf"))?.name).toBe("Report v1.2.pdf");
  });

  it("keeps the type the browser gave it", () => {
    expect(asAllowedAttachment(file("clip", "video/quicktime"))?.type).toBe("video/quicktime");
  });

  it("still refuses what the client wants refused", () => {
    expect(asAllowedAttachment(file("archive.zip", "application/zip"))).toBeNull();
    expect(asAllowedAttachment(file("logo.svg", "image/svg+xml"))).toBeNull();
    expect(asAllowedAttachment(file("Sheet.numbers", ""))).toBeNull();
  });
});

describe("telling the seller which files were refused", () => {
  it("names the file", () => {
    const message = refusedAttachmentsMessage([{ name: "archive.zip" }]);
    expect(message).toContain('"archive.zip" wasn\'t uploaded');
    expect(message).toContain("PDF");
  });

  it("names the first and counts the rest", () => {
    expect(refusedAttachmentsMessage([{ name: "a.zip" }, { name: "b.svg" }, { name: "c.rar" }])).toMatch(
      /^"a\.zip" and 2 more weren't uploaded/,
    );
  });
});
