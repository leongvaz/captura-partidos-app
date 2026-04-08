import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const baseClasses =
  'inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-slate-200/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100',
  ghost:
    'bg-transparent hover:bg-slate-800/60 text-slate-100 border border-transparent hover:border-slate-600',
  danger:
    'bg-red-700/80 hover:bg-red-600 text-white border border-red-800/80 hover:border-red-700/80',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-3 text-sm',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    />
  );
}

interface ActionIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger';
  children: ReactNode;
}

export function ActionIconButton({
  variant = 'default',
  className = '',
  ...props
}: ActionIconButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-md border text-[11px] p-1.5 focus:outline-none focus:ring-2 focus:ring-slate-200/60 transition-colors';
  const byVariant =
    variant === 'danger'
      ? 'border-slate-600 bg-slate-900 text-red-300 hover:bg-red-900/30 hover:border-red-700 hover:text-red-200'
      : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-slate-500';

  return <button {...props} className={`${base} ${byVariant} ${className}`} />;
}

