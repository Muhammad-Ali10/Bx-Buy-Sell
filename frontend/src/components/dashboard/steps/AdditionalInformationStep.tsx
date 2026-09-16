import { useState, useEffect } from "react";
import { hintPlaceholder, QuestionHint } from "@/components/dashboard/QuestionHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrefixedNumberInput } from "@/components/dashboard/PrefixedNumberInput";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageIcon, X, Loader2 } from "lucide-react";
import { useStatisticQuestions } from "@/hooks/useStatisticQuestions";
import { useListingCategoryId } from "@/hooks/useListingCategoryId";
import { useProductQuestions } from "@/hooks/useProductQuestions";
import { useManagementQuestions } from "@/hooks/useManagementQuestions";
import { toast } from "sonner";
import { uploadToCloudinary, uploadMultipleToCloudinary } from "@/lib/cloudinary";
import { isQuestionHidden } from "@/lib/questionRequired";
import {
  ALLOWED_ATTACHMENT_LABEL,
  formatMaxSize,
  maxBytesFor,
  isAllowedAttachment,
} from "@/lib/fileTypes";
import { isValidListingDateAnswer } from "@/lib/dateUtils";
// Shared with the rest of the wizard rather than kept as a private copy.
import { clampPercent, sanitizeNumberInput } from "@/lib/numberInput";
import { getFormCurrencySymbol } from "@/lib/listingCurrency";
import { fileNameFromUrl } from "@/lib/mediaUtils";
import { usePersistOnUnmount } from "@/hooks/usePersistOnUnmount";


interface AdditionalInformationStepProps {
  formData?: any;
  onNext: (data: any) => void;
  onBack: () => void;
  defaultTab?: "statistics" | "products" | "management";
  onPersist?: (data: any) => void;
}

export const AdditionalInformationStep = ({ formData: parentFormData, onNext, onBack, defaultTab = "statistics", onPersist }: AdditionalInformationStepProps) => {
  const [activeTab, setActiveTab] = useState<"statistics" | "products" | "management">(defaultTab);
  
  // Update active tab when defaultTab changes
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Fetch questions for each tab
  // The seller is asked their own category's questions, not everybody's.
  const categoryId = useListingCategoryId(parentFormData);
  const { data: statisticQuestions = [], isLoading: statisticsLoading } = useStatisticQuestions(categoryId);
  const { data: productQuestions = [], isLoading: productsLoading } = useProductQuestions(categoryId);
  const { data: managementQuestions = [], isLoading: managementLoading } = useManagementQuestions(categoryId);

  const [formData, setFormData] = useState<Record<string, any>>(parentFormData || {});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  usePersistOnUnmount(onPersist, () => formData);
  const currencySymbol = getFormCurrencySymbol(formData);

  const isSplitQuestion = (questionText: string) => {
    const text = (questionText || "").toLowerCase();
    return (
      text.includes("sales channels") ||
      text.includes("sales countries") ||
      text.includes("advertising channels") ||
      // Customer Type is the same shape: named segments that add up to 100%.
      text.includes("customer type")
    );
  };

  /**
   * Customer Type always splits between exactly these two segments, so the rows
   * are fixed and the seller only fills in the percentages.
   */
  const FIXED_SPLIT_ROWS: Record<string, string[]> = {
    "customer type": ["B2B", "B2C"],
  };

  const fixedRowsFor = (questionText: string): string[] | null => {
    const text = (questionText || "").toLowerCase();
    const key = Object.keys(FIXED_SPLIT_ROWS).find((k) => text.includes(k));
    return key ? FIXED_SPLIT_ROWS[key] : null;
  };

  const normalizeSplitRow = (row: any) => {
    if (!row || typeof row !== "object") return row;
    const pct =
      row.percent != null && row.percent !== ""
        ? row.percent
        : row.percentage != null && row.percentage !== ""
          ? row.percentage
          : "";
    return { ...row, percent: pct !== undefined && pct !== null ? String(pct) : "" };
  };

  const getSplitValue = (questionId: string) => {
    const raw = formData[questionId];
    if (Array.isArray(raw)) {
      return raw.map(normalizeSplitRow);
    }
    if (typeof raw === "string" && raw.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalizeSplitRow) : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const normalizeSplitValue = (questionId: string, questionText?: string) => {
    const rows = getSplitValue(questionId);
    const fixed = questionText ? fixedRowsFor(questionText) : null;

    // Questions with fixed segments (Customer Type) always show those rows, in
    // order, so the seller only fills in the percentages.
    if (fixed) {
      return fixed.map((name) => {
        const existing = rows.find(
          (r: any) => String(r?.name || "").trim().toLowerCase() === name.toLowerCase(),
        );
        return { name, percent: existing?.percent ?? "" };
      });
    }

    if (rows.length > 0) return rows;
    return [
      { percent: "", name: "" },
      { percent: "", name: "" },
    ];
  };

  const getNumberAffix = (questionText: string) => {
    const text = (questionText || "").toLowerCase();
    if (
      text.includes("inventory value") ||
      text.includes("average order value") ||
      text.includes("order value") ||
      text.includes("price")
    ) {
      // Whatever the seller picked in Financials — a euro business should
      // not be asked for its inventory value in dollars.
      return { prefix: currencySymbol, suffix: undefined };
    }
    if (
      text.includes("rate") ||
      text.includes("conversion") ||
      text.includes("refund") ||
      text.includes("returning") ||
      text.includes("percent") ||
      text.includes("%")
    ) {
      return { prefix: "%", suffix: undefined };
    }
    return { prefix: undefined, suffix: undefined };
  };

  useEffect(() => {
    if (parentFormData) {
      setFormData(parentFormData);
    }
  }, [parentFormData]);

  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    let questionsToValidate: any[] = [];
    
    // Get questions for the active tab
    if (activeTab === "statistics") {
      questionsToValidate = statisticQuestions;
    } else if (activeTab === "products") {
      questionsToValidate = productQuestions;
    } else if (activeTab === "management") {
      questionsToValidate = managementQuestions;
    }
    
    // Check if all questions have answers
    questionsToValidate.forEach((question: any) => {
      if (isQuestionHidden(question, formData, questionsToValidate)) {
        return;
      }

      const value = formData[question.id];

      if (isSplitQuestion(question.question)) {
        /*
         * The same rows the step renders, not the raw stored value.
         *
         * These two had drifted apart: the screen built its rows through
         * `normalizeSplitValue`, the check read `getSplitValue`, and for a
         * question with fixed segments those are different shapes.
         */
        const rows = normalizeSplitValue(question.id, question.question);
        const fixed = fixedRowsFor(question.question);
        const hasAny = rows.some((row: any) => row?.percent || row?.name);
        if (!hasAny) {
          errors.push(`${question.question} is required`);
          return;
        }
        let total = 0;
        rows.forEach((row: any) => {
          const percent = row?.percent;
          const name = row?.name;
          /*
           * Customer Type and its like have their names written by the app,
           * not by the seller. Judging those rows on "a name without a
           * percent" therefore accused the seller of half-filling a row they
           * had never touched — the message named Customer Type while the
           * real gap was in another group entirely.
           */
          if (fixed) {
            if (!percent) {
              errors.push(`${question.question}: enter a % for ${name}`);
            }
          } else if ((percent && !name) || (!percent && name)) {
            errors.push(
              `${question.question}: "${(name || percent || "").toString().trim()}" needs both a % and a name`,
            );
          }
          const numeric = Number(percent);
          if (Number.isFinite(numeric)) {
            total += numeric;
          }
        });
        if (total > 100) {
          errors.push(`${question.question} total must be 100% or less`);
        }
        return;
      }
      
      // Required fields validation (skip when admin marked the question optional)
      if (
        question.required !== false &&
        (!value || (typeof value === 'string' && value.trim() === '') ||
          (Array.isArray(value) && value.length === 0))
      ) {
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
    // Check if any uploads are in progress
    const isUploading = Object.values(uploadingFiles).some(uploading => uploading);
    if (isUploading) {
      toast.error("Please wait for file uploads to complete");
      return;
    }

    const validation = validateForm();
    
    if (!validation.isValid) {
      /*
       * Every problem at once.
       *
       * `validateForm` has always collected them all and this threw away
       * everything but the first, so the step could only be corrected one
       * mistake per submission — four gaps meant pressing Continue four
       * times, each time being told about a single one.
       */
      if (validation.errors.length > 0) {
        const [first, ...rest] = validation.errors;
        toast.error(first, {
          // A real list: a joined string would run the problems together on
          // one line, which is barely better than showing one of them.
          description: rest.length ? (
            <ul style={{ margin: "4px 0 0", paddingLeft: "16px", listStyle: "disc" }}>
              {rest.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : undefined,
          duration: Math.min(12000, 4000 + rest.length * 1500),
        });
      } else {
        toast.error("Please fill in all required fields");
      }
      return;
    }
    
    onNext(formData);
  };

  const handlePhotoUpload = async (questionId: string, file: File) => {
    setUploadingFiles(prev => ({ ...prev, [questionId]: true }));
    
    try {
      const result = await uploadToCloudinary(file, 'listings/photos');
      
      if (result.success && result.url) {
        setFormData(prev => ({ ...prev, [questionId]: result.url }));
        toast.success("Photo uploaded successfully");
      } else {
        toast.error(result.error || "Failed to upload photo");
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingFiles(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleFileUpload = async (questionId: string, file: File) => {
    // Guard here too, so no caller can slip an unsupported file past the input.
    if (!isAllowedAttachment(file.name)) {
      toast.error(`This file type is not supported. Allowed: ${ALLOWED_ATTACHMENT_LABEL}`);
      return;
    }
    const limit = maxBytesFor(file.name);
    if (file.size > limit) {
      toast.error(`File must be less than ${formatMaxSize(limit)}`);
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [questionId]: true }));

    try {
      const result = await uploadToCloudinary(file, 'listings/attachments');
      
      if (result.success && result.url) {
        const currentFiles = formData[questionId] || [];
        setFormData(prev => ({ 
          ...prev, 
          [questionId]: Array.isArray(currentFiles) ? [...currentFiles, result.url] : [result.url]
        }));
        toast.success("File uploaded successfully");
      } else {
        toast.error(result.error || "Failed to upload file");
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error("Failed to upload file");
    } finally {
      setUploadingFiles(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const renderField = (question: any) => {
    const value = formData[question.id] || "";

    if (isSplitQuestion(question.question)) {
      const rows = normalizeSplitValue(question.id, question.question);
      const total = rows.reduce((sum: number, row: any) => sum + (Number(row?.percent) || 0), 0);
      // Fixed-segment questions (Customer Type) own their rows, so there is
      // nothing to add — a new row would be dropped on the next render anyway.
      const hasFixedRows = fixedRowsFor(question.question) !== null;

      return (
        <div
          style={{
            width: "100%",
            borderRadius: "12px",
            padding: "12px",
            background: "rgba(250, 250, 250, 1)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <span
            style={{
              fontFamily: "Lufga",
              fontWeight: 500,
              fontSize: "20px",
              lineHeight: "140%",
              letterSpacing: "0%",
              color: "rgba(0, 0, 0, 1)",
            }}
          >
            {question.question}
          </span>
          <div className="space-y-3">
            {rows.map((row: any, index: number) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/*
                  * A label, not a div.
                  *
                  * The input is only as wide as what has been typed into it —
                  * one character when empty — so the "%" stays against the
                  * number instead of floating at the far end of the card. That
                  * left a 365px field with a 12px target: clicking anywhere but
                  * the digit itself did nothing, and anything typed went
                  * nowhere. Wrapping it hands every click in the card to the
                  * input without giving up the fitted width.
                  */}
                <label
                  style={{
                    height: "69px",
                    borderRadius: "12px",
                    paddingTop: "22px",
                    paddingRight: "20px",
                    paddingBottom: "22px",
                    paddingLeft: "20px",
                    background: "rgba(255, 255, 255, 1)",
                    display: "flex",
                    alignItems: "center",
                    cursor: "text",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "2px", width: "100%" }}>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={row?.percent || ""}
                      onChange={(e) => {
                        const val = clampPercent(sanitizeNumberInput(e.target.value));
                        const next = [...rows];
                        next[index] = { ...next[index], percent: val };
                        const nextTotal = next.reduce((sum: number, r: any) => sum + (Number(r?.percent) || 0), 0);
                        if (nextTotal > 100) {
                          toast.error("Total must be 100% or less");
                          return;
                        }
                        setFormData({ ...formData, [question.id]: next });
                      }}
                      placeholder="0"
                      className="border-none bg-transparent h-full p-0 focus:ring-0 focus:border-transparent hover:border-transparent focus-visible:ring-0 focus-visible:outline-none placeholder:text-black/50"
                      style={{
                        width: `${Math.max(1, String(row?.percent || "").length)}ch`,
                        minWidth: "1ch",
                        fontFamily: "Lufga",
                        fontWeight: 400,
                        fontSize: "18px",
                        lineHeight: "140%",
                        letterSpacing: "0%",
                        color: "rgba(0, 0, 0, 1)",
                        outline: "none",
                        boxShadow: "none",
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "Lufga",
                        fontWeight: 400,
                        fontSize: "18px",
                        lineHeight: "140%",
                        color: "rgba(0, 0, 0, 0.5)",
                        pointerEvents: "none",
                      }}
                    >
                      %
                    </span>
                  </div>
                </label>
                {/* Same again for the name beside it. */}
                <label
                  style={{
                    height: "69px",
                    borderRadius: "12px",
                    paddingTop: "22px",
                    paddingRight: "20px",
                    paddingBottom: "22px",
                    paddingLeft: "20px",
                    background: "rgba(255, 255, 255, 1)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Input
                    value={row?.name || ""}
                    onChange={(e) => {
                      const next = [...rows];
                      next[index] = { ...next[index], name: e.target.value };
                      setFormData({ ...formData, [question.id]: next });
                    }}
                    placeholder="Name"
                    className="border-none bg-transparent h-full p-0 focus:ring-0 focus:border-transparent hover:border-transparent focus-visible:ring-0 focus-visible:outline-none"
                    style={{
                      fontFamily: "Lufga",
                      fontWeight: 400,
                      fontSize: "18px",
                      lineHeight: "140%",
                      letterSpacing: "0%",
                      color: "rgba(0, 0, 0, 1)",
                      outline: "none",
                      boxShadow: "none",
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: hasFixedRows ? "flex-end" : "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {!hasFixedRows && (
              <button
                type="button"
                onClick={() => {
                  const next = [...rows, { percent: "", name: "" }];
                  setFormData({ ...formData, [question.id]: next });
                }}
                style={{
                  height: "26px",
                  width: "fit-content",
                  borderRadius: "4px",
                  paddingTop: "3px",
                  paddingRight: "12px",
                  paddingBottom: "3px",
                  paddingLeft: "12px",
                  gap: "4px",
                  background: "rgba(241, 241, 241, 1)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontFamily: "Lufga",
                    fontWeight: 500,
                    fontSize: "14px",
                    lineHeight: "140%",
                    letterSpacing: "0%",
                    color: "rgba(0, 0, 0, 1)",
                  }}
                >
                  Add
                </span>
              </button>
            )}
            <span
              style={{
                fontFamily: "Lufga",
                fontWeight: 500,
                fontSize: "14px",
                color: total > 100 ? "#b00020" : "rgba(0, 0, 0, 0.55)",
              }}
            >
              Total: {total}% / 100%
            </span>
          </div>
        </div>
      );
    }
    
    switch (question.answer_type) {
      case "TEXT":
        return (
          <Input
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            placeholder={hintPlaceholder(question, "Enter your answer")}
            className="bg-background h-11 sm:h-12 border-none focus:ring-0 focus:border-transparent hover:border-transparent focus-visible:ring-0 focus-visible:outline-none"
            style={{
              outline: "none",
              boxShadow: "none",
            }}
          />
        );
      
      case "NUMBER":
        const affix = getNumberAffix(question.question);
        return (
          <PrefixedNumberInput
            prefix={affix.prefix}
            prefixStyle={{
              color: "rgba(0,0,0,0.5)",
              fontSize: "18px",
              fontFamily: "Lufga",
              fontWeight: 400,
              lineHeight: "140%",
            }}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              let v = sanitizeNumberInput(e.target.value);
              if (affix.prefix === "%") v = clampPercent(v);
              setFormData({ ...formData, [question.id]: v });
            }}
            placeholder={hintPlaceholder(question, "Enter a number")}
            className="h-11 sm:h-12 border-none focus:ring-0 focus:border-transparent hover:border-transparent focus-visible:ring-0 focus-visible:outline-none"
            style={{
              background: "rgba(250, 250, 250, 1)",
              borderRadius: "12px",
              outline: "none",
              boxShadow: "none",
              appearance: "textfield",
            }}
          />
        );
      
      case "TEXTAREA":
        return (
          <Textarea
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            placeholder={hintPlaceholder(question, "Enter your answer")}
            className="bg-background min-h-[120px] border-none focus:ring-0 focus:border-transparent hover:border-transparent focus-visible:ring-0 focus-visible:outline-none resize-y"
            style={{
              outline: "none",
              boxShadow: "none",
            }}
          />
        );
      
      case "DATE":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            className="bg-background h-11 sm:h-12 border-none focus:ring-0 focus:border-transparent hover:border-transparent focus-visible:ring-0 focus-visible:outline-none"
            style={{
              outline: "none",
              boxShadow: "none",
            }}
          />
        );
      
      case "YESNO":
      case "BOOLEAN":
        return (
          <div className="flex gap-3 sm:gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData({ ...formData, [question.id]: "yes" })}
              className={`px-8 sm:px-12 h-11 sm:h-12 rounded-lg font-medium transition-all ${
                value === "yes" || value === "true" 
                  ? "bg-accent text-accent-foreground hover:bg-accent/90 border-accent shadow-md" 
                  : "border-2 hover:bg-muted/50"
              }`}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData({ ...formData, [question.id]: "no" })}
              className={`px-8 sm:px-12 h-11 sm:h-12 rounded-lg font-medium transition-all ${
                value === "no" || value === "false" 
                  ? "bg-accent text-accent-foreground hover:bg-accent/90 border-accent shadow-md" 
                  : "border-2 hover:bg-muted/50"
              }`}
            >
              No
            </Button>
          </div>
        );
      
      case "SELECT":
        return (
          <Select value={value} onValueChange={(val) => setFormData({ ...formData, [question.id]: val })}>
            <SelectTrigger className="bg-background h-11 sm:h-12 border-none focus:ring-0 focus:border-transparent hover:border-transparent focus-visible:ring-0 focus-visible:outline-none">
              <SelectValue placeholder={hintPlaceholder(question, "Select an option")} />
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
            {question.option && Array.isArray(question.option) && question.option.map((opt: string, idx: number) => {
              const isChecked = selectedValues.includes(opt);
              return (
                <label key={idx} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const next = checked
                        ? [...selectedValues, opt]
                        : selectedValues.filter((item: string) => item !== opt);
                      setFormData({ ...formData, [question.id]: next });
                    }}
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        );
      
      case "PHOTO":
        const isUploadingPhoto = uploadingFiles[question.id];
        const photoUrl = typeof value === 'string' ? value : '';
        
        return (
          <div className="space-y-2">
            {photoUrl ? (
              <div className="relative inline-block">
                <img 
                  src={photoUrl} 
                  alt="Preview" 
                  className="h-32 w-32 object-cover rounded-lg border-2 border-border"
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, [question.id]: "" })}
                  className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 hover:bg-destructive/90"
                  disabled={isUploadingPhoto}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center hover:border-accent/50 transition-colors bg-muted/30">
                {/* No `accept`. The dialog filtering a file out is what made a
                    refusal silent — the seller picked nothing and nothing was
                    said. The check in the handler refuses instead, out loud. */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error("Photo must be less than 10MB");
                        return;
                      }
                      handlePhotoUpload(question.id, file);
                    }
                  }}
                  className="hidden"
                  id={`photo-${question.id}`}
                  disabled={isUploadingPhoto}
                />
                <label htmlFor={`photo-${question.id}`} className="cursor-pointer text-center w-full">
                  {isUploadingPhoto ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-12 h-12 text-accent mb-3 animate-spin" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="w-12 h-12 text-muted-foreground mb-3 mx-auto" />
                      <p className="text-sm text-muted-foreground">Click to upload photo</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                    </>
                  )}
                </label>
              </div>
            )}
          </div>
        );
      
      case "FILE":
        const isUploadingFile = uploadingFiles[question.id];
        const fileUrls = Array.isArray(value) ? value : (value ? [value] : []);
        
        return (
          <div className="space-y-2">
            <div className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center hover:border-accent/50 transition-colors bg-muted/30">
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (!isAllowedAttachment(file.name)) {
                      toast.error(`This file type is not supported. Allowed: ${ALLOWED_ATTACHMENT_LABEL}`);
                      e.target.value = "";
                      return;
                    }
                    const limit = maxBytesFor(file.name);
                    if (file.size > limit) {
                      toast.error(`File must be less than ${formatMaxSize(limit)}`);
                      e.target.value = "";
                      return;
                    }
                    handleFileUpload(question.id, file);
                  }
                }}
                className="hidden"
                id={`file-${question.id}`}
                disabled={isUploadingFile}
              />
              <label htmlFor={`file-${question.id}`} className="cursor-pointer text-center w-full">
                {isUploadingFile ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-accent mb-2 animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Click to upload file</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, etc. up to 10MB</p>
                  </>
                )}
              </label>
            </div>
            {fileUrls.length > 0 && (
              <div className="space-y-2">
                {fileUrls.map((url: string, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    {/* Same as the attachments step: the file's own name, in
                        the page's text colour rather than the accent. */}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-sm text-foreground hover:underline"
                      title={fileNameFromUrl(url)}
                    >
                      {fileNameFromUrl(url)}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = fileUrls.filter((_: string, i: number) => i !== index);
                        setFormData({ ...formData, [question.id]: updated.length === 1 ? updated[0] : updated });
                      }}
                      className="ml-2 text-destructive hover:text-destructive/90"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <Input
            value={value}
            onChange={(e) => setFormData({ ...formData, [question.id]: e.target.value })}
            placeholder={hintPlaceholder(question, "Enter your answer")}
            className="bg-background border-border h-11 sm:h-12 focus:ring-2 focus:ring-accent focus:border-accent"
          />
        );
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">
        {activeTab === "statistics" ? "Statistics" : activeTab === "products" ? "Products" : "Management"}
      </h1>

      {activeTab === "statistics" && (
        <div className="space-y-6 bg-card rounded-2xl p-6 sm:p-8 border border-border shadow-lg">
          {statisticsLoading ? (
            <div className="text-muted-foreground text-center py-12">Loading questions...</div>
          ) : statisticQuestions.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No statistic questions available. Please contact the administrator.
            </div>
          ) : (
            statisticQuestions.map((question: any) => {
              if (isQuestionHidden(question, formData, statisticQuestions)) {
                return null;
              }

              return (
                <div key={question.id} className="space-y-3">
                  {!isSplitQuestion(question.question) && (
                    <Label className="text-base sm:text-lg font-semibold text-foreground">
                      {question.question}
                    </Label>
                  )}
                  <QuestionHint question={question} />
                  {renderField(question)}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "products" && (
        <div className="space-y-6 bg-card rounded-2xl p-6 sm:p-8 border border-border shadow-lg">
          {productsLoading ? (
            <div className="text-muted-foreground text-center py-12">Loading questions...</div>
          ) : productQuestions.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No product questions available. Please contact the administrator.
            </div>
          ) : (
            productQuestions.map((question: any) => {
              if (isQuestionHidden(question, formData, productQuestions)) {
                return null;
              }

              return (
                <div key={question.id} className="space-y-3">
                  {!isSplitQuestion(question.question) && (
                    <Label className="text-base sm:text-lg font-semibold text-foreground">
                      {question.question}
                    </Label>
                  )}
                  <QuestionHint question={question} />
                  {renderField(question)}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "management" && (
        <div className="space-y-6 bg-card rounded-2xl p-6 sm:p-8 border border-border shadow-lg">
          {managementLoading ? (
            <div className="text-muted-foreground text-center py-12">Loading questions...</div>
          ) : managementQuestions.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No management questions available. Please contact the administrator.
            </div>
          ) : (
            managementQuestions.map((question: any) => {
              if (isQuestionHidden(question, formData, managementQuestions)) {
                return null;
              }

              return (
                <div key={question.id} className="space-y-3">
                  {!isSplitQuestion(question.question) && (
                    <Label className="text-base sm:text-lg font-semibold text-foreground">
                      {question.question}
                    </Label>
                  )}
                  <QuestionHint question={question} />
                  {renderField(question)}
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="w-full sm:w-auto px-8 h-11 sm:h-12 border-2"
        >
          Back
        </Button>
        <Button 
          onClick={handleContinue}
          className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto sm:ml-auto px-12 sm:px-16 h-11 sm:h-12 font-semibold rounded-full shadow-md"
        >
          Save
        </Button>
      </div>
    </div>
  );
};
