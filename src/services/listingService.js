import apiClient from "@/lib/apiClient";

export const getListing = async () => {
  const { data } = await apiClient.get("/listing");
console.log(data);
  return data?.data;
};
