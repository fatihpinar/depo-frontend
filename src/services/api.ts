// src/services/api.ts
import axios from "axios";
import { getAuth, clearAuth } from "../components/auth/storage";

// Prod'da her zaman Nginx üzerinden /api kullanacağız
const isProd = import.meta.env.MODE === "production";

const rawBase = isProd
  ? "/api" // 👈 canlı sunucuda her zaman bu
  : import.meta.env.VITE_API_URL || "http://localhost:3000/api"; // local dev

// Sonda gereksiz / olmasın ("/api///" → "/api")
const baseURL = rawBase.replace(/\/+$/, "");

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  // timeout: 20000,
});

// ---- Request: Authorization ekle ----
api.interceptors.request.use((config) => {
  const token = getAuth()?.token;
  if (token) {
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
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/signin"
      ) {
        window.location.replace("/signin");
      }
    }
    return Promise.reject(err);
  }
);

export default api;
