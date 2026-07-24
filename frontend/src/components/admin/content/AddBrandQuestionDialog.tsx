import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddBrandQuestion } from "@/hooks/useAddBrandQuestion";
import { toast } from "sonner";

interface AddBrandQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export const AddBrandQuestionDialog = ({ open, onOpenChange }: AddBrandQuestionDialogProps) => {
  const [question, setQuestion] = useState("");
  const [questionType, setQuestionType] = useState("TEXT");
  const [options, setOptions] = useState(""); // Options field - always visible
  const addQuestion = useAddBrandQuestion();

  const handleSave = () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      toast.error("Please enter a question");
      return;
    }

    // Backend requires minimum 2 characters for question
    if (trimmedQuestion.length < 2) {
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

    console.log('Submitting brand question:', {
      question: trimmedQuestion,
      answer_type: questionType,
      option: optionsArray.length > 0 ? optionsArray : []
    });

    addQuestion.mutate(
      {
        question: trimmedQuestion,
        answer_type: questionType,
        option: optionsArray.length > 0 ? optionsArray : [],
      },
      {
        onSuccess: () => {
          handleCancel();
        },
        onError: (error: any) => {
          console.error("Add question error:", error);
          // Error toast is already shown in the hook
        },
      }
    );
  };

  const handleCancel = () => {
    setQuestion("");
    setQuestionType("TEXT");
    setOptions("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-foreground">
            Add New Question
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Question Input */}
          <div className="space-y-2">
            <Label htmlFor="question" className="text-foreground">Question</Label>
            <Input
              id="question"
              placeholder="Write Question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="bg-[#F5F5F5] border-border h-12"
            />
          </div>

          {(questionType === "SELECT" || questionType === "CHECKBOX") && (
            <div className="space-y-2">
              <Label htmlFor="options" className="text-foreground">Options</Label>
              <Input
                id="options"
                placeholder="Option 1, Option 2, Option 3"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                className="bg-[#F5F5F5] border-border h-12"
              />
            </div>
          )}

          {/* Answer Type Section */}
          <div className="space-y-2">
            <Label htmlFor="answerType" className="text-foreground">Answer Type</Label>
            <Select value={questionType} onValueChange={setQuestionType}>
              <SelectTrigger id="answerType" className="bg-[#F5F5F5] border-border h-12">
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
            disabled={addQuestion.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 rounded-full h-12 bg-accent hover:bg-accent/90 text-black font-semibold"
            disabled={!question.trim() || addQuestion.isPending}
          >
            {addQuestion.isPending ? "Adding..." : "Add Question"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
