// src/components/auth/storage.ts
import { resetPerms } from "./permissions";

export type AuthPayload = { token: string; user: any; ts: number };

const KEY = "auth";

// Aktif auth'u oku (önce local, yoksa session)
export function getAuth(): AuthPayload | null {
  const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthPayload; } catch { return null; }
}

// Auth'u yaz. remember=true => localStorage; false => sessionStorage
export function setAuth(token: string, user: any, remember = true) {
  resetPerms(); // ⬅ önceki kullanıcının izinlerini sil
  const payload = { token, user, ts: Date.now() };
  (remember ? localStorage : sessionStorage).setItem("auth", JSON.stringify(payload));

  // kullanıcı kimliğini kaydet (ekstra güvence – istersen)
  try { sessionStorage.setItem("__auth_uid__", String(user?.id ?? "")); } catch {}

  // sekmelere ping at
  localStorage.setItem("__auth_ping__", String(Date.now()));
  localStorage.removeItem("__auth_ping__");

  if (remember) sessionStorage.removeItem("auth");
  else localStorage.removeItem("auth");
}

export function clearAuth() {
  resetPerms(); // ⬅ izin cache’i boşalt
  localStorage.removeItem("auth");
  sessionStorage.removeItem("auth");
  try { sessionStorage.removeItem("__auth_uid__"); } catch {}
  localStorage.setItem("__auth_logout__", String(Date.now()));
  localStorage.removeItem("__auth_logout__");
}

// Sekmeler arası auth değişimini dinle
export function onAuthChange(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === KEY || e.key === "__auth_ping__" || e.key === "__auth_logout__") cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
