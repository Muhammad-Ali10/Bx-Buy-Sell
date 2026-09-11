import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { apiClient } from "@/lib/api";
import { AdminChatDetails } from "./AdminChatDetails";

jest.mock("@/lib/api", () => ({
  apiClient: {
    getChatById: jest.fn(),
    getSecureListingById: jest.fn(),
  },
}));
// Reads `import.meta.env`, which Jest's CommonJS build cannot parse.
jest.mock("@/lib/apiBase", () => ({ apiBaseUrl: "http://api.test" }));

/**
 * Who the Details panel says is in a conversation.
 *
 * It went wrong twice. A chat whose buyer is also its seller listed that
 * account twice, and the two avatars shared a key — when the panel moved on,
 * React kept one, so the next chat showed a picture of nobody in it. And an
 * admin who wrote into a buyer and seller's chat was in it, but not shown.
 */
describe("AdminChatDetails participants", () => {
  const abcd = { id: "abcd", first_name: "abcd", last_name: "abcd", profile_pic: null };
  const mulhammad = { id: "mulhammad", first_name: "Mulhammad", last_name: "Ali2", profile_pic: null };
  const admin = { id: "admin", first_name: "hello", last_name: "rao0", profile_pic: null, role: "ADMIN" };
  const chats: Record<string, unknown> = {
    "self-chat": { id: "self-chat", user: abcd, seller: abcd, messages: [] },
    "real-chat": { id: "real-chat", user: mulhammad, seller: abcd, messages: [] },
    // As in the client's second screenshot: the buyer wrote, the admin wrote
    // once, and the platform posted a notice.
    "team-chat": {
      id: "team-chat",
      user: mulhammad,
      seller: abcd,
      messages: [
        { id: "m1", senderId: "mulhammad", sender: mulhammad, type: "TEXT", content: "hi" },
        { id: "m2", senderId: "admin", sender: admin, type: "ADMIN", content: "Hello from the team" },
        { id: "m3", senderId: null, sender: null, type: "SYSTEM", content: "notice" },
      ],
    },
  };

  beforeEach(() => {
    (apiClient.getChatById as jest.Mock).mockImplementation(async (id: string) => ({
      success: true,
      data: chats[id],
    }));
  });

  const avatarCount = (container: HTMLElement) =>
    container.querySelectorAll(".border-2.border-white").length;

  const panel = (conversationId: string) => (
    <MemoryRouter>
      <AdminChatDetails conversationId={conversationId} />
    </MemoryRouter>
  );

  it("shows someone who is both buyer and seller once", async () => {
    const { container } = render(panel("self-chat"));

    await screen.findByRole("heading", { name: "abcd abcd" });
    expect(avatarCount(container)).toBe(1);
  });

  it("does not carry a picture over from the chat before", async () => {
    const { container, rerender } = render(panel("self-chat"));
    await screen.findByRole("heading", { name: /abcd abcd/ });

    rerender(panel("real-chat"));

    await screen.findByRole("heading", { name: /Mulhammad Ali2\s+←→\s+abcd abcd/ });
    expect(avatarCount(container)).toBe(2);
    expect(screen.queryByText(/^Team:/)).toBeNull();
  });

  it("shows a team member who wrote in the chat, marked as the team", async () => {
    const { container } = render(panel("team-chat"));

    await screen.findByRole("heading", { name: /Mulhammad Ali2\s+←→\s+abcd abcd/ });
    expect(avatarCount(container)).toBe(3);
    expect(screen.getByText("Team: hello rao0")).toBeTruthy();
  });
});
