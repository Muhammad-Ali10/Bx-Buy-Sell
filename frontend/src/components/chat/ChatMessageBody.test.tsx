import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatMessageBody } from "./ChatMessageBody";
import { downloadAttachment } from "@/lib/downloadFile";

jest.mock("@/lib/downloadFile", () => ({ downloadAttachment: jest.fn() }));

/**
 * "In the admin dashboard it only shows (image) but it does not show the
 * image itself that was uploaded."
 *
 * The admin window printed `message.content` and nothing else, so every
 * picture ever sent came out as the word beside it.
 */
describe("ChatMessageBody", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the picture that was sent", () => {
    render(
      <ChatMessageBody
        message={{ type: "IMAGE", content: "📷 Image", fileUrl: "https://cdn.test/cat.png" }}
      />,
    );

    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.test/cat.png");
    // "📷 Image" is what the sending side writes beside a photo, not a caption.
    expect(screen.queryByText("📷 Image")).toBeNull();
  });

  it("keeps a caption the sender actually wrote", () => {
    render(
      <ChatMessageBody
        message={{ type: "IMAGE", content: "Here is the dashboard", fileUrl: "https://cdn.test/a.png" }}
      />,
    );

    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText("Here is the dashboard")).toBeInTheDocument();
  });

  it("saves a file instead of opening it in a tab", async () => {
    render(
      <ChatMessageBody
        message={{ type: "FILE", content: "📎 accounts.pdf", fileUrl: "https://cdn.test/accounts.pdf" }}
      />,
    );

    await userEvent.click(screen.getByRole("link", { name: /accounts\.pdf/ }));

    expect(downloadAttachment).toHaveBeenCalledWith("https://cdn.test/accounts.pdf", "accounts.pdf");
  });

  it("still says something when a picture has no address", () => {
    render(<ChatMessageBody message={{ type: "IMAGE", content: "📷 Image", fileUrl: null }} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("📷 Image")).toBeInTheDocument();
  });

  it("writes plain words as they were typed", () => {
    render(<ChatMessageBody message={{ type: "TEXT", content: "hello\nthere" }} />);

    expect(screen.getByText(/hello/)).toBeInTheDocument();
  });
});
