import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDeleteAccount } from "@/hooks/useDeleteAccount";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string | null;
  accountPlatform: string;
}

export const DeleteAccountDialog = ({ 
  open, 
  onOpenChange, 
  accountId, 
  accountPlatform 
}: DeleteAccountDialogProps) => {
  const deleteAccount = useDeleteAccount();

  const handleDelete = () => {
    if (!accountId) return;

    deleteAccount.mutate(accountId, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Delete Social Account</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            Are you sure you want to delete the {accountPlatform} account? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-transparent border-gray-600 text-white hover:bg-[#2a2a2a]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteAccount.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {deleteAccount.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
