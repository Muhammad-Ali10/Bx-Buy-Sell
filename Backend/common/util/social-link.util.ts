/**
 * The server's copy of the rule a "Link" answer has to satisfy.
 *
 * The browser checks this too, but the browser is not the only way in: a
 * draft saved earlier, a retry, or a direct call to the API all arrive here
 * with nothing in between. The listing schema accepted any string at all for
 * a Link question, which is how `sssssssssssssssss` came to sit under
 * Instagram and a youtube.com address under Facebook.
 *
 * Kept deliberately in step with `frontend/src/lib/socialLinks.ts` — the two
 * are ported by hand, and the tests beside each of them use the same cases so
 * a drift between them shows up as a failure rather than as a listing the
 * form accepts and the API rejects.
 */

import { isValidDomain, normalizeDomain } from './domain.util';

export type SocialPlatform = {
  match: string;
  label: string;
  example: string;
  host: RegExp;
  /** Absent where a handle means nothing, as with an Amazon storefront. */
  handlePath?: string;
};

export const PLATFORMS: SocialPlatform[] = [
  {
    match: 'instagram',
    label: 'Instagram',
    example: 'https://instagram.com/yourname',
    host: /^([a-z0-9-]+\.)?instagram\.com$/,
    handlePath: '',
  },
  {
    match: 'facebook',
    label: 'Facebook',
    example: 'https://facebook.com/yourpage',
    host: /^([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)$/,
    handlePath: '',
  },
  {
    match: 'tiktok',
    label: 'TikTok',
    example: 'https://tiktok.com/@yourname',
    host: /^([a-z0-9-]+\.)?tiktok\.com$/,
    handlePath: '@',
  },
  {
    match: 'twitter',
    label: 'Twitter',
    example: 'https://twitter.com/yourname',
    host: /^([a-z0-9-]+\.)?(twitter\.com|x\.com)$/,
    handlePath: '',
  },
  {
    match: 'youtube',
    label: 'YouTube',
    example: 'https://youtube.com/@yourchannel',
    host: /^([a-z0-9-]+\.)?(youtube\.com|youtu\.be)$/,
    handlePath: '@',
  },
  {
    match: 'linkedin',
    label: 'LinkedIn',
    example: 'https://linkedin.com/company/yourcompany',
    host: /^([a-z0-9-]+\.)?linkedin\.com$/,
    handlePath: 'company/',
  },
  {
    match: 'pinterest',
    label: 'Pinterest',
    example: 'https://pinterest.com/yourname',
    host: /^([a-z0-9-]+\.)?pinterest\.[a-z]{2,}(\.[a-z]{2,})?$/,
    handlePath: '',
  },
  {
    match: 'amazon',
    label: 'Amazon',
    example: 'https://amazon.com/shops/yourstore',
    host: /^([a-z0-9-]+\.)?amazon\.[a-z]{2,}(\.[a-z]{2,})?$/,
  },
  {
    match: 'snapchat',
    label: 'Snapchat',
    example: 'https://snapchat.com/add/yourname',
    host: /^([a-z0-9-]+\.)?snapchat\.com$/,
    handlePath: 'add/',
  },
];

export const platformFor = (
  questionText: string | undefined | null,
): SocialPlatform | null => {
  const lower = String(questionText || '').toLowerCase();
  return PLATFORMS.find((platform) => lower.includes(platform.match)) ?? null;
};

/**
 * A handle, if that is unmistakably what this is.
 *
 * The leading `@` is what separates a handle from a bare word. Without it,
 * `sssssssssss` would be a perfectly good Instagram handle.
 */
const handleIn = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('@')) return null;
  const handle = trimmed.slice(1);
  return /^[A-Za-z0-9._-]{1,40}$/.test(handle) ? handle : null;
};

/**
 * "a" or "an", so the message is not "a Instagram link".
 *
 * Only the platform names are ever passed in, and none of them starts with a
 * silent consonant, so the first letter is enough.
 */
const article = (word: string): string => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const linkHost = (raw: string): string | null => {
  const value = String(raw ?? '').trim();
  if (!value || !isValidDomain(value)) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return null;
  }
};

/** What is wrong with this answer, or null when nothing is. */
export const checkLinkAnswer = (
  raw: unknown,
  questionText: string | undefined | null,
): string | null => {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const platform = platformFor(questionText);

  if (platform && platform.handlePath !== undefined && handleIn(value)) return null;

  if (!isValidDomain(value)) {
    return platform
      ? `${platform.label} must be a link, for example ${platform.example}`
      : `${questionText || 'This'} must be a valid link, for example https://example.com`;
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
 * A value that does not validate is returned untouched, so an answer that
 * failed is never quietly turned into something else.
 */
export const normalizeLinkAnswer = (
  raw: unknown,
  questionText: string | undefined | null,
): unknown => {
  if (typeof raw !== 'string') return raw;
  const value = raw.trim();
  if (!value) return raw;

  const platform = platformFor(questionText);
  const handle =
    platform && platform.handlePath !== undefined ? handleIn(value) : null;
  if (handle && platform) {
    const host = platform.example.replace(/^https?:\/\//, '').split('/')[0];
    return `https://${host}/${platform.handlePath}${handle}`;
  }

  return isValidDomain(value) ? normalizeDomain(value) : raw;
};

/**
 * The answer a Link question should be checked on.
 *
 * Mirrors `getDomainAnswerForValidation`: an answer can arrive as a plain
 * string or as a one-item array, and only a string is worth checking.
 */
export const getLinkAnswerForValidation = (answer: unknown): string | null => {
  if (typeof answer === 'string') return answer.trim() || null;
  if (Array.isArray(answer)) {
    const first = answer.find((item) => typeof item === 'string' && item.trim());
    return typeof first === 'string' ? first.trim() : null;
  }
  return null;
};
