<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">福利通知</div>
          <div class="subtitle">查看到账提醒、余额变动、临期提醒和过期提醒。</div>
        </div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="员工ID">
        <el-input-number v-model="filters.employeeId" :min="1" controls-position="right" />
      </el-form-item>
      <el-form-item label="通知类型">
        <el-select v-model="filters.notificationType" clearable style="width: 180px">
          <el-option label="福利到账" value="benefit_issued" />
          <el-option label="余额变动" value="benefit_balance_changed" />
          <el-option label="30天临期" value="benefit_expiring_30d" />
          <el-option label="15天临期" value="benefit_expiring_15d" />
          <el-option label="7天临期" value="benefit_expiring_7d" />
          <el-option label="3天临期" value="benefit_expiring_3d" />
          <el-option label="1天临期" value="benefit_expiring_1d" />
          <el-option label="已过期" value="benefit_expired" />
        </el-select>
      </el-form-item>
      <el-form-item label="已读">
        <el-select v-model="filters.readFlag" clearable style="width: 120px">
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="employee.name" label="员工" min-width="120" show-overflow-tooltip />
      <el-table-column label="通知类型" min-width="120">
        <template #default="{ row }">
          <el-tag :type="notificationTagType(row.notificationType)">
            {{ formatNotificationType(row.notificationType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
      <el-table-column prop="content" label="内容" min-width="260" show-overflow-tooltip />
      <el-table-column label="到账金额" width="120" align="right">
        <template #default="{ row }">{{ formatMoney(row.amountStandard) }}</template>
      </el-table-column>
      <el-table-column label="当前余额" width="120" align="right">
        <template #default="{ row }">{{ formatMoney(row.balanceAmount) }}</template>
      </el-table-column>
      <el-table-column label="临期金额" width="120" align="right">
        <template #default="{ row }">{{ formatMoney(row.expiringAmount) }}</template>
      </el-table-column>
      <el-table-column label="过期金额" width="120" align="right">
        <template #default="{ row }">{{ formatMoney(row.expiredAmount) }}</template>
      </el-table-column>
      <el-table-column label="通知时间" width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.notifyAt" /></template>
      </el-table-column>
      <el-table-column label="已读" width="90">
        <template #default="{ row }">
          <el-tag :type="row.readFlag ? 'success' : 'warning'">
            {{ row.readFlag ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button
            v-if="canRead && !row.readFlag"
            link
            type="primary"
            @click="markRead(row.id)"
          >
            标记已读
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="pager"
      background
      layout="total, prev, pager, next"
      :total="total"
      :page-size="query.pageSize"
      :current-page="query.page"
      @current-change="handlePageChange"
    />
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import {
  getEmployeeBenefitNotifications,
  readEmployeeBenefitNotification,
} from '../../api/employee-benefits';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatNotificationType, notificationTagType } from '../../utils/employee-benefits';
import { formatMoney } from '../../utils/format';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const canRead = hasPermission('employeeBenefits.notifications.read');

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  employeeId: undefined as number | undefined,
  notificationType: '',
  readFlag: undefined as boolean | undefined,
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getEmployeeBenefitNotifications({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'notifyAt',
      sortOrder: 'desc',
      employeeId: filters.employeeId,
      notificationType: filters.notificationType || undefined,
      readFlag: filters.readFlag,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.employeeId = undefined;
  filters.notificationType = '';
  filters.readFlag = undefined;
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

async function markRead(id: number) {
  await readEmployeeBenefitNotification(id);
  ElMessage.success('通知已标记为已读');
  await loadData();
}

onMounted(loadData);
</script>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.filters {
  margin-bottom: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
