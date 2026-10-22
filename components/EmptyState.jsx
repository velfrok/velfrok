export function EmptyState({ icon = "🛒", title, hint, cta }) {
  return <div className="empty">{icon}<h3>{title}</h3><p>{hint}</p>{cta}</div>;
}
export function Skeleton() {
  return <div className="skeleton-card" aria-busy="true" aria-label="Loading" />;
}
