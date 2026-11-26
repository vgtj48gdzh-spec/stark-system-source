export const API_PAGE_SIZE_LIMIT = 100;

export interface ApiPageQuery {
  page: number;
  pageSize: number;
}

export interface ApiPagePayload<T> {
  list: T[];
  total: number;
}

export async function fetchAllAtApiPageLimit<T>(
  fetchPage: (query: ApiPageQuery) => Promise<ApiPagePayload<T>>,
): Promise<T[]> {
  const items: T[] = [];

  for (let page = 1; ; page += 1) {
    const payload = await fetchPage({ page, pageSize: API_PAGE_SIZE_LIMIT });
    const list = Array.isArray(payload?.list) ? payload.list : [];
    const total = Number(payload?.total);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error('分页接口返回的 total 无效');
    }

    items.push(...list);
    if (items.length >= total) {
      return items.slice(0, total);
    }

    if (list.length === 0 || list.length < API_PAGE_SIZE_LIMIT) {
      throw new Error('分页接口在返回全部数据前提前结束');
    }
  }
}
