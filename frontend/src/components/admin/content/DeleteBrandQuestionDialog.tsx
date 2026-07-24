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
import { useDeleteBrandQuestion } from "@/hooks/useDeleteBrandQuestion";

interface DeleteBrandQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string | null;
  questionText: string;
}

export const DeleteBrandQuestionDialog = ({
  open,
  onOpenChange,
  questionId,
  questionText,
}: DeleteBrandQuestionDialogProps) => {
  const deleteQuestion = useDeleteBrandQuestion();

  const handleDelete = () => {
    if (questionId) {
      deleteQuestion.mutate(questionId, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-background border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Delete Question</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Are you sure you want to delete "{questionText}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border text-foreground hover:bg-accent">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteQuestion.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteQuestion.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
