/**
 * One stored shape for a seller's website, however they typed it.
 *
 * Sellers write `test.com`, `www.test.com`, `http://test.com` and
 * `https://test.com/` and mean the same site, so the differences are flattened
 * on the way in: no `www.`, no trailing slash, no stray spaces, host in lower
 * case. Two decisions in here are not flattening, though, and both matter:
 *
 *  - `http://` typed on purpose is kept. Some sites still answer on http and
 *    nowhere else, and rewriting them to https produces a link that fails.
 *    Anything with no protocol at all becomes https.
 *  - A path, a subdomain, a port or a query is kept. `test.com/shop` and
 *    `shop.test.com` are where the business actually is; this used to reject
 *    the first outright and quietly discard the second's path, which turned a
 *    working address into a link to somewhere else.
 *
 * What is shown is a separate question from what is stored — see
 * `domainDisplay`.
 */

export const DOMAIN_VALIDATION_MESSAGE =
  "Enter a valid domain, for example: www.example.com";

export function isDomainQuestion(questionText: string | undefined | null): boolean {
  return String(questionText || "").toLowerCase().includes("domain");
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
  const value = String(raw ?? "").trim();
  if (!value || /\s/.test(value)) return false;

  try {
    const parsed = new URL(withProtocol(value).url);
    const host = parsed.hostname;

    if (!host || !host.includes(".")) return false;

    const labels = host.split(".");
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
  const value = String(raw ?? "").trim();
  if (!value) return value;

  const { url, explicitHttp } = withProtocol(value);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return value;
  }

  const protocol = explicitHttp ? "http" : "https";
  // `hostname` arrives lower-cased already; the `www.` is ours to drop.
  const host = parsed.hostname.replace(/^www\./i, "");
  const port = parsed.port ? `:${parsed.port}` : "";
  // A lone "/" is not a path. A real one keeps everything but its last slash.
  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");

  return `${protocol}://${host}${port}${path}${parsed.search}${parsed.hash}`;
}

/**
 * The host on its own, for showing on the page.
 *
 * The listing page printed the stored string, so a seller who had typed a path
 * saw `https://test.com/shop/products` sitting in the middle of a row of short
 * fields. The address still has to work when clicked, which is why this is only
 * the label — `getDomainHref` supplies what it points at.
 */
export function domainDisplay(raw: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";

  try {
    return new URL(withProtocol(value).url).hostname.replace(/^www\./i, "");
  } catch {
    return value;
  }
}

/** Where the link goes: the whole address, path and all. */
export function getDomainHref(raw: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "#";
  return isValidDomain(value) ? normalizeDomain(value) : "#";
}

export function normalizeDomainAnswer(answer: unknown, questionText: string): unknown {
  if (!isDomainQuestion(questionText)) return answer;

  if (Array.isArray(answer)) {
    return answer.map((item) =>
      typeof item === "string" && isValidDomain(item) ? normalizeDomain(item) : item,
    );
  }

  if (typeof answer !== "string") return answer;

  const trimmed = answer.trim();
  if (!trimmed) return answer;

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return JSON.stringify(
          parsed.map((item) =>
            typeof item === "string" && isValidDomain(item) ? normalizeDomain(item) : item,
          ),
        );
      }
    } catch {
      // Fall through to plain string handling.
    }
  }

  return isValidDomain(trimmed) ? normalizeDomain(trimmed) : answer;
}
