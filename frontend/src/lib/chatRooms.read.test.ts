jest.mock("@/lib/api", () => ({ apiClient: {} }));

import { withRoomRead, type EnrichedChatRoom } from "./chatRooms";

/**
 * Reading a conversation clears its unread badge in the shared list cache,
 * instead of refetching the whole list on every open.
 */
describe("marking a conversation read in the list", () => {
  const room = (id: string, unreadCount: number) => ({ id, unreadCount }) as EnrichedChatRoom;

  it("clears only that conversation's count", () => {
    const rooms = [room("a", 3), room("b", 2)];
    expect(withRoomRead(rooms, "a")?.map((r) => [r.id, r.unreadCount])).toEqual([
      ["a", 0],
      ["b", 2],
    ]);
  });

  it("leaves every other room as the same object, so nothing else re-renders", () => {
    const rooms = [room("a", 3), room("b", 2), room("c", 0)];
    const next = withRoomRead(rooms, "a")!;
    expect(next[1]).toBe(rooms[1]);
    expect(next[2]).toBe(rooms[2]);
  });

  it("does nothing when the list has not been loaded", () => {
    expect(withRoomRead(undefined, "a")).toBeUndefined();
  });
});
