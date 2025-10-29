import apiClient from "@/lib/apiClient";
import { getSession, setSession } from "@/utils/session";

export const registerUser = async (userData) => {
  const { data } = await apiClient.post("/auth/signup", userData);
  return data;
};

export const loginUser = async (userData) => {
  const { data } = await apiClient.post("/auth/signin", userData);
  console.log(data);
  return data;
};
 
export const logoutUser = async () => {
  const { data } = await apiClient.post("/auth/logout");
  return data;
};


export const refreshToken = async () => {
  const session = getSession();
  const rt = session?.refreshToken;
  // console.log(rt);
  if (!rt) throw new Error("No refresh token found");
  const { data } = await apiClient.patch(`/auth/refresh/${rt}`, {}, );
  const newSession = {
    ...session,
    accessToken: data?.data?.tokens?.accessToken,
    refreshToken: data?.data?.tokens?.refreshToken ?? session.refreshToken,
    user: data?.data?.user ?? session.user,
  };
  setSession(newSession);
  return newSession; 
};

