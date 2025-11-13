// src/components/auth/RequirePermission.tsx
import { Navigate, Outlet } from "react-router-dom";
import { hasAny, arePermsReady } from "./permissions";

type Props = { anyOf: string[] };

export default function RequirePermission({ anyOf }: Props) {
  // İzinler hydrate edilmediyse bekleyelim (UI: null veya küçük loader koyabilirsin)
  if (!arePermsReady()) return null;

  return hasAny(anyOf as any) ? <Outlet /> : <Navigate to="/" replace />;
}
