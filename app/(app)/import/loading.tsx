export default function Loading() {
  return (
    <div className="page">
      <div className="page-loading" aria-busy="true" aria-label="Loading GitHub import">
        <div className="skeleton" style={{ width: 110, height: 11 }} />
        <div className="skeleton" style={{ width: 300, height: 30 }} />
        <div className="skeleton" style={{ width: 460, maxWidth: "90%", height: 13 }} />
        <div className="import-grid" style={{ marginTop: 8 }}>
          <div className="skeleton" style={{ height: 320, borderRadius: 16 }} />
          <div className="stack gap-16">
            <div className="skeleton" style={{ height: 150, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 110, borderRadius: 16 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
