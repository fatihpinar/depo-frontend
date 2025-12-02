// src/components/auth/SignInForm.tsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { setAuth, getAuth } from "./storage";
import { refreshPermissions } from "./permissions";
import api from "../../services/api";   // 👈 ORTAK axios client


const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function SignInForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("admin@mail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Zaten girişliyse /'e at
  useEffect(() => {
    const a = getAuth();
    if (a?.token) navigate("/", { replace: true });
  }, [navigate]);

  const friendlyError = (raw?: string, status?: number) => {
    if (status === 401 || raw === "INVALID_CREDENTIALS") return "Hatalı e-posta veya şifre.";
    if (raw === "USER_INACTIVE") return "Hesabınız pasif. Lütfen yetkiliyle iletişime geçin.";
    return raw || "Giriş başarısız.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!email.trim() || !password) {
      setErr("E-posta ve şifre zorunludur.");
      return;
    }

        setLoading(true);
    try {
      // Ortak axios client → baseURL zaten /api
      const res = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      const data = res.data;

      // 1) Yeni oturumu yaz
      setAuth(data.token, data.user, remember);

      // 2) Eski izin cache’ini temizle (guard)
      sessionStorage.removeItem("perms");
      try {
        localStorage.setItem("__perms_reset__", String(Date.now()));
        localStorage.removeItem("__perms_reset__");
      } catch {}

      // 3) Yeni token ile izinleri anında hydrate et
      await refreshPermissions();

      // 4) Dashboard
      navigate("/", { replace: true });
    } catch (e: any) {
      const rawMsg = e?.response?.data?.message;
      const status = e?.response?.status;
      setErr(friendlyError(rawMsg, status));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Giriş Yap
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Giriş yapmak için e-posta ve şifrenizi girin.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Email */}
              <div>
                <Label>
                  E-posta <span className="text-error-500">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="eposta@ornek.com"
                  value={email}
                  onChange={(e: any) => setEmail(e.target.value)}
                  required   // ✅ artık hata vermeyecek
                />
              </div>

              {/* Password */}
              <div>
                <Label>
                  Şifre <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Şifrenizi girin"
                    value={password}
                    onChange={(e: any) => setPassword(e.target.value)}
                    required   // ✅
                  />
                  <span
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showPassword ? <EyeIcon className="size-5" /> : <EyeCloseIcon className="size-5" />}
                  </span>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox checked={remember} onChange={setRemember} />
                  <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    Beni hatırla
                  </span>
                </div>
                <Link to="/reset-password" className="text-sm text-brand-500 hover:text-brand-600">
                  Şifremi unuttum?
                </Link>
              </div>

              {/* Error */}
              {err && (
                <div className="p-3 text-sm rounded-md bg-error-50 text-error-600 dark:bg-error-900/30 dark:text-error-300">
                  {err}
                </div>
              )}

              {/* Submit */}
              <div>
                <Button className="w-full" size="sm" type="submit" disabled={loading}>
                  {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
