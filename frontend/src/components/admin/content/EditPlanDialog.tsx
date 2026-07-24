import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { useUpdatePlan } from "@/hooks/useUpdatePlan";
import { toast } from "sonner";

interface EditPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: { id: string; title: string; description: string; duration_type: string; type: string; price: string; feature: string[] } | null;
}

export const EditPlanDialog = ({ open, onOpenChange, plan }: EditPlanDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [type, setType] = useState("monthly");
  const [price, setPrice] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");
  const updatePlan = useUpdatePlan();

  useEffect(() => {
    if (plan) {
      setTitle(plan.title);
      setDescription(plan.description);
      setDuration(plan.duration_type);
      setType(plan.type);
      setPrice(plan.price);
      setFeatures(plan.feature || []);
    }
  }, [plan]);

  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature("");
    }
  };

  const handleRemoveFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!plan) return;

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedDuration = duration.trim();
    const trimmedPrice = price.trim();

    if (!trimmedTitle || trimmedTitle.length < 4) {
      toast.error("Title must be at least 4 characters");
      return;
    }
    if (!trimmedDescription || trimmedDescription.length < 4) {
      toast.error("Description must be at least 4 characters");
      return;
    }
    if (!trimmedDuration || trimmedDuration.length < 4) {
      toast.error("Duration must be at least 4 characters");
      return;
    }
    if (!trimmedPrice || trimmedPrice.length < 1) {
      toast.error("Price is required");
      return;
    }

    updatePlan.mutate(
      {
        id: plan.id,
        title: trimmedTitle,
        description: trimmedDescription,
        duration: trimmedDuration,
        type: type,
        price: trimmedPrice,
        features: features.length > 0 ? features : undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (error: any) => {
          console.error("Update plan error:", error);
        },
      }
    );
  };

  const handleCancel = () => {
    if (plan) {
      setTitle(plan.title);
      setDescription(plan.description);
      setDuration(plan.duration_type);
      setType(plan.type);
      setPrice(plan.price);
      setFeatures(plan.feature || []);
    }
    setNewFeature("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-none text-black max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold">Edit Package</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium text-black">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Basic Plan"
              className="bg-gray-50 border-gray-200 text-black"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-black">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Package description"
              className="bg-gray-50 border-gray-200 text-black min-h-[100px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-sm font-medium text-black">Duration</Label>
              <Input
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., monthly, yearly"
                className="bg-gray-50 border-gray-200 text-black"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm font-medium text-black">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type" className="bg-gray-50 border-gray-200 text-black">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price" className="text-sm font-medium text-black">Price</Label>
            <Input
              id="price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g., 0$/limited, 49$/monthly"
              className="bg-gray-50 border-gray-200 text-black"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-black">Features</Label>
            <div className="flex gap-2">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder="Add a feature"
                className="bg-gray-50 border-gray-200 text-black"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddFeature();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAddFeature}
                className="bg-accent hover:bg-accent/90 text-black"
              >
                Add
              </Button>
            </div>
            {features.length > 0 && (
              <div className="space-y-2 mt-2">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm">{feature}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFeature(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-center gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="border-2 border-black text-black hover:bg-gray-50 rounded-full px-12 h-12 font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updatePlan.isPending || !title.trim() || !description.trim() || !duration.trim() || !price.trim()}
            className="bg-[#a3e635] text-black hover:bg-[#84cc16] rounded-full px-12 h-12 font-semibold"
          >
            {updatePlan.isPending ? "Updating..." : "Update Package"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

