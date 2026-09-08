import { checkLinkAnswer, linkPlaceholder, normalizeLinkAnswer, platformLabel } from "./socialLinks";

const accepts = (value: string, question: string) => checkLinkAnswer(value, question) === null;
const refuses = (value: string, question: string) => checkLinkAnswer(value, question);

/**
 * The two failures in the client's screenshot.
 *
 * The admin had set these questions to Link. Instagram held
 * `sssssssssssssssssssssssssssss` and Facebook held a YouTube address, and the
 * form let both through: the only rule on an admin-defined account question
 * was whether a required one was empty.
 */
describe("what the client reported", () => {
  it("refuses a word that is not a link", () => {
    expect(refuses("sssssssssssssssssssssssssssss", "Instagram")).toContain("must be a link");
  });

  it("refuses a link to the wrong platform", () => {
    expect(refuses("https://www.youtube.com/", "Facebook")).toContain("must be a Facebook link");
  });

  it("gets the article right", () => {
    // "a Instagram link" and "a Amazon link" both read as mistakes.
    expect(refuses("https://www.youtube.com/", "Instagram")).toContain("an Instagram link");
    expect(refuses("https://www.youtube.com/", "Amazon")).toContain("an Amazon link");
    expect(refuses("https://www.youtube.com/", "Facebook")).toContain("a Facebook link");
  });

  it("says which platform, and shows one", () => {
    expect(refuses("https://www.youtube.com/", "Facebook")).toContain(
      "https://facebook.com/yourpage",
    );
  });
});

/**
 * What the one existing check let through.
 *
 * `new URL()` was the rule on the Primary Domain field's neighbours, and it
 * accepts anything that parses as a host — which every one of these does.
 */
describe("values new URL() called valid", () => {
  it.each(["sssssssssssssssssssss", "a", "...", "ttps://example.com"])("refuses %s", (value) => {
    expect(accepts(value, "Instagram")).toBe(false);
  });
});

describe("links that are genuinely right", () => {
  it.each([
    ["https://instagram.com/trueglow", "Instagram"],
    ["https://www.instagram.com/trueglow.de/", "Instagram"],
    ["www.tiktok.com/@trueglow.de", "TikTok"],
    ["https://facebook.com/mypage", "Facebook"],
    ["https://fb.com/mypage", "Facebook"],
    ["https://youtu.be/abc123", "YouTube"],
    ["https://x.com/someone", "Twitter"],
  ])("accepts %s under %s", (value, question) => {
    expect(accepts(value, question)).toBe(true);
  });

  it("accepts a country storefront", () => {
    // A German seller's Amazon shop is not on amazon.com.
    expect(accepts("https://amazon.de/shops/mystore", "Amazon")).toBe(true);
    expect(accepts("https://amazon.co.uk/shops/mystore", "Amazon")).toBe(true);
    expect(accepts("https://pinterest.de/mypins", "Pinterest")).toBe(true);
  });

  it("is not fooled by a host that merely contains the name", () => {
    expect(accepts("https://instagram.com.example.net/x", "Instagram")).toBe(false);
  });
});

/**
 * A handle is an answer; a bare word is not.
 *
 * The `@` is what separates them. Treating any bare word as a handle would
 * have turned the client's own `sssssssssss` into a perfectly good Instagram
 * handle and let it back through the front door.
 */
describe("handles", () => {
  it("accepts a handle and stores the address it stands for", () => {
    expect(accepts("@trueglow", "Instagram")).toBe(true);
    expect(normalizeLinkAnswer("@trueglow", "Instagram")).toBe("https://instagram.com/trueglow");
  });

  it("puts the handle where each platform keeps it", () => {
    expect(normalizeLinkAnswer("@trueglow", "TikTok")).toBe("https://tiktok.com/@trueglow");
    expect(normalizeLinkAnswer("@mychannel", "YouTube")).toBe("https://youtube.com/@mychannel");
    expect(normalizeLinkAnswer("@mycompany", "LinkedIn")).toBe(
      "https://linkedin.com/company/mycompany",
    );
  });

  it("still refuses a bare word", () => {
    expect(accepts("sssssssss", "Instagram")).toBe(false);
    expect(accepts("trueglow", "Instagram")).toBe(false);
  });

  it("does not invent a handle where the platform has none", () => {
    // An Amazon storefront is a path on Amazon's site, not an @name.
    expect(accepts("@mystore", "Amazon")).toBe(false);
  });
});

describe("normalising", () => {
  it("gives a protocol-less link one", () => {
    expect(normalizeLinkAnswer("www.tiktok.com/@trueglow.de", "TikTok")).toBe(
      "https://tiktok.com/@trueglow.de",
    );
  });

  it("leaves a rejected answer exactly as it was", () => {
    // Never quietly turn something that failed into something else.
    expect(normalizeLinkAnswer("sssssss", "Instagram")).toBe("sssssss");
  });
});

describe("questions that name no platform", () => {
  it("only asks for a link", () => {
    expect(accepts("https://my-own-shop.com/store", "Our shop")).toBe(true);
    expect(refuses("sssss", "Our shop")).toContain("must be a valid link");
  });

  it("leaves an empty answer alone", () => {
    // Whether an answer is required at all is the admin's setting, not ours.
    expect(accepts("", "Instagram")).toBe(true);
    expect(accepts("   ", "Our shop")).toBe(true);
  });
});

describe("labels and examples", () => {
  it("uses each platform's own spelling", () => {
    expect(platformLabel("tiktok")).toBe("TikTok");
    expect(platformLabel("instagram")).toBe("Instagram");
    expect(platformLabel("Our shop")).toBe("Our shop");
  });

  it("offers the right example per platform", () => {
    expect(linkPlaceholder("TikTok")).toContain("tiktok.com");
    expect(linkPlaceholder("Amazon")).toContain("amazon.com");
  });
});
