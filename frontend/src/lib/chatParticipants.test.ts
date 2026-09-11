import { teamParticipants, uniqueParticipants } from "./chatParticipants";

describe("teamParticipants", () => {
  const admin = { id: "admin", first_name: "hello", last_name: "rao0", profile_pic: "a.jpg", role: "ADMIN" };
  const buyer = { id: "buyer", first_name: "Manuel", last_name: "Aigner", role: "USER" };

  it("finds the admin who wrote into a buyer and seller's chat, once", () => {
    const messages = [
      { senderId: "buyer", sender: buyer },
      { senderId: "admin", sender: admin },
      { senderId: "admin", sender: admin },
    ];
    expect(teamParticipants(messages, ["buyer", "seller"])).toEqual([
      { id: "admin", full_name: "hello rao0", avatar_url: "a.jpg", role: "ADMIN" },
    ]);
  });

  it("leaves out platform notices, which have no sender", () => {
    expect(teamParticipants([{ senderId: null, sender: null }], ["buyer", "seller"])).toEqual([]);
  });

  it("finds nobody when only the buyer and seller wrote", () => {
    const messages = [{ senderId: "buyer", sender: buyer }, { senderId: "seller" }];
    expect(teamParticipants(messages, ["buyer", "seller"])).toEqual([]);
  });

  it("copes with no messages at all", () => {
    expect(teamParticipants(undefined, ["buyer", "seller"])).toEqual([]);
  });

  it("names nobody while it does not know who the buyer and seller are", () => {
    const messages = [{ senderId: "buyer", sender: buyer }];
    expect(teamParticipants(messages, [undefined, "seller"])).toEqual([]);
  });
});

describe("uniqueParticipants", () => {
  const buyer = { id: "buyer", full_name: "Mulhammad Ali2" };
  const seller = { id: "seller", full_name: "abcd abcd" };

  it("keeps a buyer and a seller who are different people, in order", () => {
    expect(uniqueParticipants([buyer, seller])).toEqual([buyer, seller]);
  });

  it("lists someone who is both buyer and seller once", () => {
    expect(uniqueParticipants([seller, { ...seller }])).toEqual([seller]);
  });

  it("skips a missing side", () => {
    expect(uniqueParticipants([null, seller, undefined])).toEqual([seller]);
  });

  it("does not merge people it cannot tell apart", () => {
    const a = { id: undefined, full_name: "A" };
    const b = { id: undefined, full_name: "B" };
    expect(uniqueParticipants([a, b])).toEqual([a, b]);
  });
});
