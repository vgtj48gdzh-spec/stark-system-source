import { ElMessage } from 'element-plus';
import axios, { type AxiosInstance } from 'axios';
import { getCurrentUserId } from '../utils/permissions';

const http = axios.create({
  baseURL:
    (__OWNER_INTAKE__ ? '/owner-intake-api' : import.meta.env.VITE_API_BASE_URL) ||
    (__OWNER_REPAIR_READONLY__
      ? '/owner-repair-api'
      : __OWNER_REPAIR_ACCEPTANCE__
        ? '/owner-repair-acceptance-api'
        : '/api'),
  timeout: 10000,
});
const OWNER_BANK_SMS_READONLY_ENABLED = __OWNER_BANK_SMS_READONLY__;
const OWNER_REPAIR_READONLY_ENABLED = __OWNER_REPAIR_READONLY__;
const OWNER_REPAIR_ACCEPTANCE_ENABLED = __OWNER_REPAIR_ACCEPTANCE__;

export const gov1AcceptanceHttp = axios.create({
  baseURL: '/gov1-acceptance-api',
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  if (
    !OWNER_BANK_SMS_READONLY_ENABLED &&
    !__OWNER_INTAKE__ &&
    !OWNER_REPAIR_READONLY_ENABLED &&
    !OWNER_REPAIR_ACCEPTANCE_ENABLED
  ) {
    config.headers['x-user-id'] = String(getCurrentUserId());
  }
  return config;
});

function installResponseInterceptor(client: AxiosInstance) {
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const message =
        error.response?.data?.message || error.message || '请求失败，请稍后重试';

      if (error.config?.headers?.['x-suppress-global-error'] !== '1') {
        ElMessage.error(message);
      }
      return Promise.reject(error);
    },
  );
}

installResponseInterceptor(http);
installResponseInterceptor(gov1AcceptanceHttp);

export default http;
