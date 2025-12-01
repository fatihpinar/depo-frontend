// src/pages/Details/LegacyDetailsRedirect.tsx
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function LegacyDetailsRedirect() {
  const { kind, id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    if (kind === "master" || kind === "product" || kind === "component") {
      navigate(`/details/${kind}/${id}`, { replace: true });
    } else {
      navigate("/404", { replace: true });
    }
  }, [kind, id, navigate]);

  return null;
}
