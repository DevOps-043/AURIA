import React, { useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/shared/api/supabase-client";
import { Button } from "@/shared/components/ui/button";
import { useAuth } from "@/shared/hooks/use-auth";

export const SecurityForm: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState(0);

  const calculateStrength = (password: string) => {
    let score = 0;
    if (password.length > 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    setPasswordStrength(score);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "password") calculateStrength(value);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user?.email) return;

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: "error", text: "Las contrasenas no coinciden" });
      return;
    }

    if (formData.password.length < 8) {
      setMessage({
        type: "error",
        text: "La contrasena debe tener al menos 8 caracteres",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: formData.currentPassword,
      });

      if (signInError) {
        throw new Error(
          "La verificacion de la contrasena actual fallo. Intentalo de nuevo.",
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (updateError) throw updateError;

      setMessage({
        type: "success",
        text: "Clave de acceso actualizada correctamente",
      });
      setFormData({ currentPassword: "", password: "", confirmPassword: "" });
      setPasswordStrength(0);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "La actualizacion fallo",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-12 lg:flex-row">
        <div className="order-2 flex-1 space-y-8 lg:order-1">
          <form onSubmit={handleUpdatePassword} className="space-y-8">
            <div className="grid max-w-xl grid-cols-1 gap-6">
              <InputField
                label="Clave actual"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                placeholder="Confirma tu clave actual"
                icon={<Lock className="w-4 h-4" />}
                isPassword
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />

              <div className="my-2 h-px bg-border/20" />

              <InputField
                label="Nueva clave"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="************"
                icon={<KeyRound className="w-4 h-4" />}
                isPassword
                showPassword={showPassword}
              />

              <div className="-mt-2 space-y-2 px-1">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((index) => (
                    <div
                      key={index}
                      className={`h-1 flex-1 rounded-full transition-all duration-700 ${
                        index <= passwordStrength
                          ? index === 1
                            ? "bg-red-500/60"
                            : index === 2
                              ? "bg-amber-500/60"
                              : index === 3
                                ? "bg-blue-500/60"
                                : "bg-emerald-500/60"
                          : "bg-muted/30"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">
                  <span>Fortaleza</span>
                  <span className={passwordStrength >= 3 ? "text-emerald-500" : ""}>
                    {passwordStrength <= 1
                      ? "Debil"
                      : passwordStrength === 2
                        ? "Media"
                        : passwordStrength === 3
                          ? "Fuerte"
                          : "Compleja"}
                  </span>
                </div>
              </div>

              <InputField
                label="Confirmar clave"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="************"
                icon={<Lock className="w-4 h-4" />}
                isPassword
                showPassword={showPassword}
              />
            </div>

            <div className="flex flex-wrap items-center gap-6 border-t border-border/40 pt-6">
              <Button
                type="submit"
                disabled={
                  loading ||
                  !formData.password ||
                  formData.password !== formData.confirmPassword
                }
                className="flex h-14 items-center gap-3 rounded-[1.5rem] bg-primary px-10 text-[11px] font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    Actualizar clave
                    <Save className="w-4 h-4" />
                  </>
                )}
              </Button>

              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 ${
                      message.type === "success"
                        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                        : "border-red-500/20 bg-red-500/5 text-red-400"
                    }`}
                  >
                    {message.type === "success" ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {message.text}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>

          <div className="flex max-w-xl items-start gap-4 rounded-3xl border border-amber-500/10 bg-amber-500/5 p-5">
            <div className="flex-shrink-0 rounded-xl bg-amber-500/10 p-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-amber-500/80">
                Cierre global de sesiones
              </h4>
              <p className="text-[9px] font-bold uppercase tracking-tight leading-relaxed text-muted-foreground">
                Al actualizar tu clave principal, se cerraran las sesiones activas
                en otros equipos para evitar accesos no autorizados.
              </p>
            </div>
          </div>
        </div>

        <div className="order-1 w-full lg:order-2 lg:w-72">
          <div className="relative overflow-hidden rounded-[2rem] border border-border/40 bg-card/50 p-6 shadow-sm">
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">
                  Seguridad
                </h3>
                <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
                  Estandares de acceso
                </p>
              </div>
            </div>

            <p className="mt-6 text-[10px] font-medium leading-relaxed text-muted-foreground">
              Para mantener un buen nivel de seguridad, tus credenciales deben
              seguir reglas de alta entropia.
            </p>

            <div className="space-y-4 pt-6">
              <SecurityRequirement
                met={formData.password.length >= 8}
                label="8+ caracteres"
              />
              <SecurityRequirement
                met={/[A-Z]/.test(formData.password)}
                label="Mayuscula"
              />
              <SecurityRequirement
                met={/[0-9]/.test(formData.password)}
                label="Numero"
              />
              <SecurityRequirement
                met={/[^A-Za-z0-9]/.test(formData.password)}
                label="Simbolo / especial"
              />
            </div>

            <div className="mt-6 border-t border-border/40 pt-4">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-primary/60">
                <CheckCircle2 className="w-3 h-3" />
                <span>Cifrado con AES-256</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function InputField({
  label,
  name,
  value,
  onChange,
  placeholder,
  icon,
  isPassword,
  showPassword,
  setShowPassword,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  icon: React.ReactNode;
  isPassword?: boolean;
  showPassword?: boolean;
  setShowPassword?: (show: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      <div className="group relative">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within:text-primary">
          {icon}
        </div>
        <input
          type={isPassword && !showPassword ? "password" : "text"}
          name={name}
          value={value}
          onChange={onChange}
          className="h-12 w-full rounded-[1.4rem] border border-border/60 bg-background pl-12 pr-12 text-sm font-medium shadow-sm transition-all placeholder:text-muted-foreground/20 focus:border-primary/50 focus:outline-none"
          placeholder={placeholder}
        />
        {isPassword && setShowPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground/30 transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SecurityRequirement({
  met,
  label,
}: {
  met: boolean;
  label: string;
}) {
  return (
    <div className="group/req flex items-center justify-between">
      <span
        className={`text-[9px] font-black uppercase tracking-wider transition-colors ${
          met ? "text-foreground" : "text-muted-foreground/40"
        }`}
      >
        {label}
      </span>
      <div
        className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
          met
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            : "border-border/40"
        }`}
      >
        {met && <CheckCircle2 className="w-2.5 h-2.5" />}
      </div>
    </div>
  );
}
