import React from "react";
import logoDark from "@/assets/logo_dark.png";

export const Logo: React.FC<{ className?: string, hideText?: boolean }> = ({ className, hideText = false }) => {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-primary blur-2xl opacity-15 rounded-full scale-110"></div>
        <img
          src={logoDark}
          alt="AQELOR Logo"
          className="relative w-28 h-auto object-contain transition-all duration-700 hover:scale-110 invert brightness-90 contrast-125 dark:invert-0 dark:brightness-100 dark:contrast-100"
        />
      </div>
      {!hideText && (
        <span className="text-2xl font-bold tracking-[0.3em] bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/80 to-muted-foreground/60 mt-1 ml-1 uppercase">
          AQELOR
        </span>
      )}
    </div>
  );
};
