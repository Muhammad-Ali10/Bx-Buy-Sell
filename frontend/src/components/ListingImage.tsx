import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * A listing photo that never renders as a broken icon.
 *
 * Locked listings are served a heavily blurred Cloudinary derivative rather
 * than the original. If that derivative cannot be fetched — the account may not
 * allow on-the-fly transformations, the file may be gone — this falls back to a
 * soft placeholder instead of the browser's broken-image glyph.
 */

interface ListingImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "eager" | "lazy";
  sizes?: string;
  /** Blur the photo in the browser too — used for locked previews. */
  blurred?: boolean;
}

const Placeholder = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={className}
    style={{
      ...style,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background:
        "linear-gradient(135deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.12) 100%)",
    }}
    aria-hidden="true"
  >
    <ImageOff style={{ width: 28, height: 28, color: "rgba(0,0,0,0.25)" }} />
  </div>
);

const ListingImage = ({
  src,
  alt,
  className,
  style,
  loading = "lazy",
  sizes,
  blurred = false,
}: ListingImageProps) => {
  const [failed, setFailed] = useState(false);

  // A new src deserves a fresh attempt.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <Placeholder className={className} style={style} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      sizes={sizes}
      onError={() => setFailed(true)}
      style={{
        ...style,
        ...(blurred ? { filter: "blur(12px)", transform: "scale(1.06)" } : {}),
      }}
    />
  );
};

export default ListingImage;
