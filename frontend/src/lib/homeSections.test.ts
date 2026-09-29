import { pickHomeSections } from "./homeSections";

const day = (n: number) => new Date(Date.UTC(2026, 8, n)).toISOString();

const listing = (id: string, created: number, extra: Record<string, unknown> = {}) => ({
  id,
  created_at: day(created),
  popularity_score: 0,
  ...extra,
});

const ids = (rows: { id?: string | number }[]) => rows.map((row) => row.id);

describe("the home page's three rows", () => {
  it("shows the featured listings the server chose for this view, in its order", () => {
    const feed = [listing("paid-b", 1), listing("free", 20), listing("paid-a", 5)];
    const featured = [listing("paid-a", 5), listing("paid-b", 1)];
    expect(ids(pickHomeSections(feed, featured).featured)).toEqual(["paid-a", "paid-b"]);
  });

  it("leaves Featured empty when nothing is paid for", () => {
    const feed = [listing("a", 1), listing("b", 2), listing("c", 3)];
    expect(pickHomeSections(feed).featured).toEqual([]);
  });

  it("ranks Popular by the 30-day score, the newer listing first on a tie", () => {
    const feed = [
      listing("five-old", 1, { popularity_score: 5 }),
      listing("eight", 2, { popularity_score: 8 }),
      listing("five-new", 9, { popularity_score: 5 }),
      listing("none", 30),
      listing("views-only", 3, { popularity_score: 0.3 }),
    ];
    expect(ids(pickHomeSections(feed).popular)).toEqual(["eight", "five-new", "five-old"]);
  });

  it("breaks a Popular tie by publish date, not creation date", () => {
    const feed = [
      listing("created-first-published-today", 1, { popularity_score: 5, published_at: day(20) }),
      listing("created-later", 10, { popularity_score: 5 }),
    ];
    expect(ids(pickHomeSections(feed).popular)).toEqual([
      "created-first-published-today",
      "created-later",
    ]);
  });

  it("leaves a listing that scores nothing out of Popular", () => {
    const feed = [listing("a", 1), listing("b", 2, { popularity_score: 2 })];
    expect(ids(pickHomeSections(feed).popular)).toEqual(["b"]);
  });

  it("sorts Newest by publish date, so a long draft published today is new", () => {
    const feed = [
      listing("old", 1, { published_at: day(2) }),
      listing("draft-for-weeks", 0, { published_at: day(25) }),
      listing("middle", 5, { published_at: day(6) }),
      listing("no-publish-date", 9),
    ];
    expect(ids(pickHomeSections(feed).newest)).toEqual(["draft-for-weeks", "no-publish-date", "middle"]);
  });

  it("never shows a listing twice: Featured, then Popular, then Newest", () => {
    const feed = [
      listing("paid-and-popular-and-new", 30, { popularity_score: 9 }),
      listing("popular-and-new", 29, { popularity_score: 5 }),
      listing("new", 28),
      listing("older", 10),
      listing("oldest", 1),
    ];
    // A different object for the same listing: the featured row has its own request.
    const rows = pickHomeSections(feed, [listing("paid-and-popular-and-new", 30)]);
    expect(ids(rows.featured)).toEqual(["paid-and-popular-and-new"]);
    expect(ids(rows.popular)).toEqual(["popular-and-new"]);
    expect(ids(rows.newest)).toEqual(["new", "older", "oldest"]);
  });

  it("takes three per row", () => {
    const feed = Array.from({ length: 10 }, (_, i) => listing(`l${i}`, i, { popularity_score: i }));
    const rows = pickHomeSections(feed);
    expect(rows.popular).toHaveLength(3);
    expect(rows.newest).toHaveLength(3);
  });
});
