// src/components/auth/permissions.ts
import api from "../../services/api";
import { getAuth } from "./storage";

type PermKey = string;

let PERMS = new Set<string>();
let READY = false;

type PermsListener = () => void;
const listeners = new Set<PermsListener>();
export function onPermsChange(cb: PermsListener){ listeners.add(cb); return () => listeners.delete(cb); }
function emit(){ listeners.forEach(fn => { try { fn(); } catch {} }); }

export function arePermsReady() { return READY; }

export function setPerms(perms: string[] = []){
  PERMS = new Set(perms);
  READY = true;
  try { sessionStorage.setItem("perms", JSON.stringify(perms)); } catch {}
  emit();                // 🔔 sidebar/guard’lar rerender
}

export function resetPerms(){
  PERMS = new Set();
  READY = false;
  try { sessionStorage.removeItem("perms"); } catch {}
  emit();                // 🔔 “artık hazır değil” bilgisi yayılsın
}

export function getPerms(): PermKey[] {
  if (PERMS.size) return Array.from(PERMS);
  try {
    const raw = sessionStorage.getItem("perms");
    if (raw) PERMS = new Set(JSON.parse(raw));
  } catch {}
  return Array.from(PERMS);
}

// ------ EN ÖNEMLİ KISIM: admin-like kontrolü sağlam olsun ------
function isAdminLikeUser(user: any) {
  if (!user) return false;

  const role = user.role ?? user.role_key ?? null;
  const roleId = user.roleId ?? user.role_id ?? null;

  if (role === "admin" || role === "warehouse_manager") return true;
  if (roleId === 1 || roleId === 2) return true; // ✅ düzeltme
  return false;
}

export function hasAny(required: PermKey[] = []): boolean {
  const user = getAuth()?.user;

  // 1) Admin her şeye erişir
  if (isAdminLikeUser(user)) return true;

  // 2) Boş gereksinim -> serbest
  if (!required.length) return true;

  // 3) İzinler henüz hydrate edilmediyse “karar vermeyelim”
  if (!READY && !PERMS.size) return false;

  // 4) Set’te var mı?
  const current = PERMS.size ? PERMS : new Set(getPerms());
  return required.some((p) => current.has(p));
}

/** Oturum açıkken backend’den izinleri çekip cache’le */
export async function refreshPermissions(): Promise<PermKey[]> {
  const user = getAuth()?.user;

  // Admin ise fetch etmeden hazır kabul edelim
  if (isAdminLikeUser(user)) {
    setPerms([]);
    return [];
  }

  const { data } = await api.get<{ permissions: PermKey[] }>("/auth/me");
  const perms = data?.permissions ?? [];
  setPerms(perms);
  return perms;

  
}

// admin + depo yöneticisi (id:1 ve 2) master detaya girebilir
export function canOpenMasterDetail(): boolean {
  const user = getAuth()?.user;
  if (!user) return false;

  const role = user.role ?? user.role_key ?? null;
  const roleId = user.roleId ?? user.role_id ?? null;

  if (role === "admin" || role === "warehouse_manager") return true;
  if (roleId === 1 || roleId === 2) return true; // ✅ admin + depo yöneticisi
  return false;
}
