import http from './http';

export function getMaterialStocks(params?: { warehouseId?: number; materialId?: number }) {
  return http.get('/material-stocks', { params });
}
