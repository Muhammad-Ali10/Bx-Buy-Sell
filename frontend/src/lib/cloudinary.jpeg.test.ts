import { keepOriginalExtension } from "./cloudinary";

/**
 * `.jpeg` came back `.jpg`.
 *
 * Cloudinary stores an image under its own canonical format and calls JPEG
 * "jpg", and the name shown everywhere is read out of the URL — so the seller
 * saw their file renamed. Checked against the real account: the same asset
 * requested as `.jpeg` returns HTTP 200, `image/jpeg`, and an identical
 * `content-length`, so the spelling can simply be put back.
 */
describe("keepOriginalExtension", () => {
  const CDN = "https://res.cloudinary.com/dtfwkgpcc/image/upload/v1/listings";

  it("puts the seller's spelling back", () => {
    expect(keepOriginalExtension(`${CDN}/holiday.jpg`, "holiday.jpeg")).toBe(
      `${CDN}/holiday.jpeg`,
    );
    expect(keepOriginalExtension(`${CDN}/holiday.jpg`, "HOLIDAY.JPEG")).toBe(
      `${CDN}/holiday.jpeg`,
    );
  });

  it("leaves a file that really was .jpg alone", () => {
    expect(keepOriginalExtension(`${CDN}/holiday.jpg`, "holiday.jpg")).toBe(
      `${CDN}/holiday.jpg`,
    );
  });

  it("touches nothing but jpeg", () => {
    // Every other pair is a real conversion; asking for a format the CDN does
    // not deliver would break a working link to fix a cosmetic name.
    expect(keepOriginalExtension(`${CDN}/photo.png`, "photo.png")).toBe(`${CDN}/photo.png`);
    expect(keepOriginalExtension(`${CDN}/photo.jpg`, "photo.heic")).toBe(`${CDN}/photo.jpg`);
    expect(keepOriginalExtension(`${CDN}/doc.pdf`, "doc.pdf")).toBe(`${CDN}/doc.pdf`);
  });

  it("only rewrites the extension, never a folder that reads like one", () => {
    const tricky = "https://res.cloudinary.com/x/image/upload/v1/jpg/holiday.jpg";
    expect(keepOriginalExtension(tricky, "holiday.jpeg")).toBe(
      "https://res.cloudinary.com/x/image/upload/v1/jpg/holiday.jpeg",
    );
  });

  it("survives a query string", () => {
    expect(keepOriginalExtension(`${CDN}/a.jpg?v=2`, "a.jpeg")).toBe(`${CDN}/a.jpeg?v=2`);
  });
});
