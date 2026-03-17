import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface CalendarProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export const Calendar: React.FC<CalendarProps> = ({ value, onChange, onClose }) => {
  const initialDate = value ? new Date(value) : new Date();
  const [viewDate, setViewDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearsRef = useRef<HTMLDivElement>(null);

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    setSelectedDate(newDate);
    const formatted = newDate.toISOString().split('T')[0];
    onChange(formatted);
    onClose();
  };

  const handleSelectYear = (year: number) => {
    setViewDate(new Date(year, viewDate.getMonth(), 1));
    setShowYearPicker(false);
  };

  // Generate years from 1940 to current + 10
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = 1940; y <= currentYear + 10; y++) {
    years.push(y);
  }

  // Scroll to selected year when picker opens
  useEffect(() => {
    if (showYearPicker && yearsRef.current) {
      const selectedYearEl = yearsRef.current.querySelector('[data-selected="true"]');
      if (selectedYearEl) {
        selectedYearEl.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }
  }, [showYearPicker]);

  const days = [];
  const totalDays = daysInMonth(viewDate.getMonth(), viewDate.getFullYear());
  const offset = firstDayOfMonth(viewDate.getMonth(), viewDate.getFullYear());

  for (let i = 0; i < offset; i++) {
    days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
  }

  for (let day = 1; day <= totalDays; day++) {
    const isSelected = selectedDate && 
                      selectedDate.getDate() === day && 
                      selectedDate.getMonth() === viewDate.getMonth() && 
                      selectedDate.getFullYear() === viewDate.getFullYear();
    const isToday = new Date().getDate() === day && 
                    new Date().getMonth() === viewDate.getMonth() && 
                    new Date().getFullYear() === viewDate.getFullYear();

    days.push(
      <button
        key={day}
        type="button"
        onClick={(e) => { e.stopPropagation(); handleSelectDay(day); }}
        className={cn(
          "h-8 w-8 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center",
          isSelected 
            ? "bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20 scale-110" 
            : isToday 
              ? "text-[#3B82F6] bg-[#3B82F6]/10" 
              : "text-[#F5F7FB] hover:bg-[#263042]"
        )}
      >
        {day}
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[40] cursor-default" onClick={onClose} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="absolute top-full left-0 mt-2 w-64 bg-[#111827] border border-[#263042] rounded-2xl p-4 shadow-2xl z-[50] pointer-events-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[#263042] transition-colors group"
          >
            <span className="text-[10px] font-bold text-white uppercase tracking-widest group-hover:text-[#3B82F6]">
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <ChevronRight className={cn("w-3 h-3 text-[#7C8798] transition-transform", showYearPicker && "rotate-90")} />
          </button>
          
           {!showYearPicker && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-[#263042] rounded-lg transition-colors text-[#7C8798] hover:text-white"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-[#263042] rounded-lg transition-colors text-[#7C8798] hover:text-white"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="relative min-h-[180px]">
          <AnimatePresence mode="wait">
            {showYearPicker ? (
              <motion.div
                key="years"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="absolute inset-0 overflow-y-auto pr-2 custom-scrollbar"
                ref={yearsRef}
              >
                <div className="grid grid-cols-3 gap-2">
                  {years.map(y => (
                    <button
                      key={y}
                      type="button"
                      data-selected={y === viewDate.getFullYear()}
                      onClick={() => handleSelectYear(y)}
                      className={cn(
                        "py-2 rounded-xl text-[10px] font-bold transition-all",
                        y === viewDate.getFullYear()
                          ? "bg-[#3B82F6] text-white"
                          : "text-[#7C8798] hover:bg-[#263042] hover:text-[#F5F7FB]"
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="days"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="grid grid-cols-7 gap-1">
                  {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(d => (
                    <div key={d} className="h-8 w-8 flex items-center justify-center text-[8px] font-bold text-[#4A5568] uppercase">
                      {d}
                    </div>
                  ))}
                  {days}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="pt-4 mt-2 border-t border-[#263042] flex justify-between items-center">
          <button
            type="button"
            onClick={() => { onChange(''); onClose(); }}
            className="text-[9px] font-bold text-red-400/80 hover:text-red-400 uppercase tracking-widest"
          >
            Limpiar
          </button>
          <button
            type="button"
            className="text-[9px] font-bold text-[#7C8798] hover:text-white uppercase tracking-widest flex items-center gap-1.5"
            onClick={() => { setShowYearPicker(false); setViewDate(new Date()); }}
          >
            <CalendarIcon className="w-3 h-3" />
            Hoy
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[9px] font-bold text-[#3B82F6] uppercase tracking-widest"
          >
            Listo
          </button>
        </div>
      </motion.div>
    </>
  );
};
