import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDeleteTool } from "@/hooks/useDeleteTool";

interface DeleteToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolId: string | null;
  toolName: string;
}

export const DeleteToolDialog = ({ open, onOpenChange, toolId, toolName }: DeleteToolDialogProps) => {
  const { mutate: deleteTool, isPending } = useDeleteTool();

  const handleDelete = () => {
    if (!toolId) return;
    
    deleteTool(toolId, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Tool</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{toolName}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
