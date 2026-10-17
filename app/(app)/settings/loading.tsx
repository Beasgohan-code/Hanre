export default function Loading() {
  return (
    <div className="page">
      <div className="page-loading" aria-busy="true" aria-label="Loading settings">
        <div className="skeleton" style={{ width: 110, height: 11 }} />
        <div className="skeleton" style={{ width: 220, height: 30 }} />
        <div className="settings-grid">
          <div className="stack gap-8">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="skeleton" style={{ height: 30, borderRadius: 8 }} key={index} />
            ))}
          </div>
          <div className="stack gap-16">
            <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 260, borderRadius: 16 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
