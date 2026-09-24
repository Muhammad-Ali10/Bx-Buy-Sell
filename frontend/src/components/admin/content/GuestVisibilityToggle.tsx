import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface GuestVisibilityToggleProps {
  visible: boolean;
  onChange: (visible: boolean) => void;
}

/**
 * "Visible without registration?" — whether a visitor who is not signed in can
 * read this statistic on a published listing. Two buttons, as the client's
 * design has it, with the chosen one in lime.
 */
export const GuestVisibilityToggle = ({ visible, onChange }: GuestVisibilityToggleProps) => {
  const option = (value: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={visible === value}
      onClick={() => onChange(value)}
      className={cn(
        "h-10 min-w-[96px] rounded-full border px-6 text-sm font-semibold transition-colors",
        visible === value
          ? "border-[#C6FE1F] bg-[#C6FE1F] text-black"
          : "border-gray-200 bg-white text-black hover:bg-gray-50",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-black">Visible without registration?</Label>
      <div className="flex gap-3" role="group" aria-label="Visible without registration?">
        {option(true, "Yes")}
        {option(false, "No")}
      </div>
    </div>
  );
};

export default GuestVisibilityToggle;
