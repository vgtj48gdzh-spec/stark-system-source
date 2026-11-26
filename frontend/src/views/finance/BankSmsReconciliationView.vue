<template>
  <div class="page-stack">
    <el-alert
      v-if="OWNER_BANK_SMS_READONLY_ENABLED"
      type="info"
      :closable="false"
      show-icon
      class="page-alert"
      title="OWNER 银行短信证据只读入口"
      description="这里只允许查看概览、待处理证据、交易列表和脱敏详情；建议匹配、确认入账、忽略、历史短信回放以及其它资金写入均已关闭。"
    />
    <el-alert
      v-if="pageError"
      type="error"
      :closable="false"
      show-icon
      class="page-alert"
      :title="pageError"
    />

    <el-card class="hero-card">
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">财务中心 / 银行短信对账</div>
            <div class="subtitle">
              这里只展示 classify_type = bank_transaction 的短信。只有已完成账户绑定的短信才能进入建议匹配；短信本身不会自动改虚拟金额。
            </div>
          </div>
          <div v-if="OWNER_BANK_SMS_READONLY_ENABLED" class="toolbar-actions">
            <el-tag type="warning" effect="plain">只读证据模式</el-tag>
          </div>
          <div v-else class="toolbar-actions">
            <el-button type="primary" plain @click="router.push('/finance/bank-accounts')">
              去做账户绑定
            </el-button>
            <el-button plain @click="router.push('/finance/wechat-receipts')">
              微信支付回执
            </el-button>
            <el-button plain @click="router.push('/finance/wechat-settlement-batches')">
              财付通结算批次
            </el-button>
            <el-button plain @click="router.push('/finance/virtual-amount-check')">
              查看差额监控
            </el-button>
          </div>
        </div>
      </template>

      <div class="summary-scope-bar">
        <div class="summary-scope-copy">
          <div class="summary-scope-title">顶部汇总口径</div>
          <div class="summary-scope-description">
            {{ activeSummaryView.description || overview.aggregationNotice }}
          </div>
        </div>
        <el-radio-group v-model="summaryScope" size="small">
          <el-radio-button label="account">账户视角</el-radio-button>
          <el-radio-button label="company">公司视角</el-radio-button>
          <el-radio-button label="group">集团合并视角</el-radio-button>
        </el-radio-group>
      </div>

      <el-row :gutter="12">
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">今日银行入账发生额</div>
            <div class="metric-value income">{{ formatMoney(activeSummaryCards.todayBankIncome) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">今日银行出账发生额</div>
            <div class="metric-value expense">{{ formatMoney(activeSummaryCards.todayBankExpense) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">内部划拨净额</div>
            <div class="metric-value diff">{{ formatMoney(activeSummaryCards.internalTransferNet) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">待处理</div>
            <div class="metric-value warning">{{ activeSummaryCards.pendingCount || 0 }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">待绑定</div>
            <div class="metric-value warning">{{ activeSummaryCards.pendingBindingCount || 0 }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">当前银行余额</div>
            <div class="metric-value">{{ formatMoney(activeSummaryCards.currentBankBalance) }}</div>
          </div>
        </el-col>
      </el-row>

      <el-alert type="warning" :closable="false" class="page-alert" show-icon>
        <template #title>对账证据层提醒</template>
        <div>
          {{ overview.aggregationNotice || '当前顶部数字只属于银行短信对账证据层，不直接等于经营收入/支出或利润口径。' }}
        </div>
        <div style="margin-top: 8px">
          集团合并视角下，命中集团内正式账户的内部转账只计入“内部划拨净额”，不再混入入账/出账。
        </div>
        <div v-if="(overview.deferredMetrics || []).length" style="margin-top: 8px">
          本轮暂未纳入顶部卡片：{{ (overview.deferredMetrics || []).join('、') }}。
        </div>
      </el-alert>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-header">
          <span>{{ activeSummaryView.label || '汇总明细' }}</span>
          <span class="section-meta">{{ activeSummaryRows.length }} 行</span>
        </div>
      </template>

      <el-table :data="activeSummaryRows" empty-text="暂无汇总数据">
        <template v-if="summaryScope === 'account'">
          <el-table-column prop="companyId" label="公司 ID" width="100" />
          <el-table-column prop="bankName" label="银行" width="140" />
          <el-table-column prop="sender" label="发送方" width="110" />
          <el-table-column prop="accountTail" label="尾号" width="100" />
        </template>
        <template v-else-if="summaryScope === 'company'">
          <el-table-column prop="companyId" label="公司 ID" width="100" />
          <el-table-column prop="accountCount" label="账户数" width="100" />
        </template>
        <template v-else>
          <el-table-column prop="scopeLabel" label="视角" min-width="160" />
          <el-table-column prop="accountCount" label="纳入账户数" width="120" />
        </template>
        <el-table-column label="今日银行入账发生额" width="170">
          <template #default="{ row }">{{ formatMoney(row.todayBankIncome) }}</template>
        </el-table-column>
        <el-table-column label="今日银行出账发生额" width="170">
          <template #default="{ row }">{{ formatMoney(row.todayBankExpense) }}</template>
        </el-table-column>
        <el-table-column label="内部划拨净额" width="140">
          <template #default="{ row }">{{ formatMoney(row.internalTransferNet) }}</template>
        </el-table-column>
        <el-table-column prop="pendingCount" label="待处理" width="100" />
        <el-table-column label="当前银行余额" width="140">
          <template #default="{ row }">{{ formatMoney(row.currentBankBalance ?? row.latestBalance) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="OWNER_BANK_SMS_READONLY_ENABLED">
      <template #header>
        <div class="section-header">
          <span>待处理证据台账</span>
          <span class="section-meta">{{ pendingPagination.total }} 条</span>
        </div>
      </template>

      <el-alert
        type="warning"
        :closable="false"
        show-icon
        class="page-alert"
        title="证据只读，不代表已确认或已入账"
        description="这里只展示脱敏证据字段；不能确认、不能提升状态、不能影响总账，也不返回短信正文或安全凭据正文。"
      />

      <el-table
        :data="pendingLedgerData"
        v-loading="pendingLoading"
        empty-text="暂无待处理银行短信证据"
      >
        <el-table-column label="接收时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.receivedAt) }}</template>
        </el-table-column>
        <el-table-column label="台账状态" min-width="170">
          <template #default="{ row }">
            <el-tag :type="pendingLedgerStatusTagType(row.ledgerStatus)" effect="plain">
              {{ formatPendingLedgerStatus(row.ledgerStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="脱敏账户证据" min-width="210">
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div>{{ row.bankName || '银行待识别' }}</div>
              <div class="muted-text">
                发送方 {{ row.sender || '-' }} · 尾号 {{ row.accountTailMasked || '-' }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="方向 / 金额" min-width="150">
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div>{{ formatOptionalDirection(row.direction) }}</div>
              <div class="muted-text">{{ formatOptionalMoney(row.amount) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="证据 / 绑定" min-width="210">
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div>{{ formatPendingEvidenceStatus(row.evidenceStatus) }}</div>
              <div class="muted-text">{{ formatPendingBindingStatus(row.bindingStatus) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="风险标记" min-width="260">
          <template #default="{ row }">
            <div class="risk-tags">
              <el-tag
                v-for="flag in row.riskFlags || []"
                :key="flag"
                type="info"
                effect="plain"
                size="small"
              >
                {{ formatPendingRiskFlag(flag) }}
              </el-tag>
              <span v-if="!(row.riskFlags || []).length" class="muted-text">-</span>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pendingPagination.page"
          v-model:page-size="pendingPagination.pageSize"
          layout="total, sizes, prev, pager, next"
          :total="pendingPagination.total"
          :page-sizes="[10, 20, 50]"
          @current-change="loadPendingLedger"
          @size-change="handlePendingSizeChange"
        />
      </div>
    </el-card>

    <el-card>
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="公司 ID">
          <el-input v-model="filters.companyId" clearable placeholder="例如 7" />
        </el-form-item>
        <el-form-item label="Raw SMS ID">
          <el-input v-model="filters.rawSmsId" clearable placeholder="例如 123" />
        </el-form-item>
        <el-form-item label="银行">
          <el-input v-model="filters.bankName" clearable placeholder="例如 中国银行" />
        </el-form-item>
        <el-form-item label="账户尾号">
          <el-input v-model="filters.accountTail" clearable placeholder="例如 8030" />
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item label="核对状态">
          <el-select v-model="filters.reconcileStatus" clearable placeholder="全部状态" style="width: 160px">
            <el-option label="待绑定" value="pending_binding" />
            <el-option label="待处理" value="pending" />
            <el-option label="待证据" value="pending_evidence" />
            <el-option label="已建议" value="suggested" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已忽略" value="ignored" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="tableData" v-loading="loading" empty-text="暂无银行短信流水">
        <el-table-column label="流水" min-width="260">
          <template #default="{ row }">
            <div class="cell-stack">
              <div class="cell-title-row">
                <span class="cell-title">#{{ row.id }}</span>
                <el-tag :type="directionTagType(row.direction)">
                  {{ formatDirection(row.direction) }}
                </el-tag>
                <el-tag :type="statusTagType(row.reconcileStatus)">
                  {{ formatReconcileStatus(row.reconcileStatus) }}
                </el-tag>
              </div>
              <div class="cell-meta">
                <span>{{ row.bankName }}</span>
                <span>尾号 {{ row.accountTail }}</span>
                <span>公司 {{ row.companyId || '待绑定' }}</span>
              </div>
              <div class="muted-text">
                建议对象：{{ formatLinkType(row.latestLink?.linkType) }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="金额 / 余额" min-width="160">
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div>{{ formatMoney(row.amount) }}</div>
              <div class="muted-text">余额 {{ formatMoney(row.balanceAfter) }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="counterparty" label="对方户名" min-width="160" show-overflow-tooltip />

        <el-table-column label="时间" min-width="180">
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div>{{ formatDateTime(row.bankBusinessDate) }}</div>
              <div class="muted-text">短信：{{ formatDateTime(row.smsReceivedAt) }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <div class="action-row">
              <el-button link type="primary" @click="openDetail(row.id)">查看详情</el-button>
              <el-button
                v-if="canWrite"
                link
                type="warning"
                :disabled="!row.isBound || row.reconcileStatus === 'confirmed' || row.reconcileStatus === 'ignored'"
                @click="reconcileRow(row.id)"
              >
                建议匹配
              </el-button>
              <el-button
                v-if="canWrite"
                link
                type="success"
                :disabled="!row.isBound || row.reconcileStatus === 'confirmed' || row.reconcileStatus === 'ignored'"
                @click="confirmRow(row.id)"
              >
                确认入账
              </el-button>
              <el-button
                v-if="canWrite"
                link
                type="danger"
                :disabled="row.reconcileStatus === 'confirmed'"
                @click="ignoreRow(row.id)"
              >
                忽略
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          layout="total, sizes, prev, pager, next"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="loadTransactions"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" size="820px" :title="`银行短信 #${detailData?.id || ''}`">
      <template v-if="detailData">
        <div class="drawer-section">
          <div class="section-title">绑定信息</div>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="公司 ID">{{ detailData.companyId || '待绑定' }}</el-descriptions-item>
            <el-descriptions-item label="账户绑定">
              {{ detailData.binding?.accountAlias || '未绑定' }}
            </el-descriptions-item>
            <el-descriptions-item label="银行">{{ detailData.bankName }}</el-descriptions-item>
            <el-descriptions-item label="尾号">{{ detailData.accountTail }}</el-descriptions-item>
            <el-descriptions-item label="发送方">{{ detailData.sender }}</el-descriptions-item>
            <el-descriptions-item label="虚拟账户 ID">
              {{ detailData.binding?.virtualLedgerId || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="drawer-section">
          <div class="section-title">原始短信</div>
          <el-input :model-value="detailData.rawSms?.body || ''" type="textarea" :rows="5" readonly />
        </div>

        <div class="drawer-section">
          <div class="section-title">解析结果</div>
          <pre class="json-block">{{ formatJson(detailData.classification) }}</pre>
        </div>

        <div class="drawer-section">
          <div class="section-title">候选匹配</div>
          <el-table :data="detailData.candidateMatches || []" empty-text="暂无候选匹配">
            <el-table-column label="对象" min-width="220">
              <template #default="{ row }">
                <div class="cell-stack compact">
                  <div>{{ row.label }}</div>
                  <div class="muted-text">{{ formatLinkType(row.linkType) }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="依据" min-width="240">
              <template #default="{ row }">{{ (row.rankingReasons || []).join('；') || '-' }}</template>
            </el-table-column>
            <el-table-column prop="score" label="分数" width="90" />
            <el-table-column label="操作" width="160">
              <template #default="{ row }">
                <div class="action-row">
                  <el-button v-if="canWrite" link type="warning" @click="reconcileFromDetail(row)">
                    设为建议
                  </el-button>
                  <el-button
                    v-if="
                      !OWNER_BANK_SMS_READONLY_ENABLED &&
                      row.linkType === 'wechat_settlement_batch' &&
                      row.linkId
                    "
                    link
                    type="primary"
                    @click="openBatchDetail(row.linkId)"
                  >
                    查看批次
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="latestNoCandidateDiagnostic" class="match-diagnostic-block">
            <div class="match-diagnostic-header">匹配诊断</div>
            <div class="match-diagnostic-summary">当前短信暂未找到可建议匹配对象。</div>
            <div v-if="latestNoCandidateDiagnosticFields.length" class="match-diagnostic-fields">
              <div
                v-for="item in latestNoCandidateDiagnosticFields"
                :key="item.label"
                class="match-diagnostic-field"
              >
                <span class="match-diagnostic-label">{{ item.label }}</span>
                <span class="match-diagnostic-value">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="drawer-section">
          <div class="section-title">建议 / 落账记录</div>
          <el-table :data="detailData.reconciliationLinks || []" empty-text="暂无建议或确认记录">
            <el-table-column label="类型" width="180">
              <template #default="{ row }">{{ formatLinkType(row.linkType) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="120">
              <template #default="{ row }">{{ formatLinkStatus(row.status) }}</template>
            </el-table-column>
            <el-table-column label="建议金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.suggestedAmount) }}</template>
            </el-table-column>
            <el-table-column label="确认金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.confirmedAmount) }}</template>
            </el-table-column>
            <el-table-column prop="note" label="备注" min-width="220" show-overflow-tooltip />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button
                  v-if="
                    !OWNER_BANK_SMS_READONLY_ENABLED &&
                    row.linkType === 'wechat_settlement_batch' &&
                    row.linkId
                  "
                  link
                  type="primary"
                  @click="openBatchDetail(row.linkId)"
                >
                  查看批次
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="canWrite" class="drawer-section">
          <div class="section-title">人工确认入账</div>
          <el-form :model="confirmForm" label-width="120px">
            <el-form-item label="建议记录">
              <el-select v-model="confirmForm.reconciliationLinkId" placeholder="选择一条建议记录">
                <el-option
                  v-for="item in suggestibleLinks"
                  :key="item.id"
                  :label="`${formatLinkType(item.linkType)} / ${formatMoney(item.suggestedAmount)}`"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="确认金额">
              <el-input v-model="confirmForm.confirmedAmount" placeholder="默认使用建议金额" />
            </el-form-item>
            <el-form-item label="验证码">
              <el-input v-model="confirmForm.verificationCode" placeholder="审批单建议需要输入验证码" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="confirmForm.note" type="textarea" :rows="2" />
            </el-form-item>
            <el-alert
              v-if="confirmApplyBlockReason"
              type="warning"
              show-icon
              :closable="false"
              class="confirm-block-alert"
              title="确认入账暂不能完成"
            >
              <div>{{ confirmApplyBlockReason }}</div>
              <div class="confirm-block-note">
                这是只读提示，仅解释后端拦截原因；页面不会创建、修改或确认收款单、银行短信或其他财务对象。
              </div>
            </el-alert>
            <el-form-item>
              <el-button
                type="success"
                :disabled="!detailData.availableActions?.canConfirmApply"
                @click="submitConfirmApply"
              >
                人工确认落账
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <div class="drawer-section">
          <div class="section-title">审计日志</div>
          <el-table :data="detailData.auditLogs || []" empty-text="暂无审计日志">
            <el-table-column prop="action" label="动作" width="220" />
            <el-table-column label="说明" min-width="360">
              <template #default="{ row }">
                <div class="cell-stack compact">
                  <template v-if="getDecisionTrailEvent(row)">
                    <div class="decision-trail-summary">
                      <el-tag size="small" effect="plain" type="info">
                        {{ getDecisionTrailEvent(row)?.label }}
                      </el-tag>
                      <span>{{ getDecisionTrailEvent(row)?.description }}</span>
                    </div>
                    <div v-if="formatDecisionTrailDetails(row).length" class="decision-trail-fields">
                      <span
                        v-for="item in formatDecisionTrailDetails(row)"
                        :key="item.label"
                        class="decision-trail-field"
                      >
                        {{ item.label }}：{{ item.value }}
                      </span>
                    </div>
                  </template>
                  <div class="muted-text">{{ row.detail || '-' }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </el-drawer>

    <el-drawer
      v-model="batchDetailVisible"
      size="720px"
      :title="`财付通结算批次 #${batchDetailData?.id || ''}`"
    >
      <template v-if="batchDetailData">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="公司 ID">{{ batchDetailData.companyId }}</el-descriptions-item>
          <el-descriptions-item label="商户">{{ batchDetailData.merchantName || batchDetailData.merchantId }}</el-descriptions-item>
          <el-descriptions-item label="结算日期">{{ batchDetailData.settlementDate }}</el-descriptions-item>
          <el-descriptions-item label="批次号">{{ batchDetailData.batchNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="gross_amount">{{ formatMoney(batchDetailData.grossAmount) }}</el-descriptions-item>
          <el-descriptions-item label="fee_amount">{{ formatMoney(batchDetailData.feeAmount) }}</el-descriptions-item>
          <el-descriptions-item label="net_amount">{{ formatMoney(batchDetailData.netAmount) }}</el-descriptions-item>
          <el-descriptions-item label="match_status">{{ batchDetailData.matchStatus }}</el-descriptions-item>
        </el-descriptions>

        <div class="drawer-section">
          <div class="section-title">包含的微信支付回执</div>
          <el-table :data="batchDetailData.receipts || []" empty-text="暂无回执">
            <el-table-column prop="id" label="ID" width="90" />
            <el-table-column prop="outTradeNo" label="out_trade_no" min-width="160" show-overflow-tooltip />
            <el-table-column prop="transactionId" label="transaction_id" min-width="160" show-overflow-tooltip />
            <el-table-column label="金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.amountPaid || row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="paymentStatus" label="payment_status" width="140" />
            <el-table-column prop="settlementStatus" label="settlement_status" width="150" />
          </el-table>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  confirmApplyFinanceBankSmsTransaction,
  getFinanceBankSmsOverview,
  getFinanceBankSmsPending,
  getFinanceBankSmsTransactionDetail,
  getFinanceBankSmsTransactions,
  ignoreFinanceBankSmsTransaction,
  reconcileFinanceBankSmsTransaction,
} from '../../api/finance-bank-sms';
import { getWechatSettlementBatchDetail } from '../../api/finance-wechat';
import { formatDateTime, formatMoney } from '../../utils/format';
import { hasAnyRole } from '../../utils/permissions';

const router = useRouter();
const route = useRoute();
const OWNER_BANK_SMS_READONLY_ENABLED = __OWNER_BANK_SMS_READONLY__;
const silentRequestConfig = {
  headers: {
    'x-suppress-global-error': '1',
  },
};

const loading = ref(false);
const pendingLoading = ref(false);
const pageError = ref('');
const summaryScope = ref<'account' | 'company' | 'group'>('group');
const tableData = ref<any[]>([]);
const detailVisible = ref(false);
const detailData = ref<any>(null);
const batchDetailVisible = ref(false);
const batchDetailData = ref<any>(null);
const dateRange = ref<string[]>([]);
const filters = reactive({
  rawSmsId: '',
  companyId: '',
  bankName: '',
  accountTail: '',
  reconcileStatus: '' as '' | 'pending_binding' | 'pending' | 'pending_evidence' | 'suggested' | 'confirmed' | 'ignored',
});
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});
const pendingLedgerData = ref<any[]>([]);
const pendingPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});
const overview = reactive<any>({
  aggregationBasis: '',
  aggregationNotice: '',
  defaultScope: 'group',
  deferredMetrics: [],
  views: {
    account: {
      key: 'account',
      label: '账户视角',
      description: '',
      cards: {
        todayBankIncome: 0,
        todayBankExpense: 0,
        internalTransferNet: 0,
        pendingCount: 0,
        pendingBindingCount: 0,
        currentBankBalance: 0,
      },
      summaries: [],
    },
    company: {
      key: 'company',
      label: '公司视角',
      description: '',
      cards: {
        todayBankIncome: 0,
        todayBankExpense: 0,
        internalTransferNet: 0,
        pendingCount: 0,
        pendingBindingCount: 0,
        currentBankBalance: 0,
      },
      summaries: [],
    },
    group: {
      key: 'group',
      label: '集团合并视角',
      description: '',
      cards: {
        todayBankIncome: 0,
        todayBankExpense: 0,
        internalTransferNet: 0,
        pendingCount: 0,
        pendingBindingCount: 0,
        currentBankBalance: 0,
      },
      summaries: [],
    },
  },
  todayIncome: 0,
  todayExpense: 0,
  bankBalance: 0,
  virtualBalance: 0,
  balanceDiff: 0,
  pendingCount: 0,
  pendingBindingCount: 0,
  accountSummaries: [],
});
const confirmForm = reactive({
  reconciliationLinkId: undefined as number | undefined,
  confirmedAmount: '',
  verificationCode: '',
  note: '',
});
const confirmApplyBlockReason = ref('');
const collectionBridgeStatusHints: Record<string, string> = {
  blocked_no_collection_order: '缺少可用的收款单 / collection_order 桥接。',
  blocked_multiple_collection_orders: '存在多个可能收款单，需要人工复核。',
  blocked_amount_mismatch: '收款单金额与银行短信金额不一致。',
  blocked_target_mismatch: '收款单与建议匹配对象不一致。',
  blocked_unreviewed_or_incomplete: '收款单证据或状态未达到确认条件。',
};
const noCandidateHintLabels: Record<string, string> = {
  no_candidate_match: '未找到候选匹配',
  check_business_object_exists: '检查是否已有对应业务对象',
  check_receivable_or_collection_order: '检查应收或收款单',
  check_work_order_or_receipt_item: '检查工单或收款项目',
  check_counterparty_mapping: '检查对方户名映射',
  check_amount_match: '检查金额是否匹配',
  manual_review_required: '需要人工复核',
};
const noCandidateSourceLabels: Record<string, string> = {
  finance_receivable_tracking: '应收跟踪',
  work_orders_receipt_item: '工单或收款项目',
  wechat_settlement_batch: '微信结算批次',
  approval_order: '审批单',
  manual_fee: '手工费用',
  internal_fund_flow_when_loan_interest_candidate: '借还款利息内部往来候选',
};
const decisionTrailEvents: Record<string, { label: string; description: string }> = {
  bank_sms_reconciliation_no_candidate: {
    label: '未找到候选匹配',
    description: '系统没有找到可以建议匹配的业务对象。',
  },
  bank_sms_reconciliation_suggestion_created: {
    label: '已生成建议匹配',
    description: '系统已写入一条待人工复核的建议匹配记录。',
  },
  bank_sms_confirm_apply_attempted: {
    label: '已尝试人工确认入账',
    description: '操作人发起了人工确认入账，等待系统校验结果。',
  },
  bank_sms_confirm_apply_blocked: {
    label: '人工确认入账被系统拦截',
    description: '系统校验未通过，本次确认未改变入账状态。',
  },
  bank_sms_collection_bridge_helper_result: {
    label: '收款单桥接检查结果',
    description: '系统检查银行短信与既有收款单桥接条件后的只读结果。',
  },
  bank_sms_confirm_apply_succeeded: {
    label: '人工确认入账已完成',
    description: '人工确认入账已通过系统校验并完成记录更新。',
  },
};

const canWrite = computed(
  () =>
    !OWNER_BANK_SMS_READONLY_ENABLED &&
    hasAnyRole(['admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator']),
);
const activeSummaryView = computed(() => {
  const fallbackView =
    overview.views?.[overview.defaultScope || 'group'] ||
    overview.views?.group || {
      key: 'group',
      label: '集团合并视角',
      description: '',
      cards: {
        todayBankIncome: 0,
        todayBankExpense: 0,
        internalTransferNet: 0,
        pendingCount: 0,
        pendingBindingCount: 0,
        currentBankBalance: 0,
      },
      summaries: [],
    };

  return overview.views?.[summaryScope.value] || fallbackView;
});
const activeSummaryCards = computed(
  () =>
    activeSummaryView.value?.cards || {
      todayBankIncome: 0,
      todayBankExpense: 0,
      internalTransferNet: 0,
      pendingCount: 0,
      pendingBindingCount: 0,
      currentBankBalance: 0,
    },
);
const activeSummaryRows = computed(() => activeSummaryView.value?.summaries || []);

const suggestibleLinks = computed(() =>
  (detailData.value?.reconciliationLinks || []).filter((item: any) => item.status === 'suggested'),
);
const latestNoCandidateDiagnostic = computed(() => {
  if (!detailData.value || (detailData.value.candidateMatches || []).length > 0) {
    return null;
  }

  const latestLog = (detailData.value.auditLogs || []).reduce((latest: any | null, row: any) => {
    if (readAuditDetailJson(row).eventType !== 'bank_sms_reconciliation_no_candidate') {
      return latest;
    }

    if (!latest) {
      return row;
    }

    return getAuditLogTime(row) > getAuditLogTime(latest) ? row : latest;
  }, null);

  return latestLog ? readAuditDetailJson(latestLog) : null;
});
const latestNoCandidateDiagnosticFields = computed(() => {
  if (!latestNoCandidateDiagnostic.value) {
    return [];
  }

  return formatNoCandidateDiagnosticFields(latestNoCandidateDiagnostic.value);
});

function getPositiveInteger(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : undefined;
}

function readQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }

  return typeof value === 'string' ? value : '';
}

function syncFiltersFromRoute() {
  filters.rawSmsId = readQueryValue(route.query.rawSmsId);
}

async function loadOverview() {
  const { data } = await getFinanceBankSmsOverview(silentRequestConfig);
  Object.assign(overview, data.data);
  if (!overview.views?.[summaryScope.value]) {
    summaryScope.value = data.data.defaultScope || 'group';
  }
}

async function loadTransactions() {
  loading.value = true;
  try {
    const { data } = await getFinanceBankSmsTransactions(
      {
        page: pagination.page,
        pageSize: pagination.pageSize,
        rawSmsId: getPositiveInteger(filters.rawSmsId),
        companyId: getPositiveInteger(filters.companyId),
        bankName: filters.bankName || undefined,
        accountTail: filters.accountTail || undefined,
        reconcileStatus: filters.reconcileStatus || undefined,
        dateFrom: dateRange.value?.[0],
        dateTo: dateRange.value?.[1],
      },
      silentRequestConfig,
    );

    tableData.value = data.data.list || [];
    pagination.total = data.data.total || 0;
  } catch (error: any) {
    pageError.value = error.response?.data?.message || '银行短信对账页加载失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

async function loadPendingLedger() {
  pendingLoading.value = true;
  try {
    const { data } = await getFinanceBankSmsPending(
      {
        page: pendingPagination.page,
        pageSize: pendingPagination.pageSize,
      },
      silentRequestConfig,
    );
    const response = data.data || {};
    const safetyFlags = response.safetyFlags || {};
    const safetyContractValid =
      safetyFlags.readOnly === true &&
      safetyFlags.canConfirm === false &&
      safetyFlags.canPromote === false &&
      safetyFlags.canAffectLedger === false &&
      safetyFlags.writesBankSmsTransaction === false &&
      safetyFlags.writesFinanceInternalFundFlow === false &&
      safetyFlags.writesVirtualAccount === false &&
      safetyFlags.createsConfirmedReconciliation === false &&
      safetyFlags.returnsRawSmsBody === false &&
      safetyFlags.returnsSecurityCredentialBody === false &&
      safetyFlags.redactedByDefault === true;

    if (!safetyContractValid) {
      throw new Error('待处理证据台账的只读安全声明不完整，已停止展示。');
    }

    pendingLedgerData.value = response.list || [];
    pendingPagination.total = response.total || 0;
  } catch (error: any) {
    pendingLedgerData.value = [];
    pendingPagination.total = 0;
    pageError.value =
      error.response?.data?.message ||
      error.message ||
      '待处理证据台账加载失败，请稍后重试。';
  } finally {
    pendingLoading.value = false;
  }
}

async function loadPage() {
  pageError.value = '';
  try {
    const requests = [loadOverview(), loadTransactions()];
    if (OWNER_BANK_SMS_READONLY_ENABLED) {
      requests.push(loadPendingLedger());
    }
    await Promise.all(requests);
  } catch (error: any) {
    pageError.value = error.response?.data?.message || '银行短信对账页加载失败，请稍后重试。';
  }
}

async function openDetail(id: number) {
  confirmApplyBlockReason.value = '';
  const { data } = await getFinanceBankSmsTransactionDetail(id, silentRequestConfig);
  detailData.value = data.data;
  confirmForm.reconciliationLinkId = suggestibleLinks.value[0]?.id;
  confirmForm.confirmedAmount = suggestibleLinks.value[0]?.suggestedAmount || '';
  confirmForm.verificationCode = '';
  confirmForm.note = '';
  detailVisible.value = true;
}

async function openBatchDetail(id: number) {
  const { data } = await getWechatSettlementBatchDetail(id, silentRequestConfig);
  batchDetailData.value = data.data;
  batchDetailVisible.value = true;
}

async function reconcileRow(id: number) {
  await reconcileFinanceBankSmsTransaction(id, {});
  ElMessage.success('已生成建议匹配。');
  await Promise.all([loadPage(), detailVisible.value && detailData.value?.id === id ? openDetail(id) : Promise.resolve()]);
}

async function reconcileFromDetail(row: any) {
  if (!detailData.value?.id) {
    return;
  }

  await reconcileFinanceBankSmsTransaction(detailData.value.id, {
    linkType: row.linkType,
    linkId: row.linkId || undefined,
  });
  ElMessage.success('候选匹配已写入建议。');
  await Promise.all([loadPage(), openDetail(detailData.value.id)]);
}

async function confirmRow(id: number) {
  await openDetail(id);
}

async function submitConfirmApply() {
  if (!detailData.value?.id) {
    return;
  }

  try {
    await confirmApplyFinanceBankSmsTransaction(detailData.value.id, {
      reconciliationLinkId: confirmForm.reconciliationLinkId,
      confirmedAmount: confirmForm.confirmedAmount || undefined,
      verificationCode: confirmForm.verificationCode || undefined,
      note: confirmForm.note || undefined,
    });
    confirmApplyBlockReason.value = '';
    ElMessage.success('已完成人工确认落账。');
    await Promise.all([loadPage(), openDetail(detailData.value.id)]);
  } catch (error: any) {
    const blockReason = buildConfirmApplyBlockReason(error);
    if (blockReason) {
      confirmApplyBlockReason.value = blockReason;
      detailVisible.value = true;
      return;
    }

    throw error;
  }
}

async function ignoreRow(id: number) {
  try {
    await ElMessageBox.confirm('忽略后这条短信不会进入确认入账，是否继续？', '确认忽略', {
      type: 'warning',
    });
    await ignoreFinanceBankSmsTransaction(id, {});
    ElMessage.success('当前短信已忽略。');
    await Promise.all([loadPage(), detailVisible.value && detailData.value?.id === id ? openDetail(id) : Promise.resolve()]);
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    throw error;
  }
}

function handleSearch() {
  pagination.page = 1;
  void router.replace({
    query: {
      ...route.query,
      rawSmsId: filters.rawSmsId || undefined,
    },
  });
  void loadPage();
}

function handleReset() {
  filters.rawSmsId = '';
  filters.companyId = '';
  filters.bankName = '';
  filters.accountTail = '';
  filters.reconcileStatus = '';
  dateRange.value = [];
  pagination.page = 1;
  void router.replace({
    query: {
      ...route.query,
      rawSmsId: undefined,
    },
  });
  void loadPage();
}

function handleSizeChange(size: number) {
  pagination.pageSize = size;
  pagination.page = 1;
  void loadTransactions();
}

function handlePendingSizeChange(size: number) {
  pendingPagination.pageSize = size;
  pendingPagination.page = 1;
  void loadPendingLedger();
}

function formatDirection(value?: string) {
  return value === 'expense' ? '支出' : '收入';
}

function formatOptionalDirection(value?: string | null) {
  return value ? formatDirection(value) : '-';
}

function formatOptionalMoney(value?: string | number | null) {
  return value === undefined || value === null || value === '' ? '-' : formatMoney(value);
}

function formatPendingLedgerStatus(value?: string) {
  const labels: Record<string, string> = {
    raw_received: '已接收原始证据',
    classified_bank_transaction: '已识别银行交易',
    pending_account_binding: '待账户绑定',
    pending_company_binding: '待公司绑定',
    pending_reconciliation: '待人工对账',
    ready_for_manual_review: '待人工复核',
    blocked_security_credential: '安全凭据已阻断',
    ignored_test: '测试证据已忽略',
    rejected: '已拒绝',
  };
  return labels[value || ''] || value || '-';
}

function pendingLedgerStatusTagType(value?: string) {
  if (value === 'blocked_security_credential' || value === 'rejected') {
    return 'danger';
  }
  if (value === 'classified_bank_transaction') {
    return 'success';
  }
  if (value === 'ignored_test') {
    return 'info';
  }
  return 'warning';
}

function formatPendingEvidenceStatus(value?: string) {
  const labels: Record<string, string> = {
    security_credential_metadata_only: '仅保留安全凭据元数据',
    classification_only: '仅有分类证据',
    pending_evidence: '待补证据',
    pending_binding: '待绑定',
    candidate_transaction_pending: '候选交易待复核',
  };
  return labels[value || ''] || value || '-';
}

function formatPendingBindingStatus(value?: string) {
  const labels: Record<string, string> = {
    not_applicable_security_credential_blocked: '安全凭据已阻断，无需绑定',
    missing_account_tail: '缺账户尾号',
    unregistered_account_tail: '账户尾号未登记',
    company_binding_pending: '公司绑定待处理',
    registry_active: '账户登记有效',
  };
  return labels[value || ''] || value || '-';
}

function formatPendingRiskFlag(value?: string) {
  const labels: Record<string, string> = {
    read_only_no_ledger_mutation: '只读且不改账',
    security_credential_blocked: '安全凭据已阻断',
    raw_body_not_returned: '正文不返回',
    account_tail_missing: '缺账户尾号',
    active_bank_account_registry_missing: '缺有效账户登记',
    no_bank_sms_transaction: '尚无交易候选',
    promotion_disabled_candidate_only: '仅候选且禁止提升',
    existing_candidate_transaction: '已有交易候选',
    balance_data_present_pending_only: '余额仅作待处理证据',
  };
  return labels[value || ''] || value || '-';
}

function formatReconcileStatus(value?: string) {
  switch (value) {
    case 'pending_binding':
      return '待绑定';
    case 'pending':
      return '待处理';
    case 'pending_evidence':
      return '待证据';
    case 'suggested':
      return '已建议';
    case 'confirmed':
      return '已确认';
    case 'ignored':
      return '已忽略';
    default:
      return value || '-';
  }
}

function formatLinkType(value?: string) {
  switch (value) {
    case 'receivable_tracking':
      return '应收追踪';
    case 'receipt_item':
      return '待收款项';
    case 'approval_order':
      return '审批单';
    case 'manual_fee':
      return '银行手续费';
    case 'wechat_settlement_batch':
      return '财付通结算批次';
    case 'internal_fund_flow':
      return '内部资金往来';
    case 'ignore':
      return '忽略';
    default:
      return value || '-';
  }
}

function formatLinkStatus(value?: string) {
  switch (value) {
    case 'suggested':
      return '建议匹配成功';
    case 'confirmed':
      return '人工确认落账成功';
    case 'rejected':
      return '已驳回';
    default:
      return value || '-';
  }
}

function directionTagType(value?: string) {
  return value === 'expense' ? 'danger' : 'success';
}

function statusTagType(value?: string) {
  switch (value) {
    case 'pending_binding':
    case 'pending':
    case 'pending_evidence':
      return 'warning';
    case 'suggested':
      return 'info';
    case 'confirmed':
      return 'success';
    case 'ignored':
      return '';
    default:
      return 'info';
  }
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function readAuditDetailJson(row: any): Record<string, unknown> {
  const detailJson = row?.detailJson;
  if (!detailJson) {
    return {};
  }

  if (typeof detailJson === 'string') {
    try {
      const parsed = JSON.parse(detailJson);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof detailJson === 'object' && !Array.isArray(detailJson) ? detailJson : {};
}

function getDecisionTrailEvent(row: any) {
  const eventType = readAuditDetailJson(row).eventType;
  return typeof eventType === 'string' ? decisionTrailEvents[eventType] : undefined;
}

function getAuditLogTime(row: any) {
  const timestamp = Date.parse(row?.createdAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function pickFirstDetailValue(detailJson: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = detailJson[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

function formatCompactValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length ? value.join('、') : '';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  return typeof value === 'string' ? value : '';
}

function formatMappedCompactValue(value: unknown, labels: Record<string, string>) {
  if (Array.isArray(value)) {
    return value
      .map((item) => formatMappedCompactValue(item, labels))
      .filter(Boolean)
      .join('、');
  }

  if (typeof value === 'string') {
    return labels[value] || value;
  }

  return formatCompactValue(value);
}

function formatNoCandidateDiagnosticFields(detailJson: Record<string, unknown>) {
  const fields = [
    {
      label: '检查来源',
      keys: ['candidateSourcesChecked'],
      formatter: (value: unknown) => formatMappedCompactValue(value, noCandidateSourceLabels),
    },
    {
      label: '可能缺失证据',
      keys: ['missingEvidenceHints'],
      formatter: (value: unknown) => formatMappedCompactValue(value, noCandidateHintLabels),
    },
    {
      label: '建议下一步',
      keys: ['safeNextStepHints'],
      formatter: (value: unknown) => formatMappedCompactValue(value, noCandidateHintLabels),
    },
    { label: '对方信息', keys: ['counterpartyPresent'] },
    { label: '公司绑定', keys: ['companyBound'] },
    {
      label: '原因代码',
      keys: ['reasonCode'],
      formatter: (value: unknown) => formatMappedCompactValue(value, noCandidateHintLabels),
    },
  ];

  return fields
    .map((field) => {
      const value = pickFirstDetailValue(detailJson, field.keys);
      const formattedValue = field.formatter
        ? field.formatter(value)
        : formatCompactValue(value);

      return formattedValue ? { label: field.label, value: formattedValue } : null;
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));
}

function formatDecisionTrailDetails(row: any) {
  const detailJson = readAuditDetailJson(row);
  if (!getDecisionTrailEvent(row)) {
    return [];
  }

  const fields = [
    { label: '原因代码', keys: ['reasonCode'] },
    { label: '桥接状态', keys: ['bridgeHelperStatus'] },
    { label: '候选数量', keys: ['candidateCount'] },
    { label: '检查来源', keys: ['candidateSourcesChecked'] },
    { label: '缺失线索', keys: ['missingEvidenceHints'] },
    { label: '下一步提示', keys: ['safeNextStepHints'] },
    { label: '对方信息', keys: ['counterpartyPresent'] },
    { label: '公司绑定', keys: ['companyBound'] },
    { label: '匹配类型', keys: ['selectedLinkType', 'linkType'], formatter: formatLinkType },
    { label: '匹配对象 ID', keys: ['selectedLinkId', 'linkId'] },
    { label: '收款单 ID', keys: ['collectionOrderId'] },
    { label: '候选收款单 ID', keys: ['candidateCollectionOrderIds'] },
    { label: '排序依据', keys: ['rankingReasons'] },
    { label: '候选分数', keys: ['candidateScore'] },
    { label: '请求确认金额', keys: ['requestedConfirmedAmount'], formatter: formatMoney },
  ];

  return fields
    .map((field) => {
      const value = pickFirstDetailValue(detailJson, field.keys);
      const formattedValue = field.formatter
        ? field.formatter(String(value ?? ''))
        : formatCompactValue(value);

      return formattedValue ? { label: field.label, value: formattedValue } : null;
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));
}

function readBackendErrorMessage(error: any) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) {
    return message.filter(Boolean).join('；');
  }

  return typeof message === 'string' && message.trim()
    ? message.trim()
    : error?.message || '';
}

function buildConfirmApplyBlockReason(error: any) {
  const backendMessage = readBackendErrorMessage(error);
  if (!backendMessage) {
    return '';
  }

  const matchedStatus = Object.keys(collectionBridgeStatusHints).find((status) =>
    backendMessage.includes(status),
  );
  if (matchedStatus) {
    return `${collectionBridgeStatusHints[matchedStatus]}请先补齐或复核收款证据。`;
  }

  const isCollectionBridgeBlock =
    backendMessage.includes('Collection-required bank SMS confirm-apply') ||
    backendMessage.includes('finance_collection_order') ||
    backendMessage.includes('Bridge helper status');
  if (!isCollectionBridgeBlock) {
    return '';
  }

  return `${backendMessage}。请先补齐或复核收款证据。`;
}

watch(
  () => route.query.rawSmsId,
  (value, previousValue) => {
    if (value === previousValue) {
      return;
    }

    syncFiltersFromRoute();
    pagination.page = 1;
    void loadPage();
  },
);

watch(
  () => confirmForm.reconciliationLinkId,
  (value, previousValue) => {
    if (value !== previousValue) {
      confirmApplyBlockReason.value = '';
    }
  },
);

onMounted(() => {
  syncFiltersFromRoute();
  void loadPage();
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #172033;
}

.subtitle {
  margin-top: 6px;
  color: #667085;
  line-height: 1.6;
}

.hero-card {
  overflow: hidden;
}

.summary-scope-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.summary-scope-copy {
  display: grid;
  gap: 6px;
}

.summary-scope-title {
  font-size: 13px;
  font-weight: 700;
  color: #172033;
}

.summary-scope-description {
  color: #667085;
  line-height: 1.6;
}

.metric-card {
  height: 100%;
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, #f8fafc, #eef2ff);
  border: 1px solid #e2e8f0;
}

.metric-label {
  font-size: 12px;
  color: #64748b;
}

.metric-value {
  margin-top: 10px;
  font-size: 24px;
  font-weight: 700;
  color: #172033;
}

.metric-value.income {
  color: #15803d;
}

.metric-value.expense {
  color: #b91c1c;
}

.metric-value.warning,
.metric-value.diff {
  color: #c2410c;
}

.page-alert {
  margin-top: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.section-meta,
.muted-text {
  color: #667085;
  font-size: 12px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
}

.cell-stack {
  display: grid;
  gap: 6px;
}

.cell-stack.compact {
  gap: 4px;
}

.cell-title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.cell-title {
  font-weight: 700;
  color: #172033;
}

.cell-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #667085;
  font-size: 12px;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.risk-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.drawer-section {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #172033;
}

.json-block {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  overflow: auto;
}

.confirm-block-alert {
  margin-bottom: 12px;
}

.confirm-block-note {
  margin-top: 6px;
  color: #92400e;
  line-height: 1.6;
}

.match-diagnostic-block {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid #d9ecff;
  border-radius: 6px;
  background: #f5fbff;
}

.match-diagnostic-header {
  color: #1d4ed8;
  font-size: 14px;
  font-weight: 700;
}

.match-diagnostic-summary {
  color: #475569;
  font-size: 13px;
}

.match-diagnostic-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 12px;
}

.match-diagnostic-field {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.match-diagnostic-label {
  color: #64748b;
  font-size: 12px;
}

.match-diagnostic-value {
  color: #0f172a;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.decision-trail-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #172033;
  line-height: 1.6;
}

.decision-trail-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.decision-trail-field {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #475569;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .summary-scope-bar {
    flex-direction: column;
  }
}
</style>
