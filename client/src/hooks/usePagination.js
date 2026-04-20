import { useState, useEffect } from 'react';

/**
 * Reusable client-side pagination hook.
 * @param {Array} items - The full list to paginate.
 * @param {number} pageSize - Number of items per page (default: 10).
 */
export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);

  // Reset to page 1 whenever the list changes (e.g. filter applied)
  useEffect(() => {
    setPage(1);
  }, [items.length]);

  return {
    page: safePage,
    totalPages,
    slice,
    setPage,
    totalItems: items.length,
    startIndex: start + 1,
    endIndex: Math.min(start + pageSize, items.length),
  };
}
