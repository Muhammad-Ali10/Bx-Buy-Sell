export const DOMAIN_VALIDATION_MESSAGE =
  'Enter a valid domain, for example: www.example.com';

export function isDomainQuestion(questionText: string | undefined | null): boolean {
  return String(questionText || '').toLowerCase().includes('domain');
}

function stripDomainInput(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export function isValidDomain(raw: string): boolean {
  const value = stripDomainInput(raw);
  if (!value || /\s/.test(value)) return false;

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(withProtocol);
    const { hostname, pathname, search, hash } = parsed;

    if (!hostname || !hostname.includes('.')) return false;
    if (search || hash) return false;
    if (pathname && pathname !== '/') return false;

    const labels = hostname.split('.');
    if (labels.some((label) => !label || label.length > 63)) return false;

    const hostPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
    if (!labels.every((label) => hostPattern.test(label))) return false;

    const tld = labels[labels.length - 1];
    if (tld.length < 2 || !/^[a-z0-9-]+$/i.test(tld)) return false;

    return true;
  } catch {
    return false;
  }
}

export function normalizeDomain(raw: string): string {
  const value = stripDomainInput(raw);
  if (!value) return value;

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const parsed = new URL(withProtocol);
  return `https://${parsed.hostname}`;
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
