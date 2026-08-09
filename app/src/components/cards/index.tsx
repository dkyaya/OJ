import type { PropsWithChildren, ReactNode } from 'react';

type CardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  status?: string;
  metric?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}>;

export function SummaryCard({ title, subtitle, status, metric, meta, action, className = '', children }: CardProps) {
  return (
    <article className={`card summary-card ${className}`.trim()}>
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {status && <span className="status" data-status={status.toLowerCase()}>{status}</span>}
      </div>
      {metric !== undefined && <strong className="card-metric">{metric}</strong>}
      {children}
      {(meta || action) && <footer><span>{meta}</span>{action}</footer>}
    </article>
  );
}

export function MetricCard({ title, value, subtitle }: { title: string; value: ReactNode; subtitle: string }) {
  return <article className="card metric-card"><span>{title}</span><strong>{value}</strong><p>{subtitle}</p></article>;
}

export function EmptyCard({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <section className="card empty-card"><h2>{title}</h2><p>{subtitle}</p>{action}</section>;
}

export function ExpandablePanel({ title, summary, children, open = false }: PropsWithChildren<{ title: string; summary: string; open?: boolean }>) {
  return <details className="card expandable-panel" open={open}><summary><span><b>{title}</b><small>{summary}</small></span><i aria-hidden="true">+</i></summary><div className="expanded-content">{children}</div></details>;
}

export const CatalystCard = SummaryCard;
export const IdeaCard = SummaryCard;
export const TradeCard = SummaryCard;
