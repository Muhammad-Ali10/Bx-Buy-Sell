import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";
import avatarPlaceholder from "@/assets/avatar-placeholder.svg";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

/**
 * Shown when someone has no profile photo.
 *
 * A picture rather than an initial. The initial was taken from whatever name
 * happened to be on the record, and on a listing the viewer has not unlocked
 * that name is the placeholder text itself — so sellers were represented by a
 * large "R", the first letter of "register to unlock". Where the name is real,
 * an initial gives away a letter of it for no benefit.
 *
 * Callers still pass their initials as children; they are ignored on purpose,
 * so this stays a single change rather than eighty-seven of them. Swap the
 * artwork by overwriting `assets/avatar-placeholder.svg`.
 */
const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, children, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  >
    <img
      src={avatarPlaceholder}
      // Decorative: the person's name is always written beside the avatar, so
      // announcing it again here would only repeat it to a screen reader.
      alt=""
      aria-hidden="true"
      draggable={false}
      className="h-full w-full object-cover"
    />
  </AvatarPrimitive.Fallback>
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
