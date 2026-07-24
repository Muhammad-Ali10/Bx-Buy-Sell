import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHandoverQuestions } from "@/hooks/useHandoverQuestions";
import { toast } from "sonner";

interface HandoverStepProps {
  formData?: any;
  onNext: (data: any) => void;
  onBack: () => void;
}

const checkboxSelectionToArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const HandoverStep = ({ formData: parentFormData, onNext, onBack }: HandoverStepProps) => {
  const { data: questions, isLoading } = useHandoverQuestions();
  const [formData, setFormData] = useState<Record<string, any>>(parentFormData || {});

  useEffect(() => {
    if (parentFormData) {
      setFormData(parentFormData);
    }
  }, [parentFormData]);

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    const currentValues = checkboxSelectionToArray(formData[questionId]);
    if (checked) {
      setFormData(prev => ({ ...prev, [questionId]: [...currentValues, option] }));
    } else {
      setFormData(prev => ({ ...prev, [questionId]: currentValues.filter((v: string) => v !== option) }));
    }
  };

  const handleYesNoChange = (questionId: string, value: string) => {
    setFormData(prev => ({ ...prev, [questionId]: value }));
  };

  const handleInputChange = (questionId: string, value: string) => {
    setFormData(prev => ({ ...prev, [questionId]: value }));
  };

  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Check if all questions have answers
    questions.forEach((question: any) => {
      const value = formData[question.id];
      
      // Required fields validation
      if (question.answer_type === 'CHECKBOX_GROUP' || question.answer_type === 'CHECKBOX') {
        const arr = checkboxSelectionToArray(value);
        if (arr.length === 0) {
          errors.push(`${question.question} requires at least one selection`);
        }
      } else if (question.answer_type === 'YES_NO' || question.answer_type === 'TWO_OPTIONS' || question.answer_type === 'SELECT') {
        if (!value || value.trim() === '') {
          errors.push(`${question.question} is required`);
        }
      } else if (!value || 
          (typeof value === 'string' && value.trim() === '') || 
          (Array.isArray(value) && value.length === 0)) {
        errors.push(`${question.question} is required`);
      }
      
      // Additional validations based on answer type
      if (question.answer_type === 'NUMBER' && value && isNaN(Number(value))) {
        errors.push(`${question.question} must be a valid number`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleSubmit = () => {
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

  if (isLoading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Handover</h1>
        <div className="text-muted-foreground">Loading questions...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Handover</h1>

      <div className="space-y-8">
        {questions && questions.length > 0 ? (
          questions.map((question: any) => (
            <div key={question.id} className="space-y-4">
              <Label className="text-lg font-semibold">{question.question}</Label>
              
              {(question.answer_type === "CHECKBOX_GROUP" || question.answer_type === "CHECKBOX") && (
                <div className="grid grid-cols-2 gap-4">
                  {question.option && question.option.length > 0 ? (
                    question.option.map((option: string, index: number) => {
                      const isSelected = checkboxSelectionToArray(formData[question.id]).includes(option);
                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            isSelected
                              ? "border-accent bg-accent/10"
                              : "border-border bg-muted/30 hover:border-accent/50"
                          }`}
                          onClick={() => handleCheckboxChange(question.id, option, !isSelected)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleCheckboxChange(question.id, option, checked as boolean)}
                            className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                          />
                          <Label className="cursor-pointer flex-1">{option}</Label>
                        </div>
                      );
                    })
                  ) : (
                    ["Domains", "Brand assets", "Website files", "Phone number(s)", "Email address", "Supplier contacts"].map((option, index) => {
                      const isSelected = checkboxSelectionToArray(formData[question.id]).includes(option);
                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            isSelected
                              ? "border-accent bg-accent/10"
                              : "border-border bg-muted/30 hover:border-accent/50"
                          }`}
                          onClick={() => handleCheckboxChange(question.id, option, !isSelected)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleCheckboxChange(question.id, option, checked as boolean)}
                            className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                          />
                          <Label className="cursor-pointer flex-1">{option}</Label>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {question.answer_type === "YES_NO" && (
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={formData[question.id] === "yes" ? "default" : "outline"}
                    onClick={() => handleYesNoChange(question.id, "yes")}
                    className={formData[question.id] === "yes" ? "bg-accent text-accent-foreground px-12" : "px-12"}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={formData[question.id] === "no" ? "default" : "outline"}
                    onClick={() => handleYesNoChange(question.id, "no")}
                    className={formData[question.id] === "no" ? "bg-muted px-12" : "px-12"}
                  >
                    No
                  </Button>
                </div>
              )}

              {question.answer_type === "TWO_OPTIONS" && (
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={formData[question.id] === "option1" ? "default" : "outline"}
                    onClick={() => handleYesNoChange(question.id, "option1")}
                    className={formData[question.id] === "option1" ? "bg-accent text-accent-foreground px-12" : "px-12"}
                  >
                    Option 1
                  </Button>
                  <Button
                    type="button"
                    variant={formData[question.id] === "option2" ? "default" : "outline"}
                    onClick={() => handleYesNoChange(question.id, "option2")}
                    className={formData[question.id] === "option2" ? "bg-muted px-12" : "px-12"}
                  >
                    Option 2
                  </Button>
                </div>
              )}

              {question.answer_type === "NUMBER" && (
                <Input
                  type="number"
                  placeholder="Enter number"
                  value={formData[question.id] || ""}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="max-w-xs bg-muted/50"
                />
              )}

              {question.answer_type === "TEXT" && (
                <Textarea
                  placeholder="Enter your answer"
                  value={formData[question.id] || ""}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="bg-muted/50 min-h-24"
                />
              )}

              {question.answer_type === "SELECT" && (
                <Select 
                  value={formData[question.id] || ""} 
                  onValueChange={(val) => handleInputChange(question.id, val)}
                >
                  <SelectTrigger className="bg-muted/50 max-w-xs">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {question.option && question.option.length > 0 ? (
                      question.option.map((opt: string, idx: number) => (
                        <SelectItem key={idx} value={opt}>
                          {opt}
                        </SelectItem>
                      ))
                    ) : (
                      ["Domains", "Brand assets", "Website files", "Phone number(s)", "Email address", "Supplier contacts"].map((opt, idx) => (
                        <SelectItem key={idx} value={opt}>
                          {opt}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No handover questions configured yet. Please contact admin to add questions.
          </div>
        )}

        <div className="flex gap-4 mt-8">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button 
            onClick={handleSubmit}
            className="bg-accent hover:bg-accent/90 text-accent-foreground ml-auto px-16"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
