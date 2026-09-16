import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddBrandQuestion } from "@/hooks/useAddBrandQuestion";
import { QuestionRequiredToggle } from "./QuestionRequiredToggle";
import { toast } from "sonner";

interface AddBrandQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The category this question is being written for. Questions belong to one
   * category now, and a question saved without one joins no set and is shown
   * to nobody.
   */
  categoryId?: string | null;
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

export const AddBrandQuestionDialog = ({ open, onOpenChange, categoryId }: AddBrandQuestionDialogProps) => {
  const [question, setQuestion] = useState("");
  const [questionType, setQuestionType] = useState("TEXT");
  const [options, setOptions] = useState(""); // Options field - always visible
  /** The administrator's note for the seller, shown under this question in Create Listing. */
  const [hintText, setHintText] = useState("");
  const [required, setRequired] = useState(true);
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
        required,
        categoryId,
        hint: hintText.trim(),
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
    setHintText("");
    setQuestionType("TEXT");
    setOptions("");
    setRequired(true);
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
            <Label className="text-sm font-medium text-black">Create Listing Text Hint</Label>
            <Textarea
              value={hintText}
              onChange={(e) => setHintText(e.target.value)}
              placeholder="Enter hint text to help users understand this question..."
              className="bg-gray-50 border-gray-200 text-black min-h-[80px] resize-none"
            />
          </div>
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
          <QuestionRequiredToggle required={required} onChange={setRequired} />
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
