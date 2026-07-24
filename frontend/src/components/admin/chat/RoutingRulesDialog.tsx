import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Settings2 } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useCreateRoutingRule } from "@/hooks/useRoutingRules";

export const RoutingRulesDialog = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [categoryId, setCategoryId] = useState<string>("");
  const [assignToRole, setAssignToRole] = useState<string>("");
  const [assignToUserId, setAssignToUserId] = useState<string>("");

  const { data: categories } = useCategories();
  const { data: teamMembers } = useTeamMembers();
  const createRule = useCreateRoutingRule();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createRule.mutateAsync({
      name,
      priority: parseInt(priority),
      is_active: isActive,
      category_id: categoryId || null,
      language: null,
      assign_to_role: assignToRole || null,
      assign_to_user_id: assignToUserId || null,
    });

    setOpen(false);
    setName("");
    setPriority("1");
    setIsActive(true);
    setCategoryId("");
    setAssignToRole("");
    setAssignToUserId("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Routing Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Create Routing Rule
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Rule Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tech Support to John"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              min="1"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Active</Label>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category (Optional)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Any category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any category</SelectItem>
                {Array.isArray(categories) && categories.map((cat: any) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignRole">Assign to Role (Optional)</Label>
            <Select value={assignToRole} onValueChange={setAssignToRole}>
              <SelectTrigger>
                <SelectValue placeholder="Any role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any role</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignUser">Assign to Specific Member (Optional)</Label>
            <Select value={assignToUserId} onValueChange={setAssignToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Any available member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any available member</SelectItem>
                {teamMembers?.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={createRule.isPending}>
            Create Rule
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};