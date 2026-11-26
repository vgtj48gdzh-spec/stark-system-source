<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">平台内容</div>
          <div class="subtitle">查看真实内容样本、目标客户、业务域、预期转化和导入来源，为后续归因与执行做底稿。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增内容</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="平台">
        <el-input v-model="filters.platform" clearable placeholder="如 douyin / wechat" style="width: 150px" />
      </el-form-item>
      <el-form-item label="账号">
        <el-input v-model="filters.accountId" clearable placeholder="平台账号ID" style="width: 150px" />
      </el-form-item>
      <el-form-item label="活动">
        <el-input v-model="filters.campaignId" clearable placeholder="活动ID" style="width: 150px" />
      </el-form-item>
      <el-form-item label="内容类型">
        <el-input v-model="filters.contentType" clearable placeholder="video / post" style="width: 140px" />
      </el-form-item>
      <el-form-item label="导入批次">
        <el-input-number v-model="filters.importBatchId" :min="1" style="width: 140px" />
      </el-form-item>
      <el-form-item label="状态">
        <el-input v-model="filters.status" clearable placeholder="draft / published" style="width: 140px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column label="平台" width="100">
        <template #default="{ row }">{{ formatPlatform(row.platform) }}</template>
      </el-table-column>
      <el-table-column prop="accountId" label="账号ID" min-width="140" show-overflow-tooltip />
      <el-table-column prop="contentId" label="内容ID" min-width="140" show-overflow-tooltip />
      <el-table-column prop="campaignId" label="活动ID" min-width="120" show-overflow-tooltip />
      <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
      <el-table-column label="内容类型" width="100">
        <template #default="{ row }">{{ formatContentType(row.contentType) }}</template>
      </el-table-column>
      <el-table-column label="内容分类" min-width="220">
        <template #default="{ row }">
          <div class="meta-stack">
            <div>{{ formatContentPlanningCategory(resolvePayload(row, 'planningCategory')) }}</div>
            <div class="sub-cell">{{ resolvePayload(row, 'contentTopic') || '-' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="目标与转化" min-width="220">
        <template #default="{ row }">
          <div class="meta-stack">
            <div>{{ formatTargetCustomerType(resolvePayload(row, 'targetCustomerType')) }}</div>
            <div class="sub-cell">{{ formatBusinessDomain(resolvePayload(row, 'targetBusinessDomain')) }}</div>
            <div class="sub-cell">{{ formatExpectedConversionGoal(resolvePayload(row, 'expectedConversionGoal')) }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="标签" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div v-if="Array.isArray(row.tags) && row.tags.length" class="tag-list">
            <el-tag
              v-for="tag in row.tags"
              :key="`${row.id}-${tag}`"
              size="small"
              effect="plain"
              class="tag-item"
            >
              {{ tag }}
            </el-tag>
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="导入来源" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="meta-stack">
            <div>批次 {{ row.importBatchId || '-' }}</div>
            <div class="sub-cell">{{ row.sourceFile || '手工录入' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" show-overflow-tooltip />
      <el-table-column label="发布时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.publishedAt" /></template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.createdAt" /></template>
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

    <el-dialog v-model="dialogVisible" title="新增平台内容" width="720px">
      <el-form label-width="110px">
        <el-form-item label="平台"><el-input v-model="form.platform" /></el-form-item>
        <el-form-item label="账号ID"><el-input v-model="form.accountId" /></el-form-item>
        <el-form-item label="内容ID"><el-input v-model="form.contentId" /></el-form-item>
        <el-form-item label="活动ID"><el-input v-model="form.campaignId" /></el-form-item>
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="内容类型"><el-input v-model="form.contentType" /></el-form-item>
        <el-form-item label="内容主题"><el-input v-model="form.contentTopic" /></el-form-item>
        <el-form-item label="目标客户">
          <el-select v-model="form.targetCustomerType" clearable style="width: 100%">
            <el-option label="新客户" value="new_customer" />
            <el-option label="复购客户" value="returning_customer" />
            <el-option label="员工" value="employee" />
            <el-option label="商户员工" value="merchant_staff" />
            <el-option label="咨询访客" value="faq_visitor" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务域">
          <el-select v-model="form.targetBusinessDomain" clearable style="width: 100%">
            <el-option label="ABC综合" value="abc_overall" />
            <el-option label="A端洗车卡" value="a_wash_card_sale" />
            <el-option label="员工福利" value="employee_benefit" />
            <el-option label="知识支持" value="knowledge_support" />
            <el-option label="售后服务" value="after_sales" />
          </el-select>
        </el-form-item>
        <el-form-item label="预期转化">
          <el-select v-model="form.expectedConversionGoal" clearable style="width: 100%">
            <el-option label="引导咨询" value="consultation" />
            <el-option label="促进购买" value="purchase" />
            <el-option label="确认福利到账" value="benefit_claim" />
            <el-option label="引导回复" value="reply" />
            <el-option label="引导到店" value="attendance" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tagsText" placeholder="用逗号分隔，如 A端洗车卡宣传, 真实内容" />
        </el-form-item>
        <el-form-item label="发布时间">
          <el-date-picker
            v-model="form.publishedAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="状态"><el-input v-model="form.status" /></el-form-item>
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
import { createPlatformContent, getPlatformContents } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatBusinessDomain,
  formatContentPlanningCategory,
  formatContentType,
  formatExpectedConversionGoal,
  formatPlatform,
  formatTargetCustomerType,
} from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.contents.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  platform: '',
  accountId: '',
  campaignId: '',
  contentType: '',
  importBatchId: undefined as number | undefined,
  status: '',
});
const form = reactive({
  platform: '',
  accountId: '',
  contentId: '',
  campaignId: '',
  title: '',
  contentType: 'video',
  contentTopic: '',
  targetCustomerType: '',
  targetBusinessDomain: '',
  expectedConversionGoal: '',
  tagsText: '',
  publishedAt: '',
  status: 'published',
});

function resolvePayload(row: any, key: string) {
  return row?.normalizedPayload?.[key];
}

function parseTags(text: string) {
  return text
    .split(/[,\n，|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPlatformContents({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'publishedAt',
      sortOrder: 'desc',
      platform: filters.platform || undefined,
      accountId: filters.accountId || undefined,
      campaignId: filters.campaignId || undefined,
      contentType: filters.contentType || undefined,
      importBatchId: filters.importBatchId,
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
  filters.accountId = '';
  filters.campaignId = '';
  filters.contentType = '';
  filters.importBatchId = undefined;
  filters.status = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function openCreateDialog() {
  form.platform = '';
  form.accountId = '';
  form.contentId = '';
  form.campaignId = '';
  form.title = '';
  form.contentType = 'video';
  form.contentTopic = '';
  form.targetCustomerType = '';
  form.targetBusinessDomain = '';
  form.expectedConversionGoal = '';
  form.tagsText = '';
  form.publishedAt = '';
  form.status = 'published';
  dialogVisible.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    const payload = {
      platform: form.platform.trim(),
      accountId: form.accountId.trim(),
      contentId: form.contentId.trim(),
      campaignId: form.campaignId.trim() || undefined,
      title: form.title.trim(),
      contentType: form.contentType.trim(),
      tags: parseTags(form.tagsText),
      publishedAt: form.publishedAt || undefined,
      status: form.status.trim(),
      normalizedPayload: {
        contentTopic: form.contentTopic.trim() || undefined,
        targetCustomerType: form.targetCustomerType || undefined,
        targetBusinessDomain: form.targetBusinessDomain || undefined,
        expectedConversionGoal: form.expectedConversionGoal || undefined,
      },
    };
    await createPlatformContent(payload);
    ElMessage.success('平台内容创建成功');
    dialogVisible.value = false;
    handleSearch();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '平台内容创建失败');
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

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-item {
  margin-right: 0;
}

.meta-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sub-cell {
  font-size: 12px;
  color: #6b7280;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
