export default function PageSkeleton({ stats = 4 }: { stats?: number }) {
  return (
    <div className="page">
      <div className="page-loading" aria-busy="true" aria-label="Loading workspace">
        <div className="skeleton" style={{ width: 130, height: 11 }} />
        <div className="skeleton" style={{ width: 280, height: 30, maxWidth: "70%" }} />
        <div className="skeleton" style={{ width: 420, maxWidth: "90%", height: 13 }} />
        <div className="stat-grid" style={{ marginTop: 16 }}>
          {Array.from({ length: stats }).map((_, index) => (
            <div className="skeleton skeleton-stat" key={index} />
          ))}
        </div>
        <div className="dash-grid">
          <div className="stack gap-16">
            <div className="skeleton" style={{ height: 220, borderRadius: 16 }} />
            <div className="project-grid">
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
            </div>
          </div>
          <div className="stack gap-16">
            <div className="skeleton" style={{ height: 240, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
