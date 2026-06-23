import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

const variantClasses = {
  primary: 'bg-accent hover:bg-accent/90 text-white',
  success: 'bg-success/20 hover:bg-success/30 text-success',
  danger: 'bg-danger hover:bg-danger/90 text-white',
  warning: 'bg-warning hover:bg-warning/90 text-white',
  ghost: 'bg-transparent hover:bg-surface2 text-text2 hover:text-text border border-border',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`
        inline-flex items-center justify-center gap-2 rounded-md font-semibold
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={disabled}
      aria-disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
