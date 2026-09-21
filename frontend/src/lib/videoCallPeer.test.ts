import { callerProfile, isTeamCaller, ringIsForMe, TEAM_CALLER } from "./videoCallPeer";

describe("video call peer", () => {
  const chat = {
    userId: "buyer-1",
    sellerId: "seller-1",
    user: { first_name: "Bea", last_name: "Buyer", profile_pic: "b.png" },
    seller: { first_name: "Sam", last_name: "Seller", profile_pic: null },
  };

  it("names the buyer or the seller when one of them is calling", () => {
    expect(callerProfile(chat, "buyer-1")).toEqual({ first_name: "Bea", last_name: "Buyer", profile_pic: "b.png" });
    expect(callerProfile(chat, "seller-1")?.first_name).toBe("Sam");
  });

  it("shows EX-Support when the caller is not in the conversation", () => {
    expect(callerProfile(chat, "admin-1")).toBe(TEAM_CALLER);
    expect(isTeamCaller(chat, "admin-1")).toBe(true);
    expect(isTeamCaller(chat, "buyer-1")).toBe(false);
  });

  it("rings only the person the call is for", () => {
    // The team rings the buyer; the seller has the same conversation open.
    const call = { from: "admin-1", to: "buyer-1" };
    expect(ringIsForMe(call, "buyer-1")).toBe(true);
    expect(ringIsForMe(call, "seller-1")).toBe(false);
    expect(ringIsForMe(call, "admin-1")).toBe(false);
  });

  it("still rings for an older event that does not say who it is for", () => {
    expect(ringIsForMe({ from: "seller-1" }, "buyer-1")).toBe(true);
    expect(ringIsForMe({ from: "seller-1" }, null)).toBe(false);
  });
});
