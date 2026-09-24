import { useState, useEffect, useRef } from "react";
import { hintPlaceholder, QuestionHint } from "@/components/dashboard/QuestionHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrefixedNumberInput } from "@/components/dashboard/PrefixedNumberInput";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Paperclip, ImageIcon, Loader2 } from "lucide-react";
import { useAdInformationQuestions } from "@/hooks/useAdInformationQuestions";
import { useListingCategoryId } from "@/hooks/useListingCategoryId";
import { toast } from "sonner";
import { uploadMultipleToCloudinary } from "@/lib/cloudinary";
import { fileNameFromUrl, parseMediaUrls } from "@/lib/mediaUtils";
import { isQuestionRequired } from "@/lib/questionRequired";
import { sanitizeNumberInput } from "@/lib/numberInput";
import { getFormCurrencySymbol } from "@/lib/listingCurrency";
import {
  asAllowedAttachment,
  maxBytesFor,
  refusedAttachmentsMessage,
} from "@/lib/fileTypes";

interface AdInformationsStepProps {
  formData?: any;
  onNext: (data: any) => void;
  onBack: () => void;
  /** Persist current input to the parent when leaving the step (e.g. sidebar tab switch). */
  onPersist?: (data: any) => void;
}

type FieldKind = "photo" | "file" | "price" | "title" | "textarea";

interface FieldConfig {
  kind: FieldKind;
  required: boolean;
  placeholder: string;
  maxLength?: number;
  showCounter: boolean;
}

/**
 * Map an admin Ad-Information question to the fixed client design (widget,
 * limits, placeholder).
 *
 * Nothing here decides whether a field must be answered. It used to say so in
 * its own `required` — "photos and attachments are never required; every other
 * field is" — which is why the admin panel's setting had no effect on this
 * step. That question is settled by `isQuestionRequired`, from the flag an
 * administrator can actually see.
 */
const getFieldConfig = (question: any): FieldConfig => {
  const type = String(question?.answer_type || "").toUpperCase();
  const text = String(question?.question || "").toLowerCase();

  if (type === "PHOTO" || type === "PHOTO_UPLOAD") {
    return { kind: "photo", required: false, placeholder: "", showCounter: false };
  }
  if (type === "FILE" || type === "FILE_UPLOAD") {
    return { kind: "file", required: false, placeholder: "", showCounter: false };
  }
  if (type === "NUMBER" || text.includes("price")) {
    return { kind: "price", required: true, placeholder: "0", showCounter: false };
  }
  if (text.includes("title")) {
    return { kind: "title", required: true, placeholder: "Enter Title", maxLength: 100, showCounter: false };
  }
  if (text.includes("intro")) {
    return {
      kind: "textarea",
      required: true,
      placeholder: "Write the best in the shortest form. This will be visible in the preview!",
      maxLength: 150,
      showCounter: true,
    };
  }
  if (text.includes("usp")) {
    return {
      kind: "textarea",
      required: true,
      placeholder: "Unique Selling Points means define what makes your business stand out",
      maxLength: 300,
      showCounter: true,
    };
  }
  if (text.includes("description")) {
    return { kind: "textarea", required: true, placeholder: "Enter your Description", maxLength: 1000, showCounter: true };
  }
  return { kind: "textarea", required: true, placeholder: "Enter your answer", showCounter: false };
};

/** Read a media field (in-memory array, JSON array, legacy comma-joined, or single URL). */
const toUrlArray = parseMediaUrls;

export const AdInformationsStep = ({ formData: parentFormData, onNext, onBack, onPersist }: AdInformationsStepProps) => {
  // The seller is asked their own category's questions, not everybody's.
  const categoryId = useListingCategoryId(parentFormData);
  const { data: questions, isLoading } = useAdInformationQuestions(categoryId);
  const [formData, setFormData] = useState<Record<string, any>>(parentFormData || {});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const currencySymbol = getFormCurrencySymbol(formData);

  // Normalize media fields to arrays whenever the parent data (re)hydrates.
  useEffect(() => {
    if (!parentFormData) return;
    const normalized: Record<string, any> = { ...parentFormData };
    (questions || []).forEach((q: any) => {
      const cfg = getFieldConfig(q);
      if (cfg.kind === "photo" || cfg.kind === "file") {
        normalized[q.id] = toUrlArray(parentFormData[q.id]);
      }
    });
    setFormData(normalized);
  }, [parentFormData, questions]);

  // Flush current input back to the parent when the step unmounts (sidebar tab switch).
  const latestRef = useRef<Record<string, any>>(formData);
  latestRef.current = formData;
  useEffect(() => {
    return () => {
      onPersist?.(latestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMultiUpload = async (
    questionId: string,
    fileList: FileList | null,
    folder: string,
    /**
     * Attachments accept only the client's format list; photos stay open.
     * Returns the file ready to upload (renamed if need be), or null to refuse it.
     */
    prepare?: (file: File) => File | null,
  ) => {
    if (!fileList || fileList.length === 0) return;
    const all = Array.from(fileList);

    // `accept` is only a browser hint, so re-check the type here.
    const checked = all.map((file) => ({ file, ready: prepare ? prepare(file) : file }));
    const rightType = checked.flatMap(({ ready }) => (ready ? [ready] : []));
    const refused = checked.filter(({ ready }) => !ready).map(({ file }) => file);
    if (refused.length > 0) {
      toast.error(refusedAttachmentsMessage(refused));
    }

    // Video is allowed up to 100 MB; everything else stays at 10 MB.
    const valid = rightType.filter((f) => f.size <= maxBytesFor(f.name));
    const oversized = rightType.length - valid.length;
    if (oversized > 0) {
      toast.error(`${oversized} file(s) skipped — max 10 MB, or 100 MB for video`);
    }
    if (valid.length === 0) return;

    setUploadingFiles((prev) => ({ ...prev, [questionId]: true }));
    try {
      const results = await uploadMultipleToCloudinary(valid, folder);
      const urls = results.filter((r) => r.success && r.url).map((r) => r.url as string);
      const failed = results.length - urls.length;
      if (urls.length > 0) {
        setFormData((prev) => ({ ...prev, [questionId]: [...toUrlArray(prev[questionId]), ...urls] }));
        toast.success(`${urls.length} file${urls.length > 1 ? "s" : ""} uploaded successfully ✅`);
      }
      if (failed > 0) toast.error(`${failed} file${failed > 1 ? "s" : ""} failed to upload`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const removeMediaAt = (questionId: string, index: number) => {
    setFormData((prev) => ({
      ...prev,
      [questionId]: toUrlArray(prev[questionId]).filter((_, i) => i !== index),
    }));
  };

  const handleInputChange = (questionId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [questionId]: value }));
  };

  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    (questions || []).forEach((q: any) => {
      const cfg = getFieldConfig(q);

      const value = formData[q.id];
      const empty =
        !value ||
        (typeof value === "string" && value.trim() === "") ||
        (Array.isArray(value) && value.length === 0);

      /*
       * Only what the administrator marked mandatory.
       *
       * This step asked for everything. It never read `required`, so a question
       * turned optional in the admin panel went on blocking the seller anyway —
       * Intro text and USPs are stored `required: false` today and were still
       * demanded here. Every other question-driven step already checks this;
       * this was the one that did not, which is why Accounts behaved and Ad
       * Information did not.
       *
       * The photo and file fields used to be skipped outright, under a rule of
       * their own that no administrator could see or change. They are ordinary
       * questions now: optional unless someone says otherwise, and genuinely
       * required when they do.
       */
      if (isQuestionRequired(q) && empty) {
        errors.push(`${q.question} is required`);
        return;
      }

      // Whether or not it had to be filled in, what is in it has to make sense.
      if (!empty && cfg.kind === "price" && isNaN(Number(value))) {
        errors.push(`${q.question} must be a valid number`);
      }
    });
    return { isValid: errors.length === 0, errors };
  };

  const handleSubmit = () => {
    if (Object.values(uploadingFiles).some(Boolean)) {
      toast.error("Please wait for uploads to complete");
      return;
    }
    const { isValid, errors } = validateForm();
    if (!isValid) {
      toast.error(errors[0] || "Please fill in all required fields");
      return;
    }
    onNext(formData);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Ad Information</h1>
        <div className="text-muted-foreground">Loading questions...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Ad Information</h1>

      <div className="space-y-6">
        {questions && questions.length > 0 ? (
          questions.map((question: any) => {
            const cfg = getFieldConfig(question);
            const value = formData[question.id];
            const textValue = typeof value === "string" ? value : "";
            const isUploading = !!uploadingFiles[question.id];
            const mediaUrls = toUrlArray(value);

            return (
              <div key={question.id} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-foreground">{question.question}</label>
                  <QuestionHint question={question} />
                  {cfg.showCounter && cfg.maxLength && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {textValue.length}/{cfg.maxLength} characters
                    </span>
                  )}
                </div>

                {cfg.kind === "photo" && (
                  <div className="space-y-3">
                    {mediaUrls.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {mediaUrls.map((url, i) => (
                          <div key={i} className="relative w-28 h-28 rounded-xl overflow-hidden border border-border">
                            <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeMediaAt(question.id, i)}
                              className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1"
                              aria-label="Remove photo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="w-[220px] max-w-full">
                      {/* No `accept`. The dialog filtering a file out is what made a
                          refusal silent — the seller picked nothing and nothing was
                          said. The check in the handler refuses instead, out loud. */}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        id={`photo-${question.id}`}
                        disabled={isUploading}
                        onChange={(e) => {
                          handleMultiUpload(question.id, e.target.files, "listings/ad-photos");
                          e.target.value = "";
                        }}
                      />
                      <label
                        htmlFor={`photo-${question.id}`}
                        className="border-2 border-dashed border-border rounded-xl h-[130px] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-accent transition-colors bg-muted/30"
                      >
                        {isUploading ? (
                          <Loader2 className="w-8 h-8 text-accent animate-spin" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        )}
                        <span className="text-sm text-muted-foreground">{isUploading ? "Uploading..." : "Upload Photo"}</span>
                      </label>
                    </div>
                  </div>
                )}

                {cfg.kind === "file" && (
                  <div className="space-y-3">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      id={`file-${question.id}`}
                      disabled={isUploading}
                      onChange={(e) => {
                        handleMultiUpload(
                          question.id,
                          e.target.files,
                          "listings/ad-attachments",
                          asAllowedAttachment,
                        );
                        e.target.value = "";
                      }}
                    />
                    <label
                      htmlFor={`file-${question.id}`}
                      className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-accent transition-colors bg-muted/30 text-center"
                    >
                      {isUploading ? (
                        <Loader2 className="w-9 h-9 text-accent animate-spin" />
                      ) : (
                        <Upload className="w-9 h-9 text-muted-foreground" />
                      )}
                      <p className="text-sm text-muted-foreground">
                        {isUploading ? (
                          "Uploading..."
                        ) : (
                          <>
                            Upload attachments like p&amp;l sheet,
                            <br />
                            tax statements, etc.
                          </>
                        )}
                      </p>
                      {!isUploading && (
                        <span className="mt-2 inline-flex items-center px-5 py-1.5 rounded-md border border-border bg-background text-sm font-medium">
                          Select Files
                        </span>
                      )}
                    </label>
                    {mediaUrls.length > 0 && (
                      <div className="space-y-2">
                        {mediaUrls.map((url, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between border border-border rounded-lg p-2.5 bg-muted/30"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              {/* The seller's own file name. It read "File 1",
                                  "File 2" — which of three tax statements is
                                  the one being removed? */}
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-sm text-foreground hover:underline"
                                title={fileNameFromUrl(url)}
                              >
                                {fileNameFromUrl(url)}
                              </a>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeMediaAt(question.id, i)}
                              className="text-destructive p-1 flex-shrink-0"
                              aria-label="Remove file"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {cfg.kind === "price" && (
                  /* The currency the seller chose in Financials, not a hard
                     dollar sign — and the field leaves room for however wide
                     it is, "$" or "CHF". A price, so a decimal point is
                     allowed but nothing else: `type="number"` had let "e"
                     and a leading minus through. */
                  <PrefixedNumberInput
                    prefix={currencySymbol}
                    prefixClassName="text-muted-foreground"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={textValue}
                    onChange={(e) =>
                      handleInputChange(question.id, sanitizeNumberInput(e.target.value))
                    }
                    className="bg-muted/50"
                  />
                )}

                {cfg.kind === "title" && (
                  <Input
                    placeholder={hintPlaceholder(question, cfg.placeholder)}
                    value={textValue}
                    maxLength={cfg.maxLength}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    className="bg-muted/50"
                  />
                )}

                {cfg.kind === "textarea" && (
                  <Textarea
                    placeholder={hintPlaceholder(question, cfg.placeholder)}
                    value={textValue}
                    maxLength={cfg.maxLength}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    className="bg-muted/50 min-h-24"
                  />
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No ad information questions configured yet. Please contact admin to add questions.
          </div>
        )}

        <div className="flex gap-4 mt-8">
          <Button type="button" variant="outline" onClick={onBack}>
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
