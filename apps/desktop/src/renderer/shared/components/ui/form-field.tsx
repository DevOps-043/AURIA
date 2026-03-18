import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

// ─── Status indicator icon for unique checks ────────────────────────────
type FieldStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

function StatusIcon({ status }: { status: FieldStatus }) {
  if (status === 'checking')
    return <Loader2 className="w-3.5 h-3.5 text-[#7C8798] animate-spin" />;
  if (status === 'available')
    return (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      </motion.div>
    );
  if (status === 'taken')
    return (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
        <XCircle className="w-3.5 h-3.5 text-red-400" />
      </motion.div>
    );
  return null;
}

// ─── Form Field ──────────────────────────────────────────────────────────
export interface FormFieldProps {
  label: string;
  icon: React.ReactNode;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  uniqueStatus?: FieldStatus;
  statusMessage?: string;
  delay?: number;
  className?: string;
  autoComplete?: string;
  maxLength?: number;
}

import { Calendar } from './calendar';

export const FormField: React.FC<FormFieldProps> = ({
  label,
  icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  error,
  uniqueStatus,
  statusMessage,
  delay = 0,
  className,
  autoComplete,
  maxLength,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  const isPassword = type === 'password';
  const isDate = type === 'date';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : (isDate ? 'text' : type);

  const borderColor = error
    ? 'border-red-400/60 focus-within:border-red-400'
    : uniqueStatus === 'taken'
    ? 'border-red-400/60 focus-within:border-red-400'
    : uniqueStatus === 'available'
    ? 'border-emerald-400/40 focus-within:border-emerald-400'
    : focused
    ? 'border-[#3B82F6] ring-2 ring-[#3B82F6]/10'
    : 'border-[#263042]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      className={cn('space-y-1.5 relative', className)}
    >
      <label className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#7C8798] ml-1 flex items-center gap-2">
        {label}
        {required && <span className="text-red-400/60">*</span>}
      </label>

      <div
        className={cn(
          'relative bg-[#0B0F14] rounded-xl transition-all duration-200',
          'border',
          borderColor,
          isDate && 'cursor-pointer'
        )}
        onClick={() => isDate && setShowCalendar(true)}
      >
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7C8798] pointer-events-none z-20">
          {icon}
        </div>
        <input
          type={inputType}
          readOnly={isDate}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => !isDate && setFocused(true)}
          onBlur={() => !isDate && setFocused(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          className={cn(
            "w-full bg-transparent py-2.5 pl-10 pr-10 text-xs text-[#F5F7FB] placeholder:text-[#3A4555] focus:outline-none",
            isDate && "cursor-pointer uppercase tracking-widest"
          )}
        />

        {/* Right side: password toggle or status icon */}
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-20 pointer-events-none">
          {uniqueStatus && <StatusIcon status={uniqueStatus} />}
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); setShowPassword((v) => !v); }}
              className="text-[#7C8798] hover:text-[#F5F7FB] transition-colors pointer-events-auto"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        <AnimatePresence>
          {showCalendar && (
            <Calendar
              value={value}
              onChange={onChange}
              onClose={() => setShowCalendar(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Error / status message */}
      <AnimatePresence mode="wait">
        {(error || (statusMessage && uniqueStatus !== 'idle')) && (
          <motion.p
            key={error || statusMessage}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'text-[9px] font-bold ml-1 tracking-wider',
              error || uniqueStatus === 'taken'
                ? 'text-red-400'
                : uniqueStatus === 'available'
                ? 'text-emerald-400'
                : 'text-[#7C8798]',
            )}
          >
            {error || statusMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Select Field ────────────────────────────────────────────────────────
export interface SelectFieldProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  delay?: number;
  className?: string;
}

import { Dropdown } from './dropdown';

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  icon,
  value,
  onChange,
  options,
  placeholder = 'Selecciona...',
  required = false,
  delay = 0,
  className,
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      className={cn('space-y-1.5', className)}
    >
      <label className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#7C8798] ml-1">
        {label}
      </label>
      <div 
        className={cn(
          "relative bg-[#0B0F14] border rounded-xl transition-all duration-200",
          focused ? "border-[#3B82F6] ring-2 ring-[#3B82F6]/10" : "border-[#263042]"
        )}
      >
        <Dropdown
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          icon={icon}
        />
      </div>
    </motion.div>
  );
};
