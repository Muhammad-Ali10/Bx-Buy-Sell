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
 * The formats listed for the seller, as ".pdf, .doc, …".
 *
 * Deliberately not handed to the file input's `accept`. It was, and that is
 * what made a refusal silent: the dialog greyed out a .zip, the seller picked
 * nothing, no handler ran, and nothing was ever said. The browser was
 * rejecting the file before the code that explains rejections could see it.
 *
 * So the picker now shows everything and the check below does the refusing —
 * out loud. This string is for telling the seller what is allowed, not for
 * stopping them.
 */
export const ATTACHMENT_ACCEPT_LABEL = ALLOWED_ATTACHMENT_EXTENSIONS.map(
  (e) => `.${e}`,
).join(", ");

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

/**
 * Other spellings of an allowed format. Windows saves a JPEG downloaded from
 * the web as ".jfif"; an iPhone photo can arrive as ".heif".
 */
const EXTENSION_ALIASES: Record<string, string> = {
  jfif: "jpg",
  jpe: "jpg",
  pjpeg: "jpg",
  pjp: "jpg",
  heif: "heic",
  qt: "mov",
};

/** The allowed formats as the browser names them, whatever the file is called. */
const EXTENSION_FOR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/csv": "csv",
  "application/csv": "csv",
  "text/plain": "txt",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/heic": "heic",
  "image/heif": "heic",
  "image/heic-sequence": "heic",
  "image/heif-sequence": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

/**
 * Which of the allowed formats this file is, or null when it is none of them.
 *
 * The name alone refused files of an allowed format: a JPEG saved as ".jfif",
 * or a PDF handed over by a phone or a cloud drive with no extension in its
 * name at all ("Invoice" rather than "Invoice.pdf"). The type the browser
 * reports decides when the name cannot.
 */
export function allowedAttachmentExtension(file: { name: string; type?: string }): string | null {
  const name = String(file.name || "");
  const ext = name.includes(".") ? getFileExtension(name) : "";
  if (ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) return ext;
  if (EXTENSION_ALIASES[ext]) return EXTENSION_ALIASES[ext];
  return EXTENSION_FOR_MIME[String(file.type || "").toLowerCase()] ?? null;
}

/**
 * The file ready to upload, or null when its format is not allowed.
 *
 * A file accepted by its type is renamed to carry the extension of its format
 * ("photo.jfif" -> "photo.jpg", "Invoice" -> "Invoice.pdf"): the uploaded
 * address keeps the name, and the listing page picks each file's icon from the
 * extension at the end of it.
 */
export function asAllowedAttachment(file: File): File | null {
  const ext = allowedAttachmentExtension(file);
  if (!ext) return null;
  const name = String(file.name || "").trim();
  const current = name.includes(".") ? getFileExtension(name) : "";
  if (current === ext) return file;
  const base =
    current && EXTENSION_ALIASES[current] ? name.slice(0, -(current.length + 1)) : name || "file";
  return new File([file], `${base}.${ext}`, { type: file.type, lastModified: file.lastModified });
}

/**
 * What the seller is told about the files turned away, by name — "1 file(s)
 * skipped" read like a fault, because it never said which file or why.
 */
export function refusedAttachmentsMessage(files: { name: string }[]): string {
  const first = `"${files[0]?.name || "file"}"`;
  const who = files.length > 1 ? `${first} and ${files.length - 1} more` : first;
  const verb = files.length > 1 ? "weren't" : "wasn't";
  // The client's words first: the seller should read that the type is the
  // problem before reading which types would do.
  return `File type not supported — ${who} ${verb} uploaded. Allowed: ${ALLOWED_ATTACHMENT_LABEL}`;
}

/**
 * For a file input's `accept`, so the picker offers only what will be taken.
 *
 * The check above still runs on every file: a drag-and-drop, or "All files"
 * chosen in the dialog, passes by the attribute entirely.
 */
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",");

/** The picture formats of the fifteen — what a photo question takes. */
export const PHOTO_EXTENSIONS = ["png", "jpg", "jpeg", "heic"];
export const PHOTO_ACCEPT = PHOTO_EXTENSIONS.map((e) => `.${e}`).join(",");
export const PHOTO_LABEL = PHOTO_EXTENSIONS.map((e) => e.toUpperCase()).join(", ");

/** A photo the platform takes, renamed like `asAllowedAttachment`; null otherwise. */
export function asAllowedPhoto(file: File): File | null {
  const allowed = asAllowedAttachment(file);
  return allowed && PHOTO_EXTENSIONS.includes(getFileExtension(allowed.name)) ? allowed : null;
}

export function refusedPhotosMessage(files: { name: string }[]): string {
  const first = `"${files[0]?.name || "file"}"`;
  const who = files.length > 1 ? `${first} and ${files.length - 1} more` : first;
  const verb = files.length > 1 ? "weren't" : "wasn't";
  return `File type not supported — ${who} ${verb} uploaded. Photos can be: ${PHOTO_LABEL}`;
}
