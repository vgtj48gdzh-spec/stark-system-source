<template>
  <el-card>
    <template #header>登记付款</template>

    <el-alert
      type="warning"
      :closable="false"
      title="仅已通过审批的申请会出现在下拉框中；即便手工构造请求，后端也会再次拦截。"
      class="tip"
    />

    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="form">
      <el-form-item label="审批申请" prop="approvalRequestId">
        <el-select v-model="form.approvalRequestId" filterable clearable style="width: 100%">
          <el-option
            v-for="item in approvalOptions"
            :key="item.id"
            :label="`${item.approvalNo} / 工单#${item.relatedWorkOrderId}`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="付款金额" prop="amount">
        <el-input v-model="form.amount" placeholder="例如 500.00" />
      </el-form-item>
      <el-form-item label="收款方" prop="payeeName">
        <el-input v-model="form.payeeName" />
      </el-form-item>
      <el-form-item label="付款方式" prop="paymentMethod">
        <el-input v-model="form.paymentMethod" />
      </el-form-item>
      <el-form-item label="付款时间" prop="paidAt">
        <el-date-picker
          v-model="form.paidAt"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="router.push('/payout-records')">返回</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!formalActorIdentityBound"
          @click="handleSubmit"
        >提交</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getApprovalRequests } from '../../api/approval-requests';
import { createPayoutRecord } from '../../api/payout-records';
import { formalActorIdentityBound } from '../../utils/permissions';

const router = useRouter();
const formRef = ref<FormInstance>();
const submitting = ref(false);
const approvalOptions = ref<any[]>([]);
const form = reactive({
  approvalRequestId: undefined as number | undefined,
  amount: '',
  payeeName: '',
  paymentMethod: '',
  paidAt: '',
});

const rules: FormRules = {
  approvalRequestId: [{ required: true, message: '请选择审批申请', trigger: 'change' }],
  amount: [{ required: true, message: '请输入付款金额', trigger: 'blur' }],
  payeeName: [{ required: true, message: '请输入收款方', trigger: 'blur' }],
  paymentMethod: [{ required: true, message: '请输入付款方式', trigger: 'blur' }],
  paidAt: [{ required: true, message: '请选择付款时间', trigger: 'change' }],
};

async function loadApprovals() {
  const { data } = await getApprovalRequests({ page: 1, pageSize: 100 });
  approvalOptions.value = data.data.list.filter((item: any) => item.currentStatus === 'approved');
}

async function handleSubmit() {
  if (!formalActorIdentityBound.value) {
    ElMessage.warning('请先通过可信代理绑定正式人员身份');
    return;
  }
  await formRef.value?.validate();
  submitting.value = true;
  try {
    await createPayoutRecord(form);
    ElMessage.success('付款记录创建成功');
    router.push('/payout-records');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadApprovals);
</script>

<style scoped>
.tip {
  margin-bottom: 16px;
}

.form {
  max-width: 720px;
}
</style>
