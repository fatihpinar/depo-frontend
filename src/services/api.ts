// src/services/api.ts
import axios from "axios";
import { getAuth, clearAuth } from "../components/auth/storage";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  // timeout: 20000, // istersen aç
});

// ---- Request: Authorization ekle ----
api.interceptors.request.use((config) => {
  const token = getAuth()?.token;
  if (token) {
    // Axios v1: headers tipi geniş; string index ile eklemek güvenli.
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Response: 401 ise temizle ve signin'e yönlendir ----
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      clearAuth();
      // Aynı sayfadaysak tekrar yönlendirmeye gerek yok
      if (typeof window !== "undefined" && window.location.pathname !== "/signin") {
        window.location.replace("/signin");
      }
    }
    return Promise.reject(err);
  }
);

export default api;
