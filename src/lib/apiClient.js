// src/api/authApi.js
import axios from "axios";
import { Base_URL } from "@/lib/constants";

const apiClient = axios.create({
  baseURL: Base_URL || "http://localhost:5000/api",
});

// Add token automatically before every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("customerToken"); // 👈 your token key
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
