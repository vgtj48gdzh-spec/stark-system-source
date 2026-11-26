<template>
  <el-card>
    <template #header>{{ isEdit ? '编辑材料' : '新建材料' }}</template>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      class="form"
      v-loading="loading"
    >
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="规格" prop="specification">
        <el-input v-model="form.specification" />
      </el-form-item>
      <el-form-item label="单位" prop="unit">
        <el-input v-model="form.unit" />
      </el-form-item>
      <el-form-item label="分类" prop="category">
        <el-input v-model="form.category" />
      </el-form-item>
      <el-form-item label="默认供应商" prop="defaultSupplierId">
        <el-select v-model="form.defaultSupplierId" clearable filterable style="width: 100%">
          <el-option
            v-for="item in supplierOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="默认单价" prop="defaultUnitPrice">
        <el-input v-model="form.defaultUnitPrice" placeholder="例如 25.50" />
      </el-form-item>
      <el-form-item label="预警库存" prop="warningQuantity">
        <el-input v-model="form.warningQuantity" placeholder="例如 10.00" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="form.status" style="width: 100%">
          <el-option label="启用" value="active" />
          <el-option label="停用" value="inactive" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item>
        <el-button @click="router.push('/materials')">返回</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!formalActorIdentityBound" @click="handleSubmit">保存</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { formalActorIdentityBound } from '../../utils/permissions';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createMaterial, getMaterialDetail, updateMaterial } from '../../api/materials';
import { getSuppliers } from '../../api/suppliers';

const route = useRoute();
const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const submitting = ref(false);
const supplierOptions = ref<any[]>([]);
const isEdit = computed(() => Boolean(route.params.id));
const form = reactive({
  name: '',
  specification: '',
  unit: '',
  category: '',
  defaultSupplierId: undefined as number | undefined,
  defaultUnitPrice: '',
  warningQuantity: '0.00',
  status: 'active',
  remark: '',
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入材料名称', trigger: 'blur' }],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }],
};

async function loadOptions() {
  const { data } = await getSuppliers();
  supplierOptions.value = data.data;
}

async function loadDetail() {
  if (!isEdit.value) {
    return;
  }

  loading.value = true;
  try {
    const { data } = await getMaterialDetail(route.params.id as string);
    Object.assign(form, data.data);
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
    if (isEdit.value) {
      await updateMaterial(route.params.id as string, form);
      ElMessage.success('材料更新成功');
    } else {
      await createMaterial(form);
      ElMessage.success('材料创建成功');
    }
    router.push('/materials');
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadOptions(), loadDetail()]);
});
</script>

<style scoped>
.form {
  max-width: 720px;
}
</style>
