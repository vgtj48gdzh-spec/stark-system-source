<template>
  <el-card>
    <template #header>新建备料</template>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="form" v-loading="loading">
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
      <el-form-item label="供应商" prop="supplierId">
        <el-select v-model="form.supplierId" clearable filterable style="width: 100%">
          <el-option
            v-for="item in supplierOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="所在库房" prop="warehouseId">
        <el-select v-model="form.warehouseId" clearable filterable style="width: 100%">
          <el-option
            v-for="item in warehouseOptions"
            :key="item.id"
            :label="`${item.name} (${item.code})`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="数量" prop="quantity">
        <el-input v-model="form.quantity" placeholder="例如 20" />
      </el-form-item>
      <el-form-item label="单价" prop="unitPrice">
        <el-input v-model="form.unitPrice" placeholder="例如 15.80" />
      </el-form-item>
      <el-form-item label="绑定工单" prop="linkedWorkOrderId">
        <el-select v-model="form.linkedWorkOrderId" clearable filterable style="width: 100%">
          <el-option
            v-for="item in workOrderOptions"
            :key="item.id"
            :label="`${item.workOrderNo} / ${item.title}`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="责任人 ID" prop="responsibleUserId">
        <el-input-number v-model="form.responsibleUserId" :min="1" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备料时间" prop="preparedAt">
        <el-date-picker
          v-model="form.preparedAt"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="绑定截止时间" prop="bindDeadlineAt">
        <el-date-picker
          v-model="form.bindDeadlineAt"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item>
        <el-button @click="router.push('/material-preparations')">返回</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createMaterialPreparation } from '../../api/material-preparations';
import { getMaterials } from '../../api/materials';
import { getSuppliers } from '../../api/suppliers';
import { getWarehouses } from '../../api/warehouses';
import { getWorkOrders } from '../../api/work-orders';

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const submitting = ref(false);
const materialOptions = ref<any[]>([]);
const supplierOptions = ref<any[]>([]);
const warehouseOptions = ref<any[]>([]);
const workOrderOptions = ref<any[]>([]);
const form = reactive({
  materialId: undefined as number | undefined,
  supplierId: undefined as number | undefined,
  warehouseId: undefined as number | undefined,
  quantity: '',
  unitPrice: '',
  linkedWorkOrderId: undefined as number | undefined,
  responsibleUserId: undefined as number | undefined,
  preparedAt: '',
  bindDeadlineAt: '',
  remark: '',
});

const rules: FormRules = {
  materialId: [{ required: true, message: '请选择材料', trigger: 'change' }],
  warehouseId: [{ required: true, message: '请选择所在库房', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
  unitPrice: [{ required: true, message: '请输入单价', trigger: 'blur' }],
};

async function loadOptions() {
  loading.value = true;
  try {
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
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    await createMaterialPreparation(form);
    ElMessage.success('备料创建成功');
    router.push('/material-preparations');
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
</style>
