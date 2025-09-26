import axios from "axios";
import { getSession, setSession, clearSession } from "@/utils/session";
import { Base_URL } from "@/lib/constants";

const apiClient = axios.create({
  baseURL: Base_URL || "http://localhost:5000/api",

});

apiClient.interceptors.request.use((config) => {
  const s = getSession();
  if (s?.accessToken) config.headers.Authorization = `Bearer ${s.accessToken}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const s = await refreshToken();               
        apiClient.defaults.headers.common.Authorization = `Bearer ${s.accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${s.accessToken}`;
        return apiClient(originalRequest);
      } catch {
        clearSession();
        window.location.href = "/signin";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
