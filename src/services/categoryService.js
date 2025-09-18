
import apiClient from "@/lib/apiClient";

export const uploadCategory = async (categoryData) => {
  console.log(categoryData);
  const { data } = await apiClient.post("/category", categoryData,{
     headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};
