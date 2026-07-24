import { normalizePublicSignupPassword } from "./authCredentials";

describe("normalizePublicSignupPassword", () => {
  it("lowercases and trims to match public signup payloads", () => {
    expect(normalizePublicSignupPassword("  AbC12  ")).toBe("abc12");
  });
});
