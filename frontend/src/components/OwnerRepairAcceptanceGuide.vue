<template>
  <section class="operation-guide">
    <div class="guide-header">
      <div>
        <div class="eyebrow">OWNER 操作向导</div>
        <h2>现在按这 5 步验收，不需要先看懂全部字段</h2>
        <p>先看现成的合成工单，再进入汽修工作台；本轮重点检查 VIN、配件采购和完整维修流程。</p>
      </div>
      <div class="guide-header-actions">
        <el-tag type="warning" effect="dark">只用合成数据</el-tag>
        <el-button link type="primary" @click="expanded = !expanded">
          {{ expanded ? '收起完整说明' : '展开完整说明' }}
        </el-button>
      </div>
    </div>

    <div class="current-action">
      <div class="current-action-copy">
        <el-tag type="success" effect="plain">现在做</el-tag>
        <div>
          <strong>{{ currentInstruction.title }}</strong>
          <p>{{ currentInstruction.description }}</p>
        </div>
      </div>
      <el-button
        v-if="currentInstruction.actionLabel"
        type="primary"
        @click="runCurrentAction"
      >
        {{ currentInstruction.actionLabel }}
      </el-button>
    </div>

    <template v-if="expanded">
      <el-steps class="guide-steps" :active="currentStep" finish-status="success" align-center>
        <el-step v-for="step in steps" :key="step.title" :title="step.title" :description="step.short" />
      </el-steps>

      <div class="guide-grid">
        <article v-for="(step, index) in steps" :key="step.title" class="guide-card">
          <div class="guide-card-title">
            <span>{{ index + 1 }}</span>
            <strong>{{ step.title }}</strong>
          </div>
          <p>{{ step.description }}</p>
        </article>
      </div>

      <div class="meaning-panel">
        <div>
          <h3>三个按钮是什么意思</h3>
          <ul>
            <li><strong>看工单：</strong>看工单金额、状态和材料等基础信息。</li>
            <li><strong>进入汽修工作台：</strong>看车辆、VIN、检查诊断、报价、施工、质检、交车、售后和 AI。</li>
            <li><strong>新建合成工单：</strong>只用于测试创建流程，不是录入真实客户。</li>
          </ul>
        </div>
        <div class="progress-panel">
          <div class="progress-title">我的验收进度（只保存在本浏览器）</div>
          <el-progress :percentage="progressPercentage" :stroke-width="10" />
          <el-checkbox
            v-for="item in checklist"
            :key="item.id"
            v-model="checkState[item.id]"
            class="check-item"
            @change="saveChecks"
          >
            {{ item.label }}
          </el-checkbox>
        </div>
      </div>

      <el-alert
        class="safe-alert"
        type="error"
        :closable="false"
        show-icon
        title="不要填写真实姓名、手机号、地址、车牌、VIN、供应商、银行流水或付款信息；发现问题时只记录页面、点击动作、预期结果和实际结果。"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

type Instruction = {
  title: string;
  description: string;
  actionLabel?: string;
  action?: 'list' | 'create' | 'repair' | 'procurement';
};

const route = useRoute();
const router = useRouter();
const expanded = ref(true);
const storageKey = 'stark-repair:owner-acceptance-guide-checks';

const steps = [
  {
    title: '选择合成工单',
    short: '从现成数据开始',
    description: '在列表里优先找“VIN与配件采购验收”，无需先新建，也不要输入任何真实资料。',
  },
  {
    title: '查看工单',
    short: '核对基础信息',
    description: '点击“看工单”，核对工单状态、金额和材料；这只是基础工单页面。',
  },
  {
    title: '进入汽修工作台',
    short: '看完整维修链路',
    description: '点击“进入汽修工作台”，按页签查看检查、方案、报价、客户确认、施工、质检、交车和售后。',
  },
  {
    title: '检查 VIN / 采购',
    short: '本轮验收重点',
    description: '重点核对 VIN、车型解码、OE/EPC、用料需求、询价比价、审批、付款意图、物流、入库/直送、安装和售后关联。',
  },
  {
    title: '集中反馈',
    short: '一次列出问题',
    description: '把不清楚、缺功能或操作不顺的地方一次列出，我会集中修改后再做一次终审。',
  },
] as const;

const checklist = [
  { id: 'list', label: '已看懂合成工单列表和两个入口按钮' },
  { id: 'repair', label: '已打开汽修工作台并看过完整流程页签' },
  { id: 'procurement', label: '已检查 VIN、配件需求、询价比价和采购链' },
  { id: 'lifecycle', label: '已检查施工、质检、交车、售后和 AI 辅助' },
  { id: 'feedback', label: '已整理一份集中反馈清单' },
] as const;

const checkState = reactive<Record<string, boolean>>(loadChecks());

const workOrderId = computed(() => {
  const match = route.path.match(/^\/work-orders\/(\d+)(?:\/repair)?$/);
  return match?.[1] || '';
});

const pageKind = computed(() => {
  if (route.path === '/work-orders/create') return 'create';
  if (/^\/work-orders\/\d+\/repair$/.test(route.path)) return 'repair';
  if (/^\/work-orders\/\d+$/.test(route.path)) return 'detail';
  return 'list';
});

const currentStep = computed(() => {
  if (pageKind.value === 'detail') return 1;
  if (pageKind.value === 'repair') return route.query.tab === 'procurement' ? 3 : 2;
  return 0;
});

const currentInstruction = computed<Instruction>(() => {
  if (pageKind.value === 'create') {
    return {
      title: '只有想测试“新建”时才填写这个表单',
      description: '标题和客户姓名必须以 SYNTHETIC 开头，手机号必须留空；如果只是看功能，直接返回列表使用现成工单。',
      actionLabel: '返回合成工单列表',
      action: 'list',
    };
  }
  if (pageKind.value === 'detail') {
    return {
      title: '先核对基础工单，再进入完整汽修流程',
      description: '当前页主要看金额、状态和材料。车辆、VIN、诊断报价、采购、施工、质检和售后都在汽修工作台。',
      actionLabel: '进入汽修工作台',
      action: 'repair',
    };
  }
  if (pageKind.value === 'repair') {
    return {
      title: route.query.tab === 'procurement' ? '正在检查 VIN / 配件采购' : '按页签从左到右看完整维修链路',
      description: route.query.tab === 'procurement'
        ? '先核对 VIN 与车型证据，再看用料、询价比价、确认/审批、付款意图、物流、收货和安装关联。'
        : '本轮重点是 VIN 与配件采购；点击右侧按钮可直接跳到该页签。',
      actionLabel: route.query.tab === 'procurement' ? '返回合成工单列表' : '直达 VIN / 配件采购',
      action: route.query.tab === 'procurement' ? 'list' : 'procurement',
    };
  }
  return {
    title: '先用现成的“VIN与配件采购验收”工单',
    description: '在下面表格找到该工单，点击“进入汽修工作台”。“看工单”只看基础信息；新建合成工单是可选测试。',
    actionLabel: '新建合成工单（可选）',
    action: 'create',
  };
});

const progressPercentage = computed(() => {
  const completed = checklist.filter((item) => checkState[item.id]).length;
  return Math.round((completed / checklist.length) * 100);
});

function runCurrentAction() {
  if (currentInstruction.value.action === 'list') {
    router.push('/work-orders');
    return;
  }
  if (currentInstruction.value.action === 'create') {
    router.push('/work-orders/create');
    return;
  }
  if (currentInstruction.value.action === 'repair' && workOrderId.value) {
    router.push(`/work-orders/${workOrderId.value}/repair`);
    return;
  }
  if (currentInstruction.value.action === 'procurement' && workOrderId.value) {
    router.push({
      path: `/work-orders/${workOrderId.value}/repair`,
      query: { tab: 'procurement' },
    });
  }
}

function loadChecks(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function saveChecks() {
  window.localStorage.setItem(storageKey, JSON.stringify(checkState));
}
</script>

<style scoped>
.operation-guide {
  display: grid;
  gap: 16px;
  margin-bottom: 18px;
  padding: clamp(16px, 2.5vw, 24px);
  border: 1px solid #d9e5df;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(23, 63, 49, 0.08);
}

.guide-header,
.current-action,
.current-action-copy,
.guide-header-actions,
.guide-card-title {
  display: flex;
  align-items: center;
}

.guide-header,
.current-action {
  justify-content: space-between;
  gap: 18px;
}

.guide-header h2 {
  margin: 4px 0 0;
  color: #173f31;
  font-size: clamp(18px, 2.2vw, 24px);
}

.guide-header p,
.current-action p,
.guide-card p {
  margin: 6px 0 0;
  color: #52635d;
  line-height: 1.65;
}

.eyebrow {
  color: #b7791f;
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.12em;
}

.guide-header-actions,
.current-action-copy {
  gap: 12px;
}

.guide-header-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.current-action {
  padding: 14px 16px;
  border-left: 5px solid #2f855a;
  border-radius: 10px;
  background: #edf8f2;
}

.current-action strong {
  color: #173f31;
  font-size: 16px;
}

.guide-steps {
  padding: 6px 0 2px;
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.guide-card {
  min-height: 148px;
  padding: 14px;
  border: 1px solid #e1e8e4;
  border-radius: 10px;
  background: #f9fbfa;
}

.guide-card-title {
  gap: 9px;
  color: #173f31;
}

.guide-card-title span {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: #2f855a;
  font-size: 12px;
  font-weight: 700;
}

.meaning-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
  gap: 18px;
  padding: 16px;
  border-radius: 10px;
  background: #f5f7f6;
}

.meaning-panel h3,
.progress-title {
  margin: 0 0 10px;
  color: #243c34;
  font-size: 15px;
  font-weight: 700;
}

.meaning-panel ul {
  margin: 0;
  padding-left: 20px;
  color: #42564f;
  line-height: 1.9;
}

.progress-panel {
  display: grid;
  align-content: start;
  gap: 6px;
}

.check-item {
  display: block;
  margin: 4px 0 0;
  white-space: normal;
}

.safe-alert {
  border-radius: 9px;
}

@media (max-width: 1180px) {
  .guide-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .guide-header,
  .current-action,
  .current-action-copy {
    align-items: flex-start;
    flex-direction: column;
  }

  .guide-grid,
  .meaning-panel {
    grid-template-columns: 1fr;
  }

  .guide-steps {
    display: none;
  }

  .current-action > .el-button {
    width: 100%;
  }
}
</style>
