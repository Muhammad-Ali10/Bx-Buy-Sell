import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddHandoverQuestion } from "@/hooks/useAddHandoverQuestion";
import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

interface AddHandoverQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddHandoverQuestionDialog = ({ open, onOpenChange }: AddHandoverQuestionDialogProps) => {
  const [question, setQuestion] = useState("");
  const [answerType, setAnswerType] = useState("TEXT");
  const [options, setOptions] = useState("");
  const addQuestion = useAddHandoverQuestion();

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      toast.error("Please enter a question");
      return;
    }

    // Backend requires minimum 4 characters
    if (trimmedQuestion.length < 4) {
      toast.error("Question must be at least 4 characters long");
      return;
    }

    console.log('Submitting handover question:', {
      question: trimmedQuestion,
      answer_type: answerType
    });

    let optionsArray: string[] = [];
    if ((answerType === "SELECT" || answerType === "CHECKBOX") && options.trim()) {
      optionsArray = options.split(",").map((opt) => opt.trim()).filter((opt) => opt.length > 0);
    }
    if ((answerType === "SELECT" || answerType === "CHECKBOX") && optionsArray.length < 2) {
      toast.error("Please provide at least 2 options");
      return;
    }

    addQuestion.mutate(
      { question: trimmedQuestion, answer_type: answerType, options: optionsArray },
      {
        onSuccess: () => {
          setQuestion("");
          setAnswerType("TEXT");
          setOptions("");
          onOpenChange(false);
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
    setAnswerType("TEXT");
    setOptions("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-none text-black max-w-[500px]">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold">Add Handovers Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="question" className="text-sm font-medium text-black">Question</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Write Question"
              className="bg-gray-50 border-gray-200 text-black"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="answerType" className="text-sm font-medium text-black">Answer Type</Label>
            <Select value={answerType} onValueChange={setAnswerType}>
              <SelectTrigger className="bg-gray-50 border-gray-200 text-black">
                <SelectValue placeholder="Select answer type" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                <SelectItem value="TEXT" className="text-black">Text</SelectItem>
                <SelectItem value="NUMBER" className="text-black">Number</SelectItem>
                <SelectItem value="SELECT" className="text-black">Dropdown</SelectItem>
                <SelectItem value="CHECKBOX" className="text-black">Checkbox (Multiple)</SelectItem>
                <SelectItem value="YESNO" className="text-black">Yes / No</SelectItem>
                <SelectItem value="TEXTAREA" className="text-black">Text Area</SelectItem>
                <SelectItem value="DATE" className="text-black">Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(answerType === "SELECT" || answerType === "CHECKBOX") && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-black">Options (comma-separated)</Label>
              <Input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
                className="bg-gray-50 border-gray-200 text-black"
              />
            </div>
          )}
        </div>
        <div className="flex justify-center gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="border-2 border-black text-black hover:bg-gray-50 rounded-full px-12 h-12 font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            disabled={addQuestion.isPending || !question.trim()}
            className="bg-[#a3e635] text-black hover:bg-[#84cc16] rounded-full px-12 h-12 font-semibold"
          >
            {addQuestion.isPending ? "Adding..." : "Add Question"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
