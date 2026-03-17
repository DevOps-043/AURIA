import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, className }) => {
  return (
    <label className={cn("flex items-start gap-3 cursor-pointer group select-none", className)}>
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <motion.div
          initial={false}
          animate={{
            backgroundColor: checked ? '#3B82F6' : 'transparent',
            borderColor: checked ? '#3B82F6' : '#263042',
          }}
          transition={{ duration: 0.2 }}
          className={cn(
            "w-4 h-4 rounded border-2 transition-colors",
            "group-hover:border-[#3B82F6]/50"
          )}
        >
          <AnimatePresence mode="wait">
            {checked && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5, rotate: -45 }}
                transition={{ duration: 0.2, ease: "backOut" }}
                className="flex items-center justify-center w-full h-full"
              >
                <Check className="w-3 h-3 text-white stroke-[3]" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      {label && (
        <span className="text-[9px] text-[#7C8798] group-hover:text-[#F5F7FB] transition-colors leading-tight tracking-wider">
          {label}
        </span>
      )}
    </label>
  );
};
