interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-4',
};

export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`
        ${sizeClasses[size]}
        border-accent/30 border-t-accent
        rounded-full animate-spin
        ${className}
      `}
    />
  );
}
