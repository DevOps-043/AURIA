import React from 'react';
import { motion } from 'framer-motion';
import { getPasswordStrength, type PasswordStrength } from '@/shared/utils/validators';

const COLORS: Record<PasswordStrength['label'], string> = {
  weak: '#EF4444',
  fair: '#F59E0B',
  good: '#3B82F6',
  strong: '#22C55E',
};

const LABELS: Record<PasswordStrength['label'], string> = {
  weak: 'DEBIL',
  fair: 'ACEPTABLE',
  good: 'BUENA',
  strong: 'FUERTE',
};

interface PasswordStrengthBarProps {
  password: string;
}

export const PasswordStrengthBar: React.FC<PasswordStrengthBarProps> = ({ password }) => {
  if (!password) return null;

  const strength = getPasswordStrength(password);
  const color = COLORS[strength.label];
  const widthPct = (strength.score / 4) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-2 pt-1"
    >
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-[#1E2632] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${widthPct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <span
          className="text-[8px] font-bold tracking-widest"
          style={{ color }}
        >
          {LABELS[strength.label]}
        </span>
      </div>

      {/* Check list */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <CheckItem met={strength.checks.length} label="10+ caracteres" />
        <CheckItem met={strength.checks.upper} label="Mayuscula" />
        <CheckItem met={strength.checks.lower} label="Minuscula" />
        <CheckItem met={strength.checks.digit} label="Numero" />
        <CheckItem met={strength.checks.special} label="Caracter especial" />
      </div>
    </motion.div>
  );
};

function CheckItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-1 h-1 rounded-full transition-colors duration-300 ${
          met ? 'bg-emerald-400' : 'bg-[#3A4555]'
        }`}
      />
      <span
        className={`text-[8px] tracking-wider transition-colors duration-300 ${
          met ? 'text-emerald-400 font-bold' : 'text-[#4A5568]'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
