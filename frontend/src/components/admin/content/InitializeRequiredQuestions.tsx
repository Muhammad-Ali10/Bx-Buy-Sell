import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useBrandQuestions } from "@/hooks/useBrandQuestions";
import { useStatisticQuestions } from "@/hooks/useStatisticQuestions";
import { useProductQuestions } from "@/hooks/useProductQuestions";
import { useManagementQuestions } from "@/hooks/useManagementQuestions";
import { useAdInformationQuestions } from "@/hooks/useAdInformationQuestions";
import { useHandoverQuestions } from "@/hooks/useHandoverQuestions";
import { useAccounts } from "@/hooks/useAccounts";

interface RequiredQuestion {
  question: string;
  answer_type: string;
  answer_for: string;
  options?: string[];
}

const REQUIRED_QUESTIONS: RequiredQuestion[] = [
  // Brand Questions
  { question: "Brand Name", answer_type: "TEXT", answer_for: "BRAND" },
  { question: "Domains", answer_type: "TEXT", answer_for: "BRAND" },
  { question: "Starting Date", answer_type: "DATE", answer_for: "BRAND" },
  { question: "Business Location", answer_type: "TEXT", answer_for: "BRAND" },
  
  // Statistics Questions
  { question: "Conversiton Rate", answer_type: "NUMBER", answer_for: "STATISTIC" },
  
  // Product Questions
  { question: "Selling Model", answer_type: "NUMBER", answer_for: "PRODUCT" },
  { question: "How many different Products do you have?", answer_type: "NUMBER", answer_for: "PRODUCT" },
  
  // Management Questions
  { question: "How many freelancers work for you?", answer_type: "NUMBER", answer_for: "MANAGEMENT" },
  
  // Ad Information Questions
  { question: "Listing Price", answer_type: "NUMBER", answer_for: "ADVERTISMENT" },
  { question: "Title", answer_type: "TEXT", answer_for: "ADVERTISMENT" },
  { question: "intro text", answer_type: "TEXT", answer_for: "ADVERTISMENT" },
  { question: "USPs", answer_type: "TEXT", answer_for: "ADVERTISMENT" },
  { question: "Description", answer_type: "TEXT", answer_for: "ADVERTISMENT" },
  
  // Handover Questions
  { question: "How many freelancers work for you?", answer_type: "NUMBER", answer_for: "HANDOVER" },
];

export const InitializeRequiredQuestions = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const queryClient = useQueryClient();
  
  const { data: brandQuestions = [] } = useBrandQuestions();
  const { data: statisticQuestions = [] } = useStatisticQuestions();
  const { data: productQuestions = [] } = useProductQuestions();
  const { data: managementQuestions = [] } = useManagementQuestions();
  const { data: adQuestions = [] } = useAdInformationQuestions();
  const { data: handoverQuestions = [] } = useHandoverQuestions();
  const { data: socialAccounts = [] } = useAccounts();

  const checkQuestionExists = (questionText: string, answerFor: string, existingQuestions: any[]): boolean => {
    return existingQuestions.some(
      (q: any) => 
        q.question?.toLowerCase().trim() === questionText.toLowerCase().trim() &&
        q.answer_for === answerFor
    );
  };

  const getQuestionsByType = (answerFor: string) => {
    switch (answerFor) {
      case "BRAND":
        return brandQuestions;
      case "STATISTIC":
        return statisticQuestions;
      case "PRODUCT":
        return productQuestions;
      case "MANAGEMENT":
        return managementQuestions;
      case "ADVERTISMENT":
        return adQuestions;
      case "HANDOVER":
        return handoverQuestions;
      default:
        return [];
    }
  };

  const createSocialAccountQuestions = async (): Promise<number> => {
    let created = 0;
    
    // Get existing social questions
    let existingSocialQuestions: any[] = [];
    try {
      const response = await apiClient.getAdminQuestions();
      if (response.success && Array.isArray(response.data)) {
        existingSocialQuestions = response.data.filter((q: any) => q.answer_for === "SOCIAL");
      }
    } catch (error) {
      console.error("Error fetching existing social questions:", error);
    }

    for (const account of socialAccounts) {
      const platformName = account.platform || account.social_account_option || "Social Media";
      const questionText = `Enter ${platformName} URL`;
      const exists = existingSocialQuestions.some(
        (q: any) => q.question?.toLowerCase().includes(platformName.toLowerCase())
      );

      if (!exists) {
        try {
          const response = await apiClient.createAdminQuestion({
            question: questionText,
            answer_type: "TEXT",
            answer_for: "SOCIAL",
          });

          if (response.success) {
            created++;
            console.log(`✅ Created social account question: ${questionText}`);
          } else {
            console.error(`❌ Failed to create social question: ${response.error}`);
          }
        } catch (error) {
          console.error(`❌ Error creating social question for ${platformName}:`, error);
        }
      }
    }

    return created;
  };

  const handleInitialize = async () => {
    setIsInitializing(true);
    let created = 0;
    let skipped = 0;
    let errors = 0;

    // First, create social account questions
    setProgress({ current: 0, total: REQUIRED_QUESTIONS.length + socialAccounts.length });
    const socialCreated = await createSocialAccountQuestions();
    created += socialCreated;

    // Then create all other required questions
    for (let i = 0; i < REQUIRED_QUESTIONS.length; i++) {
      const reqQuestion = REQUIRED_QUESTIONS[i];
      setProgress({ current: i + 1, total: REQUIRED_QUESTIONS.length + socialAccounts.length });

      const existingQuestions = getQuestionsByType(reqQuestion.answer_for);
      const exists = checkQuestionExists(reqQuestion.question, reqQuestion.answer_for, existingQuestions);

      if (exists) {
        skipped++;
        console.log(`⏭️ Skipping existing question: ${reqQuestion.question}`);
        continue;
      }

      try {
        // Map answer types
        const answerTypeMap: Record<string, string> = {
          'YESNO': 'BOOLEAN',
          'TEXTAREA': 'TEXT',
          'PHOTO_UPLOAD': 'PHOTO',
          'FILE_UPLOAD': 'FILE',
        };
        const mappedAnswerType = answerTypeMap[reqQuestion.answer_type] || reqQuestion.answer_type;

        const payload: any = {
          question: reqQuestion.question,
          answer_type: mappedAnswerType,
          answer_for: reqQuestion.answer_for,
        };

        if (reqQuestion.options && reqQuestion.options.length > 0) {
          payload.options = reqQuestion.options;
        }

        const response = await apiClient.createAdminQuestion(payload);

        if (response.success) {
          created++;
          console.log(`✅ Created question: ${reqQuestion.question}`);
        } else {
          errors++;
          console.error(`❌ Failed to create question: ${reqQuestion.question}`, response.error);
        }
      } catch (error: any) {
        errors++;
        console.error(`❌ Error creating question: ${reqQuestion.question}`, error);
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setIsInitializing(false);
    setProgress({ current: 0, total: 0 });

    if (created > 0) {
      toast.success(`✅ Successfully created ${created} question(s)! ${skipped > 0 ? `${skipped} already existed.` : ''} ${errors > 0 ? `${errors} failed.` : ''}`);
    } else if (skipped > 0) {
      toast.info(`ℹ️ All required questions already exist! (${skipped} found)`);
    } else if (errors > 0) {
      toast.error(`❌ Failed to create ${errors} question(s). Please check the console for details.`);
    } else {
      toast.info("No questions to create.");
    }

    // Invalidate all question queries to refresh the data
    queryClient.invalidateQueries({ queryKey: ["brand-questions"] });
    queryClient.invalidateQueries({ queryKey: ["statistic-questions"] });
    queryClient.invalidateQueries({ queryKey: ["product-questions"] });
    queryClient.invalidateQueries({ queryKey: ["management-questions"] });
    queryClient.invalidateQueries({ queryKey: ["ad-information-questions"] });
    queryClient.invalidateQueries({ queryKey: ["handover-questions"] });
    
    // Refresh the page after a short delay to show new questions
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Initialize Required Questions</h3>
          <p className="text-sm text-muted-foreground">
            This will automatically add all required questions for listing creation. 
            Questions that already exist will be skipped.
          </p>
        </div>
        <Button
          onClick={handleInitialize}
          disabled={isInitializing}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {isInitializing 
            ? `Initializing... (${progress.current}/${progress.total})` 
            : "Initialize All Questions"}
        </Button>
      </div>
      
      {isInitializing && (
        <div className="mt-4">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground">
        <p><strong>Will create:</strong></p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Brand Questions: Brand Name, Domains, Starting Date, Business Location</li>
          <li>Statistics Questions: Conversiton Rate</li>
          <li>Product Questions: Selling Model, Product Count</li>
          <li>Management Questions: Freelancer Count</li>
          <li>Ad Information Questions: Listing Price, Title, Intro Text, USPs, Description</li>
          <li>Handover Questions: Freelancer Count</li>
          <li>Social Account Questions: One per enabled platform</li>
        </ul>
      </div>
    </div>
  );
};

