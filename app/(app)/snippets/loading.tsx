export default function Loading() {
  return (
    <div className="page">
      <div className="page-loading" aria-busy="true" aria-label="Loading snippets">
        <div className="skeleton" style={{ width: 100, height: 11 }} />
        <div className="skeleton" style={{ width: 230, height: 30 }} />
        <div className="skeleton" style={{ width: 430, maxWidth: "90%", height: 13 }} />
        <div className="toolbar" style={{ marginTop: 16 }}>
          <div className="skeleton" style={{ width: 320, height: 36, borderRadius: 9 }} />
        </div>
        <div className="snippet-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="skeleton" style={{ height: 260, borderRadius: 14 }} key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
