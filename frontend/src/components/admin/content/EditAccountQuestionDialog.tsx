import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useUpdateAccountQuestion } from "@/hooks/useUpdateAccountQuestion";
import { toast } from "sonner";

interface AccountQuestion {
  id: string;
  question: string;
  answer_type: string;
  option?: string[];
}

interface EditAccountQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: AccountQuestion | null;
}

const QUESTION_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Dropdown" },
  { value: "CHECKBOX", label: "Checkbox (Multiple)" },
  { value: "YESNO", label: "Yes / No" },
  { value: "TEXTAREA", label: "Text Area" },
];

export const EditAccountQuestionDialog = ({ open, onOpenChange, question }: EditAccountQuestionDialogProps) => {
  const [questionText, setQuestionText] = useState("");
  const [hintText, setHintText] = useState("");
  const [questionType, setQuestionType] = useState("TEXT");
  const [options, setOptions] = useState(""); // Options field for SELECT type
  const updateQuestion = useUpdateAccountQuestion();

  useEffect(() => {
    if (question) {
      setQuestionText(question.question);
      // Map backend answer types to frontend
      const answerTypeMap: Record<string, string> = {
        'BOOLEAN': 'YESNO',
      };
      setQuestionType(answerTypeMap[question.answer_type] || question.answer_type);
      // Set options if they exist
      if (question.option && Array.isArray(question.option) && question.option.length > 0) {
        setOptions(question.option.join(', '));
      } else {
        setOptions("");
      }
    }
  }, [question]);

  const handleSave = () => {
    if (!question || !questionText.trim()) {
      return;
    }

    // Backend requires minimum 4 characters
    if (questionText.trim().length < 4) {
      toast.error("Question must be at least 4 characters long");
      return;
    }

    // Process options - split by comma if provided
    let optionsArray: string[] = [];
    if ((questionType === "SELECT" || questionType === "CHECKBOX") && options.trim()) {
      optionsArray = options.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
    }

    updateQuestion.mutate(
      {
        id: question.id,
        question: questionText.trim(),
        answer_type: questionType,
        options: optionsArray,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleCancel = () => {
    if (question) {
      setQuestionText(question.question);
      const answerTypeMap: Record<string, string> = {
        'BOOLEAN': 'YESNO',
      };
      setQuestionType(answerTypeMap[question.answer_type] || question.answer_type);
      setHintText("");
      if (question.option && Array.isArray(question.option) && question.option.length > 0) {
        setOptions(question.option.join(', '));
      } else {
        setOptions("");
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-none text-black max-w-[500px]">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold">Edit Account Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Question</Label>
            <Input
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Enter your question"
              className="bg-gray-50 border-gray-200 text-black"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Hint Text Field</Label>
            <Textarea
              value={hintText}
              onChange={(e) => setHintText(e.target.value)}
              placeholder="Enter hint text to help users understand this question..."
              className="bg-gray-50 border-gray-200 text-black min-h-[80px] resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Answer Type</Label>
            <Select value={questionType} onValueChange={setQuestionType}>
              <SelectTrigger className="bg-gray-50 border-gray-200 text-black">
                <SelectValue placeholder="Answer Type" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                {QUESTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-black">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(questionType === "SELECT" || questionType === "CHECKBOX") && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-black">Options (comma-separated)</Label>
              <Input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Yes, No (separate options with commas)"
                className="bg-gray-50 border-gray-200 text-black"
              />
              <p className="text-xs text-gray-500">Enter options separated by commas (e.g., "Yes, No" or "Option 1, Option 2")</p>
            </div>
          )}
        </div>
        <div className="flex justify-center gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={handleCancel} 
            className="border-2 border-black text-black hover:bg-gray-50 rounded-full px-12 h-12 font-semibold"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateQuestion.isPending || !questionText.trim()}
            className="bg-[#a3e635] text-black hover:bg-[#84cc16] rounded-full px-12 h-12 font-semibold"
          >
            {updateQuestion.isPending ? "Updating..." : "Update Question"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

