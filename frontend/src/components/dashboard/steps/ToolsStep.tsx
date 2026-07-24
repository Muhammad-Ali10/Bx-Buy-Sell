import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTools } from "@/hooks/useTools";
import { resolveImageUrl } from "@/lib/imageUtils";

interface ToolsStepProps {
  formData?: any;
  onNext: (data: { tools: string[]; integrations?: string[] }) => void;
  onBack: () => void;
}

export const ToolsStep = ({ formData: parentFormData, onNext, onBack }: ToolsStepProps) => {
  const [selectedTools, setSelectedTools] = useState<string[]>(parentFormData?.tools || []);
  const { data: tools, isLoading } = useTools();

  useEffect(() => {
    const raw = parentFormData?.tools;
    if (!raw || !Array.isArray(raw) || raw.length === 0) {
      return;
    }
    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return;
    }
    const resolved = raw.map((t: string) => {
      const s = String(t);
      const byId = tools.find((x) => x.id === s);
      if (byId) return byId.id;
      const byName = tools.find(
        (x) => (x.name || "").trim().toLowerCase() === s.trim().toLowerCase(),
      );
      return byName?.id || s;
    });
    setSelectedTools(resolved);
  }, [parentFormData?.tools, tools]);

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  const handleContinue = () => {
    onNext({ tools: selectedTools });
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl w-full">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Tools you use</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-6 sm:mt-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-40 sm:h-48 rounded-xl sm:rounded-2xl border-2 border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl w-full">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Tools you use</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-6 sm:mt-8 mb-6 sm:mb-8">
        {tools && Array.isArray(tools) && tools.map((tool) => {
          const isSelected = selectedTools.includes(tool.id);

          return (
            <button
              key={tool.id}
              onClick={() => toggleTool(tool.id)}
              className={`flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all hover:scale-105 ${
                isSelected 
                  ? "border-accent bg-accent/5" 
                  : "border-border bg-card hover:border-accent/50"
              }`}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                <img src={resolveImageUrl(tool.image_path)} alt={tool.name} className="w-full h-full object-contain" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-center">{tool.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Button onClick={onBack} variant="outline" className="w-full sm:w-auto">
          Back
        </Button>
        <Button onClick={handleContinue} className="w-full sm:w-auto">
          Continue
        </Button>
      </div>
    </div>
  );
};
