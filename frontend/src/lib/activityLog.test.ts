import { categoryLabel, describeBrowser, involvement, type ActivityEntry } from "./activityLog";

const entry = (overrides: Partial<ActivityEntry>): ActivityEntry => ({
  id: "e1",
  action: "auth.sign-in",
  category: "security",
  message: "Signed in",
  createdAt: "2026-09-11T10:00:00.000Z",
  ipAddress: null,
  userAgent: null,
  entityType: "user",
  entityId: null,
  actor: { id: "member-1", name: "Jane Doe", role: "USER" },
  subject: { id: "member-1", name: "Jane Doe", role: "USER" },
  ...overrides,
});

describe("activity log", () => {
  it("names nobody else for what the member did themselves", () => {
    expect(involvement(entry({}), "member-1")).toBeNull();
  });

  it("names the team member who did something to them", () => {
    const blocked = entry({
      message: "Account blocked",
      actor: { id: "admin-1", name: "hello rao0", role: "ADMIN" },
    });
    expect(involvement(blocked, "member-1")).toBe("by hello rao0");
  });

  it("names the member a team member did something to, in the team member's own log", () => {
    const blocked = entry({
      actor: { id: "admin-1", name: "hello rao0", role: "ADMIN" },
      subject: { id: "member-1", name: "Jane Doe", role: "USER" },
    });
    expect(involvement(blocked, "admin-1")).toBe("Jane Doe");
    expect(involvement({ ...blocked, subject: { id: "gone", name: null, role: null } }, "admin-1")).toBe(
      "a deleted account",
    );
  });

  it("says which browser and system a sign-in came from", () => {
    expect(
      describeBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      ),
    ).toBe("Chrome on Windows");
    expect(
      describeBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iOS");
    expect(
      describeBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0",
      ),
    ).toBe("Edge on Windows");
    expect(describeBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:129.0) Gecko/20100101 Firefox/129.0")).toBe(
      "Firefox on macOS",
    );
    expect(describeBrowser("curl/8.4")).toBe("Unknown browser");
    expect(describeBrowser(null)).toBeNull();
  });

  it("labels each kind of activity", () => {
    expect(categoryLabel("security")).toBe("Sign-ins & security");
    expect(categoryLabel("billing")).toBe("Plans & payments");
    expect(categoryLabel("nonsense")).toBe("Other");
  });
});
