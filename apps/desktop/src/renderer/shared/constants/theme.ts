/**
 * Centralized design tokens. Single source of truth for colors,
 * sizes, and animation presets used across the renderer.
 *
 * Tailwind classes still reference these hex values directly —
 * this file exists so non-Tailwind usage (inline styles, JS logic)
 * stays consistent and discoverable.
 */

export const COLORS = {
  bg: {
    primary: '#0B0F14',
    card: '#171C23',
    elevated: '#1E2632',
  },
  border: {
    default: '#263042',
    muted: '#344054',
  },
  text: {
    primary: '#F5F7FB',
    secondary: '#7C8798',
    muted: '#4A5568',
    placeholder: '#3A4555',
  },
  accent: {
    blue: '#3B82F6',
    blueHover: '#2563EB',
    cyan: '#22D3EE',
  },
  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
  },
} as const;

export const ANIMATION = {
  fadeSlide: {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -10 },
    transition: { duration: 0.25 },
  },
  fadeUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
  },
} as const;
