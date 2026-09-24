import { callLogLabel } from "./callLog";

describe("how a call reads in the conversation", () => {
  it("keeps the one-to-one wording", () => {
    expect(callLogLabel({ type: "video_call_completed" })).toBe("Video call ended");
    expect(callLogLabel({ type: "missed_video_call" })).toBe("Missed video call");
  });

  it("says when it was a group call, and how many took part", () => {
    expect(callLogLabel({ type: "video_call_completed", group: true, participants: 3 })).toBe(
      "Group video call ended · 3 people",
    );
    expect(callLogLabel({ type: "missed_video_call", group: true })).toBe("Missed group video call");
  });
});
