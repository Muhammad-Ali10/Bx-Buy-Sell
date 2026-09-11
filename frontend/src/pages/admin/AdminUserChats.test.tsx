jest.mock("@/lib/api", () => ({
  apiClient: { getSecureListingById: jest.fn(), getOrCreateDirectChat: jest.fn() },
}));
jest.mock("@/lib/apiBase", () => ({ apiBaseUrl: "http://api.test" }));
jest.mock("@/components/admin/AdminSidebar", () => ({ AdminSidebar: () => null }));
jest.mock("@/components/admin/AdminHeader", () => ({ AdminHeader: () => null }));
jest.mock("@/components/chat/ChatDetails", () => ({ ChatDetails: () => null }));

// The chat window is only watched: what it was asked to do is the question here.
let mockChatWindowProps: Record<string, unknown> | null = null;
jest.mock("@/components/chat/ChatWindow", () => ({
  ChatWindow: (props: Record<string, unknown>) => {
    mockChatWindowProps = props;
    return null;
  },
}));

// Stands in for the real list and reports what it would have found.
let mockListFinds: "nothing" | "a conversation" = "nothing";
jest.mock("@/components/chat/ConversationList", () => {
  const React = require("react");
  return {
    ConversationList: (props: {
      onAutoSelectMissing?: () => void;
      onSelectConversation: (chatId: string, userId: string, sellerId: string) => void;
    }) => {
      React.useEffect(() => {
        if (mockListFinds === "nothing") props.onAutoSelectMissing?.();
        else props.onSelectConversation("chat-1", "buyer-1", "owner-1");
      }, []);
      return null;
    },
  };
});

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { apiClient } from "@/lib/api";
import AdminUserChats from "./AdminUserChats";

/**
 * The admin's view of one member's conversations, reached from the listings
 * table's Chat button.
 */
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/users/owner-1/chats?listingId=l1"]}>
      <Routes>
        <Route path="/admin/users/:id/chats" element={<AdminUserChats />} />
      </Routes>
    </MemoryRouter>,
  );

describe("AdminUserChats, arriving from a listing", () => {
  beforeEach(() => {
    mockChatWindowProps = null;
    (apiClient.getSecureListingById as jest.Mock).mockResolvedValue({
      success: true,
      data: { advertisement: [{ question: "Title", answer: "RETEST P&L Spalten" }] },
    });
  });

  /*
   * "When I click on Chat, I am currently redirected to the general chat
   * overview." The listing the client tried had no conversation at all.
   */
  it("says so, by name, when nobody has written about the listing yet", async () => {
    mockListFinds = "nothing";
    renderPage();

    expect(
      await screen.findByText('Nobody has written about "RETEST P&L Spalten" yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByText("Select a conversation to view messages")).toBeNull();
    expect(apiClient.getSecureListingById).toHaveBeenCalledWith("l1");
  });

  /*
   * "The message can be sent initially, but after refreshing the page, it
   * disappears completely." It was sent in the member's name, which the
   * server refuses; written here, it goes in as the team.
   */
  it("opens the conversation, and what is written there goes in as the team", async () => {
    mockListFinds = "a conversation";
    renderPage();

    await waitFor(() => expect(mockChatWindowProps).not.toBeNull());
    expect(mockChatWindowProps?.conversationId).toBe("chat-1");
    expect(mockChatWindowProps?.sendAsTeam).toBe(true);
    expect(screen.queryByText(/Nobody has written about/)).toBeNull();
  });
});
