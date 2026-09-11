/**
 * What a "Link" answer has to be.
 *
 * An admin sets a question's type to Link and reasonably expects a link back.
 * Nothing checked it: `AccountsStep` only asked whether a required answer was
 * empty, so `sssssssssssssssssss` was accepted under Instagram. And where a
 * check did exist it was `new URL()`, which is no check at all — `ssssss` is a
 * syntactically valid hostname, so `https://ssssss` parses happily.
 *
 * Two rules, then. The answer must be a real link — `isValidDomain` already
 * decides that, and it is the same rule the Primary Domain field runs. And
 * when the question names a platform, the link must point at that platform:
 * half the account links already stored point somewhere else, most of them at
 * youtube.com sitting under Instagram, Facebook, Amazon and Pinterest at once.
 */

import { isValidDomain, normalizeDomain } from "./domainUtils";

export type SocialPlatform = {
  /** Matched against the question text, lower-cased. */
  match: string;
  label: string;
  example: string;
  /** Hosts that belong to this platform, including its own alternatives. */
  host: RegExp;
  /**
   * Where a handle lives in this platform's address, as a path prefix.
   *
   * Absent where a handle means nothing — an Amazon storefront has no
   * `@name`, so a bare handle there is not an answer.
   */
  handlePath?: string;
};

/**
 * The platforms this step asks about, in the spelling each of them uses.
 *
 * Two things were wrong without this. Every URL question offered the same
 * example — "https://instagram.com/yourname" — so the Twitter and TikTok
 * fields both told the seller to enter an Instagram address. And the labels
 * come from rows an admin typed, so one of them reads "instagram" beside a
 * correctly capitalised "TikTok"; CSS `capitalize` cannot fix that pair, since
 * it would turn TikTok into Tiktok.
 *
 * The host patterns allow one level of subdomain (`www.`, `m.`) and each
 * platform's own alternatives — `fb.com`, `youtu.be`, `x.com`. Amazon and
 * Pinterest take any country domain, so a German seller's `amazon.de`
 * storefront is not turned away. Anchored at both ends, so a host merely
 * containing the name — `instagram.com.example.net` — does not pass.
 */
export const PLATFORMS: SocialPlatform[] = [
  {
    match: "instagram",
    label: "Instagram",
    example: "https://instagram.com/yourname",
    host: /^([a-z0-9-]+\.)?instagram\.com$/,
    handlePath: "",
  },
  {
    match: "facebook",
    label: "Facebook",
    example: "https://facebook.com/yourpage",
    host: /^([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)$/,
    handlePath: "",
  },
  {
    match: "tiktok",
    label: "TikTok",
    example: "https://tiktok.com/@yourname",
    host: /^([a-z0-9-]+\.)?tiktok\.com$/,
    handlePath: "@",
  },
  {
    match: "twitter",
    label: "Twitter",
    example: "https://twitter.com/yourname",
    host: /^([a-z0-9-]+\.)?(twitter\.com|x\.com)$/,
    handlePath: "",
  },
  {
    match: "youtube",
    label: "YouTube",
    example: "https://youtube.com/@yourchannel",
    host: /^([a-z0-9-]+\.)?(youtube\.com|youtu\.be)$/,
    handlePath: "@",
  },
  {
    match: "linkedin",
    label: "LinkedIn",
    example: "https://linkedin.com/company/yourcompany",
    host: /^([a-z0-9-]+\.)?linkedin\.com$/,
    handlePath: "company/",
  },
  {
    match: "pinterest",
    label: "Pinterest",
    example: "https://pinterest.com/yourname",
    host: /^([a-z0-9-]+\.)?pinterest\.[a-z]{2,}(\.[a-z]{2,})?$/,
    handlePath: "",
  },
  {
    match: "amazon",
    label: "Amazon",
    example: "https://amazon.com/shops/yourstore",
    // A storefront is a path on Amazon's own site; there is no handle form.
    host: /^([a-z0-9-]+\.)?amazon\.[a-z]{2,}(\.[a-z]{2,})?$/,
  },
  {
    match: "snapchat",
    label: "Snapchat",
    example: "https://snapchat.com/add/yourname",
    host: /^([a-z0-9-]+\.)?snapchat\.com$/,
    handlePath: "add/",
  },
];

export const platformFor = (questionText: string | undefined | null): SocialPlatform | null => {
  const lower = String(questionText || "").toLowerCase();
  return PLATFORMS.find((platform) => lower.includes(platform.match)) ?? null;
};

/**
 * The platform's own spelling, without losing the rest of the question.
 *
 * This used to return the platform's name outright, which was fine while every
 * account question was just "Instagram" or "tiktok". It stopped being fine the
 * moment a second question mentioned the same platform: "Instagram Followers"
 * came back as "Instagram", so the seller saw two fields with the same label
 * and no way to tell which wanted the link and which the count.
 *
 * Only the platform's own word is corrected now — "tiktok" to "TikTok" — and
 * whatever the administrator wrote around it is left alone.
 */
export const platformLabel = (questionText: string): string => {
  const text = String(questionText ?? "").trim();
  const platform = platformFor(text);
  if (!platform) return questionText;
  if (text.toLowerCase() === platform.match) return platform.label;
  return text.replace(new RegExp(platform.match, "i"), platform.label);
};

/** An example for this platform, or a neutral one when it is not a platform. */
export const linkPlaceholder = (questionText: string): string =>
  platformFor(questionText)?.example ?? "https://example.com/yourname";

/**
 * A handle, if that is unmistakably what this is.
 *
 * The leading `@` is doing real work here. Accepting any bare word as a handle
 * would have let the exact value the client reported straight back through —
 * `sssssssssssssssssss` would have become a perfectly good Instagram handle.
 * A seller who writes `@trueglow` has plainly given a handle; one who writes
 * `sssss` has not given anything, and is told so.
 */
const handleIn = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("@")) return null;
  const handle = trimmed.slice(1);
  return /^[A-Za-z0-9._-]{1,40}$/.test(handle) ? handle : null;
};

/**
 * "a" or "an", so the message is not "a Instagram link".
 *
 * Only the platform names are ever passed in, and none of them starts with a
 * silent consonant, so the first letter is enough.
 */
const article = (word: string): string =>
  /^[aeiou]/i.test(word) ? "an" : "a";

/** The host of whatever they typed, lower-cased, or null if it is not a link. */
export const linkHost = (raw: string): string | null => {
  const value = String(raw ?? "").trim();
  if (!value || !isValidDomain(value)) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * What is wrong with this answer, or null when nothing is.
 *
 * The message rather than a boolean, because every caller wants to show it and
 * only this function knows which of the two rules was broken.
 *
 * Empty is acceptable — whether an answer is required at all is the admin's
 * setting, checked separately, and this must not turn every optional social
 * field into a mandatory one.
 */
export const checkLinkAnswer = (raw: unknown, questionText: string): string | null => {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const platform = platformFor(questionText);

  if (platform && platform.handlePath !== undefined && handleIn(value)) return null;

  if (!isValidDomain(value)) {
    return platform
      ? `${platform.label} must be a link, for example ${platform.example}`
      : `${questionText} must be a valid link, for example https://example.com`;
  }

  if (!platform) return null;

  const host = linkHost(value);
  if (host && !platform.host.test(host)) {
    return `${platform.label} must be ${article(platform.label)} ${platform.label} link, for example ${platform.example}`;
  }

  return null;
};

/**
 * The form the link is stored in.
 *
 * A handle becomes the address it stands for, so what is saved is something a
 * buyer can click. Anything else goes through the same flattening the Primary
 * Domain field uses. A value that does not validate is returned untouched, so
 * a rejected answer is never quietly turned into something else.
 */
export const normalizeLinkAnswer = (raw: unknown, questionText: string): unknown => {
  if (typeof raw !== "string") return raw;
  const value = raw.trim();
  if (!value) return raw;

  const platform = platformFor(questionText);
  const handle = platform && platform.handlePath !== undefined ? handleIn(value) : null;
  if (handle && platform) {
    const host = platform.example.replace(/^https?:\/\//, "").split("/")[0];
    return `https://${host}/${platform.handlePath}${handle}`;
  }

  return isValidDomain(value) ? normalizeDomain(value) : raw;
};
