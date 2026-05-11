/**
 * Pagination helper that adds consistent pagination to any list endpoint.
 * Use in controllers: const { page, limit, skip } = req.pagination;
 */
export const paginationDefaults = (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const sort = req.query.sort || '-createdAt';

  req.pagination = { page, limit, skip, sort };
  next();
};

/**
 * Helper to format paginated response.
 * @param {Response} res
 * @param {Array} data - query results
 * @param {number} total - total count
 * @param {object} pagination - { page, limit }
 */
export const paginatedResponse = (res, data, total, pagination) => {
  const { page, limit } = pagination;
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
};
