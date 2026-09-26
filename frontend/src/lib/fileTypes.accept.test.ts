import {
  ATTACHMENT_ACCEPT,
  PHOTO_ACCEPT,
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_LABEL,
  ATTACHMENT_ACCEPT_LABEL,
  isAllowedAttachment,
} from "./fileTypes";

/**
 * The formats the client listed, and the two they expect turned away.
 *
 * `.zip` and `.svg` were being refused by the file dialog rather than by this
 * check — so the seller picked nothing, no handler ran, and nothing was said.
 * The check is now the only thing doing the refusing, which makes it the thing
 * worth pinning.
 */
describe("the allowed attachment formats", () => {
  it("is exactly the fifteen on the client's icon sheet", () => {
    expect(ALLOWED_ATTACHMENT_EXTENSIONS).toEqual([
      "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv",
      "txt", "png", "jpg", "jpeg", "heic", "mp4", "mov",
    ]);
  });

  it("keeps jpeg and jpg as separate, both allowed", () => {
    // The seller's own spelling is preserved now, so both have to pass.
    expect(isAllowedAttachment("holiday.jpeg")).toBe(true);
    expect(isAllowedAttachment("holiday.jpg")).toBe(true);
  });

  it("refuses the two the client tested", () => {
    expect(isAllowedAttachment("archive.zip")).toBe(false);
    expect(isAllowedAttachment("logo.svg")).toBe(false);
  });

  it("judges by extension however the name is written", () => {
    expect(isAllowedAttachment("REPORT.PDF")).toBe(true);
    expect(isAllowedAttachment("https://res.cloudinary.com/x/raw/upload/v1/a.xlsx")).toBe(true);
    expect(isAllowedAttachment("no-extension")).toBe(false);
  });

  it("lets the file picker offer only those — no .zip, no .svg", () => {
    expect(ATTACHMENT_ACCEPT.split(",")).toHaveLength(15);
    expect(ATTACHMENT_ACCEPT).not.toMatch(/zip|svg|image\/\*/);
    expect(PHOTO_ACCEPT).toBe(".png,.jpg,.jpeg,.heic");
  });

  it("has something to tell the seller with", () => {
    expect(ALLOWED_ATTACHMENT_LABEL).toContain("PDF");
    expect(ATTACHMENT_ACCEPT_LABEL).toContain(".jpeg");
  });
});
