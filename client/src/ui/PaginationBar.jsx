import './PaginationBar.css';

/**
 * Dashboard pagination bar.
 * Props:
 *   page        {number}   Current page (1-indexed)
 *   totalPages  {number}   Total number of pages
 *   totalItems  {number}   Total number of items
 *   startIndex  {number}   First item index on this page
 *   endIndex    {number}   Last item index on this page
 *   onPage      {function} Called with new page number
 */
const PaginationBar = ({ page, totalPages, totalItems, startIndex, endIndex, onPage }) => {
  if (totalItems === 0) return null;

  const buildPages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) {
      pages.push(p);
    }
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="pagination-bar">
      <span className="pagination-bar__info">
        Showing <strong>{startIndex}–{endIndex}</strong> of <strong>{totalItems}</strong>
      </span>
      <div className="pagination-bar__controls">
        <button
          type="button"
          className="pagination-bar__btn"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ← Prev
        </button>

        {buildPages().map((p, i) =>
          p === '…' ? (
            // eslint-disable-next-line react/no-array-index-key
            <span key={`ellipsis-${i}`} className="pagination-bar__ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`pagination-bar__btn ${p === page ? 'pagination-bar__btn--active' : ''}`}
              onClick={() => onPage(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="pagination-bar__btn"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default PaginationBar;
