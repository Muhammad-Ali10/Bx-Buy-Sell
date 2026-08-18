import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DependencyOption {
  id: string;
  question: string;
}

interface QuestionDependencyPickerProps {
  /** All questions of the same type (to pick a parent from). */
  questions: DependencyOption[];
  /** Current question id, so it can't depend on itself. */
  excludeId?: string;
  dependsOnQuestionId: string;
  dependsOnValue: string;
  onChange: (dependsOnQuestionId: string, dependsOnValue: string) => void;
}

// Radix Select cannot use "" as an item value, so use a sentinel for "none".
const NONE = "__none__";

/**
 * Optional conditional-display config for a question: "show this question only
 * when [another question]'s answer equals [value]". Leaving it as "Always show"
 * keeps the default behaviour (no dependency).
 */
export const QuestionDependencyPicker = ({
  questions,
  excludeId,
  dependsOnQuestionId,
  dependsOnValue,
  onChange,
}: QuestionDependencyPickerProps) => {
  const available = questions.filter((q) => q.id !== excludeId);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-black">
        Show only if (optional)
      </Label>
      <Select
        value={dependsOnQuestionId || NONE}
        onValueChange={(v) =>
          onChange(
            v === NONE ? "" : v,
            v === NONE ? "" : dependsOnValue || "yes",
          )
        }
      >
        <SelectTrigger className="bg-gray-50 border-gray-200 text-black">
          <SelectValue placeholder="Always show" />
        </SelectTrigger>
        <SelectContent className="bg-white border-gray-200">
          <SelectItem value={NONE} className="text-black">
            Always show
          </SelectItem>
          {available.map((q) => (
            <SelectItem key={q.id} value={q.id} className="text-black">
              {q.question}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {dependsOnQuestionId && (
        <div className="space-y-1 pt-1">
          <Label className="text-xs text-gray-500">
            …only when that answer equals
          </Label>
          <Input
            value={dependsOnValue}
            onChange={(e) => onChange(dependsOnQuestionId, e.target.value)}
            placeholder="yes"
            className="bg-gray-50 border-gray-200 text-black"
          />
          <p className="text-xs text-gray-500">
            For Yes/No questions use <b>yes</b> or <b>no</b>.
          </p>
        </div>
      )}
    </div>
  );
};

export default QuestionDependencyPicker;
