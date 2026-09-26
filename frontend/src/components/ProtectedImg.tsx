import type { ImgHTMLAttributes } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { useProtectedUrl } from "@/hooks/useProtectedUrl";

/**
 * An `<img>` that can show a private attachment.
 *
 * A chat photo is only readable through the protected download route, which
 * needs the viewer's token — something an `<img src>` cannot send. This fetches
 * it with the token and shows it; a public image goes straight through.
 */
export const ProtectedImg = ({
  src,
  alt = "",
  className,
  style,
  ...rest
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | null | undefined }) => {
  const { src: shown, loading, failed } = useProtectedUrl(src);

  if (loading || failed || !shown) {
    return (
      <span
        className={`inline-flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}
        style={{ minWidth: 64, minHeight: 64, ...style }}
        role="img"
        aria-label={failed ? "Image unavailable" : alt || "Loading image"}
      >
        {failed ? <ImageOff className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
      </span>
    );
  }
  return <img src={shown} alt={alt} className={className} style={style} {...rest} />;
};

export default ProtectedImg;
