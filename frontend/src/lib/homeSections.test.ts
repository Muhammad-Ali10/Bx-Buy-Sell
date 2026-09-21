import { pickHomeSections } from "./homeSections";

const day = (n: number) => new Date(Date.UTC(2026, 8, n)).toISOString();

const listing = (id: string, created: number, extra: Record<string, unknown> = {}) => ({
  id,
  created_at: day(created),
  requests_count: 0,
  featuredOnStartPage: false,
  ...extra,
});

const ids = (rows: { id?: string | number }[]) => rows.map((row) => row.id);

describe("the home page's three rows", () => {
  it("shows only paid placements as Featured, in the feed's order", () => {
    const feed = [
      listing("paid-b", 1, { featuredOnStartPage: true }),
      listing("free", 20),
      listing("paid-a", 5, { featuredOnStartPage: true }),
    ];
    expect(ids(pickHomeSections(feed).featured)).toEqual(["paid-b", "paid-a"]);
  });

  it("leaves Featured empty rather than filling it with unpaid listings", () => {
    const feed = [listing("a", 1), listing("b", 2), listing("c", 3)];
    expect(pickHomeSections(feed).featured).toEqual([]);
  });

  it("ranks Popular by how many buyers wrote, newest first on a tie", () => {
    const feed = [
      listing("two-old", 1, { requests_count: 2 }),
      listing("four", 2, { requests_count: 4 }),
      listing("two-new", 9, { requests_count: 2 }),
      listing("none", 30),
      listing("one", 3, { requests_count: 1 }),
    ];
    expect(ids(pickHomeSections(feed).popular)).toEqual(["four", "two-new", "two-old"]);
  });

  it("leaves a listing nobody contacted out of Popular", () => {
    const feed = [listing("a", 1), listing("b", 2, { requests_count: 1 })];
    expect(ids(pickHomeSections(feed).popular)).toEqual(["b"]);
  });

  it("sorts Newest by date, whatever order the feed came in", () => {
    const feed = [listing("old", 1), listing("newest", 9), listing("middle", 5), listing("oldest", 0)];
    expect(ids(pickHomeSections(feed).newest)).toEqual(["newest", "middle", "old"]);
  });

  it("never shows a listing twice: Featured, then Popular, then Newest", () => {
    const feed = [
      listing("paid-and-popular-and-new", 30, { featuredOnStartPage: true, requests_count: 9 }),
      listing("popular-and-new", 29, { requests_count: 5 }),
      listing("new", 28),
      listing("older", 10),
      listing("oldest", 1),
    ];
    const rows = pickHomeSections(feed);
    expect(ids(rows.featured)).toEqual(["paid-and-popular-and-new"]);
    expect(ids(rows.popular)).toEqual(["popular-and-new"]);
    expect(ids(rows.newest)).toEqual(["new", "older", "oldest"]);
  });

  it("takes three per row", () => {
    const feed = Array.from({ length: 10 }, (_, i) => listing(`l${i}`, i, { requests_count: i }));
    const rows = pickHomeSections(feed);
    expect(rows.popular).toHaveLength(3);
    expect(rows.newest).toHaveLength(3);
  });
});
