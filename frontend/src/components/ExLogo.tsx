import { cn } from "@/lib/utils";
import logo from "@/assets/_App Icon 1 (2).png";

interface ExLogoProps {
  className?: string;
  size?: number;
}

export function ExLogo({ className, size = 16 }: ExLogoProps) {
  return (
    <img
      src={logo}
      alt="EX Logo"
      className={cn("object-contain flex-shrink-0", className)}
      decoding="async"
      sizes={`${size}px`}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
        minWidth: `${size}px`, 
        minHeight: `${size}px`
      }}
    />
  );
}

