// client/src/pages/AdminDashboard/components/SnapshotsTab.jsx
import React from "react";
import Pagination from "./Pagination";

export default function SnapshotsTab({
  snapshots,
  allSnapshots,
  loading,
  pagination,
  setPagination,
  onPreview,
  onRefresh,
}) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button className="btn-ghost-sm" onClick={onRefresh}>🔄 Refresh</button>
        <span style={{ marginLeft: 12, color: "#687791", fontSize: 14 }}>
          Total: {allSnapshots.length} snapshots
        </span>
      </div>

      {snapshots.length === 0 ? (
        <div className="empty-state">No snapshots found</div>
      ) : (
        <div className="snapshots-grid">
          {snapshots.map((snap, i) => (
            <div key={i} className="snapshot-item">
              <img
                src={snap.image_url}
                alt={`Snapshot ${i}`}
                onClick={() => onPreview(snap.image_url)}
                className="snapshot-image"
              />
              <div className="snapshot-info">
                <div>User: {snap.user_id}</div>
                <div>Test: {snap.test_id}</div>
                <div>{new Date(snap.timestamp || snap.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={pagination.snapshots}
        total={Math.ceil(allSnapshots.length / 10) || 1}
        setPage={(page) => setPagination((prev) => ({ ...prev, snapshots: page }))}
      />
    </div>
  );
}