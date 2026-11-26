import http from './http';

export function getSystemHealth() {
  return http.get('/health');
}
