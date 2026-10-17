export default function Loading() {
  return (
    <div className="page workbench-page">
      <div className="workbench">
        <div className="wb-head">
          <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 7 }} />
          <div className="skeleton" style={{ width: 180, height: 16 }} />
          <div style={{ flex: 1 }} />
          <div className="skeleton" style={{ width: 160, height: 30, borderRadius: 8 }} />
        </div>
        <div className="wb-body">
          <div className="wb-side">
            <div style={{ padding: 12 }} className="stack gap-8">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="skeleton" style={{ height: 22, width: `${90 - index * 7}%` }} />
              ))}
            </div>
          </div>
          <div className="wb-main">
            <div className="skeleton" style={{ height: 37, borderRadius: 0 }} />
            <div style={{ flex: 1, padding: 20 }} className="stack gap-10">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="skeleton" style={{ height: 12, width: `${95 - (index % 5) * 12}%` }} />
              ))}
            </div>
            <div className="skeleton" style={{ height: 220, borderRadius: 0 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
