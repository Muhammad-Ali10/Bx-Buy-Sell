import { FILE_TYPE_STYLES, getFileExtension, type FileGlyph } from "@/lib/fileTypes";

/**
 * The badge shown next to an attachment: a folded-corner page in the format's
 * colour, its own pictogram, and the format name underneath — following the
 * icon sheet the client supplied.
 *
 * Drawn rather than shipped as fifteen SVG files, so adding a format is one
 * entry in FILE_TYPE_STYLES and nothing else.
 */

/** White rounded tile holding the format's initial, as on DOC / XLS / PPT. */
const letterTile = (letter: string, color: string) => (
  <>
    <rect x="7" y="14.5" width="12" height="12" rx="2" fill="#fff" />
    <text
      x="13"
      y="24"
      textAnchor="middle"
      fill={color}
      fontSize="9.5"
      fontWeight="700"
      fontFamily="Arial, Helvetica, sans-serif"
    >
      {letter}
    </text>
  </>
);

/** Three white rules, the "text" half of the document icons. */
const rules = (
  <g fill="#fff">
    <rect x="21" y="15" width="11" height="2" rx="1" />
    <rect x="21" y="19.5" width="11" height="2" rx="1" />
    <rect x="21" y="24" width="11" height="2" rx="1" />
  </g>
);

const GLYPHS: Record<FileGlyph, (color: string) => JSX.Element> = {
  // Bold "A", standing in for the Acrobat mark.
  pdf: () => (
    <text
      x="20"
      y="28"
      textAnchor="middle"
      fill="#fff"
      fontSize="19"
      fontWeight="700"
      fontFamily="Georgia, 'Times New Roman', serif"
    >
      A
    </text>
  ),
  word: (color) => (
    <g>
      {letterTile("W", color)}
      {rules}
    </g>
  ),
  excel: (color) => (
    <g>
      {letterTile("X", color)}
      <g fill="#fff">
        <rect x="21" y="15" width="5" height="4.6" rx="0.8" />
        <rect x="27.5" y="15" width="4.5" height="4.6" rx="0.8" />
        <rect x="21" y="21.4" width="5" height="4.6" rx="0.8" />
        <rect x="27.5" y="21.4" width="4.5" height="4.6" rx="0.8" />
      </g>
    </g>
  ),
  // Pie wedge on its own.
  ppt: () => (
    <g fill="#fff">
      <path d="M19 14.5a7 7 0 1 0 7 7h-7z" />
      <path d="M21 12.5v7h7a7 7 0 0 0-7-7z" opacity="0.7" />
    </g>
  ),
  pptx: (color) => (
    <g>
      {letterTile("P", color)}
      <g fill="#fff">
        <path d="M26.5 16a5 5 0 1 0 5 5h-5z" />
        <path d="M28 14v5h5a5 5 0 0 0-5-5z" opacity="0.7" />
      </g>
    </g>
  ),
  // Bulleted rows.
  csv: () => (
    <g fill="#fff">
      <circle cx="11" cy="16" r="1.7" />
      <circle cx="11" cy="20.5" r="1.7" />
      <circle cx="11" cy="25" r="1.7" />
      <rect x="15.5" y="15" width="14" height="2" rx="1" />
      <rect x="15.5" y="19.5" width="14" height="2" rx="1" />
      <rect x="15.5" y="24" width="14" height="2" rx="1" />
    </g>
  ),
  txt: () => (
    <g>
      <text
        x="12"
        y="25"
        textAnchor="middle"
        fill="#fff"
        fontSize="14"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        T
      </text>
      {rules}
    </g>
  ),
  // Photo: sun over a hill, cut out of a white frame.
  image: (color) => (
    <g>
      <rect x="9" y="13.5" width="22" height="15" rx="2" fill="#fff" />
      <circle cx="15" cy="18.5" r="2.2" fill={color} />
      <path d="M11 28.5l5.8-7 3.6 4.2 2.8-3 6.8 5.8z" fill={color} />
    </g>
  ),
  // "HEIC" inside corner brackets.
  heic: () => (
    <g fill="#fff">
      <rect x="9" y="13.5" width="2" height="6" rx="1" />
      <rect x="9" y="13.5" width="6" height="2" rx="1" />
      <rect x="29" y="13.5" width="2" height="6" rx="1" />
      <rect x="25" y="13.5" width="6" height="2" rx="1" />
      <rect x="9" y="23" width="2" height="6" rx="1" />
      <rect x="9" y="27" width="6" height="2" rx="1" />
      <rect x="29" y="23" width="2" height="6" rx="1" />
      <rect x="25" y="27" width="6" height="2" rx="1" />
      <text
        x="20"
        y="24.5"
        textAnchor="middle"
        fill="#fff"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        HEIC
      </text>
    </g>
  ),
  // Film frame with sprocket holes and a play triangle.
  video: (color) => (
    <g>
      <rect x="8" y="14" width="24" height="14" rx="2" fill="#fff" />
      <g fill={color}>
        <rect x="9.6" y="15.6" width="2.6" height="2.4" rx="0.6" />
        <rect x="9.6" y="19.8" width="2.6" height="2.4" rx="0.6" />
        <rect x="9.6" y="24" width="2.6" height="2.4" rx="0.6" />
        <rect x="27.8" y="15.6" width="2.6" height="2.4" rx="0.6" />
        <rect x="27.8" y="19.8" width="2.6" height="2.4" rx="0.6" />
        <rect x="27.8" y="24" width="2.6" height="2.4" rx="0.6" />
        <path d="M17.8 17.4v7.2l6-3.6z" />
      </g>
    </g>
  ),
};

const FALLBACK = { color: "#8A94A6", glyph: "txt" as FileGlyph };

interface FileTypeIconProps {
  /** File name or URL — the extension decides the colour, glyph and label. */
  fileName: string;
  /** Rendered width in px; the badge keeps its 40:48 ratio. */
  size?: number;
  className?: string;
}

const FileTypeIcon = ({ fileName, size = 40, className }: FileTypeIconProps) => {
  const ext = getFileExtension(fileName);
  const { color, glyph } = FILE_TYPE_STYLES[ext] ?? FALLBACK;
  const label = (ext || "file").toUpperCase();

  // DOCX / JPEG / XLSX need to step down so the name stays inside the page.
  const fontSize = label.length >= 4 ? 9 : 12;

  return (
    <svg
      viewBox="0 0 40 48"
      role="img"
      aria-label={`${label} file`}
      className={className}
      // Explicit size plus flexShrink: inside a flex row an SVG with only
      // width/height attributes collapses to nothing next to long file names.
      style={{ width: size, height: size * 1.2, flexShrink: 0, display: 'block' }}
    >
      {/* Page with the top-right corner turned down. */}
      <path
        d="M4 0h22l14 14v30a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z"
        fill={color}
      />
      <path d="M26 0l14 14H26V0z" fill="#fff" />

      {GLYPHS[glyph](color)}

      <text
        x="20"
        y="42.5"
        textAnchor="middle"
        fill="#fff"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
};

export default FileTypeIcon;
