import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * An ⓘ that explains something: on hover, and on a tap.
 *
 * A plain tooltip never opens on a phone, which would leave the explanation
 * out of reach for most visitors, so a click toggles it as well. Radix closes a
 * tooltip on the trigger's pointer-down and click; both are held off here so
 * the toggle decides.
 */
export const InfoHint = ({
  label,
  children,
  side = "bottom",
  className,
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              setOpen((isOpen) => !isOpen);
            }}
            className={cn(
              "flex items-center justify-center opacity-60 transition-opacity hover:opacity-100 focus:outline-none",
              className,
            )}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[260px] text-xs leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default InfoHint;
