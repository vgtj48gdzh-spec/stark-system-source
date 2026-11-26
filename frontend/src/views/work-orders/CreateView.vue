<template>
  <WorkOrderIntakeForm v-if="ownerIntakeEnabled" />
  <el-card v-else>
    <template #header>{{ ownerRepairAcceptanceEnabled ? '创建合成工单' : '创建工单' }}</template>

    <el-alert
      :type="ownerRepairAcceptanceEnabled ? 'warning' : 'info'"
      :closable="false"
      :title="
        ownerRepairAcceptanceEnabled
          ? '只允许合成数据：标题和客户姓名必须以 SYNTHETIC 开头，手机号必须留空；工单只写入隔离数据库。'
          : '工单创建后系统会自动进入待付款状态，收款成功后才会自动变更为已付款。'
      "
      class="tip"
    />

    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="form">
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="请输入工单标题" />
      </el-form-item>
      <el-form-item label="客户姓名" prop="customerName">
        <el-input v-model="form.customerName" placeholder="请输入客户姓名" />
      </el-form-item>
      <el-form-item label="客户手机号" prop="customerMobile">
        <el-input
          v-model="form.customerMobile"
          :disabled="ownerRepairAcceptanceEnabled"
          :placeholder="ownerRepairAcceptanceEnabled ? '隔离验收禁止录入手机号' : '可选'"
        />
      </el-form-item>
      <el-form-item label="应收金额" prop="amountDue">
        <el-input v-model="form.amountDue" placeholder="例如 1200.00" />
      </el-form-item>
      <el-form-item label="负责人 ID" prop="responsibleUserId">
        <el-input-number v-model="form.responsibleUserId" :min="1" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item>
        <el-button @click="router.push('/work-orders')">返回</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">提交</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createWorkOrder } from '../../api/work-orders';
import WorkOrderIntakeForm from './components/WorkOrderIntakeForm.vue';

const router = useRouter();
const ownerIntakeEnabled = __OWNER_INTAKE__;
const ownerRepairAcceptanceEnabled = __OWNER_REPAIR_ACCEPTANCE__;
const formRef = ref<FormInstance>();
const submitting = ref(false);
const form = reactive({
  title: '',
  customerName: '',
  customerMobile: '',
  amountDue: '',
  responsibleUserId: undefined as number | undefined,
  remark: '',
});

const rules: FormRules = {
  title: [{ required: true, message: '请输入工单标题', trigger: 'blur' }],
  customerName: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  amountDue: [{ required: true, message: '请输入应收金额', trigger: 'blur' }],
};

async function handleSubmit() {
  await formRef.value?.validate();
  if (
    ownerRepairAcceptanceEnabled &&
    (!form.title.trim().startsWith('SYNTHETIC') ||
      !form.customerName.trim().startsWith('SYNTHETIC') ||
      Boolean(form.customerMobile.trim()))
  ) {
    ElMessage.warning('隔离验收数据必须以 SYNTHETIC 开头，且手机号必须留空');
    return;
  }
  submitting.value = true;
  try {
    await createWorkOrder({
      ...form,
      customerMobile: ownerRepairAcceptanceEnabled ? '00000000000' : form.customerMobile,
    });
    ElMessage.success(ownerRepairAcceptanceEnabled ? '合成工单创建成功' : '工单创建成功');
    router.push('/work-orders');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.tip {
  margin-bottom: 16px;
}

.form {
  max-width: 720px;
}
</style>
