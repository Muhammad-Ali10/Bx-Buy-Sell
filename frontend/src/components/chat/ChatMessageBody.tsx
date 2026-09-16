import { Paperclip } from "lucide-react";
import { downloadAttachment } from "@/lib/downloadFile";

/**
 * What one message says: a picture, a file, or words.
 *
 * A message carries its content as text and anything attached as `fileUrl`.
 * Written as `{message.content}` alone, a photograph came out as the word
 * "image" — which is what the admin dashboard showed for every picture ever
 * sent. Both chat screens have to read the same message the same way.
 */
export interface ChatMessageBodyMessage {
  content?: string | null;
  type?: string | null;
  fileUrl?: string | null;
}

/** The placeholder the sending side writes beside a photo; not a caption. */
const isPlaceholderCaption = (caption: string) =>
  /^(📷\s*)?image$/i.test(caption.trim());

export const ChatMessageBody = ({
  message,
  className = "chat-message-text-desktop",
  style,
}: {
  message: ChatMessageBodyMessage;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const text = message.content ?? "";
  const textStyle: React.CSSProperties = {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
    ...style,
  };

  if (message.type === "IMAGE" && message.fileUrl) {
    const caption = text.trim();
    return (
      <div className="space-y-2">
        <img
          src={message.fileUrl}
          alt={caption || "Image"}
          className="max-h-64 max-w-full cursor-pointer rounded-lg object-contain"
          loading="lazy"
          decoding="async"
          onClick={() => window.open(message.fileUrl as string, "_blank")}
          onError={(event) => {
            // A picture that will not load says so, rather than leaving a gap
            // where nobody can tell whether anything was sent.
            const image = event.currentTarget;
            image.style.display = "none";
            image.nextElementSibling?.classList.remove("hidden");
          }}
        />
        <p className={`hidden ${className}`} style={textStyle}>
          {caption || "Image"} (could not be loaded)
        </p>
        {caption && !isPlaceholderCaption(caption) && (
          <p className={className} style={textStyle}>
            {caption}
          </p>
        )}
      </div>
    );
  }

  if (message.type === "FILE" && message.fileUrl) {
    const name = text.replace(/^📎\s*/, "").trim();
    return (
      <a
        href={message.fileUrl}
        onClick={(event) => {
          event.preventDefault();
          void downloadAttachment(message.fileUrl as string, name || undefined);
        }}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 break-all underline hover:opacity-80 ${className}`}
        style={style}
      >
        <Paperclip className="h-4 w-4 flex-shrink-0" />
        <span>{name || "Download File"}</span>
      </a>
    );
  }

  return (
    <p className={className} style={textStyle}>
      {text}
    </p>
  );
};
