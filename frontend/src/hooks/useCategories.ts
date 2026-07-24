import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const useCategories = (options?: { nocache?: boolean }) => {
  return useQuery({
    queryKey: ["categories", options?.nocache ? "nocache" : "cached"],
    queryFn: async () => {
      const response = await apiClient.getCategories(options?.nocache ? "true" : undefined);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch categories");
      }
      
      // Ensure we return an array
      const categories = Array.isArray(response.data) ? response.data : [];
      // Filter out only truly invalid categories (no name at all, or explicitly invalid names)
      const validCategories = categories.filter((cat: any) => {
        if (!cat) {
          return false;
        }
        if (!cat.name) {
          return false;
        }
        const name = String(cat.name).trim();
        if (name === '') {
          return false;
        }
        // Only filter out explicitly invalid test data - be very conservative
        // Don't filter out categories that might be valid (like "undefine new" which is different from "undefined")
        const lowerName = name.toLowerCase();
        if (lowerName === 'undefined' || lowerName === 'string' || lowerName === 'null') {
          return false;
        }
        return true;
      });
      
      // Deduplicate by name (case-insensitive) - keep the first occurrence (most recent due to backend ordering)
      const seen = new Map<string, any>();
      const uniqueCategories: any[] = [];
      for (const category of validCategories) {
        const nameKey = String(category.name).trim().toLowerCase();
        
        if (!seen.has(nameKey)) {
          seen.set(nameKey, category);
          uniqueCategories.push(category);
        } else {
        }
      }
      return uniqueCategories;
    },
  });
};
