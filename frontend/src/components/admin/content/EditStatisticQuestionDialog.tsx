import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useUpdateStatisticQuestion } from "@/hooks/useUpdateStatisticQuestion";

interface StatisticQuestion {
  id: string;
  question: string;
  answer_type: string;
  option?: string[];
}

interface EditStatisticQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: StatisticQuestion | null;
}

const QUESTION_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Select" },
  { value: "CHECKBOX", label: "Checkbox (Multiple)" },
  { value: "TEXTAREA", label: "Text Area" },
];

export const EditStatisticQuestionDialog = ({ open, onOpenChange, question }: EditStatisticQuestionDialogProps) => {
  const [questionText, setQuestionText] = useState("");
  const [hintText, setHintText] = useState("");
  const [questionType, setQuestionType] = useState("TEXT");
  const [options, setOptions] = useState("");
  const updateQuestion = useUpdateStatisticQuestion();

  useEffect(() => {
    if (question) {
      setQuestionText(question.question);
      setQuestionType(question.answer_type);
      setOptions(question.option && Array.isArray(question.option) ? question.option.join(", ") : "");
    }
  }, [question]);

  const handleSave = () => {
    if (!question || !questionText.trim()) {
      return;
    }

    let optionsArray: string[] = [];
    if ((questionType === "SELECT" || questionType === "CHECKBOX") && options.trim()) {
      optionsArray = options.split(",").map((opt) => opt.trim()).filter((opt) => opt.length > 0);
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
      setQuestionType(question.answer_type);
      setOptions(question.option && Array.isArray(question.option) ? question.option.join(", ") : "");
      setHintText("");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-none text-black max-w-[500px]">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold">Edit Statistic Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Question</Label>
            <Input
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Conversion Rate"
              className="bg-gray-50 border-gray-200 text-black"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Hint Text Field</Label>
            <Textarea
              value={hintText}
              onChange={(e) => setHintText(e.target.value)}
              placeholder="Enter the percentage of visitors who make a purchase out of the total number of visitors."
              className="bg-gray-50 border-gray-200 text-black min-h-[80px] resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Options</Label>
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
                placeholder="Option 1, Option 2, Option 3"
                className="bg-gray-50 border-gray-200 text-black"
              />
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
