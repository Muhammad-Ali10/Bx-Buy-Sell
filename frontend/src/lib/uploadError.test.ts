import { uploadErrorMessage, uploadSizeRefusal } from "./uploadError";

/**
 * "I can't upload photos or files to the chat" — reported with a toast that
 * read "[object Object]". The upload itself went to a route that never
 * existed; these are the two things the person uploading is told.
 */
describe("upload error text", () => {
  it("reads the reason out of the server's nested message", () => {
    // The exact body the chat upload got back, which showed as "[object Object]".
    const refused = {
      status: "error",
      message: { message: "Cannot POST /upload", error: "Not Found", statusCode: 404 },
    };
    expect(uploadErrorMessage(refused, "Upload failed")).toBe("Cannot POST /upload");
  });

  it("takes a plain message as it is", () => {
    expect(uploadErrorMessage({ message: "Unsupported file type." }, "Upload failed")).toBe(
      "Unsupported file type.",
    );
  });

  it("joins a list of validation messages", () => {
    expect(
      uploadErrorMessage({ message: { message: ["file is required", "type is invalid"] } }, "x"),
    ).toBe("file is required, type is invalid");
  });

  it("falls back when there is nothing readable", () => {
    expect(uploadErrorMessage({}, "Upload failed (500)")).toBe("Upload failed (500)");
    expect(uploadErrorMessage(null, "Upload failed")).toBe("Upload failed");
    expect(uploadErrorMessage({ message: {} }, "Upload failed")).toBe("Upload failed");
    expect(uploadErrorMessage({ message: "   " }, "Upload failed")).toBe("Upload failed");
  });
});

describe("upload size", () => {
  const MB = 1024 * 1024;

  it("lets a file of exactly 10 MB through", () => {
    expect(uploadSizeRefusal(10 * MB)).toBeNull();
  });

  it("refuses anything larger, and says what the limit is", () => {
    expect(uploadSizeRefusal(10 * MB + 1)).toBe("File is too large (max 10 MB).");
  });
});
