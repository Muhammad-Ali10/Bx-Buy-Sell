import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, ...props }, ref) => {
  // Determine number of thumbs based on value or defaultValue
  const numThumbs = React.useMemo(() => {
    if (value) {
      return Array.isArray(value) ? value.length : 1;
    }
    if (defaultValue) {
      return Array.isArray(defaultValue) ? defaultValue.length : 1;
    }
    return 1;
  }, [value, defaultValue]);

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      value={value}
      defaultValue={defaultValue}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary [&.override-green]:!bg-[rgba(58,58,59,1)]">
        <SliderPrimitive.Range className="absolute h-full bg-primary [&.override-green]:!bg-[rgba(197,253,31,1)]" />
      </SliderPrimitive.Track>
      {Array.from({ length: numThumbs }).map((_, index) => (
        <SliderPrimitive.Thumb 
          key={index}
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&.override-green]:!bg-[rgba(24,24,26,1)] [&.override-green]:!border-[5px_solid_rgba(197,253,31,1)]" 
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
