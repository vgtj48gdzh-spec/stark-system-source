import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGov1AcceptanceProxyOptions,
  createGov1DevProxyLoopbackGuardPlugin,
  resolveGov1DevProxyIdentity,
} from './scripts/gov1-dev-proxy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version?: string;
};
const frontendBuildTime = new Date().toISOString();
const frontendBuildId = `${packageJson.version ?? '0.1.0'}-${frontendBuildTime
  .replace(/[-:TZ.]/g, '')
  .slice(0, 14)}`;
const optimizedDevDependencies = ['vue', 'vue-router', 'element-plus', 'axios', 'dayjs'];
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:3000';
export default defineConfig(({ mode }) => {
  const ownerBankSmsReadonlyBuild = mode === 'owner-bank-sms-readonly';
  const ownerRepairReadonlyBuild = mode === 'owner-repair-readonly';
  const ownerRepairAcceptanceBuild = mode === 'owner-repair-acceptance';
  const ownerIntakeBuild = mode === 'owner-intake';
  const gov1DevProxyIdentity = resolveGov1DevProxyIdentity();

  return {
    base: ownerIntakeBuild ? '/owner-intake/' : ownerBankSmsReadonlyBuild
      ? '/owner-bank-sms/'
      : ownerRepairReadonlyBuild
        ? '/owner-repair/'
        : ownerRepairAcceptanceBuild
          ? '/owner-repair-acceptance/'
        : '/',
    plugins: [vue(), createGov1DevProxyLoopbackGuardPlugin({ identity: gov1DevProxyIdentity })],
    optimizeDeps: {
      noDiscovery: true,
      include: optimizedDevDependencies,
      force: true,
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version ?? '0.1.0'),
      __APP_BUILD_TIME__: JSON.stringify(frontendBuildTime),
      __APP_BUILD_ID__: JSON.stringify(frontendBuildId),
      __OWNER_BANK_SMS_READONLY__: JSON.stringify(ownerBankSmsReadonlyBuild),
      __OWNER_REPAIR_READONLY__: JSON.stringify(ownerRepairReadonlyBuild),
      __OWNER_REPAIR_ACCEPTANCE__: JSON.stringify(ownerRepairAcceptanceBuild),
      __OWNER_INTAKE__: JSON.stringify(ownerIntakeBuild),
    },
    build: ownerIntakeBuild ? { outDir: 'dist-owner-intake', emptyOutDir: true } : ownerBankSmsReadonlyBuild
      ? {
          outDir: 'dist-owner-bank-sms-readonly',
          emptyOutDir: true,
        }
      : ownerRepairReadonlyBuild
        ? {
            outDir: 'dist-owner-repair-readonly',
            emptyOutDir: true,
          }
        : ownerRepairAcceptanceBuild
          ? {
              outDir: 'dist-owner-repair-acceptance',
              emptyOutDir: true,
            }
        : undefined,
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/gov1-acceptance-api': createGov1AcceptanceProxyOptions({
          target: apiProxyTarget,
          identity: gov1DevProxyIdentity,
        }),
      },
    },
  };
});
