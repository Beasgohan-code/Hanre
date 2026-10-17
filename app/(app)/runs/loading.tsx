export default function Loading() {
  return (
    <div className="page">
      <div className="page-loading" aria-busy="true" aria-label="Loading run history">
        <div className="skeleton" style={{ width: 120, height: 11 }} />
        <div className="skeleton" style={{ width: 260, height: 30 }} />
        <div className="stat-grid" style={{ marginTop: 14 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="skeleton skeleton-stat" key={index} />
          ))}
        </div>
        <div className="stack gap-8" style={{ marginTop: 8 }}>
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="skeleton skeleton-row" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
