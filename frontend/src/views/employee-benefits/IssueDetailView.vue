<template>
  <div class="page-stack" v-loading="loading">
    <el-card v-if="detail">
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">福利发放单详情</div>
            <div class="subtitle">{{ detail.issueNo }}</div>
          </div>
          <el-space>
            <el-button @click="router.back()">返回</el-button>
            <el-button
              v-if="canConfirm && detail.status === 'draft'"
              type="success"
              @click="handleConfirm"
            >
              确认
            </el-button>
            <el-button
              v-if="canIssue && detail.status === 'confirmed'"
              type="warning"
              @click="handleIssue"
            >
              发放
            </el-button>
          </el-space>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="发放单号">{{ detail.issueNo }}</el-descriptions-item>
        <el-descriptions-item label="员工">{{ detail.employeeName }}</el-descriptions-item>
        <el-descriptions-item label="周期">{{ detail.periodKey }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="issueStatusTagType(detail.status)">{{ formatIssueStatus(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="总金额">{{ formatMoney(detail.totalAmount) }}</el-descriptions-item>
        <el-descriptions-item label="明细数">{{ detail.totalItemCount }}</el-descriptions-item>
        <el-descriptions-item label="已确认">{{ detail.confirmedFlag ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="发放时间"><ReadableDateTime :value="detail.issuedAt" /></el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="detail">
      <template #header><div class="section-title">福利明细</div></template>
      <el-table :data="detail.items || []">
        <el-table-column prop="itemType" label="类型" min-width="120" />
        <el-table-column prop="itemName" label="名称" min-width="180" show-overflow-tooltip />
        <el-table-column label="金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.amountStandard) }}</template>
        </el-table-column>
        <el-table-column label="数量" width="100" align="right">
          <template #default="{ row }">{{ row.quantityStandard }}</template>
        </el-table-column>
        <el-table-column prop="validityDays" label="有效天数" width="100" align="right" />
        <el-table-column label="生效时间" width="200">
          <template #default="{ row }"><ReadableDateTime :value="row.effectiveAt" /></template>
        </el-table-column>
        <el-table-column prop="sourceTable" label="来源表" min-width="120" show-overflow-tooltip />
        <el-table-column prop="sourceId" label="来源ID" min-width="120" show-overflow-tooltip />
      </el-table>
    </el-card>

    <el-card v-if="detail">
      <template #header><div class="section-title">福利购物卡记录</div></template>
      <el-table :data="detail.cardRecords || []">
        <el-table-column prop="id" label="记录ID" width="90" />
        <el-table-column prop="cardCategory" label="分类" min-width="120" />
        <el-table-column label="到账金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.amountTotal) }}</template>
        </el-table-column>
        <el-table-column label="剩余金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.amountRemaining) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ formatCardRecordStatus(row.status) }}</template>
        </el-table-column>
        <el-table-column label="生效时间" width="200">
          <template #default="{ row }"><ReadableDateTime :value="row.effectiveAt" /></template>
        </el-table-column>
        <el-table-column label="到期时间" width="200">
          <template #default="{ row }"><ReadableDateTime :value="row.expiresAt" /></template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="detail">
      <template #header><div class="section-title">资金联动记录</div></template>
      <el-table :data="detail.fundLinks || []">
        <el-table-column prop="fundLinkType" label="联动类型" min-width="140" />
        <el-table-column label="金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.amountStandard) }}</template>
        </el-table-column>
        <el-table-column prop="linkedPeriodKey" label="关联周期" min-width="120" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="sourceTable" label="来源表" min-width="120" />
        <el-table-column prop="sourceId" label="来源ID" min-width="120" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  confirmEmployeeBenefitIssue,
  getEmployeeBenefitIssue,
  issueEmployeeBenefitIssue,
} from '../../api/employee-benefits';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatCardRecordStatus, formatIssueStatus, issueStatusTagType } from '../../utils/employee-benefits';
import { formatMoney } from '../../utils/format';
import { hasPermission } from '../../utils/permissions';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const detail = ref<any>(null);
const canConfirm = hasPermission('employeeBenefits.issues.confirm');
const canIssue = hasPermission('employeeBenefits.issues.issue');

async function loadDetail() {
  loading.value = true;
  try {
    const { data } = await getEmployeeBenefitIssue(Number(route.params.id));
    detail.value = data.data;
  } finally {
    loading.value = false;
  }
}

async function handleConfirm() {
  await confirmEmployeeBenefitIssue(Number(route.params.id), {});
  ElMessage.success('福利发放单已确认');
  await loadDetail();
}

async function handleIssue() {
  await issueEmployeeBenefitIssue(Number(route.params.id), {});
  ElMessage.success('福利已发放');
  await loadDetail();
}

onMounted(loadDetail);
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.title,
.section-title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}
</style>
