import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteFinancialQuestion } from "@/hooks/useDeleteFinancialQuestion";

interface DeleteFinancialQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string | null;
  questionText: string;
}

export const DeleteFinancialQuestionDialog = ({ 
  open, 
  onOpenChange, 
  questionId, 
  questionText 
}: DeleteFinancialQuestionDialogProps) => {
  const deleteQuestion = useDeleteFinancialQuestion();

  const handleDelete = () => {
    if (!questionId) return;

    deleteQuestion.mutate(questionId, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Delete Financial Question</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            Are you sure you want to delete "{questionText}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-[#3a3a3a] text-white hover:bg-[#2a2a2a]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteQuestion.isPending}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            {deleteQuestion.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

