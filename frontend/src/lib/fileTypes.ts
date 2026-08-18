/**
 * The file formats a seller may attach to a listing, and how each one is drawn.
 *
 * This is the single source of truth: the upload `accept` hint, the real
 * validation that blocks everything else, and the icon shown on the listing
 * page all read from here. Adding a format means adding one entry.
 */

export type FileGlyph =
  | "pdf"
  | "word"
  | "excel"
  | "ppt"
  | "pptx"
  | "csv"
  | "txt"
  | "image"
  | "heic"
  | "video";

interface FileTypeStyle {
  /** Badge colour, taken from the client's icon sheet. */
  color: string;
  /** Which white pictogram sits above the label. */
  glyph: FileGlyph;
}

export const FILE_TYPE_STYLES: Record<string, FileTypeStyle> = {
  pdf: { color: "#E8453C", glyph: "pdf" },
  doc: { color: "#2E7CD6", glyph: "word" },
  docx: { color: "#2E7CD6", glyph: "word" },
  xls: { color: "#1D8E4E", glyph: "excel" },
  xlsx: { color: "#1D8E4E", glyph: "excel" },
  ppt: { color: "#F58220", glyph: "ppt" },
  pptx: { color: "#F58220", glyph: "pptx" },
  csv: { color: "#1BA5A0", glyph: "csv" },
  txt: { color: "#8262C0", glyph: "txt" },
  png: { color: "#8262C0", glyph: "image" },
  jpg: { color: "#5BB947", glyph: "image" },
  jpeg: { color: "#EE5273", glyph: "image" },
  heic: { color: "#1BA5A0", glyph: "heic" },
  mp4: { color: "#EE5273", glyph: "video" },
  mov: { color: "#8262C0", glyph: "video" },
};

/** Every format a seller is allowed to upload. Anything else is rejected. */
export const ALLOWED_ATTACHMENT_EXTENSIONS = Object.keys(FILE_TYPE_STYLES);

/** Shown to the seller when a file is turned away. */
export const ALLOWED_ATTACHMENT_LABEL = ALLOWED_ATTACHMENT_EXTENSIONS.map((e) =>
  e.toUpperCase(),
).join(", ");

/**
 * `accept` for the file input. This is only a hint — a browser will still let
 * someone pick "All files" or drag anything in, so never rely on it alone.
 */
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",");

/** Documents, spreadsheets and images. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Video gets its own, much larger cap.
 *
 * MP4 and MOV are on the allowed list, but almost no real video fits in 10 MB
 * — a few seconds of phone footage passes that on its own. Holding video to
 * the document limit means the format is offered and then refused.
 */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const VIDEO_EXTENSIONS = ["mp4", "mov"];

/** The size limit that applies to this particular file. */
export const maxBytesFor = (nameOrUrl: string): number =>
  VIDEO_EXTENSIONS.includes(getFileExtension(nameOrUrl))
    ? MAX_VIDEO_BYTES
    : MAX_ATTACHMENT_BYTES;

/** "10 MB" / "100 MB", for the message shown when a file is too big. */
export const formatMaxSize = (bytes: number): string => `${Math.round(bytes / (1024 * 1024))} MB`;

/** Lowercase extension of a file name or a URL (query string stripped). */
export const getFileExtension = (nameOrUrl: string): string =>
  String(nameOrUrl || "")
    .split("?")[0]
    .split("#")[0]
    .split(".")
    .pop()
    ?.toLowerCase() ?? "";

/** True when the file's extension is one the client allows. */
export const isAllowedAttachment = (nameOrUrl: string): boolean =>
  ALLOWED_ATTACHMENT_EXTENSIONS.includes(getFileExtension(nameOrUrl));
