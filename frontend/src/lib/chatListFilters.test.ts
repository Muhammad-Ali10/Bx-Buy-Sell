import {
  DEFAULT_CHAT_LIST_FILTERS,
  countActiveChatFilters,
  listingChoices,
  narrowsChatList,
  passesChatFilters,
  sortChats,
} from "./chatListFilters";

/**
 * The client: "The Filter is currently not working, please add there this
 * options: Label Filter (Good, Medium, Bad), Sorting based on (Listing)".
 */
const chat = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  listingId: `listing-${id}` as string | null,
  listingTitle: `Listing ${id}`,
  label: null as "GOOD" | "MEDIUM" | "BAD" | null,
  isPinned: false,
  pinnedAt: null as string | null,
  lastMessageAt: "2026-09-01T10:00:00.000Z",
  ...overrides,
});
const ids = (list: { id: string }[]) => list.map((c) => c.id);
const withFilters = (patch: Record<string, unknown> = {}) => ({
  ...DEFAULT_CHAT_LIST_FILTERS,
  ...patch,
});
const at = (hour: number) => `2026-09-01T${String(hour).padStart(2, "0")}:00:00.000Z`;

describe("label filter", () => {
  const good = chat("g", { label: "GOOD" });
  const medium = chat("m", { label: "MEDIUM" });
  const bad = chat("b", { label: "BAD" });
  const none = chat("n");
  const all = [good, medium, bad, none];

  it("shows every chat when no label is chosen", () => {
    expect(all.filter((c) => passesChatFilters(c, withFilters()))).toHaveLength(4);
  });

  it("shows only the chosen labels, several at once", () => {
    const filters = withFilters({ labels: ["GOOD", "MEDIUM"] });
    expect(ids(all.filter((c) => passesChatFilters(c, filters)))).toEqual(["g", "m"]);
  });

  it("hides chats with no label once one is chosen", () => {
    expect(passesChatFilters(none, withFilters({ labels: ["BAD"] }))).toBe(false);
  });
});

describe("listing filter", () => {
  it("shows one listing's chats only", () => {
    const filters = withFilters({ listingId: "listing-a" });
    expect(passesChatFilters(chat("a"), filters)).toBe(true);
    expect(passesChatFilters(chat("b"), filters)).toBe(false);
  });

  it("offers each listing once, A–Z, and not the chats about no listing", () => {
    const list = [
      chat("1", { listingId: "L2", listingTitle: "beta shop" }),
      chat("2", { listingId: "L1", listingTitle: "Alpha SaaS" }),
      chat("3", { listingId: "L2", listingTitle: "beta shop" }),
      chat("4", { listingId: null, listingTitle: "General enquiry" }),
    ];
    expect(listingChoices(list)).toEqual([
      { id: "L1", title: "Alpha SaaS" },
      { id: "L2", title: "beta shop" },
    ]);
  });
});

describe("sorting", () => {
  const list = [
    chat("zeta-old", { listingId: "Z", listingTitle: "Zeta", lastMessageAt: at(1) }),
    chat("alpha-old", { listingId: "A", listingTitle: "alpha", lastMessageAt: at(2) }),
    chat("general", { listingId: null, listingTitle: "General enquiry", lastMessageAt: at(9) }),
    chat("zeta-new", { listingId: "Z", listingTitle: "Zeta", lastMessageAt: at(5) }),
    chat("alpha-new", { listingId: "A", listingTitle: "alpha", lastMessageAt: at(4) }),
  ];

  it("puts the newest message first by default", () => {
    expect(ids(sortChats(list, "recent"))).toEqual([
      "general",
      "zeta-new",
      "alpha-new",
      "alpha-old",
      "zeta-old",
    ]);
  });

  it("groups by listing A–Z, newest first within each, chats about no listing last", () => {
    expect(ids(sortChats(list, "listing"))).toEqual([
      "alpha-new",
      "alpha-old",
      "zeta-new",
      "zeta-old",
      "general",
    ]);
  });

  it("keeps two listings with the same name apart", () => {
    const twins = [
      chat("x1", { listingId: "X", listingTitle: "Test Title", lastMessageAt: at(1) }),
      chat("y1", { listingId: "Y", listingTitle: "Test Title", lastMessageAt: at(3) }),
      chat("x2", { listingId: "X", listingTitle: "Test Title", lastMessageAt: at(5) }),
    ];
    const sorted = ids(sortChats(twins, "listing"));
    expect(Math.abs(sorted.indexOf("x1") - sorted.indexOf("x2"))).toBe(1);
  });

  it("keeps pinned chats on top in either order, the newest pin first", () => {
    const pinned = [
      ...list,
      chat("pin-old", { listingId: "Z", listingTitle: "Zeta", isPinned: true, pinnedAt: at(1), lastMessageAt: at(0) }),
      chat("pin-new", { listingId: "A", listingTitle: "alpha", isPinned: true, pinnedAt: at(6), lastMessageAt: at(0) }),
    ];
    expect(ids(sortChats(pinned, "listing")).slice(0, 2)).toEqual(["pin-new", "pin-old"]);
    expect(ids(sortChats(pinned, "recent")).slice(0, 2)).toEqual(["pin-new", "pin-old"]);
  });

  it("leaves the list it was given as it was", () => {
    const before = ids(list);
    sortChats(list, "listing");
    expect(ids(list)).toEqual(before);
  });
});

describe("the number on the filter button", () => {
  it("is zero at rest", () => {
    expect(countActiveChatFilters(DEFAULT_CHAT_LIST_FILTERS)).toBe(0);
  });

  it("counts label, listing and order once each", () => {
    expect(countActiveChatFilters(withFilters({ labels: ["GOOD", "BAD"] }))).toBe(1);
    expect(
      countActiveChatFilters(withFilters({ labels: ["GOOD"], listingId: "L1", sort: "listing" })),
    ).toBe(3);
  });

  it("tells hiding chats from reordering them", () => {
    expect(narrowsChatList(withFilters({ sort: "listing" }))).toBe(false);
    expect(narrowsChatList(withFilters({ labels: ["BAD"] }))).toBe(true);
    expect(narrowsChatList(withFilters({ listingId: "L1" }))).toBe(true);
  });
});
