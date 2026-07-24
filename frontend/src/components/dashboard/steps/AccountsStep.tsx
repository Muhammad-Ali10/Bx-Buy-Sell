import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccounts } from "@/hooks/useAccounts";
import { useAccountQuestions } from "@/hooks/useAccountQuestions";
import { Facebook, Instagram, Twitter, Music, Pin, Linkedin, Youtube } from "lucide-react";
import { toast } from "sonner";

interface AccountsStepProps {
  formData?: any;
  onNext: (data: any) => void;
  onBack: () => void;
}

export const AccountsStep = ({ formData: parentFormData, onNext, onBack }: AccountsStepProps) => {
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const { data: questions = [], isLoading: questionsLoading } = useAccountQuestions();
  const [formData, setFormData] = useState<Record<string, { url: string; followers: string }>>(() => {
    if (parentFormData?.socialAccounts) {
      const initial: Record<string, { url: string; followers: string }> = {};
      Object.keys(parentFormData.socialAccounts).forEach((platform) => {
        initial[platform] = {
          url: parentFormData.socialAccounts[platform].url || "",
          followers: String(parentFormData.socialAccounts[platform].followers || ""),
        };
      });
      return initial;
    }
    return {};
  });
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, any>>(() => {
    if (parentFormData?.socialAccountQuestions) {
      return parentFormData.socialAccountQuestions;
    }
    return {};
  });

  useEffect(() => {
    if (parentFormData?.socialAccounts) {
      const updated: Record<string, { url: string; followers: string }> = {};
      Object.keys(parentFormData.socialAccounts).forEach((platform) => {
        updated[platform] = {
          url: parentFormData.socialAccounts[platform].url || "",
          followers: String(parentFormData.socialAccounts[platform].followers || ""),
        };
      });
      setFormData(updated);
    }
    if (parentFormData?.socialAccountQuestions) {
      setQuestionAnswers(parentFormData.socialAccountQuestions);
    }
  }, [parentFormData]);

  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Social accounts are optional, but validate format if provided
    Object.keys(formData).forEach((platform) => {
      const accountData = formData[platform];
      
      // If URL is provided, validate format
      if (accountData.url && accountData.url.trim() !== '') {
        // Basic URL validation
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        const usernamePattern = /^@?[\w.]+$/;
        
        if (!urlPattern.test(accountData.url) && !usernamePattern.test(accountData.url)) {
          errors.push(`${platform} URL format is invalid. Use a valid URL or username`);
        }
      }
      
      // If followers is provided, validate it's a number
      if (accountData.followers && accountData.followers.trim() !== '') {
        const followersNum = parseInt(accountData.followers);
        if (isNaN(followersNum) || followersNum < 0) {
          errors.push(`${platform} followers must be a valid positive number`);
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
      }
      return;
    }
    
    // Format data for submission
    const accountsData: Record<string, { url: string; followers: number }> = {};
    Object.keys(formData).forEach((platform) => {
      accountsData[platform] = {
        url: formData[platform].url || "",
        followers: parseInt(formData[platform].followers) || 0,
      };
    });
    onNext({ 
      socialAccounts: accountsData,
      socialAccountQuestions: questionAnswers 
    });
  };

  const renderQuestionField = (question: any) => {
    const value = questionAnswers[question.id] || "";
    
    switch (question.answer_type) {
      case "TEXT":
        return (
          <Input
            value={value}
            onChange={(e) => setQuestionAnswers({ ...questionAnswers, [question.id]: e.target.value })}
            placeholder="Enter your answer"
            className="bg-muted/50"
          />
        );
      
      case "TEXTAREA":
        return (
          <Textarea
            value={value}
            onChange={(e) => setQuestionAnswers({ ...questionAnswers, [question.id]: e.target.value })}
            placeholder="Enter your answer"
            className="bg-muted/50 min-h-[100px]"
          />
        );
      
      case "NUMBER":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setQuestionAnswers({ ...questionAnswers, [question.id]: e.target.value })}
            placeholder="Enter a number"
            className="bg-muted/50"
          />
        );
      
      case "DATE":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setQuestionAnswers({ ...questionAnswers, [question.id]: e.target.value })}
            className="bg-muted/50"
          />
        );
      
      case "YESNO":
      case "BOOLEAN":
        return (
          <Select value={value} onValueChange={(val) => setQuestionAnswers({ ...questionAnswers, [question.id]: val })}>
            <SelectTrigger className="bg-muted/50">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        );
      
      case "SELECT":
        return (
          <Select value={value} onValueChange={(val) => setQuestionAnswers({ ...questionAnswers, [question.id]: val })}>
            <SelectTrigger className="bg-muted/50">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.option && Array.isArray(question.option) && question.option.length > 0 ? (
                question.option.map((opt: string, idx: number) => (
                  <SelectItem key={idx} value={opt}>
                    {opt}
                  </SelectItem>
                ))
              ) : (
                <>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </>
              )}
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
                    setQuestionAnswers({ ...questionAnswers, [question.id]: next });
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
            onChange={(e) => setQuestionAnswers({ ...questionAnswers, [question.id]: e.target.value })}
            placeholder="Enter your answer"
            className="bg-muted/50"
          />
        );
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "facebook": return <Facebook className="w-5 h-5" />;
      case "instagram": return <Instagram className="w-5 h-5" />;
      case "twitter": return <Twitter className="w-5 h-5" />;
      case "tiktok": return <Music className="w-5 h-5" />;
      case "pinterest": return <Pin className="w-5 h-5" />;
      case "linkedin": return <Linkedin className="w-5 h-5" />;
      case "youtube": return <Youtube className="w-5 h-5" />;
      default: return <span className="text-xl">🌐</span>;
    }
  };

  const handleUrlChange = (platform: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        url: value
      }
    }));
  };

  const handleFollowersChange = (platform: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        followers: value
      }
    }));
  };

  if (accountsLoading || questionsLoading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Social Media Accounts</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Social Media Accounts</h1>
{/* 
      <div className="bg-card rounded-xl p-8 border border-border">
        {accounts.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg mb-2">No social media platforms enabled.</p>
            <p className="text-sm">The administrator needs to enable social media platforms first.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {accounts.map((account: any) => (
              <div key={account.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    {getPlatformIcon(account.platform)}
                  </div>
                  <Label className="text-base font-semibold capitalize">{account.platform}</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Account Link</Label>
                    <Input
                      value={formData[account.platform]?.url || ""}
                      onChange={(e) => handleUrlChange(account.platform, e.target.value)}
                      placeholder="facebook.com/yourname or @yourname"
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Followers</Label>
                    <Input
                      type="number"
                      value={formData[account.platform]?.followers || ""}
                      onChange={(e) => handleFollowersChange(account.platform, e.target.value)}
                      placeholder="1000"
                      className="bg-muted/50"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div> */}

      {/* Account Questions Section */}
      {questions.length > 0 && (
        <div className="bg-card rounded-xl p-8 border border-border mt-6">
          <h2 className="text-2xl font-bold mb-6">Account Questions</h2>
          <div className="space-y-6">
            {questions.map((question: any) => (
              <div key={question.id} className="space-y-2">
                <Label className="text-base font-semibold">
                  {question.question}
                </Label>
                {renderQuestionField(question)}
              </div>
            ))}
          </div>
        </div>
      )}

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
