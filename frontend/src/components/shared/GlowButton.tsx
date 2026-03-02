import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface GlowButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  type?: 'button' | 'submit';
}

const variants = {
  primary: 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/25',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200 shadow-slate-500/10',
  danger: 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/25',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
};

export default function GlowButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
}: GlowButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={disabled || loading ? {} : { scale: 1.02 }}
      whileTap={disabled || loading ? {} : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative inline-flex items-center justify-center gap-2
        rounded-lg font-semibold shadow-lg
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${variant === 'primary' && !disabled ? 'hover:shadow-violet-500/40 hover:shadow-xl' : ''}
        ${className}
      `}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
}
