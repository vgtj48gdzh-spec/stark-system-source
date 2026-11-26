<template>
  <el-card>
    <template #header>{{ isInbound ? '新增入库记录' : '新增出库记录' }}</template>

    <el-alert
      v-if="!formalActorIdentityBound"
      title="正式人员身份尚未绑定，当前页面只可查看，不能提交真实进出库。"
      type="warning"
      :closable="false"
      class="identity-warning"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="form" v-loading="loading">
      <el-form-item label="库房" prop="warehouseId">
        <el-select v-model="form.warehouseId" filterable style="width: 100%">
          <el-option
            v-for="item in warehouseOptions"
            :key="item.id"
            :label="`${item.name} (${item.code})`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="材料" prop="materialId">
        <el-select v-model="form.materialId" filterable style="width: 100%">
          <el-option
            v-for="item in materialOptions"
            :key="item.id"
            :label="`${item.name}${item.specification ? ` / ${item.specification}` : ''}`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="数量" prop="quantity">
        <el-input v-model="form.quantity" placeholder="例如 12 或 12.50" />
      </el-form-item>
      <el-form-item label="单价" prop="unitPrice">
        <el-input v-model="form.unitPrice" placeholder="例如 18.80" />
      </el-form-item>
      <el-form-item label="关联工单" prop="relatedWorkOrderId">
        <el-select v-model="form.relatedWorkOrderId" clearable filterable style="width: 100%">
          <el-option
            v-for="item in workOrderOptions"
            :key="item.id"
            :label="`${item.workOrderNo} / ${item.title}`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关联备料" prop="relatedPreparationId">
        <el-select v-model="form.relatedPreparationId" clearable filterable style="width: 100%">
          <el-option
            v-for="item in preparationOptions"
            :key="item.id"
            :label="item.preparationNo"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item>
        <el-button @click="router.push('/inventory-transactions')">返回</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!formalActorIdentityBound"
          @click="handleSubmit"
        >保存</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  createInventoryInbound,
  createInventoryOutbound,
} from '../../api/inventory-transactions';
import { getMaterialPreparations } from '../../api/material-preparations';
import { getMaterials } from '../../api/materials';
import { getWarehouses } from '../../api/warehouses';
import { getWorkOrders } from '../../api/work-orders';
import { formalActorIdentityBound } from '../../utils/permissions';

const route = useRoute();
const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const submitting = ref(false);
const warehouseOptions = ref<any[]>([]);
const materialOptions = ref<any[]>([]);
const workOrderOptions = ref<any[]>([]);
const preparationOptions = ref<any[]>([]);
const isInbound = computed(() => route.path.includes('/inbound/'));
const form = reactive({
  requestIdempotencyKey: createRequestIdempotencyKey(),
  warehouseId: undefined as number | undefined,
  materialId: undefined as number | undefined,
  quantity: '',
  unitPrice: '',
  relatedWorkOrderId: undefined as number | undefined,
  relatedPreparationId: undefined as number | undefined,
  remark: '',
});

function createRequestIdempotencyKey() {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return `inventory-ui:${randomPart}`;
}

const rules: FormRules = {
  warehouseId: [{ required: true, message: '请选择库房', trigger: 'change' }],
  materialId: [{ required: true, message: '请选择材料', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
  unitPrice: [{ required: true, message: '请输入单价', trigger: 'blur' }],
};

async function loadOptions() {
  loading.value = true;
  try {
    const [warehousesResponse, materialsResponse, workOrdersResponse, preparationsResponse] =
      await Promise.all([
        getWarehouses(),
        getMaterials(),
        getWorkOrders({ page: 1, pageSize: 100 }),
        getMaterialPreparations(),
      ]);

    warehouseOptions.value = warehousesResponse.data.data;
    materialOptions.value = materialsResponse.data.data;
    workOrderOptions.value = workOrdersResponse.data.data.list;
    preparationOptions.value = preparationsResponse.data.data;
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (!formalActorIdentityBound.value) {
    ElMessage.warning('请先通过可信代理绑定正式人员身份');
    return;
  }
  await formRef.value?.validate();
  submitting.value = true;
  try {
    if (isInbound.value) {
      await createInventoryInbound(form);
      ElMessage.success('入库记录创建成功');
    } else {
      await createInventoryOutbound(form);
      ElMessage.success('出库记录创建成功');
    }
    router.push('/inventory-transactions');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadOptions);
</script>

<style scoped>
.form {
  max-width: 720px;
}

.identity-warning {
  margin-bottom: 16px;
}
</style>
