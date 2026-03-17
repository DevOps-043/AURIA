import { useState, useMemo } from 'react';
import { supabase } from '@/shared/api/supabase-client';
import { AUTH_ERRORS } from '@/shared/constants/errors';
import { BIO_MAX_LENGTH } from '@/shared/constants/auth';
import {
  validatePassword,
  validateEmail,
  validateUsername,
  validatePhone,
  validateName,
  validateDateOfBirth,
} from '@/shared/utils/validators';

export interface SignupFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  gender: string;
  countryCode: string;
  city: string;
  companyName: string;
  jobTitle: string;
  githubUsername: string;
  bio: string;
  marketingConsent: boolean;
  termsAccepted: boolean;
}

const INITIAL: SignupFields = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  username: '',
  password: '',
  confirmPassword: '',
  dateOfBirth: '',
  gender: '',
  countryCode: '',
  city: '',
  companyName: '',
  jobTitle: '',
  githubUsername: '',
  bio: '',
  marketingConsent: false,
  termsAccepted: false,
};

export type SignupStep = 1 | 2; // 1: identity+credentials, 2: profile (optional)

export function useSignupForm() {
  const [fields, setFields] = useState<SignupFields>(INITIAL);
  const [step, setStep] = useState<SignupStep>(1);
  const [touched, setTouched] = useState<Set<keyof SignupFields>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = <K extends keyof SignupFields>(key: K, value: SignupFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => new Set(prev).add(key));
    setSubmitError(null);
  };

  // ─── Validations (only shown after field is touched) ──────────────
  const errors = useMemo(() => {
    const e: Partial<Record<keyof SignupFields, string>> = {};

    if (touched.has('firstName')) {
      const r = validateName(fields.firstName, 'El nombre');
      if (!r.valid) e.firstName = r.message;
    }
    if (touched.has('lastName')) {
      const r = validateName(fields.lastName, 'El apellido');
      if (!r.valid) e.lastName = r.message;
    }
    if (touched.has('email')) {
      const r = validateEmail(fields.email);
      if (!r.valid) e.email = r.message;
    }
    if (touched.has('username')) {
      const r = validateUsername(fields.username);
      if (!r.valid) e.username = r.message;
    }
    if (touched.has('password')) {
      const r = validatePassword(fields.password);
      if (!r.valid) e.password = r.message;
    }
    if (touched.has('confirmPassword')) {
      if (!fields.confirmPassword) {
        e.confirmPassword = 'Confirma tu contrasena';
      } else if (fields.confirmPassword !== fields.password) {
        e.confirmPassword = 'Las contrasenas no coinciden';
      }
    }
    if (touched.has('phone') && fields.phone) {
      const r = validatePhone(fields.phone);
      if (!r.valid) e.phone = r.message;
    }
    if (touched.has('dateOfBirth') && fields.dateOfBirth) {
      const r = validateDateOfBirth(fields.dateOfBirth);
      if (!r.valid) e.dateOfBirth = r.message;
    }
    if (touched.has('bio') && fields.bio.length > BIO_MAX_LENGTH) {
      e.bio = `Maximo ${BIO_MAX_LENGTH} caracteres`;
    }

    return e;
  }, [fields, touched]);

  // ─── Step 1 completeness ──────────────────────────────────────────
  const step1Valid =
    validateName(fields.firstName, '').valid &&
    validateName(fields.lastName, '').valid &&
    validateEmail(fields.email).valid &&
    validateUsername(fields.username).valid &&
    validatePassword(fields.password).valid &&
    fields.confirmPassword === fields.password &&
    fields.confirmPassword.length > 0 &&
    (fields.phone === '' || validatePhone(fields.phone).valid);

  const canSubmit = step1Valid && fields.termsAccepted;

  // ─── Submit ───────────────────────────────────────────────────────
  const submit = async () => {
    if (!canSubmit) {
      setSubmitError(AUTH_ERRORS.INCOMPLETE_FIELDS);
      return;
    }
    if (!supabase) {
      setSubmitError(AUTH_ERRORS.DB_NOT_CONFIGURED);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: fields.email,
        password: fields.password,
        options: {
          data: {
            username: fields.username,
            first_name: fields.firstName,
            last_name: fields.lastName,
            phone: fields.phone || undefined,
            date_of_birth: fields.dateOfBirth || undefined,
            gender: fields.gender || undefined,
            country_code: fields.countryCode || undefined,
            city: fields.city || undefined,
            company_name: fields.companyName || undefined,
            job_title: fields.jobTitle || undefined,
            github_username: fields.githubUsername || undefined,
            bio: fields.bio || undefined,
            marketing_consent: fields.marketingConsent,
            terms_accepted: fields.termsAccepted,
          },
        },
      });

      if (signUpError) throw signUpError;

      // Supabase returns a user with an empty session when email confirmation
      // is required. Detect this so the UI can show the right message.
      if (data.user && !data.session) {
        setSuccess(true);
        return;
      }

      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : AUTH_ERRORS.REGISTRATION_FAILED;
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setFields(INITIAL);
    setStep(1);
    setTouched(new Set());
    setSubmitError(null);
    setSuccess(false);
  };

  return {
    fields,
    set,
    step,
    setStep,
    errors,
    step1Valid,
    canSubmit,
    submitting,
    submitError,
    success,
    submit,
    reset,
  };
}
