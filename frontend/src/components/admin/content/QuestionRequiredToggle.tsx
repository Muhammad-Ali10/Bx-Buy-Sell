import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface QuestionRequiredToggleProps {
  required: boolean;
  onChange: (required: boolean) => void;
}

/**
 * Lets the admin mark a question as mandatory or optional for the seller.
 * New questions default to "Required".
 */
export const QuestionRequiredToggle = ({
  required,
  onChange,
}: QuestionRequiredToggleProps) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-black">
        Answer requirement
      </Label>
      <Select
        value={required ? "required" : "optional"}
        onValueChange={(v) => onChange(v === "required")}
      >
        <SelectTrigger className="bg-gray-50 border-gray-200 text-black">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white border-gray-200">
          <SelectItem value="required" className="text-black">
            Required (must be filled)
          </SelectItem>
          <SelectItem value="optional" className="text-black">
            Optional
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default QuestionRequiredToggle;
