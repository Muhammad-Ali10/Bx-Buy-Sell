import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useAddStatisticQuestion } from "@/hooks/useAddStatisticQuestion";

interface AddStatisticQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUESTION_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SELECT", label: "Select" },
  { value: "CHECKBOX", label: "Checkbox (Multiple)" },
  { value: "TEXTAREA", label: "Text Area" },
];

export const AddStatisticQuestionDialog = ({ open, onOpenChange }: AddStatisticQuestionDialogProps) => {
  const [question, setQuestion] = useState("");
  const [hintText, setHintText] = useState("");
  const [questionType, setQuestionType] = useState("TEXT");
  const [options, setOptions] = useState("");
  const addQuestion = useAddStatisticQuestion();

  const handleSave = () => {
    if (!question.trim()) {
      return;
    }

    let optionsArray: string[] = [];
    if ((questionType === "SELECT" || questionType === "CHECKBOX") && options.trim()) {
      optionsArray = options.split(",").map((opt) => opt.trim()).filter((opt) => opt.length > 0);
    }
    if ((questionType === "SELECT" || questionType === "CHECKBOX") && optionsArray.length < 2) {
      return;
    }

    addQuestion.mutate(
      {
        question: question.trim(),
        answer_type: questionType,
        options: optionsArray,
      },
      {
        onSuccess: () => {
          setQuestion("");
          setHintText("");
          setQuestionType("TEXT");
          setOptions("");
          onOpenChange(false);
        },
      }
    );
  };

  const handleCancel = () => {
    setQuestion("");
    setHintText("");
    setQuestionType("TEXT");
    setOptions("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-none text-black max-w-[500px]">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold">Added Statistic Questions</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Question</Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
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
                placeholder="1000, 5000, 10000"
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
