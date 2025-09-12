// src/api/authApi.js
import axios from "axios";
import { Base_URL } from "@/lib/constants"

const apiClient = axios.create({
  baseURL: Base_URL || "http://localhost:5000/api",
  // withCredentials: true,
});
console.log(Base_URL)
export default apiClient;
