import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeletePlan } from "@/hooks/useDeletePlan";

interface DeletePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string | null;
  planTitle: string;
}

export const DeletePlanDialog = ({ open, onOpenChange, planId, planTitle }: DeletePlanDialogProps) => {
  const deletePlan = useDeletePlan();

  const handleDelete = () => {
    if (!planId) return;

    deletePlan.mutate(planId, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-none text-black max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Delete Package</DialogTitle>
          <DialogDescription className="text-gray-600">
            Are you sure you want to delete "{planTitle}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-2 border-black text-black hover:bg-gray-50 rounded-full px-8 h-10 font-semibold"
            disabled={deletePlan.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            variant="destructive"
            className="bg-destructive hover:bg-destructive/90 text-white rounded-full px-8 h-10 font-semibold"
            disabled={deletePlan.isPending}
          >
            {deletePlan.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};


