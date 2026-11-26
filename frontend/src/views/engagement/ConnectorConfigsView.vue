<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">连接器配置</div>
          <div class="subtitle">为后续抖音、微信等平台适配器预留配置。当前先支持文件导入与接口适配器的配置管理。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增配置</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="平台">
        <el-input v-model="filters.platform" clearable style="width: 140px" />
      </el-form-item>
      <el-form-item label="配置状态">
        <el-select v-model="filters.status" clearable style="width: 140px">
          <el-option label="启用" value="active" />
          <el-option label="停用" value="inactive" />
          <el-option label="草稿" value="draft" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="id" label="配置ID" width="90" />
      <el-table-column label="平台" width="100">
        <template #default="{ row }">{{ formatPlatform(row.platform) }}</template>
      </el-table-column>
      <el-table-column prop="accountId" label="账号ID" min-width="140" show-overflow-tooltip />
      <el-table-column prop="connectorCode" label="配置编码" min-width="160" show-overflow-tooltip />
      <el-table-column prop="connectorName" label="配置名称" min-width="160" show-overflow-tooltip />
      <el-table-column label="连接器类型" width="120">
        <template #default="{ row }">{{ formatConnectorType(row.connectorType) }}</template>
      </el-table-column>
      <el-table-column prop="authMode" label="鉴权方式" width="120" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ formatConnectorStatus(row.status) }}</template>
      </el-table-column>
      <el-table-column label="最近同步" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.lastSyncedAt" /></template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column v-if="canManage" label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="pager"
      background
      layout="total, prev, pager, next"
      :total="total"
      :page-size="query.pageSize"
      :current-page="query.page"
      @current-change="handlePageChange"
    />

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑连接器配置' : '新增连接器配置'" width="720px">
      <el-form label-width="110px">
        <el-form-item label="平台"><el-input v-model="form.platform" /></el-form-item>
        <el-form-item label="账号ID"><el-input v-model="form.accountId" /></el-form-item>
        <el-form-item label="配置编码"><el-input v-model="form.connectorCode" /></el-form-item>
        <el-form-item label="配置名称"><el-input v-model="form.connectorName" /></el-form-item>
        <el-form-item label="连接器类型">
          <el-select v-model="form.connectorType" style="width: 100%">
            <el-option label="文件导入" value="file_import" />
            <el-option label="平台适配器" value="api_adapter" />
          </el-select>
        </el-form-item>
        <el-form-item label="鉴权方式"><el-input v-model="form.authMode" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
            <el-option label="草稿" value="draft" />
          </el-select>
        </el-form-item>
        <el-form-item label="配置JSON">
          <el-input v-model="form.configJsonText" type="textarea" :rows="5" placeholder="可填 JSON" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  createPlatformConnectorConfig,
  getPlatformConnectorConfigs,
  updatePlatformConnectorConfig,
} from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatConnectorStatus, formatConnectorType, formatPlatform } from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.connectorConfigs.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  platform: '',
  status: '',
});
const form = reactive({
  platform: '',
  accountId: '',
  connectorCode: '',
  connectorName: '',
  connectorType: 'file_import',
  authMode: '',
  status: 'active',
  configJsonText: '',
  remark: '',
});

function parseJson(text: string) {
  if (!text.trim()) return undefined;
  return JSON.parse(text);
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPlatformConnectorConfigs({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      platform: filters.platform || undefined,
      status: filters.status || undefined,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.platform = '';
  filters.status = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function resetForm() {
  editingId.value = null;
  form.platform = '';
  form.accountId = '';
  form.connectorCode = '';
  form.connectorName = '';
  form.connectorType = 'file_import';
  form.authMode = '';
  form.status = 'active';
  form.configJsonText = '';
  form.remark = '';
}

function openCreateDialog() {
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(row: any) {
  editingId.value = row.id;
  form.platform = row.platform ?? '';
  form.accountId = row.accountId ?? '';
  form.connectorCode = row.connectorCode ?? '';
  form.connectorName = row.connectorName ?? '';
  form.connectorType = row.connectorType ?? 'file_import';
  form.authMode = row.authMode ?? '';
  form.status = row.status ?? 'active';
  form.configJsonText = row.configJson ? JSON.stringify(row.configJson, null, 2) : '';
  form.remark = row.remark ?? '';
  dialogVisible.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    const payload = {
      platform: form.platform,
      accountId: form.accountId,
      connectorCode: form.connectorCode,
      connectorName: form.connectorName,
      connectorType: form.connectorType,
      authMode: form.authMode || undefined,
      status: form.status,
      configJson: parseJson(form.configJsonText),
      remark: form.remark || undefined,
    };

    if (editingId.value) {
      await updatePlatformConnectorConfig(editingId.value, payload);
      ElMessage.success('连接器配置更新成功');
    } else {
      await createPlatformConnectorConfig(payload);
      ElMessage.success('连接器配置创建成功');
    }
    dialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('保存失败，请检查配置内容');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.header-row {
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

.filters {
  margin-bottom: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
