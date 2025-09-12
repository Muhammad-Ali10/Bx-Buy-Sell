
import apiClient from "@/lib/apiClient";

export const registerUser = async (userData) => {
  const { data } = await apiClient.post("/auth/signup", userData);
  return data;
};

export const optsend = async (email) => {
  const { data } = await apiClient.get(`/auth/get-otp/${email}`);
  console.log(data);
  return data;
};
