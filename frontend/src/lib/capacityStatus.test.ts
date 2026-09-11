import { capacityRowStatus } from "./capacityStatus";

/**
 * The client: after sending proof of funds and returning to Account Details,
 * the Acquisition Capacity row should show the documents are being reviewed —
 * not ask for them again.
 */
describe("the Acquisition Capacity row on Account Details", () => {
  it("asks for documents when none were sent", () => {
    expect(capacityRowStatus(null)).toBe("NONE");
    expect(capacityRowStatus({ verified: false, status: null })).toBe("NONE");
  });

  it("reads In Review while the documents wait for a moderator", () => {
    expect(capacityRowStatus({ verified: false, status: "UNASSIGNED" })).toBe("IN_REVIEW");
    expect(capacityRowStatus({ verified: false, status: "IN_REVIEW" })).toBe("IN_REVIEW");
  });

  it("reads Verified once a review found an amount", () => {
    expect(capacityRowStatus({ verified: true, status: "COMPLETED" })).toBe("VERIFIED");
  });

  it("asks again when the review verified nothing", () => {
    expect(capacityRowStatus({ verified: false, status: "COMPLETED" })).toBe("NONE");
  });
});
