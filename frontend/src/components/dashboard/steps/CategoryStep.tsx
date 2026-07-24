import { useState, useEffect } from "react";
import { ShoppingBag, Code, Handshake, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { resolveImageUrl } from "@/lib/imageUtils";

interface CategoryStepProps {
  formData?: any;
  onNext: (data: { category: string }) => void;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  bg_color?: string;
  icon_color?: string;
  image_path?: string;
}

const iconMap: Record<string, any> = {
  "shopping-bag": ShoppingBag,
  "code": Code,
  "handshake": Handshake,
  "layout-grid": LayoutGrid,
};

export const CategoryStep = ({ formData, onNext }: CategoryStepProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(formData?.category || "");
  
  // Use the same hook as admin dashboard for consistent category display
  const { data: categories = [], isLoading: loading } = useCategories({ nocache: true });

  useEffect(() => {
    const raw = formData?.category;
    if (raw === undefined || raw === null || raw === "") {
      return;
    }
    if (!categories.length) {
      return;
    }
    const rawStr = String(raw);
    const byId = categories.find((c) => c.id === rawStr);
    if (byId) {
      setSelectedCategory(byId.id);
      return;
    }
    const byName = categories.find(
      (c) => (c.name || "").trim().toLowerCase() === rawStr.trim().toLowerCase(),
    );
    if (byName) {
      setSelectedCategory(byName.id);
      return;
    }
    setSelectedCategory(rawStr);
  }, [formData?.category, categories]);

  const handleCategorySelect = (categoryId: string) => {
    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }
    setSelectedCategory(categoryId);
    setTimeout(() => {
      onNext({ category: categoryId });
    }, 300);
  };

  const handleContinue = () => {
    if (!selectedCategory) {
      toast.error("Please select a category to continue");
      return;
    }
    onNext({ category: selectedCategory });
  };

  if (loading) {
    return (
      <div className="max-w-5xl w-full">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Select Category</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-6 sm:mt-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 sm:h-48 rounded-xl sm:rounded-2xl border-2 border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
      <div className="max-w-5xl w-full">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Select Category</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-6 sm:mt-8">
        {categories.map((category) => {
          const Icon = category.icon ? iconMap[category.icon] || LayoutGrid : LayoutGrid;
          const isSelected = selectedCategory === category.id;
          const bgColor = category.bg_color || "bg-blue-100";
          const iconColor = category.icon_color || "text-blue-600";
          
          return (
            <button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              className={`flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl border-2 transition-all hover:scale-105 ${
                isSelected 
                  ? "border-accent bg-accent/5" 
                  : "border-border bg-card hover:border-accent/50"
              }`}
            >
              {category.image_path ? (
                <div 
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                  style={{ 
                    backgroundColor: 'rgba(156, 163, 175, 0.15)',
                    borderRadius: '16.78px'
                  }}
                >
                  <img 
                    src={resolveImageUrl(category.image_path)} 
                    alt={category.name}
                    className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-full"
                  />
                </div>
              ) : (
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${bgColor} flex items-center justify-center`}>
                  <Icon className={`w-8 h-8 sm:w-10 sm:h-10 ${iconColor}`} />
                </div>
              )}
              <span className="text-sm sm:text-base md:text-lg font-semibold text-center">{category.name}</span>
            </button>
          );
        })}
      </div>

      {categories.length > 0 && (
        <div className="flex justify-end mt-6 sm:mt-8">
          <Button 
            onClick={handleContinue}
            disabled={!selectedCategory}
            className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto px-8 sm:px-16"
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
};
