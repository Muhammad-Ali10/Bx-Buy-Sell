import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDeleteAdInformationQuestion } from "@/hooks/useDeleteAdInformationQuestion";

interface DeleteAdInformationQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string | null;
  questionText: string;
}

export const DeleteAdInformationQuestionDialog = ({ 
  open, 
  onOpenChange, 
  questionId, 
  questionText 
}: DeleteAdInformationQuestionDialogProps) => {
  const deleteQuestion = useDeleteAdInformationQuestion();

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
          <AlertDialogTitle className="text-white">Delete Ad Information Question</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            Are you sure you want to delete the question "{questionText}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-transparent border-gray-600 text-white hover:bg-[#2a2a2a]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteQuestion.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {deleteQuestion.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
