import {
  DOMAIN_VALIDATION_MESSAGE,
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

  it("accepts valid domain formats", () => {
    expect(isValidDomain("www.aaa.de")).toBe(true);
    expect(isValidDomain("aaa.de")).toBe(true);
    expect(isValidDomain("subdomain.aaa.de")).toBe(true);
    expect(isValidDomain("https://aaa.de")).toBe(true);
    expect(isValidDomain("https://www.aaa.de")).toBe(true);
    expect(isValidDomain("http://aaa.de")).toBe(true);
  });

  it("rejects invalid domain formats", () => {
    expect(isValidDomain("invalid-domain")).toBe(false);
    expect(isValidDomain("aaa")).toBe(false);
    expect(isValidDomain("")).toBe(false);
  });

  it("normalizes domains to https URLs", () => {
    expect(normalizeDomain("www.aaa.de")).toBe("https://www.aaa.de");
    expect(normalizeDomain("aaa.de")).toBe("https://aaa.de");
    expect(normalizeDomain("https://aaa.de")).toBe("https://aaa.de");
    expect(normalizeDomain("http://aaa.de")).toBe("https://aaa.de");
  });

  it("normalizes domain answers for storage", () => {
    expect(normalizeDomainAnswer("aaa.de", "Domains")).toBe("https://aaa.de");
    expect(normalizeDomainAnswer("https://aaa.de", "Domains")).toBe(
      "https://aaa.de",
    );
    expect(normalizeDomainAnswer("aaa.de", "Brand Name")).toBe("aaa.de");
  });

  it("builds hrefs without double protocols", () => {
    expect(getDomainHref("https://aaa.de")).toBe("https://aaa.de");
    expect(getDomainHref("aaa.de")).toBe("https://aaa.de");
  });

  it("exports the expected validation message", () => {
    expect(DOMAIN_VALIDATION_MESSAGE).toBe(
      "Enter a valid domain, for example: www.example.com",
    );
  });
});
