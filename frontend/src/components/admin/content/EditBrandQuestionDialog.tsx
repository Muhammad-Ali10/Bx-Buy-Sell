import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateBrandQuestion } from "@/hooks/useUpdateBrandQuestion";
import { toast } from "sonner";

interface BrandQuestion {
  id: string;
  question: string;
  answer_type: string;
  answer_for: string;
  option?: string[];
}

interface EditBrandQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: BrandQuestion | null;
}

const QUESTION_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Select" },
  { value: "CHECKBOX", label: "Checkbox (Multiple)" },
  { value: "TEXTAREA", label: "Long Text" },
  { value: "URL", label: "Link" },
];

export const EditBrandQuestionDialog = ({ open, onOpenChange, question }: EditBrandQuestionDialogProps) => {
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState("TEXT");
  const [options, setOptions] = useState(""); // For SELECT type - comma separated options
  const updateQuestion = useUpdateBrandQuestion();

  useEffect(() => {
    if (question) {
      setQuestionText(question.question);
      // Map backend type back to frontend type for display
      // Since backend converts URL/DATE/TEXTAREA to TEXT, we need to check if we can determine original
      // For now, we'll use the stored type, but if it's TEXT, we'll default to TEXT
      // Note: We can't know if TEXT was originally URL, so we'll just use what's stored
      let displayType = question.answer_type;
      // If the type is TEXT, we can't know if it was originally URL, so keep it as TEXT
      // But we'll allow user to change it to URL if they want
      setQuestionType(displayType);
      // Convert options array to comma-separated string
      if (question.option && Array.isArray(question.option)) {
        setOptions(question.option.join(', '));
      } else {
        setOptions("");
      }
    }
  }, [question]);

  const handleSave = () => {
    if (!questionText.trim() || !question) {
      toast.error("Please enter a question");
      return;
    }

    // Backend requires minimum 2 characters for question
    if (questionText.trim().length < 2) {
      toast.error("Question must be at least 2 characters long");
      return;
    }

    // Process options - split by comma if provided
    let optionsArray: string[] = [];
    if ((questionType === "SELECT" || questionType === "CHECKBOX") && options.trim()) {
      optionsArray = options.split(',').map(opt => opt.trim()).filter(opt => opt.length >= 2);
    }
    if ((questionType === "SELECT" || questionType === "CHECKBOX") && optionsArray.length < 2) {
      toast.error("Please provide at least 2 options");
      return;
    }

    updateQuestion.mutate(
      {
        id: question.id,
        question: questionText.trim(),
        answer_type: questionType,
        option: optionsArray.length > 0 ? optionsArray : undefined,
      },
      {
        onSuccess: () => {
          handleCancel();
        },
      }
    );
  };

  const handleCancel = () => {
    setQuestionText("");
    setQuestionType("TEXT");
    setOptions("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-foreground">
            Edit Question
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Question Input */}
          <div className="space-y-2">
            <Label htmlFor="edit-question" className="text-foreground">Question</Label>
            <Input
              id="edit-question"
              placeholder="Write Question"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="bg-[#F5F5F5] border-border h-12"
            />
          </div>

          {(questionType === "SELECT" || questionType === "CHECKBOX") && (
            <div className="space-y-2">
              <Label htmlFor="edit-options" className="text-foreground">Options</Label>
              <Input
                id="edit-options"
                placeholder="Option 1, Option 2, Option 3"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                className="bg-[#F5F5F5] border-border h-12"
              />
            </div>
          )}

          {/* Answer Type Section */}
          <div className="space-y-2">
            <Label htmlFor="edit-answerType" className="text-foreground">Answer Type</Label>
            <Select value={questionType} onValueChange={setQuestionType}>
              <SelectTrigger id="edit-answerType" className="bg-[#F5F5F5] border-border h-12">
                <SelectValue placeholder="Answer Type" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                {QUESTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1 rounded-full h-12 bg-white border-border hover:bg-gray-50"
            disabled={updateQuestion.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 rounded-full h-12 bg-accent hover:bg-accent/90 text-black font-semibold"
            disabled={!questionText.trim() || updateQuestion.isPending}
          >
            {updateQuestion.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
