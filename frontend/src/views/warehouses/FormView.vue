<template>
  <el-card>
    <template #header>{{ isEdit ? '编辑库房' : '新建库房' }}</template>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="form" v-loading="loading">
      <el-form-item label="库房名称" prop="name">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="库房编码" prop="code">
        <el-input v-model="form.code" />
      </el-form-item>
      <el-form-item label="负责人 ID" prop="managerUserId">
        <el-input-number v-model="form.managerUserId" :min="1" style="width: 100%" />
      </el-form-item>
      <el-form-item label="地址" prop="address">
        <el-input v-model="form.address" />
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
        <el-button @click="router.push('/warehouses')">返回</el-button>
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
import {
  createWarehouse,
  getWarehouseDetail,
  updateWarehouse,
} from '../../api/warehouses';

const route = useRoute();
const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const submitting = ref(false);
const isEdit = computed(() => Boolean(route.params.id));
const form = reactive({
  name: '',
  code: '',
  managerUserId: undefined as number | undefined,
  address: '',
  status: 'active',
  remark: '',
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入库房名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入库房编码', trigger: 'blur' }],
};

async function loadDetail() {
  if (!isEdit.value) {
    return;
  }

  loading.value = true;
  try {
    const { data } = await getWarehouseDetail(route.params.id as string);
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
      await updateWarehouse(route.params.id as string, form);
      ElMessage.success('库房更新成功');
    } else {
      await createWarehouse(form);
      ElMessage.success('库房创建成功');
    }
    router.push('/warehouses');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadDetail);
</script>

<style scoped>
.form {
  max-width: 720px;
}
</style>
