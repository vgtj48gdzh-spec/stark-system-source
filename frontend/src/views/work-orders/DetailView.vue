<template>
  <div class="page-stack">
    <el-card v-loading="loading">
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">{{ ownerRepairAcceptanceEnabled ? '合成工单详情' : '工单详情' }}</div>
            <div class="subtitle">
              {{
                ownerRepairAcceptanceEnabled
                  ? '只操作隔离数据库中的合成财务、材料和库存记录；不会影响正式总部数据。'
                  : '查看财务状态，并在当前页面直接绑定、修改和删除材料明细。'
              }}
            </div>
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" @click="router.push(`/work-orders/${route.params.id}/repair`)">
              汽修业务工作台
            </el-button>
            <el-button @click="router.push('/work-orders')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="工单编号">{{ detail.workOrderNo }}</el-descriptions-item>
        <el-descriptions-item label="标题">{{ detail.title }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ detail.customerName }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ maskCustomerMobile(detail.customerMobile) }}</el-descriptions-item>
        <el-descriptions-item label="应收金额">{{ detail.amountDue }}</el-descriptions-item>
        <el-descriptions-item label="已收金额">{{ detail.amountReceived }}</el-descriptions-item>
        <el-descriptions-item label="材料成本">{{ detail.materialCostTotal || '0.00' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="workOrderStatusMap[detail.status]?.type || 'info'">
            {{ workOrderStatusMap[detail.status]?.label || detail.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="负责人 ID">{{ detail.responsibleUserId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card>
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">工单材料</div>
            <div class="subtitle">来源必须明确；库存相关数量、单价或删除修正不得直接回滚，必须进入审批后的不可变修正合同。</div>
          </div>
          <div class="toolbar-actions">
            <el-switch
              v-if="canIncludeDeleted"
              v-model="includeDeleted"
              inline-prompt
              active-text="含已删"
              inactive-text="仅有效"
            />
            <el-button v-if="canManageMaterials" type="primary" @click="openCreateDialog">
              添加材料
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="materialRows" v-loading="materialsLoading">
        <el-table-column label="材料" min-width="180">
          <template #default="{ row }">
            <div>{{ materialMap[row.materialId]?.name || `材料 #${row.materialId}` }}</div>
            <div class="cell-subtitle">
              {{ materialMap[row.materialId]?.specification || materialMap[row.materialId]?.unit || '-' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源" min-width="120">
          <template #default="{ row }">
            <el-tag :type="workOrderMaterialSourceMap[row.sourceType]?.type || 'info'">
              {{ workOrderMaterialSourceMap[row.sourceType]?.label || row.sourceType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="100">
          <template #default="{ row }">
            <el-tag :type="row.deletedAt ? 'danger' : 'success'">
              {{ row.deletedAt ? '已删除' : '有效' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" min-width="100" />
        <el-table-column prop="unitPrice" label="单价" min-width="100" />
        <el-table-column prop="totalPrice" label="总价" min-width="100" />
        <el-table-column label="库房" min-width="140">
          <template #default="{ row }">
            {{ row.warehouseId ? warehouseMap[row.warehouseId]?.name || `库房 #${row.warehouseId}` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="备料单" min-width="140">
          <template #default="{ row }">
            {{
              row.preparationId
                ? preparationMap[row.preparationId]?.preparationNo || `备料 #${row.preparationId}`
                : '-'
            }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <ReadableDateTime :value="row.createdAt" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canManageMaterials && !row.deletedAt"
              link
              type="primary"
              @click="openEditDialog(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="canDeleteMaterial && !row.deletedAt && row.sourceType === 'manual'"
              link
              type="danger"
              @click="handleDeleteMaterial(row)"
            >
              删除
            </el-button>
            <el-button
              v-if="canViewMaterialAudit"
              link
              type="info"
              @click="openAuditDialog(row)"
            >
              审计链
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="添加工单材料" width="640px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="120px">
        <el-form-item label="来源方式" prop="sourceType">
          <el-select v-model="createForm.sourceType" style="width: 100%">
            <el-option label="手工录入" value="manual" />
            <el-option label="库房出库" value="warehouse" />
            <el-option label="备料绑定" value="preparation" />
          </el-select>
        </el-form-item>
        <el-form-item label="材料" prop="materialId">
          <el-select v-model="createForm.materialId" filterable clearable style="width: 100%">
            <el-option
              v-for="item in materialOptions"
              :key="item.id"
              :label="`${item.name}${item.specification ? ` / ${item.specification}` : ''}`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="createForm.sourceType === 'warehouse'" label="库房" prop="warehouseId">
          <el-select v-model="createForm.warehouseId" clearable style="width: 100%">
            <el-option
              v-for="item in warehouseOptions"
              :key="item.id"
              :label="`${item.name} (${item.code})`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="createForm.sourceType === 'preparation'" label="备料单" prop="preparationId">
          <el-select
            v-model="createForm.preparationId"
            clearable
            filterable
            style="width: 100%"
            @change="handlePreparationChange"
          >
            <el-option
              v-for="item in availablePreparations"
              :key="item.id"
              :label="`${item.preparationNo} / 材料#${item.materialId}`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input v-model="createForm.quantity" placeholder="例如 10 或 10.50" />
        </el-form-item>
        <el-form-item label="单价" prop="unitPrice">
          <el-input v-model="createForm.unitPrice" placeholder="例如 18.80" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="createForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreateMaterial">确认添加</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑工单材料" width="640px">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="120px">
        <el-form-item label="来源方式">
          <el-tag :type="workOrderMaterialSourceMap[editTarget?.sourceType || '']?.type || 'info'">
            {{ workOrderMaterialSourceMap[editTarget?.sourceType || '']?.label || editTarget?.sourceType }}
          </el-tag>
        </el-form-item>
        <el-form-item label="材料">
          <span>{{ materialMap[editTarget?.materialId || 0]?.name || '-' }}</span>
        </el-form-item>
        <el-form-item v-if="editTarget?.warehouseId" label="库房">
          <span>{{ warehouseMap[editTarget.warehouseId]?.name || `库房 #${editTarget.warehouseId}` }}</span>
        </el-form-item>
        <el-form-item v-if="editTarget?.preparationId" label="备料单">
          <span>{{
            preparationMap[editTarget.preparationId]?.preparationNo || `备料 #${editTarget.preparationId}`
          }}</span>
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input
            v-model="editForm.quantity"
            :disabled="editTarget?.sourceType !== 'manual'"
            placeholder="库存相关数量修正必须走审批"
          />
        </el-form-item>
        <el-form-item label="单价" prop="unitPrice">
          <el-input
            v-model="editForm.unitPrice"
            :disabled="editTarget?.sourceType !== 'manual'"
            placeholder="库房/备料来源材料不允许改单价"
          />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="editForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleUpdateMaterial">确认更新</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="auditDialogVisible" title="工单材料完整审计链" width="720px">
      <el-skeleton v-if="auditLoading" :rows="8" animated />
      <pre v-else class="audit-json">{{ formattedAuditPayload }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getMaterialPreparations } from '../../api/material-preparations';
import { getMaterials } from '../../api/materials';
import { getWarehouses } from '../../api/warehouses';
import {
  createWorkOrderMaterial,
  deleteWorkOrderMaterial,
  getWorkOrderDetail,
  getWorkOrderMaterialAudit,
  getWorkOrderMaterials,
  updateWorkOrderMaterial,
} from '../../api/work-orders';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatDateTime } from '../../utils/format';
import { hasPermission } from '../../utils/permissions';
import { workOrderMaterialSourceMap, workOrderStatusMap } from '../../utils/status-tag';

const route = useRoute();
const router = useRouter();
const ownerRepairAcceptanceEnabled = __OWNER_REPAIR_ACCEPTANCE__;
const loading = ref(false);
const materialsLoading = ref(false);
const submitting = ref(false);
const createDialogVisible = ref(false);
const editDialogVisible = ref(false);
const auditDialogVisible = ref(false);
const auditLoading = ref(false);
const includeDeleted = ref(false);
const createFormRef = ref<FormInstance>();
const editFormRef = ref<FormInstance>();
const detail = ref<any>(null);
const materialRows = ref<any[]>([]);
const materialOptions = ref<any[]>([]);
const warehouseOptions = ref<any[]>([]);
const preparationOptions = ref<any[]>([]);
const editTarget = ref<any>(null);
const auditPayload = ref<any>(null);

const canManageMaterials = computed(
  () =>
    hasPermission('workOrderMaterial.create') || hasPermission('workOrderMaterial.update'),
);
const canDeleteMaterial = computed(() => hasPermission('workOrderMaterial.delete'));
const canViewMaterialAudit = computed(() => hasPermission('workOrderMaterial.audit'));
const canIncludeDeleted = computed(() => hasPermission('workOrderMaterial.includeDeleted'));

const createForm = reactive({
  requestIdempotencyKey: '',
  materialId: undefined as number | undefined,
  sourceType: 'manual' as 'manual' | 'warehouse' | 'preparation',
  warehouseId: undefined as number | undefined,
  preparationId: undefined as number | undefined,
  quantity: '',
  unitPrice: '',
  remark: '',
});

const editForm = reactive({
  quantity: '',
  unitPrice: '',
  remark: '',
});

const createRules: FormRules = {
  sourceType: [{ required: true, message: '请选择来源方式', trigger: 'change' }],
  materialId: [{ required: true, message: '请选择材料', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
  unitPrice: [{ required: true, message: '请输入单价', trigger: 'blur' }],
};

const editRules: FormRules = {
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
};

const materialMap = computed(() => Object.fromEntries(materialOptions.value.map((item) => [item.id, item])));
const warehouseMap = computed(() => Object.fromEntries(warehouseOptions.value.map((item) => [item.id, item])));
const preparationMap = computed(() =>
  Object.fromEntries(preparationOptions.value.map((item) => [item.id, item])),
);
const availablePreparations = computed(() =>
  preparationOptions.value.filter(
    (item) => item.bindStatus === 'unbound' || item.linkedWorkOrderId === Number(route.params.id),
  ),
);
const formattedAuditPayload = computed(() => JSON.stringify(auditPayload.value, null, 2));

function maskCustomerMobile(value: string | null | undefined) {
  if (!value) return '-';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return '****';
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

watch(
  () => createForm.sourceType,
  (value) => {
    if (value !== 'warehouse') {
      createForm.warehouseId = undefined;
    }

    if (value !== 'preparation') {
      createForm.preparationId = undefined;
    }
  },
);

watch(includeDeleted, () => {
  loadMaterials();
});

async function loadDetail() {
  loading.value = true;
  try {
    const { data } = await getWorkOrderDetail(route.params.id as string);
    detail.value = data.data;
  } finally {
    loading.value = false;
  }
}

async function loadMaterials() {
  materialsLoading.value = true;
  try {
    const { data } = await getWorkOrderMaterials(route.params.id as string, {
      includeDeleted: canIncludeDeleted.value ? includeDeleted.value : undefined,
    });
    materialRows.value = data.data;
  } finally {
    materialsLoading.value = false;
  }
}

async function loadOptions() {
  const [materialsResponse, warehousesResponse, preparationsResponse] = await Promise.all([
    getMaterials(),
    getWarehouses(),
    getMaterialPreparations(),
  ]);

  materialOptions.value = materialsResponse.data.data;
  warehouseOptions.value = warehousesResponse.data.data;
  preparationOptions.value = preparationsResponse.data.data;
}

function resetCreateForm() {
  createForm.requestIdempotencyKey = createRequestIdempotencyKey();
  createForm.materialId = undefined;
  createForm.sourceType = 'manual';
  createForm.warehouseId = undefined;
  createForm.preparationId = undefined;
  createForm.quantity = '';
  createForm.unitPrice = '';
  createForm.remark = '';
  createFormRef.value?.clearValidate();
}

function createRequestIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `work-order-material:${crypto.randomUUID()}`;
  }
  return `work-order-material:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
}

function openCreateDialog() {
  resetCreateForm();
  createDialogVisible.value = true;
}

function handlePreparationChange(preparationId: number) {
  const selected = preparationOptions.value.find((item) => item.id === preparationId);

  if (!selected) {
    return;
  }

  createForm.materialId = selected.materialId;
  createForm.quantity = selected.quantity;
  createForm.unitPrice = selected.unitPrice;
}

function openEditDialog(row: any) {
  editTarget.value = row;
  editForm.quantity = row.quantity;
  editForm.unitPrice = row.unitPrice;
  editForm.remark = row.remark || '';
  editDialogVisible.value = true;
}

async function openAuditDialog(row: any) {
  auditDialogVisible.value = true;
  auditLoading.value = true;
  auditPayload.value = null;

  try {
    const { data } = await getWorkOrderMaterialAudit(route.params.id as string, row.id);
    auditPayload.value = data.data;
  } finally {
    auditLoading.value = false;
  }
}

async function handleCreateMaterial() {
  await createFormRef.value?.validate();
  submitting.value = true;
  try {
    await createWorkOrderMaterial(route.params.id as string, createForm);
    ElMessage.success('工单材料添加成功');
    createDialogVisible.value = false;
    resetCreateForm();
    await Promise.all([loadDetail(), loadMaterials(), loadOptions()]);
  } finally {
    submitting.value = false;
  }
}

async function handleUpdateMaterial() {
  await editFormRef.value?.validate();

  if (!editTarget.value) {
    return;
  }

  submitting.value = true;
  try {
    await updateWorkOrderMaterial(route.params.id as string, editTarget.value.id, {
      quantity: editForm.quantity,
      unitPrice: editForm.unitPrice,
      remark: editForm.remark,
    });
    ElMessage.success('工单材料更新成功');
    editDialogVisible.value = false;
    await Promise.all([loadDetail(), loadMaterials(), loadOptions()]);
  } finally {
    submitting.value = false;
  }
}

async function handleDeleteMaterial(row: any) {
  await ElMessageBox.confirm(
    `确认删除手工材料明细 #${row.id} 吗？库存或备料来源必须走审批修正，不能在这里直接删除。`,
    '删除确认',
    {
      type: 'warning',
    },
  );

  await deleteWorkOrderMaterial(route.params.id as string, row.id);
  ElMessage.success('工单材料删除成功');
  await Promise.all([loadDetail(), loadMaterials(), loadOptions()]);
}

onMounted(async () => {
  await Promise.all([loadDetail(), loadMaterials(), loadOptions()]);
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

.subtitle,
.cell-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
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
