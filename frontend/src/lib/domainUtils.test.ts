import {
  DOMAIN_VALIDATION_MESSAGE,
  domainDisplay,
  getDomainHref,
  isDomainQuestion,
  isValidDomain,
  normalizeDomain,
  normalizeDomainAnswer,
} from "./domainUtils";

describe("domainUtils", () => {
  it("detects domain questions", () => {
    expect(isDomainQuestion("Domains")).toBe(true);
    expect(isDomainQuestion("Brand Name")).toBe(false);
  });

  /**
   * The four ways a seller writes the same address. They are one site, so they
   * are stored as one string and shown as one label.
   */
  describe("the four input variants", () => {
    const variants = ["test.com", "www.test.com", "http://test.com", "https://test.com/"];

    it.each(variants)("%s is valid", (input) => {
      expect(isValidDomain(input)).toBe(true);
    });

    it.each(variants)("%s displays as test.com", (input) => {
      expect(domainDisplay(input)).toBe("test.com");
    });

    it("stores https for everything except an explicit http", () => {
      expect(normalizeDomain("test.com")).toBe("https://test.com");
      expect(normalizeDomain("www.test.com")).toBe("https://test.com");
      expect(normalizeDomain("https://test.com/")).toBe("https://test.com");
      // Kept: some sites answer on http and nowhere else.
      expect(normalizeDomain("http://test.com")).toBe("http://test.com");
    });
  });

  it("keeps a path so the link still works", () => {
    expect(normalizeDomain("test.com/shop")).toBe("https://test.com/shop");
    expect(normalizeDomain("https://www.test.com/shop/")).toBe("https://test.com/shop");
    expect(normalizeDomain("test.com/shop?id=2")).toBe("https://test.com/shop?id=2");
    // Shown as the host alone, however deep the address goes.
    expect(domainDisplay("test.com/shop")).toBe("test.com");
  });

  it("keeps a subdomain, in the link and on the page", () => {
    expect(normalizeDomain("shop.test.com")).toBe("https://shop.test.com");
    expect(normalizeDomain("https://shop.test.com/products/")).toBe(
      "https://shop.test.com/products",
    );
    // Not trimmed back to test.com: two different sites must not read alike.
    expect(domainDisplay("shop.test.com")).toBe("shop.test.com");
  });

  it("cleans up whitespace, trailing slashes and capitals", () => {
    expect(normalizeDomain("  https://WWW.Test.COM/  ")).toBe("https://test.com");
    expect(normalizeDomain("TEST.com")).toBe("https://test.com");
    expect(normalizeDomain("https://test.com///")).toBe("https://test.com");
  });

  it("accepts the shapes sellers actually use", () => {
    expect(isValidDomain("www.aaa.de")).toBe(true);
    expect(isValidDomain("aaa.de")).toBe(true);
    expect(isValidDomain("subdomain.aaa.de")).toBe(true);
    expect(isValidDomain("https://aaa.de")).toBe(true);
    expect(isValidDomain("http://aaa.de")).toBe(true);
    // A path no longer disqualifies an address.
    expect(isValidDomain("aaa.de/shop")).toBe(true);
  });

  it("rejects what cannot be a domain", () => {
    expect(isValidDomain("invalid-domain")).toBe(false);
    expect(isValidDomain("aaa")).toBe(false);
    expect(isValidDomain("")).toBe(false);
    expect(isValidDomain("test .com")).toBe(false);
    // Both of these are sitting in the database today.
    expect(isValidDomain("Brand-Name")).toBe(false);
    expect(isValidDomain("ttps://dgmarq.com/admin/users")).toBe(false);
    expect(isValidDomain("http://localhost:8080")).toBe(false);
  });

  it("normalizes domain answers for storage, and leaves other answers alone", () => {
    expect(normalizeDomainAnswer("aaa.de", "Domains")).toBe("https://aaa.de");
    expect(normalizeDomainAnswer("www.aaa.de/shop", "Domains")).toBe("https://aaa.de/shop");
    expect(normalizeDomainAnswer("aaa.de", "Brand Name")).toBe("aaa.de");
    // Left exactly as typed when it is not a domain at all, so nothing is
    // silently turned into something the seller did not write.
    expect(normalizeDomainAnswer("Brand-Name", "Domains")).toBe("Brand-Name");
  });

  it("builds hrefs that point at the whole address", () => {
    expect(getDomainHref("https://aaa.de")).toBe("https://aaa.de");
    expect(getDomainHref("aaa.de")).toBe("https://aaa.de");
    expect(getDomainHref("www.aaa.de/shop")).toBe("https://aaa.de/shop");
    expect(getDomainHref("http://aaa.de")).toBe("http://aaa.de");
    expect(getDomainHref("nonsense")).toBe("#");
  });

  it("exports the expected validation message", () => {
    expect(DOMAIN_VALIDATION_MESSAGE).toBe(
      "Enter a valid domain, for example: www.example.com",
    );
  });
});
