import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Share dialog for a listing.
 *
 * The old behaviour called `navigator.share`, which does not exist on desktop
 * Chrome/Firefox and needs a secure context — so on most desktops the button
 * appeared to do nothing. This dialog replaces it everywhere: same UI on every
 * browser and device, no native share sheet.
 */

interface ShareListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absolute listing URL, e.g. https://host/listing/123 */
  url: string;
  /** Listing name, used as the pre-filled text on networks that support it. */
  title?: string;
}

const FacebookIcon = () => (
  <svg viewBox="0 0 320 512" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 448 512" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z" />
  </svg>
);

const TwitterIcon = () => (
  <svg viewBox="0 0 512 512" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.825 9.825 0 0 1 6.988 2.896 9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M23.91 3.79 20.3 20.84c-.25 1.21-.98 1.5-2 .94l-5.5-4.07-2.66 2.57c-.3.3-.55.56-1.1.56-.72 0-.6-.27-.84-.95L6.3 13.7.85 12c-1.18-.35-1.19-1.16.26-1.75l21.26-8.2c.97-.44 1.9.24 1.53 1.73Z" />
  </svg>
);

/** Brand colours are intentional here — these are logos, not UI accents. */
const NETWORKS = [
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    Icon: FacebookIcon,
    href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    color: "#0A66C2",
    Icon: LinkedInIcon,
    href: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "twitter",
    label: "Twitter",
    color: "#1DA1F2",
    Icon: TwitterIcon,
    href: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    color: "#25D366",
    Icon: WhatsAppIcon,
    href: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(title ? `${title} ${url}` : url)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    color: "#229ED9",
    Icon: TelegramIcon,
    href: (url: string, title: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
];

/**
 * `navigator.clipboard` also needs a secure context, so fall back to the legacy
 * path — otherwise copy fails silently on a plain-http deployment.
 */
const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
};

const ShareListingDialog = ({ open, onOpenChange, url, title = "" }: ShareListingDialogProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(url);
    if (!ok) {
      toast.error("Could not copy the link");
      return;
    }
    setCopied(true);
    toast.success("Link copied to clipboard");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const openNetwork = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer,width=650,height=600");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="max-w-[400px] rounded-3xl p-6 gap-0 border-0"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="h-4 w-4" />
        </button>

        <DialogTitle className="text-center text-lg font-bold">Share with Friends</DialogTitle>
        <DialogDescription className="mt-1 text-center text-xs">
          Invite others to view this opportunity
        </DialogDescription>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Share your link</p>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <input
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="flex-1 truncate bg-transparent text-sm text-muted-foreground outline-none"
              aria-label="Listing link"
            />
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy link"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copied ? (
                <Check className="h-4 w-4 text-[#7CB305]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-3 text-sm font-medium">Share on:</p>
          <div className="flex items-start justify-between gap-1">
            {NETWORKS.map(({ id, label, color, Icon, href }) => (
              <button
                key={id}
                type="button"
                onClick={() => openNetwork(href(url, title))}
                className="flex flex-1 flex-col items-center gap-1.5 rounded-lg py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
                  style={{ backgroundColor: color }}
                >
                  <Icon />
                </span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareListingDialog;
