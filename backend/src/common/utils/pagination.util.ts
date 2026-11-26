export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginationResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function getPagination(query: PaginationQuery) {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.max(1, Number(query.pageSize ?? 10));

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPaginationResult<T>(
  query: PaginationQuery,
  list: T[],
  total: number,
): PaginationResult<T> {
  const { page, pageSize } = getPagination(query);

  return {
    list,
    total,
    page,
    pageSize,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export function paginateArray<T>(items: T[], query: PaginationQuery): PaginationResult<T> {
  const { skip, take } = getPagination(query);
  const list = items.slice(skip, skip + take);
  return buildPaginationResult(query, list, items.length);
}
