// src/components/auth/RequireAuth.tsx
import { Navigate, Outlet, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { getAuth, onAuthChange } from "./storage";
import { refreshPermissions, arePermsReady } from "./permissions";

export default function RequireAuth() {
  const loc = useLocation();
  const [auth, setAuth] = useState(() => getAuth());
  const [loadingPerms, setLoadingPerms] = useState(() => arePermsReady() === false);

  // Diğer sekmelerde login/logout olursa…
  useEffect(() => {
    const off = onAuthChange(() => setAuth(getAuth()));
    return off;
  }, []);

  // Token varsa izinleri hydrate et
  useEffect(() => {
    if (!auth?.token) return;
    if (arePermsReady()) { setLoadingPerms(false); return; }
    setLoadingPerms(true);
    refreshPermissions().finally(() => setLoadingPerms(false));
  }, [auth?.token]);

  if (!auth?.token) {
    return <Navigate to="/signin" replace state={{ from: loc.pathname }} />;
  }
  if (loadingPerms) {
    // minik bir boş state / skeleton gösterebilirsin
    return null;
  }
  return <Outlet />;
}
