import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div className={`bg-surface border border-border rounded-lg ${className}`} {...props}>
      {children}
    </div>
  );
}
