import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'outline';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  const byVariant: Record<BadgeVariant, string> = {
    default: 'bg-slate-600 text-slate-100',
    success: 'bg-emerald-700 text-emerald-50',
    warning: 'bg-amber-800 text-amber-100',
    danger: 'bg-red-800 text-red-100',
    outline: 'border border-slate-500 text-slate-200',
  };

  return <span className={`${base} ${byVariant[variant]} ${className}`}>{children}</span>;
}

