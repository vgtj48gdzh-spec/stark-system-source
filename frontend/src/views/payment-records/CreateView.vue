<template>
  <el-card>
    <template #header>录入收款</template>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="form">
      <el-form-item label="关联工单" prop="workOrderId">
        <el-select v-model="form.workOrderId" filterable clearable style="width: 100%">
          <el-option
            v-for="item in workOrderOptions"
            :key="item.id"
            :label="`${item.workOrderNo} / ${item.title}`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="金额" prop="amount">
        <el-input v-model="form.amount" placeholder="例如 3000.00" />
      </el-form-item>
      <el-form-item label="收款方式" prop="paymentMethod">
        <el-input v-model="form.paymentMethod" placeholder="如 对公转账 / 现金" />
      </el-form-item>
      <el-form-item label="收款状态" prop="paymentStatus">
        <el-select v-model="form.paymentStatus" style="width: 100%">
          <el-option label="待确认" value="pending" />
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
        </el-select>
      </el-form-item>
      <el-form-item label="付款人" prop="payerName">
        <el-input v-model="form.payerName" />
      </el-form-item>
      <el-form-item label="收款时间" prop="paidAt">
        <el-date-picker
          v-model="form.paidAt"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item>
        <el-button @click="router.push('/payment-records')">返回</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">提交</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createPaymentRecord } from '../../api/payment-records';
import { getWorkOrders } from '../../api/work-orders';

const router = useRouter();
const formRef = ref<FormInstance>();
const submitting = ref(false);
const workOrderOptions = ref<any[]>([]);
const form = reactive({
  workOrderId: undefined as number | undefined,
  amount: '',
  paymentMethod: '',
  paymentStatus: 'pending',
  payerName: '',
  paidAt: '',
  remark: '',
});

const rules: FormRules = {
  workOrderId: [{ required: true, message: '请选择工单', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  paymentMethod: [{ required: true, message: '请输入收款方式', trigger: 'blur' }],
  paymentStatus: [{ required: true, message: '请选择收款状态', trigger: 'change' }],
};

async function loadWorkOrders() {
  const { data } = await getWorkOrders({ page: 1, pageSize: 100 });
  workOrderOptions.value = data.data.list;
}

async function handleSubmit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    await createPaymentRecord(form);
    ElMessage.success('收款记录创建成功');
    router.push('/payment-records');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadWorkOrders);
</script>

<style scoped>
.form {
  max-width: 720px;
}
</style>
