export default function Loading() {
  return (
    <div className="page">
      <div className="page-loading" aria-busy="true" aria-label="Loading projects">
        <div className="skeleton" style={{ width: 110, height: 11 }} />
        <div className="skeleton" style={{ width: 240, height: 30 }} />
        <div className="skeleton" style={{ width: 440, maxWidth: "90%", height: 13 }} />
        <div className="toolbar" style={{ marginTop: 18 }}>
          <div className="skeleton" style={{ width: 320, height: 36, borderRadius: 9 }} />
          <div className="skeleton" style={{ width: 140, height: 36, borderRadius: 9 }} />
        </div>
        <div className="project-tiles">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="skeleton skeleton-card" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
