import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  iconClassName?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  iconClassName,
}: StatCardProps) {
  return (
    <div className={cn('stat-card group', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className={cn(
              'inline-flex items-center text-xs font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span className="ml-1">{Math.abs(trend.value)}%</span>
              <span className="ml-1 text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110',
          iconClassName
        )}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
