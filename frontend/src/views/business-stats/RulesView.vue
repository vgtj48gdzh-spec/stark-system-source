<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">奖励规则</div>
          <div class="subtitle">管理奖励事件基础规则，财务可查看，管理员可维护。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增规则</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="事件类型">
        <el-input v-model="filters.eventType" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="业务域">
        <el-input v-model="filters.businessDomain" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="ruleCode" label="规则编码" min-width="160" show-overflow-tooltip />
      <el-table-column prop="ruleName" label="规则名称" min-width="160" show-overflow-tooltip />
      <el-table-column label="事件类型" min-width="140">
        <template #default="{ row }">{{ formatRewardEventType(row.eventType) }}</template>
      </el-table-column>
      <el-table-column label="业务域" min-width="120">
        <template #default="{ row }">{{ formatBusinessStatDomain(row.businessDomain) }}</template>
      </el-table-column>
      <el-table-column prop="requiredTagCode" label="依赖标签" min-width="120" show-overflow-tooltip />
      <el-table-column prop="defaultWeight" label="默认权重" width="100" align="right" />
      <el-table-column prop="defaultCoefficient" label="默认系数" width="100" align="right" />
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'info'">{{ row.isActive ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
      <el-table-column v-if="canManage" label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
          <el-button link :type="row.isActive ? 'warning' : 'success'" @click="toggleRule(row)">
            {{ row.isActive ? '停用' : '启用' }}
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

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑规则' : '新增规则'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="规则编码">
          <el-input v-model="form.ruleCode" :disabled="Boolean(editingId)" />
        </el-form-item>
        <el-form-item label="规则名称">
          <el-input v-model="form.ruleName" />
        </el-form-item>
        <el-form-item label="事件类型">
          <el-select v-model="form.eventType" style="width: 100%">
            <el-option label="A端订单完成" value="a_order_completed" />
            <el-option label="组合成交" value="combo_success" />
            <el-option label="发卡成功" value="card_issue" />
            <el-option label="公车完成" value="public_vehicle_completed" />
            <el-option label="私家车复购" value="private_vehicle_repurchase" />
            <el-option label="保险转化" value="insurance_conversion" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务域">
          <el-select v-model="form.businessDomain" style="width: 100%">
            <el-option label="斯塔克工单" value="stark_work_order" />
            <el-option label="斯塔克材料" value="stark_material" />
            <el-option label="斯塔克资金" value="stark_fund" />
            <el-option label="ABC订单" value="abc_order" />
            <el-option label="ABC资金" value="abc_fund" />
            <el-option label="ABC卡域" value="abc_card" />
          </el-select>
        </el-form-item>
        <el-form-item label="依赖标签">
          <el-select v-model="form.requiredTagCode" clearable style="width: 100%">
            <el-option label="ABC总量" value="abc_overall" />
            <el-option label="A端洗车卡销售" value="a_wash_card_sale" />
            <el-option label="公车" value="public_vehicle" />
            <el-option label="私家车" value="private_vehicle" />
            <el-option label="保险理赔" value="insurance_claim" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认权重">
          <el-input v-model="form.defaultWeight" />
        </el-form-item>
        <el-form-item label="默认系数">
          <el-input v-model="form.defaultCoefficient" />
        </el-form-item>
        <el-form-item label="人工确认">
          <el-switch v-model="form.requiresManualConfirmation" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.isActive" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import {
  createRewardRule,
  getRewardRules,
  toggleRewardRule,
  updateRewardRule,
} from '../../api/business-stats';
import { formatBusinessStatDomain, formatRewardEventType } from '../../utils/business-stats';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const canManage = hasPermission('businessStats.rules.manage');

const query = reactive({
  page: 1,
  pageSize: 10,
});

const filters = reactive({
  eventType: '',
  businessDomain: '',
});

const form = reactive({
  ruleCode: '',
  ruleName: '',
  eventType: 'a_order_completed',
  businessDomain: 'abc_order',
  requiredTagCode: '',
  defaultWeight: '1.00',
  defaultCoefficient: '1.00',
  rewardEnabled: true,
  requiresManualConfirmation: false,
  isActive: true,
  remark: '',
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getRewardRules({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      eventType: filters.eventType || undefined,
      businessDomain: filters.businessDomain || undefined,
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

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function resetFilters() {
  filters.eventType = '';
  filters.businessDomain = '';
  handleSearch();
}

function resetForm() {
  form.ruleCode = '';
  form.ruleName = '';
  form.eventType = 'a_order_completed';
  form.businessDomain = 'abc_order';
  form.requiredTagCode = '';
  form.defaultWeight = '1.00';
  form.defaultCoefficient = '1.00';
  form.rewardEnabled = true;
  form.requiresManualConfirmation = false;
  form.isActive = true;
  form.remark = '';
}

function openCreateDialog() {
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(row: any) {
  editingId.value = row.id;
  form.ruleCode = row.ruleCode;
  form.ruleName = row.ruleName;
  form.eventType = row.eventType;
  form.businessDomain = row.businessDomain;
  form.requiredTagCode = row.requiredTagCode || '';
  form.defaultWeight = row.defaultWeight;
  form.defaultCoefficient = row.defaultCoefficient;
  form.rewardEnabled = row.rewardEnabled;
  form.requiresManualConfirmation = row.requiresManualConfirmation;
  form.isActive = row.isActive;
  form.remark = row.remark || '';
  dialogVisible.value = true;
}

async function handleSubmit() {
  const payload = {
    ruleCode: form.ruleCode,
    ruleName: form.ruleName,
    eventType: form.eventType,
    businessDomain: form.businessDomain,
    requiredTagCode: form.requiredTagCode || null,
    defaultWeight: form.defaultWeight,
    defaultCoefficient: form.defaultCoefficient,
    rewardEnabled: form.rewardEnabled,
    requiresManualConfirmation: form.requiresManualConfirmation,
    isActive: form.isActive,
    remark: form.remark || null,
  };
  if (editingId.value) {
    await updateRewardRule(editingId.value, payload);
    ElMessage.success('奖励规则已更新');
  } else {
    await createRewardRule(payload);
    ElMessage.success('奖励规则已创建');
  }
  dialogVisible.value = false;
  await loadData();
}

async function toggleRule(row: any) {
  await toggleRewardRule(row.id, !row.isActive);
  ElMessage.success('规则状态已更新');
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
