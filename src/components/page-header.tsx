import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

export function PageHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description?: ReactNode;
  badge?: { label: string; tone?: 'default' | 'secondary' };
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-primary">{title}</h1>
          {badge ? (
            <Badge variant={badge.tone === 'secondary' ? 'secondary' : 'default'}>{badge.label}</Badge>
          ) : null}
        </div>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
