import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useBrandQuestions } from "@/hooks/useBrandQuestions";
import { toast } from "sonner";
import FlagIcon from "@/components/FlagIcon";
import { isValidListingDateAnswer } from "@/lib/dateUtils";
import {
  DOMAIN_VALIDATION_MESSAGE,
  isDomainQuestion,
  isValidDomain,
  normalizeDomain,
} from "@/lib/domainUtils";

interface BrandInformationStepProps {
  formData?: any;
  onNext: (data: any) => void;
  onBack: () => void;
}

export const BrandInformationStep = ({ formData: parentFormData, onNext, onBack }: BrandInformationStepProps) => {
  const { data: questions = [], isLoading } = useBrandQuestions();
  const [formData, setFormData] = useState<Record<string, any>>(parentFormData || {});

  useEffect(() => {
    if (parentFormData) {
      setFormData(parentFormData);
    }
  }, [parentFormData]);

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
      
      if (isDomainQuestion(question.question) && value) {
        const domainValue = typeof value === "string" ? value : String(value);
        if (!isValidDomain(domainValue)) {
          errors.push(DOMAIN_VALIDATION_MESSAGE);
        }
      } else if (question.answer_type === "URL" && value) {
        const urlValue = typeof value === "string" ? value : String(value);
        const withProtocol = /^https?:\/\//i.test(urlValue.trim())
          ? urlValue.trim()
          : `https://${urlValue.trim()}`;
        try {
          new URL(withProtocol);
        } catch {
          errors.push(`${question.question} must be a valid URL`);
        }
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
    
    const normalizedFormData = { ...formData };
    questions.forEach((question: any) => {
      if (!isDomainQuestion(question.question)) return;

      const value = normalizedFormData[question.id];
      if (typeof value === "string" && value.trim() && isValidDomain(value)) {
        normalizedFormData[question.id] = normalizeDomain(value);
      }
    });

    onNext(normalizedFormData);
  };

  const renderField = (question: any) => {
    const value = formData[question.id] || "";
    
    switch (question.answer_type) {
      case "TEXT": {
        // Check if this is a location field (Business Location or similar)
        const isLocationField = question.question.toLowerCase().includes('location') || 
                                question.question.toLowerCase().includes('address') ||
                                question.question.toLowerCase().includes('country');
        
        return (
          <div className="relative">
            <Input
              value={value}
              onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
              placeholder={
                isDomainQuestion(question.question)
                  ? "www.example.com"
                  : "Enter your answer"
              }
              className="bg-muted/50"
              style={isLocationField && value ? { paddingRight: '40px' } : {}}
            />
            {isLocationField && value && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <FlagIcon country={value} className="w-5 h-4" />
              </div>
            )}
          </div>
        );
      }
      
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
            type="month"
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            className="bg-muted/50 border-none focus:ring-0 focus:border-transparent hover:border-transparent focus-visible:ring-0 focus-visible:outline-none"
            style={{
              outline: "none",
              boxShadow: "none",
            }}
          />
        );
      
      case "URL":
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            placeholder={
              isDomainQuestion(question.question)
                ? "www.example.com"
                : "Enter link here"
            }
            className="bg-muted/50 border-none focus:ring-0 focus:border-transparent hover:border-transparent focus-visible:ring-0 focus-visible:outline-none"
            style={{
              outline: "none",
              boxShadow: "none",
            }}
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

      case "CHECKBOX": {
        let selectedValues: string[] = Array.isArray(value) ? value : [];
        if (!selectedValues.length && typeof value === "string" && value.trim().startsWith("[")) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) selectedValues = parsed.map(String);
          } catch {
            selectedValues = [];
          }
        }
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
      }
      
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
      <div className="max-w-4xl w-full">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 md:mb-8">Brand Information</h1>
        <div className="text-sm sm:text-base text-muted-foreground">Loading questions...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl w-full">

      <div className="bg-card rounded-xl p-4 sm:p-6 md:p-8 border border-border space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 md:mb-8">Brand Information</h1>

        {questions.length === 0 ? (
          <div className="text-center text-sm sm:text-base text-muted-foreground py-6 sm:py-8">
            No brand information questions available. Please contact the administrator.
          </div>
        ) : (
          questions.map((question: any) => (
            <div key={question.id} className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold">
                {question.question === "Domains" ? "Domain" : question.question}
              </Label>
              {renderField(question)}
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          Back
        </Button>
        <Button 
          onClick={handleContinue}
          className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto sm:ml-auto sm:px-16"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};
