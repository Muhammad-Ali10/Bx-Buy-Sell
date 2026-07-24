import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useProductQuestions } from "@/hooks/useProductQuestions";
import { toast } from "sonner";
import { isValidListingDateAnswer } from "@/lib/dateUtils";

interface ProductsStepProps {
  onNext: (data: any) => void;
  onBack: () => void;
}

export const ProductsStep = ({ onNext, onBack }: ProductsStepProps) => {
  const { data: questions = [], isLoading } = useProductQuestions();
  const [formData, setFormData] = useState<Record<string, any>>({});

  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Check if all questions have answers
    questions.forEach((question: any) => {
      const value = formData[question.id];
      
      // Required fields validation
      if (!value || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)) {
        errors.push(`${question.question} is required`);
      }
      
      // Additional validations based on answer type
      if (question.answer_type === 'NUMBER' && value && isNaN(Number(value))) {
        errors.push(`${question.question} must be a valid number`);
      }
      
      if (
        question.answer_type === 'DATE' &&
        value &&
        !isValidListingDateAnswer(typeof value === 'string' ? value : String(value))
      ) {
        errors.push(`${question.question} must be a valid date`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleContinue = () => {
    const validation = validateForm();
    
    if (!validation.isValid) {
      // Show first error
      if (validation.errors.length > 0) {
        toast.error(validation.errors[0]);
      } else {
        toast.error("Please fill in all required fields");
      }
      return;
    }
    
    onNext(formData);
  };

  const renderField = (question: any) => {
    const value = formData[question.id] || "";
    
    switch (question.answer_type) {
      case "TEXT":
        return (
          <Input
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            placeholder="Enter your answer"
            className="bg-muted/50"
          />
        );
      
      case "NUMBER":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            placeholder="Enter a number"
            className="bg-muted/50"
          />
        );
      
      case "TEXTAREA":
        return (
          <Textarea
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            placeholder="Enter your answer"
            className="bg-muted/50 min-h-[100px]"
          />
        );
      
      case "DATE":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            className="bg-muted/50"
          />
        );
      
      case "YESNO":
        return (
          <Select value={value} onValueChange={(val) => setFormData({ ...formData, [question.id]: val })}>
            <SelectTrigger className="bg-muted/50">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        );
      
      case "SELECT":
        return (
          <Select value={value} onValueChange={(val) => setFormData({ ...formData, [question.id]: val })}>
            <SelectTrigger className="bg-muted/50">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.option && Array.isArray(question.option) && question.option.map((opt: string, idx: number) => (
                <SelectItem key={idx} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "CHECKBOX":
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {question.option && Array.isArray(question.option) && question.option.map((opt: string, idx: number) => (
              <label key={idx} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedValues.includes(opt)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selectedValues, opt]
                      : selectedValues.filter((item: string) => item !== opt);
                    setFormData({ ...formData, [question.id]: next });
                  }}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );
      
      default:
        return (
          <Input
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            placeholder="Enter your answer"
            className="bg-muted/50"
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Products</h1>
        <div className="text-muted-foreground">Loading questions...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Products</h1>

      <div className="bg-card rounded-xl p-8 border border-border space-y-6">
        {questions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No product questions available. Please contact the administrator.
          </div>
        ) : (
          questions.map((question: any) => (
            <div key={question.id} className="space-y-3">
              <Label className="text-base font-semibold">{question.question}</Label>
              {renderField(question)}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-4 mt-8">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          onClick={handleContinue}
          className="bg-accent hover:bg-accent/90 text-accent-foreground ml-auto px-16"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};
