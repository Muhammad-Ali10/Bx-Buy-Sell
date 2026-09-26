jest.mock("@/lib/apiBase", () => ({ apiBaseUrl: "http://api.test" }));
import { render, screen, waitFor } from "@testing-library/react";
import { ProtectedImg } from "./ProtectedImg";

/**
 * Chat photos are private now: only readable through the protected download
 * route, with the viewer's token — which an `<img src>` cannot send.
 */
describe("ProtectedImg", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    localStorage.setItem("auth_token", "token-1");
    (URL as any).createObjectURL = jest.fn(() => "blob:photo-1");
    (URL as any).revokeObjectURL = jest.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it("shows a public image as it is, without fetching it", () => {
    global.fetch = jest.fn();
    render(<ProtectedImg src="https://res.cloudinary.com/demo/image/upload/cat.png" alt="cat" />);
    expect(screen.getByRole("img", { name: "cat" })).toHaveAttribute(
      "src",
      "https://res.cloudinary.com/demo/image/upload/cat.png",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches a private one with the viewer's token and shows it from memory", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["x"]) });
    render(
      <ProtectedImg
        src="/attachments/0f8fad5b-d9cb-469f-a165-70867728950e/download/photo.png"
        alt="photo"
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("img", { name: "photo" })).toHaveAttribute("src", "blob:photo-1"),
    );
    expect((global.fetch as jest.Mock).mock.calls[0][1]).toEqual({
      headers: { Authorization: "Bearer token-1" },
    });
  });

  it("says so when the viewer may not see it", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    render(
      <ProtectedImg src="/attachments/0f8fad5b-d9cb-469f-a165-70867728950e/download/p.png" alt="p" />,
    );
    expect(await screen.findByRole("img", { name: "Image unavailable" })).toBeInTheDocument();
  });
});
