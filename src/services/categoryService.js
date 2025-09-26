
import apiClient from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

export const uploadCategory = async (categoryData) => {
  console.log(categoryData);
  const { data } = await apiClient.post("/category", categoryData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};


export const getCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await apiClient.get("/category");
      return data?.data
    },
  });

};

