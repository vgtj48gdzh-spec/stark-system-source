<template>
  <div class="page-stack" v-loading="loading">
    <el-card>
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">备料详情</div>
            <div class="subtitle">查看备料责任、库房、绑定状态，并在允许的角色下执行绑定或查看审计。</div>
          </div>
          <div class="toolbar-actions">
            <el-button v-if="canViewPreparationAudit" type="info" @click="openAuditDialog">查看审计</el-button>
            <el-button @click="router.push('/material-preparations')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="备料编号">{{ detail.preparationNo }}</el-descriptions-item>
        <el-descriptions-item label="材料">
          {{ materialMap[detail.materialId]?.name || `材料 #${detail.materialId}` }}
        </el-descriptions-item>
        <el-descriptions-item label="供应商">
          {{ supplierMap[detail.supplierId]?.name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="所在库房">
          {{ detail.warehouseId ? warehouseMap[detail.warehouseId]?.name || `库房 #${detail.warehouseId}` : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="责任人 ID">{{ detail.responsibleUserId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="数量">{{ detail.quantity }}</el-descriptions-item>
        <el-descriptions-item label="单价">{{ detail.unitPrice }}</el-descriptions-item>
        <el-descriptions-item label="总价">{{ detail.totalPrice }}</el-descriptions-item>
        <el-descriptions-item label="已绑定工单">{{ detail.linkedWorkOrderId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="绑定状态">
          <el-tag :type="preparationBindStatusMap[detail.bindStatus]?.type || 'info'">
            {{ preparationBindStatusMap[detail.bindStatus]?.label || detail.bindStatus }}
          </el-tag>
          <el-tag v-if="detail.isOverdue" type="danger" class="extra-tag">已超时</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备料时间">{{ formatDateTime(detail.preparedAt) }}</el-descriptions-item>
        <el-descriptions-item label="绑定截止时间">
          {{ formatDateTime(detail.bindDeadlineAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="canBindPreparation">
      <template #header>绑定工单</template>
      <el-alert
        v-if="detail?.bindStatus === 'bound'"
        type="success"
        :closable="false"
        title="当前备料已绑定工单，如需查看实际领料，请到工单详情页查看材料明细。"
      />
      <el-form v-else inline>
        <el-form-item label="工单">
          <el-select v-model="bindForm.workOrderId" filterable clearable style="width: 320px">
            <el-option
              v-for="item in workOrderOptions"
              :key="item.id"
              :label="`${item.workOrderNo} / ${item.title}`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleBind">绑定工单</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="auditDialogVisible" title="备料审计" width="720px">
      <el-skeleton v-if="auditLoading" :rows="8" animated />
      <pre v-else class="audit-json">{{ formattedAuditPayload }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  bindMaterialPreparation,
  getMaterialPreparationAudit,
  getMaterialPreparationDetail,
} from '../../api/material-preparations';
import { getMaterials } from '../../api/materials';
import { getSuppliers } from '../../api/suppliers';
import { getWarehouses } from '../../api/warehouses';
import { getWorkOrders } from '../../api/work-orders';
import { formatDateTime } from '../../utils/format';
import { hasPermission } from '../../utils/permissions';
import { preparationBindStatusMap } from '../../utils/status-tag';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const submitting = ref(false);
const auditLoading = ref(false);
const auditDialogVisible = ref(false);
const detail = ref<any>(null);
const auditPayload = ref<any>(null);
const materialOptions = ref<any[]>([]);
const supplierOptions = ref<any[]>([]);
const warehouseOptions = ref<any[]>([]);
const workOrderOptions = ref<any[]>([]);
const bindForm = reactive({
  workOrderId: undefined as number | undefined,
});

const canBindPreparation = computed(() => hasPermission('materialPreparation.bind'));
const canViewPreparationAudit = computed(() => hasPermission('materialPreparation.audit'));
const formattedAuditPayload = computed(() => JSON.stringify(auditPayload.value, null, 2));

const materialMap = computed(() => Object.fromEntries(materialOptions.value.map((item) => [item.id, item])));
const supplierMap = computed(() => Object.fromEntries(supplierOptions.value.map((item) => [item.id, item])));
const warehouseMap = computed(() => Object.fromEntries(warehouseOptions.value.map((item) => [item.id, item])));

async function loadOptions() {
  const [materialsResponse, suppliersResponse, warehousesResponse, workOrdersResponse] = await Promise.all([
    getMaterials(),
    getSuppliers(),
    getWarehouses(),
    getWorkOrders({ page: 1, pageSize: 100 }),
  ]);
  materialOptions.value = materialsResponse.data.data;
  supplierOptions.value = suppliersResponse.data.data;
  warehouseOptions.value = warehousesResponse.data.data;
  workOrderOptions.value = workOrdersResponse.data.data.list;
}

async function loadDetail() {
  loading.value = true;
  try {
    const { data } = await getMaterialPreparationDetail(route.params.id as string);
    detail.value = data.data;
    bindForm.workOrderId = data.data.linkedWorkOrderId || undefined;
  } finally {
    loading.value = false;
  }
}

async function openAuditDialog() {
  auditDialogVisible.value = true;
  auditLoading.value = true;
  auditPayload.value = null;

  try {
    const { data } = await getMaterialPreparationAudit(route.params.id as string);
    auditPayload.value = data.data;
  } finally {
    auditLoading.value = false;
  }
}

async function handleBind() {
  if (!bindForm.workOrderId) {
    ElMessage.warning('请选择工单');
    return;
  }

  submitting.value = true;
  try {
    await bindMaterialPreparation(route.params.id as string, {
      workOrderId: bindForm.workOrderId,
    });
    ElMessage.success('备料绑定工单成功');
    await loadDetail();
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadOptions(), loadDetail()]);
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.toolbar-actions {
  display: flex;
  gap: 12px;
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

.extra-tag {
  margin-left: 8px;
}

.audit-json {
  margin: 0;
  max-height: 520px;
  overflow: auto;
  padding: 16px;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.5;
}
</style>
