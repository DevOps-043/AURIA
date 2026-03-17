/** Centralized validation rules for auth forms. Pure functions, no side effects. */

export interface ValidationResult {
  valid: boolean;
  message: string;
}

// ─── Password ────────────────────────────────────────────────────────────
const PASSWORD_MIN = 10;
const HAS_UPPER = /[A-Z]/;
const HAS_LOWER = /[a-z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export interface PasswordStrength {
  score: number; // 0-4
  label: 'weak' | 'fair' | 'good' | 'strong';
  checks: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    digit: boolean;
    special: boolean;
  };
}

export function validatePassword(pw: string): ValidationResult {
  if (pw.length < PASSWORD_MIN)
    return { valid: false, message: `Se requieren al menos ${PASSWORD_MIN} caracteres` };
  if (!HAS_UPPER.test(pw))
    return { valid: false, message: 'Debe incluir una letra mayuscula' };
  if (!HAS_LOWER.test(pw))
    return { valid: false, message: 'Debe incluir una letra minuscula' };
  if (!HAS_DIGIT.test(pw))
    return { valid: false, message: 'Debe incluir un numero' };
  if (!HAS_SPECIAL.test(pw))
    return { valid: false, message: 'Debe incluir un caracter especial (!@#$...)' };
  return { valid: true, message: '' };
}

export function getPasswordStrength(pw: string): PasswordStrength {
  const checks = {
    length: pw.length >= PASSWORD_MIN,
    upper: HAS_UPPER.test(pw),
    lower: HAS_LOWER.test(pw),
    digit: HAS_DIGIT.test(pw),
    special: HAS_SPECIAL.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const labels: Record<number, PasswordStrength['label']> = {
    0: 'weak', 1: 'weak', 2: 'fair', 3: 'good', 4: 'good', 5: 'strong',
  };
  return { score: Math.min(score, 4), label: labels[score] ?? 'weak', checks };
}

// ─── Email ───────────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) return { valid: false, message: 'El correo es obligatorio' };
  if (!EMAIL_REGEX.test(email)) return { valid: false, message: 'Ingresa un correo valido' };
  return { valid: true, message: '' };
}

// ─── Username ────────────────────────────────────────────────────────────
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

export function validateUsername(username: string): ValidationResult {
  if (!username.trim()) return { valid: false, message: 'El nombre de usuario es obligatorio' };
  if (username.length < 3) return { valid: false, message: 'Minimo 3 caracteres' };
  if (username.length > 24) return { valid: false, message: 'Maximo 24 caracteres' };
  if (!USERNAME_REGEX.test(username))
    return { valid: false, message: 'Solo letras, numeros y guiones bajos' };
  return { valid: true, message: '' };
}

// ─── Phone ───────────────────────────────────────────────────────────────
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export function validatePhone(phone: string): ValidationResult {
  if (!phone.trim()) return { valid: true, message: '' }; // optional
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (!PHONE_REGEX.test(cleaned))
    return { valid: false, message: 'Ingresa un telefono valido' };
  return { valid: true, message: '' };
}

// ─── Name ────────────────────────────────────────────────────────────────
export function validateName(name: string, label: string): ValidationResult {
  if (!name.trim()) return { valid: false, message: `${label} es obligatorio` };
  if (name.trim().length < 2) return { valid: false, message: `${label} es demasiado corto` };
  if (name.trim().length > 50) return { valid: false, message: `${label} es demasiado largo` };
  return { valid: true, message: '' };
}

// ─── Date of Birth ───────────────────────────────────────────────────────
export function validateDateOfBirth(dob: string): ValidationResult {
  if (!dob) return { valid: true, message: '' }; // optional
  const date = new Date(dob);
  if (isNaN(date.getTime())) return { valid: false, message: 'Fecha invalida' };
  const today = new Date();
  const minAge = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
  if (date > minAge) return { valid: false, message: 'Debes tener al menos 13 anos' };
  return { valid: true, message: '' };
}
