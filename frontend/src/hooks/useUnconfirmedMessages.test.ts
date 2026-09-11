import { act, renderHook } from "@testing-library/react";
import { useUnconfirmedMessages } from "./useUnconfirmedMessages";

/**
 * "The message can be sent initially, but after refreshing the page, it
 * disappears completely."
 */
describe("useUnconfirmedMessages", () => {
  const message = { tempId: "temp-1", content: "Hello Manuel", restorable: true };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("gives a message back when the server never confirms it", () => {
    const onFail = jest.fn();
    const { result } = renderHook(() => useUnconfirmedMessages(onFail, 15000));

    act(() => result.current.track(message));
    act(() => jest.advanceTimersByTime(14999));
    expect(onFail).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(onFail).toHaveBeenCalledWith(message, undefined);
  });

  it("lets go of a message once its saved copy arrives", () => {
    const onFail = jest.fn();
    const { result } = renderHook(() => useUnconfirmedMessages(onFail, 15000));

    act(() => result.current.track(message));
    act(() => result.current.confirm("temp-1"));
    act(() => jest.advanceTimersByTime(60000));

    expect(onFail).not.toHaveBeenCalled();
  });

  it("gives back everything still waiting when the server refuses, with its reason", () => {
    const onFail = jest.fn();
    const { result } = renderHook(() => useUnconfirmedMessages(onFail, 15000));
    const second = { tempId: "temp-2", content: "📷 Image", restorable: false };

    act(() => {
      result.current.track(message);
      result.current.track(second);
    });
    act(() => result.current.failAll("Unauthorized sender"));

    expect(onFail).toHaveBeenCalledTimes(2);
    expect(onFail).toHaveBeenCalledWith(message, "Unauthorized sender");
    expect(onFail).toHaveBeenCalledWith(second, "Unauthorized sender");

    // Given back once, not again when its timer would have run out.
    act(() => jest.advanceTimersByTime(60000));
    expect(onFail).toHaveBeenCalledTimes(2);
  });

  it("stays the same object from one render to the next", () => {
    const { result, rerender } = renderHook(() => useUnconfirmedMessages(jest.fn(), 15000));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it("forgets everything when the window closes", () => {
    const onFail = jest.fn();
    const { result, unmount } = renderHook(() => useUnconfirmedMessages(onFail, 15000));

    act(() => result.current.track(message));
    unmount();
    act(() => jest.advanceTimersByTime(60000));

    expect(onFail).not.toHaveBeenCalled();
  });
});
