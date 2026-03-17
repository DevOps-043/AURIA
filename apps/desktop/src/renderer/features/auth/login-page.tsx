import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/shared/components/ui/logo";
import { Button } from "@/shared/components/ui/button";
import { FormField, SelectField } from "@/shared/components/ui/form-field";
import { PasswordStrengthBar } from "@/shared/components/ui/password-strength";
import { useSignupForm } from "./use-signup-form";
import { useLoginForm } from "./use-login-form";
import {
  useUsernameCheck,
  useUniqueCheck,
} from "@/shared/hooks/use-unique-check";
import { GENDER_OPTIONS, BIO_MAX_LENGTH } from "@/shared/constants/auth";
import { GithubIcon } from "@/shared/components/ui/icons";
import {
  KeyRound,
  Mail,
  ArrowRight,
  ArrowLeft,
  Loader2,
  User,
  UserPlus,
  LogIn,
  Phone,
  Calendar,
  Building2,
  Briefcase,
  Globe,
  MapPin,
  FileText,
  Shield,
} from "lucide-react";
import { Checkbox } from "@/shared/components/ui/checkbox";

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const form = useLoginForm();

  React.useEffect(() => {
    if (form.success) onSuccess();
  }, [form.success, onSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.login();
  };

  return (
    <motion.form
      key="login"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.25 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <FormField
        label="Correo o usuario"
        icon={<Mail className="w-3.5 h-3.5" />}
        value={form.email}
        onChange={(value: string) => {
          form.setEmail(value);
          form.clearError();
        }}
        placeholder="developer@aqelor.ai"
        required
        autoComplete="email"
        delay={0.1}
      />

      <FormField
        label="Clave de acceso"
        icon={<KeyRound className="w-3.5 h-3.5" />}
        type="password"
        value={form.password}
        onChange={(value: string) => {
          form.setPassword(value);
          form.clearError();
        }}
        placeholder="**********"
        required
        autoComplete="current-password"
        delay={0.15}
      />

      {form.error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-1 text-center text-[9px] font-bold uppercase tracking-widest text-red-400"
        >
          {form.error}
        </motion.p>
      )}

      <SubmitSection
        loading={form.loading}
        label="Iniciar sesion"
        onSubmit={form.login}
        onGitHub={form.loginWithGitHub}
      />
    </motion.form>
  );
}

function SignupStep1({ form }: { form: ReturnType<typeof useSignupForm> }) {
  const { fields, set, errors } = form;
  const usernameCheck = useUsernameCheck(fields.username);
  const emailCheck = useUniqueCheck("email", fields.email, 5);

  return (
    <motion.form
      key="signup-step1"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.25 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (form.step1Valid) form.setStep(2);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Nombre"
          icon={<User className="w-3.5 h-3.5" />}
          value={fields.firstName}
          onChange={(value: string) => set("firstName", value)}
          placeholder="Alex"
          required
          error={errors.firstName}
          autoComplete="given-name"
          delay={0.05}
        />
        <FormField
          label="Apellido"
          icon={<User className="w-3.5 h-3.5" />}
          value={fields.lastName}
          onChange={(value: string) => set("lastName", value)}
          placeholder="Stone"
          required
          error={errors.lastName}
          autoComplete="family-name"
          delay={0.1}
        />
      </div>

      <FormField
        label="Nombre de usuario"
        icon={<User className="w-3.5 h-3.5" />}
        value={fields.username}
        onChange={(value: string) =>
          set("username", value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
        }
        placeholder="quantum_dev"
        required
        error={errors.username}
        uniqueStatus={errors.username ? undefined : usernameCheck.status}
        statusMessage={usernameCheck.message}
        maxLength={24}
        autoComplete="username"
        delay={0.15}
      />

      <FormField
        label="Correo electronico"
        icon={<Mail className="w-3.5 h-3.5" />}
        type="email"
        value={fields.email}
        onChange={(value: string) => set("email", value)}
        placeholder="developer@aqelor.ai"
        required
        error={errors.email}
        uniqueStatus={errors.email ? undefined : emailCheck.status}
        statusMessage={emailCheck.message}
        autoComplete="email"
        delay={0.2}
      />

      <FormField
        label="Telefono"
        icon={<Phone className="w-3.5 h-3.5" />}
        type="tel"
        value={fields.phone}
        onChange={(value: string) => set("phone", value)}
        placeholder="+52 555 000 0000"
        error={errors.phone}
        autoComplete="tel"
        delay={0.25}
      />

      <FormField
        label="Clave de acceso"
        icon={<KeyRound className="w-3.5 h-3.5" />}
        type="password"
        value={fields.password}
        onChange={(value: string) => set("password", value)}
        placeholder="Min. 10 caracteres con A-z, 0-9, !@#"
        required
        error={errors.password}
        autoComplete="new-password"
        delay={0.3}
      />

      <AnimatePresence>
        {fields.password && <PasswordStrengthBar password={fields.password} />}
      </AnimatePresence>

      <FormField
        label="Confirmar clave de acceso"
        icon={<Shield className="w-3.5 h-3.5" />}
        type="password"
        value={fields.confirmPassword}
        onChange={(value: string) => set("confirmPassword", value)}
        placeholder="Vuelve a escribir tu clave de acceso"
        required
        error={errors.confirmPassword}
        autoComplete="new-password"
        delay={0.35}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="pt-2"
      >
        <Button
          type="submit"
          disabled={!form.step1Valid}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3B82F6] text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/10 transition-all hover:bg-[#2563EB] disabled:bg-[#263042] disabled:text-[#4A5568]"
        >
          Continuar
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
        <p className="mt-2 text-center text-[8px] tracking-wider text-[#4A5568]">
          Paso 1 de 2 - Campos obligatorios
        </p>
      </motion.div>
    </motion.form>
  );
}

function SignupStep2({ form }: { form: ReturnType<typeof useSignupForm> }) {
  const {
    fields,
    set,
    errors,
    submitting,
    submitError,
    canSubmit,
    submit,
  } = form;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <motion.form
      key="signup-step2"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.25 }}
      onSubmit={handleSubmit}
      className="space-y-3"
    >
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => form.setStep(1)}
        className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[#7C8798] transition-colors hover:text-[#F5F7FB]"
      >
        <ArrowLeft className="w-3 h-3" />
        Volver
      </motion.button>

      <FormField
        label="Fecha de nacimiento"
        icon={<Calendar className="w-3.5 h-3.5" />}
        type="date"
        value={fields.dateOfBirth}
        onChange={(value: string) => set("dateOfBirth", value)}
        error={errors.dateOfBirth}
        delay={0.05}
      />

      <SelectField
        label="Genero"
        icon={<User className="w-3.5 h-3.5" />}
        value={fields.gender}
        onChange={(value: string) => set("gender", value)}
        options={GENDER_OPTIONS}
        placeholder="Selecciona genero..."
        delay={0.1}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Codigo de pais"
          icon={<Globe className="w-3.5 h-3.5" />}
          value={fields.countryCode}
          onChange={(value: string) => set("countryCode", value.toUpperCase().slice(0, 2))}
          placeholder="MX"
          maxLength={2}
          delay={0.15}
        />
        <FormField
          label="Ciudad"
          icon={<MapPin className="w-3.5 h-3.5" />}
          value={fields.city}
          onChange={(value: string) => set("city", value)}
          placeholder="Ciudad de Mexico"
          delay={0.2}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Empresa"
          icon={<Building2 className="w-3.5 h-3.5" />}
          value={fields.companyName}
          onChange={(value: string) => set("companyName", value)}
          placeholder="Acme Inc."
          delay={0.25}
        />
        <FormField
          label="Puesto"
          icon={<Briefcase className="w-3.5 h-3.5" />}
          value={fields.jobTitle}
          onChange={(value: string) => set("jobTitle", value)}
          placeholder="Ingeniero"
          delay={0.3}
        />
      </div>

      <FormField
        label="Usuario de GitHub"
        icon={<GithubIcon className="w-3.5 h-3.5" />}
        value={fields.githubUsername}
        onChange={(value: string) => set("githubUsername", value)}
        placeholder="octocat"
        delay={0.35}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-1.5"
      >
        <label className="ml-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#7C8798]">
          Biografia
          <span className="text-[#4A5568]">
            ({fields.bio.length}/{BIO_MAX_LENGTH})
          </span>
        </label>
        <div className="relative rounded-xl border border-[#263042] bg-[#0B0F14] transition-colors focus-within:border-[#3B82F6]">
          <div className="absolute left-3.5 top-3 text-[#7C8798]">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <textarea
            value={fields.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Cuentanos sobre ti..."
            maxLength={BIO_MAX_LENGTH}
            rows={2}
            className="w-full resize-none bg-transparent py-2.5 pl-10 pr-4 text-xs text-[#F5F7FB] placeholder:text-[#3A4555] focus:outline-none"
          />
        </div>
        {errors.bio && <p className="ml-1 text-[9px] font-bold text-red-400">{errors.bio}</p>}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="space-y-3 pt-1"
      >
        <Checkbox
          checked={fields.termsAccepted}
          onChange={(value: boolean) => set("termsAccepted", value)}
          label={
            <>
              Acepto los <span className="text-[#3B82F6]">Terminos del servicio</span>{" "}
              y la <span className="text-[#3B82F6]">Politica de privacidad</span>
              <span className="ml-0.5 text-red-400/60">*</span>
            </>
          }
        />
        <Checkbox
          checked={fields.marketingConsent}
          onChange={(value: boolean) => set("marketingConsent", value)}
          label="Acepto recibir actualizaciones y anuncios del producto"
        />
      </motion.div>

      {submitError && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-1 text-center text-[9px] font-bold uppercase tracking-widest text-red-400"
        >
          {submitError}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="pt-1"
      >
        <Button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3B82F6] text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/10 transition-all hover:bg-[#2563EB] disabled:bg-[#263042] disabled:text-[#4A5568]"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Shield className="w-3.5 h-3.5" />
              Crear perfil
            </>
          )}
        </Button>
        <p className="mt-2 text-center text-[8px] tracking-wider text-[#4A5568]">
          Paso 2 de 2 - Detalles opcionales del perfil
        </p>
      </motion.div>
    </motion.form>
  );
}

function SubmitSection({
  loading,
  label,
  onSubmit,
  onGitHub,
}: {
  loading: boolean;
  label: string;
  onSubmit: () => void;
  onGitHub: () => void;
}) {
  return (
    <div className="space-y-3 pt-2">
      <Button
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3B82F6] text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/10 transition-all hover:bg-[#2563EB]"
        disabled={loading}
        type="button"
        onClick={onSubmit}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {label}
            <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </Button>

      <div className="flex items-center gap-4 py-0.5">
        <div className="h-px flex-1 bg-[#263042]" />
        <span className="text-[8px] font-bold tracking-widest text-[#7C8798]">O</span>
        <div className="h-px flex-1 bg-[#263042]" />
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={onGitHub}
        className="flex h-10 w-full items-center justify-center gap-3 rounded-xl border border-[#344054] bg-[#171C23] text-[9px] font-bold uppercase tracking-widest text-[#F5F7FB] transition-colors hover:bg-[#1E2632] disabled:opacity-50"
      >
        <GithubIcon className="w-3.5 h-3.5" />
        Continuar con GitHub
      </button>
    </div>
  );
}

function SuccessScreen({
  mode,
  onBack,
}: {
  mode: "login" | "signup";
  onBack: () => void;
}) {
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-8 text-center"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
        >
          <svg
            className="h-7 w-7 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </motion.div>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-1 text-lg font-bold uppercase tracking-widest text-white"
      >
        {mode === "login" ? "Autenticado" : "Perfil creado"}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-6 text-[9px] font-bold uppercase tracking-wider text-[#7C8798]"
      >
        {mode === "login"
          ? "Estableciendo conexion segura..."
          : "Registro completado correctamente"}
      </motion.p>

      {mode === "signup" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Button
            onClick={onBack}
            className="rounded-lg border border-[#263042] bg-[#0B0F14] px-6 py-2 text-[9px] font-bold uppercase tracking-widest text-white hover:bg-[#171C23]"
          >
            Volver al inicio de sesion
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

export const LoginPage: React.FC<{ oauthError?: string | null }> = ({
  oauthError,
}) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginSuccess, setLoginSuccess] = useState(false);
  const signupForm = useSignupForm();

  const switchMode = (newMode: "login" | "signup") => {
    setMode(newMode);
    setLoginSuccess(false);
    if (newMode === "signup") signupForm.reset();
  };

  const showSuccess = loginSuccess || signupForm.success;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#0B0F14] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#171C23] to-[#0B0F14]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[460px] px-6 py-6"
      >
        <div className="relative rounded-2xl border border-[#263042] bg-[#171C23] p-8 shadow-2xl">
          <div className="mb-5 flex flex-col items-center text-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <Logo className="mb-3" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-1 text-xl font-bold uppercase tracking-[0.2em] text-white"
            >
              {mode === "login" ? "Autenticacion" : "Registro"}
            </motion.h1>
            <motion.p
              className="text-[9px] font-bold uppercase tracking-widest text-[#7C8798]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {mode === "login" ? "Acceso seguro" : "Crea tu perfil"}
            </motion.p>
          </div>

          {oauthError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3"
            >
              <p className="text-center text-[9px] font-bold uppercase tracking-widest text-red-400">
                {oauthError}
              </p>
            </motion.div>
          )}

          {!showSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mb-5 flex rounded-xl border border-[#263042] bg-[#0B0F14] p-1"
            >
              <button
                onClick={() => switchMode("login")}
                className={`flex-1 rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                  mode === "login"
                    ? "border border-[#263042] bg-[#171C23] text-white shadow-lg"
                    : "text-[#7C8798] hover:text-[#F5F7FB]"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <LogIn className="w-3 h-3" />
                  Entrar
                </span>
              </button>
              <button
                onClick={() => switchMode("signup")}
                className={`flex-1 rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                  mode === "signup"
                    ? "border border-[#263042] bg-[#171C23] text-white shadow-lg"
                    : "text-[#7C8798] hover:text-[#F5F7FB]"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <UserPlus className="w-3 h-3" />
                  Registrarse
                </span>
              </button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {showSuccess ? (
              <SuccessScreen
                mode={mode}
                onBack={() => {
                  switchMode("login");
                  signupForm.reset();
                }}
              />
            ) : mode === "login" ? (
              <LoginForm onSuccess={() => setLoginSuccess(true)} />
            ) : signupForm.step === 1 ? (
              <SignupStep1 form={signupForm} />
            ) : (
              <SignupStep2 form={signupForm} />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
