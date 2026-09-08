import { useState, useEffect } from "react";
import { hintPlaceholder, QuestionHint } from "@/components/dashboard/QuestionHint";
import { sanitizeNumberInput } from "@/lib/numberInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useHandoverQuestions } from "@/hooks/useHandoverQuestions";
import { useListingCategoryId } from "@/hooks/useListingCategoryId";
import { toast } from "sonner";
import { usePersistOnUnmount } from "@/hooks/usePersistOnUnmount";

interface HandoverStepProps {
  formData?: any;
  onNext: (data: any) => void;
  onBack: () => void;
  onPersist?: (data: any) => void;
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

export const HandoverStep = ({ formData: parentFormData, onNext, onPersist }: HandoverStepProps) => {
  // The seller is asked their own category's questions, not everybody's.
  const categoryId = useListingCategoryId(parentFormData);
  const { data: questions, isLoading } = useHandoverQuestions(categoryId);
  const [formData, setFormData] = useState<Record<string, any>>(parentFormData || {});
  usePersistOnUnmount(onPersist, () => formData);

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
    setFormData(prev => {
      const next: Record<string, any> = { ...prev, [questionId]: value };

      /**
       * Withdrawing support takes its duration with it.
       *
       * The months field only appears once support is promised, but hiding it
       * does not empty it: answer "Yes", type six, change to "No", and the six
       * is still in the form and still saved — the listing then advertises a
       * support period nobody offers.
       */
      const answered = (questions ?? []).find((q: any) => q.id === questionId);
      if (answered && isSupportOfferedQuestion(String(answered.question || '')) && !isYes(value)) {
        for (const other of questions ?? []) {
          if (isSupportMonthsQuestion(String(other.question || ''))) {
            next[other.id] = '';
          }
        }
      }

      return next;
    });
  };

/**
 * "How long in months" only makes sense once support has been promised.
 *
 * The two are recognised by their wording. Questions are rows an administrator
 * writes, and nothing in that row can point at another one — `answer_for` names
 * the section (HANDOVER, SOCIAL, …), never a parent question. So matching the
 * text is the only join available, and if the wording is ever edited the pair
 * simply comes apart and the field shows unconditionally: the safe direction to
 * fail, since a visible field can be answered and a hidden one cannot.
 *
 * Two spellings are in the database — "How long in months" and an older "How
 * long is month" — so the test is loose enough to catch both.
 */
const isSupportOfferedQuestion = (question: string) =>
  /post\s*[- ]?\s*sale/i.test(question) && /support/i.test(question);

const isSupportMonthsQuestion = (question: string) =>
  /how\s+long/i.test(question) && /month/i.test(question);

const isYes = (value: unknown) => String(value ?? '').trim().toLowerCase() === 'yes';

  const handleInputChange = (questionId: string, value: string) => {
    setFormData(prev => ({ ...prev, [questionId]: value }));
  };


  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Check if all questions have answers
    questions.forEach((question: any) => {
      const value = formData[question.id];

      // Admin can mark a question as optional; skip empty-answer validation for those.
      const isAnswerEmpty = (question.answer_type === 'CHECKBOX_GROUP' || question.answer_type === 'CHECKBOX')
        ? checkboxSelectionToArray(value).length === 0
        : (!value || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0));
      if (question.required === false && isAnswerEmpty) {
        return;
      }

      // Required fields validation
      if (question.answer_type === 'CHECKBOX_GROUP' || question.answer_type === 'CHECKBOX') {
        const arr = checkboxSelectionToArray(value);
        if (arr.length === 0) {
          errors.push(`${question.question} requires at least one selection`);
        }
      } else if (
        question.answer_type === 'BOOLEAN' ||
        question.answer_type === 'YESNO' ||
        question.answer_type === 'YES_NO' ||
        question.answer_type === 'SELECT'
      ) {
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

  const FALLBACK_ASSETS = [
    "Domains",
    "Brand assets",
    "Website files",
    "Phone number(s)",
    "Email address",
    "Supplier contacts",
  ];

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-border bg-card p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Handover</h1>

      <div className="space-y-6">
        {questions && questions.length > 0 ? (
          questions.map((question: any) => {
            const answerType = String(question.answer_type || "").toUpperCase();
            const isBoolean = answerType === "BOOLEAN" || answerType === "YESNO" || answerType === "YES_NO";
            const isNumber = answerType === "NUMBER";
            const isText = answerType === "TEXT";
            // In Handover, any option-based question (the assets list) is a multi-select
            // checkbox grid — whether the admin saved it as CHECKBOX or SELECT.
            const isCheckboxLike = !isBoolean && !isNumber && !isText;
            const options: string[] =
              question.option && question.option.length > 0 ? question.option : FALLBACK_ASSETS;

            /**
             * How long support lasts is only a question once support is offered.
             * Asked unconditionally, it invited a seller to promise six months
             * of something they had just said they do not provide.
             */
            if (isSupportMonthsQuestion(String(question.question || ''))) {
              const offered = (questions ?? []).find((q: any) =>
                isSupportOfferedQuestion(String(q.question || '')),
              );
              if (offered && !isYes(formData[offered.id])) return null;
            }

            return (
              <div key={question.id} className="space-y-3 ">
                <Label className="text-base md:text-lg font-semibold text-foreground block">
                  {question.question}
                </Label>
                <QuestionHint question={question} />

                {isCheckboxLike && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {options.map((option: string, index: number) => {
                      const isSelected = checkboxSelectionToArray(formData[question.id]).includes(option);
                      return (
                        <div
                          key={index}
                          onClick={() => handleCheckboxChange(question.id, option, !isSelected)}
                          className={`flex items-center gap-3 px-5 py-4 rounded-2xl border-2 transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-accent/10 border-accent"
                              : "bg-muted/40 border-transparent hover:border-border"
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="pointer-events-none h-6 w-6 rounded border-2 border-muted-foreground/40 data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=checked]:text-accent-foreground"
                          />
                          <span
                            className={`flex-1 text-sm md:text-base ${
                              isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                            }`}
                          >
                            {option}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isBoolean && (
                  <div className="inline-flex gap-2">
                    {["Yes", "No"].map((opt) => {
                      const selected = String(formData[question.id] ?? "").toLowerCase() === opt.toLowerCase();
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleYesNoChange(question.id, opt)}
                          className={`h-12 w-28 rounded-xl text-base font-semibold transition-colors ${
                            selected
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {isNumber && (
                  /* Digits and nothing else — see `sanitizeNumberInput`,
                     which every other step runs too. This step had its own
                     copy of the rule written inline. */
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formData[question.id] || ""}
                    onChange={(e) =>
                      handleInputChange(question.id, sanitizeNumberInput(e.target.value))
                    }
                    className="w-full h-14 rounded-xl bg-background"
                  />
                )}

                {isText && (
                  <Textarea
                    placeholder={hintPlaceholder(question, "Enter your answer")}
                    value={formData[question.id] || ""}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    className="w-full rounded-xl bg-background min-h-24"
                  />
                )}

              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No handover questions configured yet. Please contact admin to add questions.
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSubmit}
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-14 px-14 font-semibold"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
