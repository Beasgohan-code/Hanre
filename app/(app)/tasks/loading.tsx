export default function Loading() {
  return (
    <div className="page">
      <div className="page-loading" aria-busy="true" aria-label="Loading tasks">
        <div className="skeleton" style={{ width: 100, height: 11 }} />
        <div className="skeleton" style={{ width: 210, height: 30 }} />
        <div className="skeleton" style={{ width: 440, maxWidth: "90%", height: 13 }} />
        <div className="board" style={{ marginTop: 18 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="skeleton" style={{ height: 300, borderRadius: 14 }} key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
