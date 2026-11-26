<template>
  <div class="page-stack">
    <el-card v-loading="loading">
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">ABC 积分总览</div>
            <div class="subtitle">
              这里展示的是 ABC 积分的只读事实源、来源分布和当前桥接边界，不会直接写入 ABC。
            </div>
          </div>
        </div>
      </template>

      <div v-if="overview" class="summary-grid">
        <div
          v-for="card in overview.summaryCards || []"
          :key="card.key"
          class="summary-card"
        >
          <div class="summary-label">{{ card.title }}</div>
          <div class="summary-value">{{ card.value }}</div>
          <div class="summary-subtitle">{{ card.subtitle }}</div>
        </div>
      </div>

      <el-alert
        v-if="overview"
        type="warning"
        :closable="false"
        show-icon
        class="info-alert"
      >
        <template #title>当前执行边界</template>
        <div class="subtle-text">
          rewardDomain={{ overview.rewardDomain }} / sourceOfTruth={{ overview.sourceOfTruth }} /
          writePathStable={{ overview.writePathStable ? 'true' : 'false' }}
        </div>
        <div class="subtle-text">
          当前执行模式：
          {{ overview.executionMode === 'controlled_write' ? '受控写入' : '仅支持草稿与确认，执行会进入 blocked' }}
        </div>
      </el-alert>

      <div v-if="overview" class="two-column">
        <el-card shadow="never">
          <template #header><div class="section-title">来源分布</div></template>
          <el-table :data="overview.sourceBreakdown || []" size="small">
            <el-table-column prop="sourceType" label="来源类型" min-width="160" />
            <el-table-column prop="rowCount" label="记录数" width="100" align="right" />
            <el-table-column prop="totalChange" label="累计变动" width="120" align="right" />
          </el-table>
        </el-card>

        <el-card shadow="never">
          <template #header><div class="section-title">只读发现说明</div></template>
          <ul class="bullet-list">
            <li v-for="item in overview.reconciliationNotes || []" :key="item">{{ item }}</li>
          </ul>
          <div class="subtle-text">
            当前数据足以做只读发现、草稿和确认；如果 ABC 写入路径还未稳定确认，执行必须进入 blocked。
          </div>
        </el-card>
      </div>

      <el-card v-if="overview" shadow="never">
        <template #header><div class="section-title">最近 ABC 积分流水样本</div></template>
        <el-table :data="overview.recentLedgerPreview || []" size="small">
          <el-table-column prop="id" label="流水 ID" width="90" />
          <el-table-column prop="ownerName" label="用户" min-width="120" />
          <el-table-column prop="ownerMobile" label="手机号" width="140" />
          <el-table-column prop="sourceType" label="来源类型" width="160" />
          <el-table-column prop="changeAmount" label="积分变动" width="110" align="right" />
          <el-table-column prop="info" label="说明" min-width="220" show-overflow-tooltip />
          <el-table-column prop="createdAt" label="时间" width="180" />
        </el-table>
      </el-card>
    </el-card>

    <AiSideAssistant
      page-title="ABC 积分总览"
      route-path="/abc-points/overview"
      :current-filters="{}"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, ref } from 'vue';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';
import { getAbcPointsOverview } from '../../api/points';

const loading = ref(false);
const overview = ref<any | null>(null);

async function loadOverview() {
  loading.value = true;
  try {
    const response = await getAbcPointsOverview();
    overview.value = response.data.data;
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '加载 ABC 积分总览失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadOverview();
});
</script>

<style scoped>
.info-alert {
  margin: 16px 0;
}

.two-column {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  margin-bottom: 16px;
}

.bullet-list {
  margin: 0;
  padding-left: 18px;
  line-height: 1.8;
}
</style>
