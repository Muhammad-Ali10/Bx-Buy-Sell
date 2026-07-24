import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Paperclip, ImageIcon, Loader2 } from "lucide-react";
import { useAdInformationQuestions } from "@/hooks/useAdInformationQuestions";
import { toast } from "sonner";
import { uploadToCloudinary } from "@/lib/cloudinary";

interface AdInformationsStepProps {
  formData?: any;
  onNext: (data: any) => void;
  onBack: () => void;
}

export const AdInformationsStep = ({ formData: parentFormData, onNext, onBack }: AdInformationsStepProps) => {
  const { data: questions, isLoading } = useAdInformationQuestions();
  const [formData, setFormData] = useState<Record<string, any>>(parentFormData || {});
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (parentFormData) {
      setFormData(parentFormData);
      // Restore photo preview if exists (could be URL or base64)
      const photoData = Object.values(parentFormData).find((val: any) => 
        typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('http'))
      );
      if (photoData) {
        setPhotoPreview(photoData as string);
      }
    }
  }, [parentFormData]);

  const handlePhotoUpload = async (questionId: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo must be less than 10MB");
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [questionId]: true }));
    
    try {
      const result = await uploadToCloudinary(file, 'listings/ad-photos');
      
      if (result.success && result.url) {
        setPhotoPreview(result.url);
        setFormData(prev => ({ ...prev, [questionId]: result.url }));
        console.log('✅ Photo uploaded successfully:', result.url);
        toast.success("Photo uploaded successfully! ✅");
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
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name} is too large. Maximum size is 10MB`);
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [questionId]: true }));
    
    try {
      const result = await uploadToCloudinary(file, 'listings/ad-attachments');
      
      if (result.success && result.url) {
        const currentFiles = formData[questionId] || [];
        const updatedFiles = Array.isArray(currentFiles) ? [...currentFiles, result.url] : [result.url];
        setFormData(prev => ({ ...prev, [questionId]: updatedFiles }));
        console.log('File uploaded successfully:', result.url);
        toast.success(`File "${file.name}" uploaded successfully! ✅`);
      } else {
        console.error('File upload failed:', result.error);
        toast.error(result.error || "Failed to upload file");
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error("Failed to upload file");
    } finally {
      setUploadingFiles(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const removePhoto = (questionId: string) => {
    setPhotoPreview("");
    setFormData(prev => ({ ...prev, [questionId]: "" }));
  };

  const removeAttachment = (questionId: string, index: number) => {
    const currentFiles = formData[questionId] || [];
    const updatedFiles = Array.isArray(currentFiles) 
      ? currentFiles.filter((_: any, i: number) => i !== index)
      : [];
    setFormData(prev => ({ ...prev, [questionId]: updatedFiles }));
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
      if (!value || 
          (typeof value === 'string' && value.trim() === '') || 
          (Array.isArray(value) && value.length === 0)) {
        errors.push(`${question.question} is required`);
      }
      
      // Additional validations based on answer type
      if (question.answer_type === 'NUMBER' && value && isNaN(Number(value))) {
        errors.push(`${question.question} must be a valid number`);
      }
      
      if (question.answer_type === 'PHOTO' || question.answer_type === 'PHOTO_UPLOAD') {
        if (!value || value.trim() === '') {
          errors.push(`${question.question} requires a photo upload`);
        }
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleSubmit = () => {
    // Check if any uploads are in progress
    const isUploading = Object.values(uploadingFiles).some(uploading => uploading);
    if (isUploading) {
      toast.error("Please wait for file uploads to complete");
      return;
    }

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
          questions.map((question: any) => (
            <div key={question.id} className="space-y-2">
              <label className="text-sm font-medium">
                {question.question}
              </label>
              
              {(question.answer_type === "PHOTO" || question.answer_type === "PHOTO_UPLOAD") && (
                <div>
                  {(() => {
                    const isUploading = uploadingFiles[question.id];
                    const photoUrl = formData[question.id] || photoPreview;
                    
                    if (!photoUrl) {
                      return (
                        <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center hover:border-accent/50 transition-colors cursor-pointer bg-muted/30">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handlePhotoUpload(question.id, file);
                              }
                            }}
                            className="hidden"
                            id={`photo-${question.id}`}
                            disabled={isUploading}
                          />
                          <label htmlFor={`photo-${question.id}`} className="cursor-pointer text-center w-full">
                            {isUploading ? (
                              <>
                                <Loader2 className="w-12 h-12 text-accent mb-3 mx-auto animate-spin" />
                                <p className="text-sm text-muted-foreground">Uploading...</p>
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-12 h-12 text-muted-foreground mb-3 mx-auto" />
                                <p className="text-sm text-muted-foreground">Click to upload photo</p>
                                <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                              </>
                            )}
                          </label>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="relative inline-block w-full">
                        <div className="relative border-2 border-accent rounded-xl overflow-hidden bg-muted/20 p-2">
                          <img
                            src={photoUrl}
                            alt="Uploaded photo preview"
                            className="w-full h-64 object-contain rounded-lg"
                            onError={(e) => {
                              console.error('Error loading image:', photoUrl);
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EImage not found%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          {isUploading && (
                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                                <p className="text-sm text-muted-foreground">Uploading...</p>
                              </div>
                            </div>
                          )}
                          <div className="absolute top-4 right-4 flex items-center gap-2">
                            <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Uploaded
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removePhoto(question.id)}
                              disabled={isUploading}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {(question.answer_type === "FILE" || question.answer_type === "FILE_UPLOAD") && (
                <div className="space-y-4">
                  {(() => {
                    const isUploading = uploadingFiles[question.id];
                    const fileUrls = Array.isArray(formData[question.id]) ? formData[question.id] : (formData[question.id] ? [formData[question.id]] : []);
                    
                    return (
                      <>
                        <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center hover:border-accent/50 transition-colors cursor-pointer bg-muted/30">
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(question.id, file);
                              }
                            }}
                            className="hidden"
                            id={`file-${question.id}`}
                            disabled={isUploading}
                          />
                          <label htmlFor={`file-${question.id}`} className="cursor-pointer text-center w-full">
                            {isUploading ? (
                              <>
                                <Loader2 className="w-12 h-12 text-accent mb-3 mx-auto animate-spin" />
                                <p className="text-sm text-muted-foreground">Uploading...</p>
                              </>
                            ) : (
                              <>
                                <Upload className="w-12 h-12 text-muted-foreground mb-3 mx-auto" />
                                <p className="text-sm text-muted-foreground mb-1">Upload attachments</p>
                                <p className="text-xs text-muted-foreground mb-2">PDF, DOC, etc. up to 10MB</p>
                              </>
                            )}
                          </label>
                        </div>
                        {fileUrls.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-2">
                              ✅ {fileUrls.length} file{fileUrls.length > 1 ? 's' : ''} uploaded successfully
                            </p>
                            {fileUrls.map((url: string, index: number) => (
                              <div key={index} className="flex items-center justify-between border-2 border-green-500/50 rounded-lg p-3 bg-muted/30">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="flex-shrink-0 bg-green-500 text-white rounded-full p-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                  <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-accent hover:underline truncate flex-1"
                                    title={url}
                                  >
                                    File {index + 1} - Click to view
                                  </a>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                                  onClick={() => removeAttachment(question.id, index)}
                                  disabled={isUploading}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              
              {question.answer_type === "NUMBER" && (
                <Input
                  type="number"
                  placeholder="Enter number"
                  value={formData[question.id] || ""}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="bg-muted/50"
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
            </div>
          ))
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
