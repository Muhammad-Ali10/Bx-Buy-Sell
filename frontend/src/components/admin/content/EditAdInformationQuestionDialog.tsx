import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateAdInformationQuestion } from "@/hooks/useUpdateAdInformationQuestion";
import { useState, useEffect } from "react";

interface EditAdInformationQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: { id: string; question: string; answer_type: string; option?: string[] } | null;
}

export const EditAdInformationQuestionDialog = ({ open, onOpenChange, question }: EditAdInformationQuestionDialogProps) => {
  const [questionText, setQuestionText] = useState("");
  const [answerType, setAnswerType] = useState("TEXT");
  const [options, setOptions] = useState("");
  const updateQuestion = useUpdateAdInformationQuestion();

  useEffect(() => {
    if (question) {
      setQuestionText(question.question);
      // Map backend answer types to frontend
      const answerTypeMap: Record<string, string> = {
        'BOOLEAN': 'YESNO',
      };
      setAnswerType(answerTypeMap[question.answer_type] || question.answer_type);
      setOptions(question.option && Array.isArray(question.option) ? question.option.join(", ") : "");
    }
  }, [question]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question || !questionText.trim()) return;

    const optionsArray =
      (answerType === "SELECT" || answerType === "CHECKBOX") && options.trim()
        ? options.split(",").map((opt) => opt.trim()).filter((opt) => opt.length > 0)
        : [];

    updateQuestion.mutate(
      { id: question.id, question: questionText, answer_type: answerType, options: optionsArray },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Ad Information Question</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="question" className="text-white">Question</Label>
            <Input
              id="question"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Write Question"
              className="bg-[#2a2a2a] border-[#3a3a3a] text-white"
            />
          </div>
          <div>
            <Label htmlFor="answerType" className="text-white">Answer Type</Label>
            <Select value={answerType} onValueChange={setAnswerType}>
              <SelectTrigger className="bg-[#2a2a2a] border-[#3a3a3a] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2a2a2a] border-[#3a3a3a] text-white">
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="NUMBER">Number</SelectItem>
                <SelectItem value="SELECT">Dropdown</SelectItem>
                <SelectItem value="CHECKBOX">Checkbox (Multiple)</SelectItem>
                <SelectItem value="PHOTO">Photo Upload</SelectItem>
                <SelectItem value="FILE">File Upload</SelectItem>
                <SelectItem value="DATE">Date</SelectItem>
                <SelectItem value="YESNO">Yes / No</SelectItem>
                <SelectItem value="TEXTAREA">Text Area</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(answerType === "SELECT" || answerType === "CHECKBOX") && (
            <div>
              <Label htmlFor="options" className="text-white">Options (comma-separated)</Label>
              <Input
                id="options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
                className="bg-[#2a2a2a] border-[#3a3a3a] text-white"
              />
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#3a3a3a] text-white hover:bg-[#2a2a2a]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateQuestion.isPending}
              className="bg-[#9EFF00] text-black hover:bg-[#8DE000]"
            >
              {updateQuestion.isPending ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
