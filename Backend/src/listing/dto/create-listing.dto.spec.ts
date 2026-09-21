import { Question } from './create-listing.dto';

const answer = (question: string, value: string) =>
  Question.safeParse({ answer_for: 'SOCIAL', answer_type: 'URL', question, answer: value });

/**
 * The rule as the API actually enforces it.
 *
 * `social-link.util.spec.ts` covers the rule itself; this covers it being
 * wired in, which is the part that was missing. The schema took any string at
 * all for a Link question, so the browser was the only thing standing between
 * a listing and an Instagram field pointing at youtube.com.
 */
describe('the listing schema on a Link answer', () => {
  it('rejects what the client reported', () => {
    const a = answer('Instagram', 'sssssssssssssssssssssssssssss');
    expect(a.success).toBe(false);
    const b = answer('Facebook', 'https://www.youtube.com/');
    expect(b.success).toBe(false);
    if (!b.success) expect(b.error.issues[0].message).toContain('Facebook link');
  });

  it('accepts a right one', () => {
    expect(answer('Instagram', 'https://instagram.com/trueglow').success).toBe(true);
    expect(answer('TikTok', 'www.tiktok.com/@trueglow.de').success).toBe(true);
  });

  it('leaves other question types alone', () => {
    const r = Question.safeParse({
      answer_for: 'BRAND', answer_type: 'TEXT', question: 'Instagram vibe', answer: 'ssssss',
    });
    expect(r.success).toBe(true);
  });
});

/*
 * A seller's figures went missing from their listing: five employees, a three
 * per cent conversion rate. The schema wanted two characters, so the form threw
 * every one-character answer away before sending it.
 */
describe('the listing schema on a short answer', () => {
  const answer = (value: string) =>
    Question.safeParse({
      answer_for: 'STATISTIC',
      answer_type: 'NUMBER',
      question: 'Conversion Rate',
      answer: value,
    });

  it('takes a single character', () => {
    expect(answer('3').success).toBe(true);
  });

  it('still refuses an empty one', () => {
    expect(answer('').success).toBe(false);
  });
});
