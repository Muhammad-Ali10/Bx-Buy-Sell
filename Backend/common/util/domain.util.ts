/**
 * One stored shape for a seller's website, however they typed it.
 *
 * The same rules the form applies, so the two agree. They did not: this file
 * was left behind when the form's were revised, and the difference showed up
 * as a listing that could not be published at all. Two of those rules are the
 * ones that matter, and both were wrong here:
 *
 *  - `http://` typed on purpose is kept. Some sites still answer on http and
 *    nowhere else; this returned `https://` whatever was sent, so a working
 *    address was stored as one that fails.
 *  - A path, port, query or subdomain is kept. This rejected anything with a
 *    path outright, and — worse — its normaliser returned the host alone, so a
 *    path that did get through was silently dropped and the link went
 *    somewhere else.
 *
 * Kept in step with `frontend/src/lib/domainUtils.ts`. The tests beside this
 * file are the ones from there; if the two are edited apart again, they fail.
 */

export const DOMAIN_VALIDATION_MESSAGE =
  'Enter a valid domain, for example: www.example.com';

export function isDomainQuestion(questionText: string | undefined | null): boolean {
  return String(questionText || '').toLowerCase().includes('domain');
}

/** Whatever they typed, given a protocol so `URL` will take it. */
function withProtocol(value: string): { url: string; explicitHttp: boolean } {
  const explicitHttp = /^http:\/\//i.test(value);
  return {
    url: /^https?:\/\//i.test(value) ? value : `https://${value}`,
    explicitHttp,
  };
}

/**
 * True when this parses as a URL and its host looks like a real domain.
 *
 * A dot in the host is the line the client drew, and it is the one that catches
 * the mistakes actually found in the data: `Brand-Name`, and `ttps://…`, whose
 * missing letter turns the whole address into a host called "ttps".
 */
export function isValidDomain(raw: string): boolean {
  const value = String(raw ?? '').trim();
  if (!value || /\s/.test(value)) return false;

  try {
    const parsed = new URL(withProtocol(value).url);
    const host = parsed.hostname;

    if (!host || !host.includes('.')) return false;

    const labels = host.split('.');
    if (labels.some((label) => !label || label.length > 63)) return false;

    const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
    if (!labels.every((label) => labelPattern.test(label))) return false;

    const tld = labels[labels.length - 1];
    if (tld.length < 2 || !/^[a-z0-9-]+$/i.test(tld)) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * The form the address is stored in.
 *
 * Returns the input untouched when it cannot be parsed at all, so a value that
 * failed validation is never silently turned into something else.
 */
export function normalizeDomain(raw: string): string {
  const value = String(raw ?? '').trim();
  if (!value) return value;

  const { url, explicitHttp } = withProtocol(value);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return value;
  }

  const protocol = explicitHttp ? 'http' : 'https';
  // `hostname` arrives lower-cased already; the `www.` is ours to drop.
  const host = parsed.hostname.replace(/^www\./i, '');
  const port = parsed.port ? `:${parsed.port}` : '';
  // A lone "/" is not a path. A real one keeps everything but its last slash.
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');

  return `${protocol}://${host}${port}${path}${parsed.search}${parsed.hash}`;
}

export function normalizeDomainAnswer(
  answer: unknown,
  questionText: string,
): unknown {
  if (!isDomainQuestion(questionText)) return answer;

  if (Array.isArray(answer)) {
    return answer.map((item) =>
      typeof item === 'string' && isValidDomain(item)
        ? normalizeDomain(item)
        : item,
    );
  }

  if (typeof answer !== 'string') return answer;

  const trimmed = answer.trim();
  if (!trimmed) return answer;

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return JSON.stringify(
          parsed.map((item) =>
            typeof item === 'string' && isValidDomain(item)
              ? normalizeDomain(item)
              : item,
          ),
        );
      }
    } catch {
      // Fall through to plain string handling.
    }
  }

  return isValidDomain(trimmed) ? normalizeDomain(trimmed) : answer;
}

export function getDomainAnswerForValidation(answer: unknown): string | null {
  if (answer == null) return null;

  if (Array.isArray(answer)) {
    const first = answer.find(
      (item) => typeof item === 'string' && item.trim().length > 0,
    );
    return typeof first === 'string' ? first.trim() : null;
  }

  if (typeof answer !== 'string') return null;

  const trimmed = answer.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const first = parsed.find(
          (item) => typeof item === 'string' && item.trim().length > 0,
        );
        return typeof first === 'string' ? first.trim() : null;
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}
