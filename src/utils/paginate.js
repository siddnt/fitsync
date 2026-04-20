/**
 * Extracts and validates pagination query params from an Express request.
 *
 * @param {object} query   - req.query
 * @param {number} defaultLimit - items per page (default 10, capped at 100)
 * @returns {{ page: number, limit: number, skip: number }}
 */
export const getPaginationParams = (query = {}, defaultLimit = 10) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

/**
 * Builds the pagination metadata object to attach to API responses.
 *
 * @param {number} total  - total documents matching the query
 * @param {number} page   - current page number
 * @param {number} limit  - items per page
 * @returns {{ total: number, page: number, limit: number, totalPages: number }}
 */
export const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
