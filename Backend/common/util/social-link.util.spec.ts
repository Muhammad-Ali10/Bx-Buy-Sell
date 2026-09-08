import {
  checkLinkAnswer,
  getLinkAnswerForValidation,
  normalizeLinkAnswer,
} from './social-link.util';

/**
 * The same cases the browser copy is held to.
 *
 * These two files are ported by hand, so the tests are deliberately the same:
 * a rule that drifts apart shows up here as a failure, rather than as a
 * listing the form accepts and the API then rejects.
 */
const accepts = (value: string, question: string) =>
  checkLinkAnswer(value, question) === null;

describe('checkLinkAnswer', () => {
  it('refuses what the client reported', () => {
    expect(checkLinkAnswer('sssssssssssssssssssssssssssss', 'Instagram')).toContain(
      'must be a link',
    );
    expect(checkLinkAnswer('https://www.youtube.com/', 'Facebook')).toContain(
      'must be a Facebook link',
    );
  });

  it('gets the article right', () => {
    // "a Instagram link" and "a Amazon link" both read as mistakes.
    expect(checkLinkAnswer('https://www.youtube.com/', 'Instagram')).toContain(
      'an Instagram link',
    );
    expect(checkLinkAnswer('https://www.youtube.com/', 'Amazon')).toContain(
      'an Amazon link',
    );
    expect(checkLinkAnswer('https://www.youtube.com/', 'Facebook')).toContain(
      'a Facebook link',
    );
  });

  it('refuses what new URL() called valid', () => {
    for (const value of ['sssssssssssssssssssss', 'a', '...', 'ttps://example.com']) {
      expect(accepts(value, 'Instagram')).toBe(false);
    }
  });

  it('accepts links that are genuinely right', () => {
    expect(accepts('https://instagram.com/trueglow', 'Instagram')).toBe(true);
    expect(accepts('www.tiktok.com/@trueglow.de', 'TikTok')).toBe(true);
    expect(accepts('https://fb.com/mypage', 'Facebook')).toBe(true);
    expect(accepts('https://youtu.be/abc123', 'YouTube')).toBe(true);
    expect(accepts('https://x.com/someone', 'Twitter')).toBe(true);
  });

  it('accepts a country storefront', () => {
    expect(accepts('https://amazon.de/shops/mystore', 'Amazon')).toBe(true);
    expect(accepts('https://pinterest.de/mypins', 'Pinterest')).toBe(true);
  });

  it('is not fooled by a host that merely contains the name', () => {
    expect(accepts('https://instagram.com.example.net/x', 'Instagram')).toBe(false);
  });

  it('takes a handle but not a bare word', () => {
    expect(accepts('@trueglow', 'Instagram')).toBe(true);
    expect(accepts('trueglow', 'Instagram')).toBe(false);
    // An Amazon storefront is a path on Amazon's site, not an @name.
    expect(accepts('@mystore', 'Amazon')).toBe(false);
  });

  it('leaves an empty answer alone', () => {
    // Whether an answer is required at all is the admin's setting.
    expect(accepts('', 'Instagram')).toBe(true);
    expect(accepts('   ', 'Instagram')).toBe(true);
  });

  it('only asks for a link where no platform is named', () => {
    expect(accepts('https://my-own-shop.com/store', 'Our shop')).toBe(true);
    expect(checkLinkAnswer('sssss', 'Our shop')).toContain('must be a valid link');
  });
});

describe('normalizeLinkAnswer', () => {
  it('stores the address a handle stands for', () => {
    expect(normalizeLinkAnswer('@trueglow', 'Instagram')).toBe(
      'https://instagram.com/trueglow',
    );
    expect(normalizeLinkAnswer('@trueglow', 'TikTok')).toBe(
      'https://tiktok.com/@trueglow',
    );
    expect(normalizeLinkAnswer('@mycompany', 'LinkedIn')).toBe(
      'https://linkedin.com/company/mycompany',
    );
  });

  it('gives a protocol-less link one', () => {
    expect(normalizeLinkAnswer('www.tiktok.com/@trueglow.de', 'TikTok')).toBe(
      'https://tiktok.com/@trueglow.de',
    );
  });

  it('leaves a rejected answer exactly as it was', () => {
    expect(normalizeLinkAnswer('sssssss', 'Instagram')).toBe('sssssss');
  });
});

describe('getLinkAnswerForValidation', () => {
  it('reads a plain string and a one-item array alike', () => {
    expect(getLinkAnswerForValidation('https://instagram.com/x')).toBe(
      'https://instagram.com/x',
    );
    expect(getLinkAnswerForValidation(['https://instagram.com/x'])).toBe(
      'https://instagram.com/x',
    );
    expect(getLinkAnswerForValidation('  ')).toBeNull();
    expect(getLinkAnswerForValidation(undefined)).toBeNull();
  });
});
