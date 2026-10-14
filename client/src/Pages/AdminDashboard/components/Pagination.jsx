// client/src/pages/AdminDashboard/components/Pagination.jsx
import React from "react";

export default function Pagination({ page, total, setPage }) {
  if (total <= 1) return null;

  return (
    <div className="pagination">
      <button
        className="btn-ghost-sm"
        disabled={page <= 1}
        onClick={() => setPage(Math.max(1, page - 1))}
      >
        ⬅ Previous
      </button>
      <span className="pagination-info">
        Page {page} of {total}
      </span>
      <button
        className="btn-ghost-sm"
        disabled={page >= total}
        onClick={() => setPage(Math.min(total, page + 1))}
      >
        Next ➡
      </button>
    </div>
  );
}