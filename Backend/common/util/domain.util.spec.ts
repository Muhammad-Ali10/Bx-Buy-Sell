import {
  DOMAIN_VALIDATION_MESSAGE,
  isDomainQuestion,
  isValidDomain,
  normalizeDomain,
  normalizeDomainAnswer,
} from './domain.util';

/**
 * The rules the form applies, checked on this side too.
 *
 * These two files were revised apart once, and the difference did not show up
 * until a seller could not publish at all: the form sent `test-c.de/shop`, and
 * this side answered "Enter a valid domain". Nothing here is new — every case
 * is one the form's own tests already cover. Editing one side without the
 * other now fails here rather than in front of a seller.
 */
describe('domain.util', () => {
  it('detects domain questions', () => {
    expect(isDomainQuestion('Primary Domain')).toBe(true);
    expect(isDomainQuestion('Brand Name')).toBe(false);
  });

  describe('the four input variants', () => {
    const variants = ['test.com', 'www.test.com', 'http://test.com', 'https://test.com/'];

    it.each(variants)('%s is valid', (input) => {
      expect(isValidDomain(input)).toBe(true);
    });

    it('stores https for everything except an explicit http', () => {
      expect(normalizeDomain('test.com')).toBe('https://test.com');
      expect(normalizeDomain('www.test.com')).toBe('https://test.com');
      expect(normalizeDomain('https://test.com/')).toBe('https://test.com');
      // Kept: some sites answer on http and nowhere else.
      expect(normalizeDomain('http://test.com')).toBe('http://test.com');
    });
  });

  describe('what the seller typed is what is stored', () => {
    it('keeps a path', () => {
      expect(isValidDomain('test-c.de/shop')).toBe(true);
      expect(normalizeDomain('test-c.de/shop')).toBe('https://test-c.de/shop');
      expect(normalizeDomain('HTTP://WWW.Test-C.de/shop/')).toBe('http://test-c.de/shop');
    });

    it('keeps a subdomain, a port and a query', () => {
      expect(normalizeDomain('shop.test.com')).toBe('https://shop.test.com');
      expect(normalizeDomain('test.com:8080/a')).toBe('https://test.com:8080/a');
      expect(normalizeDomain('test.com/a?b=1')).toBe('https://test.com/a?b=1');
    });
  });

  describe('what is rejected', () => {
    it('needs a dot in the host', () => {
      expect(isValidDomain('Brand-Name')).toBe(false);
      expect(isValidDomain('localhost')).toBe(false);
    });

    it('catches the missing letter in a protocol', () => {
      // "ttps://x.com" parses as a host called "ttps" — no dot, so it fails.
      expect(isValidDomain('ttps://dgmarq.com')).toBe(false);
    });

    it('rejects blanks and spaces', () => {
      expect(isValidDomain('')).toBe(false);
      expect(isValidDomain('two words.com')).toBe(false);
    });
  });

  describe('answers', () => {
    it('only touches domain questions', () => {
      expect(normalizeDomainAnswer('www.test.com', 'Primary Domain')).toBe('https://test.com');
      expect(normalizeDomainAnswer('www.test.com', 'Brand Name')).toBe('www.test.com');
    });

    it('leaves an answer that failed validation exactly as it is', () => {
      expect(normalizeDomainAnswer('asdf', 'Primary Domain')).toBe('asdf');
    });

    it('handles a list', () => {
      expect(normalizeDomainAnswer(['www.a.com', 'http://b.com/x'], 'Domains')).toEqual([
        'https://a.com',
        'http://b.com/x',
      ]);
    });
  });

  it('has a message to show', () => {
    expect(DOMAIN_VALIDATION_MESSAGE).toContain('valid domain');
  });
});
