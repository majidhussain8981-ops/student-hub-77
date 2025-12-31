import { cn } from '@/lib/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'default';

interface StatusBadgeProps {
  status: string;
  type?: StatusType;
  className?: string;
}

const statusTypeMap: Record<string, StatusType> = {
  active: 'success',
  enrolled: 'success',
  present: 'success',
  passed: 'success',
  completed: 'success',
  inactive: 'error',
  dropped: 'error',
  absent: 'error',
  failed: 'error',
  late: 'warning',
  excused: 'info',
  pending: 'warning',
};

const typeStyles: Record<StatusType, string> = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-info/10 text-info border-info/20',
  default: 'bg-muted text-muted-foreground border-border',
};

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const resolvedType = type || statusTypeMap[status.toLowerCase()] || 'default';
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize',
        typeStyles[resolvedType],
        className
      )}
    >
      {status}
    </span>
  );
}
