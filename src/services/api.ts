// src/services/api.ts
import axios from "axios";
import { getAuth, clearAuth } from "../components/auth/storage";

// === Base URL hesaplama ===
function resolveBaseURL() {
  // Browser'dayız ve sunucuya deploy edilmiş durumdaysak:
  if (typeof window !== "undefined") {
    const host = window.location.hostname;

    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1";

    // Local değilse (yani 13.60.253.7 ya da ileride domain)
    // her zaman Nginx üzerinden /api kullan:
    if (!isLocal) {
      return "/api";
    }
  }

  // Local geliştirme: env varsa onu, yoksa localhost:3000/api
  return import.meta.env.VITE_API_URL || "http://localhost:3000/api";
}

const rawBase = resolveBaseURL();

// Sonda gereksiz / olmasın
const baseURL = rawBase.replace(/\/+$/, "");

// Sırf debug için – prod’da da kalabilir, zararı yok:
console.log("[API] baseURL =", baseURL);

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
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
