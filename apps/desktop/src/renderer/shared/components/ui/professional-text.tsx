import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface ProfessionalTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export const ProfessionalText: React.FC<ProfessionalTextProps> = ({ 
  text, 
  className,
  delay = 0 
}) => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$X&";
  const [displayText, setDisplayText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    timeout = setTimeout(() => {
      setIsAnimating(true);
      let iteration = 0;
      
      const interval = setInterval(() => {
        setDisplayText(
          text
            .split("")
            .map((char, index) => {
              if (index < iteration) {
                return text[index];
              }
              return characters[Math.floor(Math.random() * characters.length)];
            })
            .join("")
        );

        if (iteration >= text.length) {
          clearInterval(interval);
        }

        iteration += 1 / 3;
      }, 30);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <motion.span 
      className={`font-mono ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {displayText || (isAnimating ? "" : " ")}
    </motion.span>
  );
};
