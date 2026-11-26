<template>
  <el-container class="layout-shell">
    <el-aside width="220px" class="layout-aside">
      <div class="logo">斯塔克系统 MVP</div>
      <el-scrollbar>
        <el-menu router :default-active="route.path" :default-openeds="openGroupIds">
          <el-sub-menu v-for="group in visibleNavigationGroups" :key="group.id" :index="group.id">
            <template #title>{{ group.title }}</template>
            <el-menu-item v-for="item in group.items" :key="item.path" :index="item.path">
              {{ resolveMenuLabel(item) }}
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-scrollbar>
    </el-aside>
    <el-container>
      <el-header class="layout-header">
        <div>
          <div class="header-title">企业管理系统 MVP</div>
          <div class="header-subtitle">工单、财务、库存、ABC 只读接入与绩效基础一体化管理</div>
        </div>
        <div class="header-actions">
          <div v-if="showRuntimeFingerprint" class="runtime-fingerprint">
            <div>前端 {{ frontendBuildLabel }}</div>
            <div v-if="backendFingerprintLabel">{{ backendFingerprintLabel }}</div>
            <div v-else>后端指纹读取中...</div>
          </div>
          <el-tag :type="formalActorIdentityBound ? 'success' : 'warning'">
            {{ identityLabel }}
          </el-tag>
          <el-select
            v-if="!isLogsReadonly"
            v-model="selectedRole"
            size="small"
            class="role-switcher"
            :disabled="formalActorIdentityBound || isLogsReadonly"
          >
            <el-option
              v-for="item in roleOptions"
              :key="item.code"
              :label="`${item.label}（用户 ${item.userId}）`"
              :value="item.code"
            />
          </el-select>
        </div>
      </el-header>
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { getAuthenticatedUser } from '../api/auth';
import { getSystemHealth } from '../api/system';
import { useRoute, useRouter } from 'vue-router';
import type { NavigationItem } from '../utils/navigation';
import { navigationGroups } from '../utils/navigation';
import { requiresGov1FormalIdentity } from '../utils/gov1-formal-identity-route';
import { operationLogsAdmission, requiresOperationLogsIdentity } from '../utils/operation-logs-admission';
import {
  currentRoleCode,
  currentRoleProfile,
  authenticatedUserIdentity,
  formalActorIdentityBound,
  hasAnyRole,
  resolveHomePath,
  roleOptions,
  setAuthenticatedUserIdentity,
  setCurrentRole,
  type RoleCode,
} from '../utils/permissions';

const route = useRoute();
const router = useRouter();
const isLogsReadonly = computed(() => requiresOperationLogsIdentity(route.matched));
const authenticatedIdentityScope = computed(() =>
  requiresGov1FormalIdentity(route.matched) ? 'gov1_acceptance' : 'application',
);
let authenticatedIdentityRequestSequence = 0;
const backendFingerprint = ref<{
  pid?: number | null;
  startedAt?: string | null;
  buildId?: string | null;
  appVersion?: string | null;
} | null>(null);

const fundTruthNavigationItem: NavigationItem = {
  path: '/fund-truth-reconciliations',
  label: '资金真相对照',
  roles: ['admin', 'finance', 'approver'],
};

const visibleNavigationGroups = computed(() => {
  if (isLogsReadonly.value) {
    return [{ id: 'main-readonly', title: '主站只读入口', items: [
      { path: '/operation-logs', label: '操作日志', roles: ['admin', 'finance', 'approver'] } as NavigationItem,
    ] }];
  }
  const groups = navigationGroups.map((group) => ({
    ...group,
    items: [...group.items],
  }));

  const coreGroup = groups.find((group) => group.id === 'core');
  if (
    coreGroup &&
    !coreGroup.items.some((item) => item.path === fundTruthNavigationItem.path)
  ) {
    coreGroup.items.splice(4, 0, fundTruthNavigationItem);
  }

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAnyRole(item.roles)),
    }))
    .filter((group) => group.items.length > 0);
});

const openGroupIds = computed(() => visibleNavigationGroups.value.map((group) => group.id));

const selectedRole = computed<RoleCode>({
  get: () => currentRoleCode.value,
  set: async (value) => {
    setCurrentRole(value);
    await router.replace(resolveHomePath(value));
  },
});

const showRuntimeFingerprint = computed(
  () => !isLogsReadonly.value && (hasAnyRole(['admin', 'finance']) || route.query.debugRuntime === '1'),
);

const frontendBuildLabel = computed(() => {
  const buildTime = (__APP_BUILD_TIME__ || '').replace('T', ' ').slice(0, 19);
  return `${__APP_VERSION__} / ${__APP_BUILD_ID__} / ${buildTime}`;
});

const backendFingerprintLabel = computed(() => {
  if (!backendFingerprint.value) {
    return '';
  }
  const startedAt = (backendFingerprint.value.startedAt || '').replace('T', ' ').slice(0, 19);
  return `后端 ${backendFingerprint.value.appVersion || '-'} / ${
    backendFingerprint.value.buildId || '-'
  } / PID ${backendFingerprint.value.pid || '-'} / ${startedAt || '-'}`;
});

const identityLabel = computed(() => {
  if (isLogsReadonly.value) {
    const { status, identity } = operationLogsAdmission.state.value;
    return status === 'authorized' && identity
      ? `${identity.realName || identity.username} · 正式只读身份（编号 ${identity.id}）`
      : status === 'checking' ? '正在验证正式身份' : '正式身份未通过';
  }
  const identity = authenticatedUserIdentity.value;
  if (identity?.formalIdentityBound) {
    return `${identity.realName || identity.username} · 正式身份`;
  }
  return `${currentRoleProfile.value.label} · 本地演示身份`;
});

function resolveMenuLabel(item: NavigationItem) {
  return item.labelByRole?.[currentRoleCode.value] ?? item.label;
}

async function loadRuntimeFingerprint() {
  if (!showRuntimeFingerprint.value) {
    return;
  }

  try {
    const { data } = await getSystemHealth();
    backendFingerprint.value = {
      pid: data?.data?.app?.pid ?? null,
      startedAt: data?.data?.app?.startedAt ?? null,
      buildId: data?.data?.build?.buildId ?? null,
      appVersion: data?.data?.build?.appVersion ?? data?.data?.build?.version ?? null,
    };
  } catch {
    backendFingerprint.value = null;
  }
}

async function loadAuthenticatedIdentity() {
  const requestSequence = ++authenticatedIdentityRequestSequence;
  if (isLogsReadonly.value) return;
  const scope = authenticatedIdentityScope.value;
  if (scope === 'gov1_acceptance' && formalActorIdentityBound.value) {
    return;
  }

  try {
    const { data } = await getAuthenticatedUser(scope);
    if (requestSequence === authenticatedIdentityRequestSequence) {
      setAuthenticatedUserIdentity(data.data);
    }
  } catch {
    if (requestSequence === authenticatedIdentityRequestSequence) {
      setAuthenticatedUserIdentity(null);
    }
  }
}

watch([authenticatedIdentityScope, isLogsReadonly], () => {
  void loadAuthenticatedIdentity();
});

onMounted(async () => {
  await Promise.all([loadRuntimeFingerprint(), loadAuthenticatedIdentity()]);
});
</script>

<style scoped>
.layout-shell {
  min-height: 100vh;
}

.layout-aside {
  background: #172033;
  color: #fff;
}

.logo {
  padding: 20px;
  font-size: 18px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 72px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.header-title {
  font-weight: 600;
  color: #111827;
}

.header-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.runtime-fingerprint {
  max-width: 420px;
  font-size: 12px;
  line-height: 1.4;
  color: #6b7280;
  text-align: right;
}

.role-switcher {
  width: 180px;
}

.layout-main {
  background: #f5f7fa;
}
</style>
