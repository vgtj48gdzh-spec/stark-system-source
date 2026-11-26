<template>
  <el-container class="acceptance-shell">
    <el-header class="acceptance-header">
      <div>
        <div class="acceptance-title">斯塔克总部 · 汽修隔离验收</div>
        <div class="acceptance-subtitle">
          OWNER 专用 · 仅合成数据 · 独立进程与数据库 · 不连接正式门店
        </div>
      </div>
      <div class="acceptance-actions">
        <el-tag type="warning" effect="dark">SYNTHETIC ONLY</el-tag>
        <el-tag :type="formalActorIdentityBound ? 'success' : 'danger'" effect="plain">
          {{ identityLabel }}
        </el-tag>
        <el-button @click="router.push('/work-orders')">合成工单</el-button>
        <el-button type="primary" @click="router.push('/work-orders/create')">新建合成工单</el-button>
      </div>
    </el-header>

    <el-main class="acceptance-main">
      <el-alert
        class="acceptance-warning"
        type="warning"
        :closable="false"
        show-icon
        title="本入口只连接隔离验收数据库。页面中的客户、车辆、供应商、审批、资金和库存均必须使用 SYNTHETIC 标识；不得录入真实资料或联系外部人员。"
      />
      <OwnerRepairAcceptanceGuide />
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getAuthenticatedUser } from '../api/auth';
import OwnerRepairAcceptanceGuide from '../components/OwnerRepairAcceptanceGuide.vue';
import {
  authenticatedUserIdentity,
  formalActorIdentityBound,
  setAuthenticatedUserIdentity,
} from '../utils/permissions';

const router = useRouter();

const identityLabel = computed(() => {
  const identity = authenticatedUserIdentity.value;
  if (!identity?.formalIdentityBound) return '正式身份未绑定';
  return `${identity.realName || identity.username} · 隔离正式身份`;
});

onMounted(async () => {
  try {
    const { data } = await getAuthenticatedUser();
    setAuthenticatedUserIdentity(data.data);
  } catch {
    setAuthenticatedUserIdentity(null);
  }
});
</script>

<style scoped>
.acceptance-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(227, 160, 8, 0.13), transparent 34%),
    #f4f6f5;
}

.acceptance-header {
  height: auto;
  min-height: 92px;
  padding: 18px clamp(16px, 4vw, 52px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  color: #fffdf5;
  background: linear-gradient(135deg, #312a16 0%, #6b4e10 100%);
  box-shadow: 0 10px 28px rgba(50, 42, 20, 0.2);
}

.acceptance-title {
  font-size: 22px;
  font-weight: 760;
  letter-spacing: 0.04em;
}

.acceptance-subtitle {
  margin-top: 6px;
  color: rgba(255, 253, 245, 0.78);
  font-size: 13px;
}

.acceptance-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.acceptance-main {
  width: min(1680px, 100%);
  margin: 0 auto;
  padding: clamp(16px, 3vw, 32px);
}

.acceptance-warning {
  margin-bottom: 18px;
}

@media (max-width: 860px) {
  .acceptance-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .acceptance-title {
    font-size: 18px;
  }

  .acceptance-actions {
    justify-content: flex-start;
  }
}
</style>
