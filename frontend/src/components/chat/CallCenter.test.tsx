import { act, fireEvent, render, screen } from "@testing-library/react";

import { CallCenter } from "./CallCenter";
import { startCall } from "@/lib/calls";

/**
 * The client found calls came through only while the other person had the
 * chat open; everywhere else they were "offline". The CallCenter sits at the
 * root, on the session's connection, so a call rings on any page.
 */
const handlers: Record<string, (data: any) => void> = {};
const emit = jest.fn();
const fakeSocket = {
  connected: true,
  on: (event: string, handler: (data: any) => void) => {
    handlers[event] = handler;
  },
  off: (event: string) => {
    delete handlers[event];
  },
  emit,
  timeout: () => ({ emit }),
};

jest.mock("@/lib/socket", () => ({
  onPresenceSocket: (listener: (socket: unknown) => void) => {
    listener(fakeSocket);
    return () => undefined;
  },
}));
jest.mock("@/lib/ringTone", () => ({ startRingTone: jest.fn(), stopRingTone: jest.fn() }));
jest.mock("./GroupVideoCall", () => ({ __esModule: true, default: () => <div>call screen</div> }));

const ring = (kind: "direct" | "group") =>
  act(() => {
    handlers["group-call:incoming"]({
      chatId: "c1",
      callId: "call-1",
      kind,
      from: kind === "group" ? "admin-1" : "buyer-1",
      people:
        kind === "group"
          ? { "admin-1": "EX-Support", "buyer-1": "Bea Buyer", "seller-1": "Sam Seller" }
          : { "buyer-1": "Bea Buyer", "seller-1": "Sam Seller" },
    });
  });

describe("calls ringing anywhere on the site", () => {
  beforeEach(() => emit.mockClear());

  it("rings a call between two people with the caller's name", () => {
    render(<CallCenter />);
    ring("direct");
    expect(screen.getByRole("dialog", { name: "Incoming video call" })).toBeTruthy();
    expect(screen.getByText("Bea Buyer")).toBeTruthy();
    expect(screen.getByText("is calling you")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Answer/ })).toBeTruthy();
  });

  it("rings a group call with who else is invited", () => {
    render(<CallCenter />);
    ring("group");
    expect(screen.getByRole("dialog", { name: "Incoming group video call" })).toBeTruthy();
    expect(screen.getByText(/with Bea Buyer and Sam Seller/)).toBeTruthy();
  });

  it("tells the server when a call is declined, and goes away", () => {
    render(<CallCenter />);
    ring("direct");
    fireEvent.click(screen.getByRole("button", { name: /Decline/ }));
    expect(emit).toHaveBeenCalledWith("group-call:decline", { chatId: "c1", callId: "call-1" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stops ringing when the call ends before it is answered", () => {
    render(<CallCenter />);
    ring("direct");
    act(() => handlers["group-call:ended"]({ callId: "call-1", reason: "no_answer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("answers with the call it was rung for", () => {
    render(<CallCenter />);
    ring("direct");
    fireEvent.click(screen.getByRole("button", { name: /Answer/ }));
    expect(emit).toHaveBeenCalledWith("group-call:join", { chatId: "c1", callId: "call-1" }, expect.any(Function));
  });
});

describe("placing a call from a button anywhere in the app", () => {
  beforeEach(() => emit.mockClear());

  it("asks the server to ring the person, and opens the call screen when it does", async () => {
    render(<CallCenter />);
    act(() => startCall({ chatId: "c1", to: "seller-1" }));
    expect(emit).toHaveBeenCalledWith("group-call:start", { chatId: "c1", to: "seller-1" }, expect.any(Function));

    const reply = emit.mock.calls[0][2];
    act(() =>
      reply(null, {
        ok: true,
        callId: "call-9",
        kind: "direct",
        invited: ["seller-1"],
        people: { "buyer-1": "Bea Buyer", "seller-1": "Sam Seller" },
        appId: "a",
        channel: "gc_x",
        token: "t",
        uid: "buyer-1",
      }),
    );
    expect(await screen.findByText("call screen")).toBeTruthy();
  });
});
