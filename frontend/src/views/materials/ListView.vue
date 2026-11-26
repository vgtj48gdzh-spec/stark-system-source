<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <div>
          <div class="title">材料档案</div>
          <div class="subtitle">材料将被库存、备料和工单材料成本统一引用。</div>
        </div>
        <el-button v-if="formalActorIdentityBound" type="primary" @click="router.push('/materials/create')">新建材料</el-button>
      </div>
    </template>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="materialNo" label="材料编号" min-width="160" />
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column prop="specification" label="规格" min-width="140" />
      <el-table-column prop="unit" label="单位" min-width="100" />
      <el-table-column prop="category" label="分类" min-width="120" />
      <el-table-column label="默认供应商" min-width="180">
        <template #default="{ row }">
          {{ supplierMap[row.defaultSupplierId]?.name || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="defaultUnitPrice" label="默认单价" min-width="100" />
      <el-table-column prop="warningQuantity" label="预警库存" min-width="100" />
      <el-table-column label="状态" min-width="120">
        <template #default="{ row }">
          <el-tag :type="materialStatusMap[row.status]?.type || 'info'">
            {{ materialStatusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button v-if="formalActorIdentityBound" link type="primary" @click="router.push(`/materials/${row.id}/edit`)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getMaterials } from '../../api/materials';
import { getSuppliers } from '../../api/suppliers';
import { materialStatusMap } from '../../utils/status-tag';
import { formalActorIdentityBound } from '../../utils/permissions';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);
const suppliers = ref<any[]>([]);
const supplierMap = computed(() => Object.fromEntries(suppliers.value.map((item) => [item.id, item])));

async function loadData() {
  loading.value = true;
  try {
    const [materialsResponse, suppliersResponse] = await Promise.all([getMaterials(), getSuppliers()]);
    tableData.value = materialsResponse.data.data;
    suppliers.value = suppliersResponse.data.data;
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.toolbar {
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
</style>
