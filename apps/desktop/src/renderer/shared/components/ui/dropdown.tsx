import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Selecciona...',
  className,
  icon,
  onFocus,
  onBlur,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleToggle = () => {
    if (disabled || options.length === 0) {
      return;
    }

    setIsOpen(!isOpen);
    if (!isOpen && onFocus) onFocus();
    if (isOpen && onBlur) onBlur();
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    if (onBlur) onBlur();
  };

  // Click away listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) {
          setIsOpen(false);
          if (onBlur) onBlur();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onBlur]);

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border border-[#263042] bg-[#101720]/90 py-2.5 pr-4 text-left text-[10px] font-black uppercase tracking-[0.18em] text-[#F5F7FB] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-200",
          icon ? "pl-10" : "pl-4",
          isOpen && "border-[#3B82F6]/60 bg-[#121b28]",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7C8798]">
            {icon}
          </span>
        )}
        <div className="flex items-center gap-2 overflow-hidden">
          <span className={cn(
            "truncate",
            !selectedOption ? "text-[#7C8798]" : "text-[#F5F7FB]"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-[#7C8798] transition-transform duration-200",
          isOpen && "rotate-180 text-[#3B82F6]"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-[#263042] bg-[#0b1017]/95 shadow-[0_24px_64px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "group flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] transition-all",
                      isSelected 
                        ? "border-[#3B82F6]/25 bg-[#3B82F6]/10 text-[#F5F7FB]" 
                        : "text-[#A8B3C4] hover:border-[#263042] hover:bg-white/[0.03] hover:text-[#F5F7FB]"
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-[#3B82F6]" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-transparent transition-colors group-hover:bg-[#3B82F6]/50" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
