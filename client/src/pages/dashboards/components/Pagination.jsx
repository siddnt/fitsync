import { useMemo } from 'react';
import './Pagination.css';

/**
 * <Pagination /> – renders page controls below a table.
 */
const Pagination = ({ page, totalPages, from, to, total, onPageChange }) => {
    if (total <= 0) return null;

    /* Build the page-number list (max 7 visible, with ellipses) */
    const pages = useMemo(() => {
        const maxVisible = 7;
        if (totalPages <= maxVisible) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages = [1];
        let start = Math.max(2, page - 1);
        let end = Math.min(totalPages - 1, page + 1);
        if (page <= 3) { start = 2; end = 5; }
        if (page >= totalPages - 2) { start = totalPages - 4; end = totalPages - 1; }
        if (start > 2) pages.push('…L');
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push('…R');
        pages.push(totalPages);
        return pages;
    }, [page, totalPages]);

    return (
        <div className="pagination">
            <span className="pagination__info">
                Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
            </span>

            <div className="pagination__controls">
                <button
                    type="button"
                    className="pagination__btn"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    aria-label="Previous page"
                >
                    ‹
                </button>

                {pages.map((p) =>
                    typeof p === 'string' ? (
                        <span key={p} className="pagination__ellipsis">…</span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            className={`pagination__btn ${p === page ? 'pagination__btn--active' : ''}`}
                            onClick={() => onPageChange(p)}
                        >
                            {p}
                        </button>
                    ),
                )}

                <button
                    type="button"
                    className="pagination__btn"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    aria-label="Next page"
                >
                    ›
                </button>
            </div>
        </div>
    );
};

export default Pagination;
