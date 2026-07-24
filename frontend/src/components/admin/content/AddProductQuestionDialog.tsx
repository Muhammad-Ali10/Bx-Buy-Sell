import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { useAddProductQuestion } from "@/hooks/useAddProductQuestion";

interface AddProductQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export const AddProductQuestionDialog = ({ open, onOpenChange }: AddProductQuestionDialogProps) => {
  const [question, setQuestion] = useState("");
  const [hintText, setHintText] = useState("");
  const [questionType, setQuestionType] = useState("TEXT");
  const [options, setOptions] = useState(""); // Options field for SELECT type
  const addQuestion = useAddProductQuestion();

  const handleSave = () => {
    if (!question.trim()) {
      return;
    }

    // Process options - split by comma if provided
    let optionsArray: string[] = [];
    if ((questionType === "SELECT" || questionType === "CHECKBOX") && options.trim()) {
      optionsArray = options.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
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
          <DialogTitle className="text-xl font-bold">Added Product Questions</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Question</Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="How many different Products do you have?"
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
                placeholder="Option 1, Option 2, Option 3 (separate options with commas)"
                className="bg-gray-50 border-gray-200 text-black"
              />
              <p className="text-xs text-gray-500">Enter options separated by commas (e.g., "Option 1, Option 2, Option 3")</p>
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
