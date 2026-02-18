import * as React from 'react';
import { cn } from '../../lib/utils';

const Alert = React.forwardRef(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(
      'relative w-full rounded-lg border p-4 text-sm',
      variant === 'destructive' && 'border-red-200 bg-[#fff4f4] text-red-800',
      variant === 'warning' && 'border-amber-200 bg-[#fff9eb] text-amber-800',
      variant === 'info' && 'border-blue-200 bg-[#eff6ff] text-blue-800',
      variant === 'default' && 'border-[#e2e8f0] bg-white text-[#0f172a]',
      className
    )}
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-bold leading-tight tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-xs leading-relaxed opacity-90', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
