<template>
  <div class="page-stack">
    <el-alert
      v-if="pageError"
      type="error"
      :closable="false"
      show-icon
      class="page-alert"
      :title="pageError"
    />
    <el-alert
      v-if="diagnosticConclusion"
      :type="diagnosticAlertType(diagnosticConclusion.level)"
      :closable="false"
      show-icon
      class="page-alert"
      :title="diagnosticConclusion.title"
      :description="diagnosticConclusionText"
    />
    <el-alert
      v-if="lastCommandFeedback"
      :type="lastCommandFeedback.type"
      :closable="true"
      show-icon
      class="page-alert"
      :title="lastCommandFeedback.title"
      :description="lastCommandFeedback.description"
      @close="lastCommandFeedback = null"
    />

    <el-card>
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">设备与短信诊断</div>
            <div class="subtitle">
              仅使用现有诊断页，查看设备运行状态、桥接目标、上传队列、运营商风险和重复来源。
            </div>
          </div>
          <div class="toolbar-actions">
            <el-select
              v-model="activeDeviceId"
              clearable
              filterable
              placeholder="选择设备"
              style="width: 240px"
              @change="loadPage"
            >
              <el-option
                v-for="item in diagnostics.devices"
                :key="item.deviceId"
                :label="item.deviceId"
                :value="item.deviceId"
              />
            </el-select>
            <el-button type="primary" plain :disabled="!activeDeviceId" @click="requestInboxSyncAction">
              手动收件箱同步
            </el-button>
            <el-button type="success" plain :disabled="!activeDeviceId" @click="requestTestUploadAction">
              测试上传
            </el-button>
            <el-button type="warning" plain :disabled="!activeDeviceId" @click="requestBackendRediscoveryAction">
              一键重新发现后台
            </el-button>
            <el-button
              plain
              :disabled="!activeDeviceId || !targetAutoHeal.autoDiscoverySelectedUrl"
              @click="switchToDiscoveredBackendAction"
            >
              一键切换到发现到的后台
            </el-button>
            <el-button type="primary" plain :disabled="!activeDeviceId" @click="requestPendingQueueRetryAction">
              强制重试待上传队列
            </el-button>
            <el-button type="danger" plain :disabled="!activeDeviceId" @click="clearTargetFailureAction">
              清理旧失败 target
            </el-button>
            <el-button @click="manualRefreshAction">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="12">
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">设备在线状态</div>
            <div class="metric-value">
              <el-tag :type="onlineStatusTagType(runtimeOverview?.deviceOnlineStatus || currentDevice?.deviceOnlineStatus)">
                {{ onlineStatusText(runtimeOverview?.deviceOnlineStatus || currentDevice?.deviceOnlineStatus) }}
              </el-tag>
            </div>
            <div class="metric-meta">
              {{ formatDurationSeconds(runtimeOverview?.lastHeartbeatAgeSeconds ?? currentDevice?.lastHeartbeatAgeSeconds) }}
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">接收短信权限</div>
            <div class="metric-value">{{ permissionText(currentDevice?.receiveSmsPermission) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">读取短信权限</div>
            <div class="metric-value">{{ permissionText(currentDevice?.readSmsPermission) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">连接方式</div>
            <div class="metric-value">
              <el-tag :type="transportTagType(runtimeOverview?.connectionMode || currentDevice?.transportMode)">
                {{ connectionModeText(runtimeOverview?.connectionMode || currentDevice?.transportMode) }}
              </el-tag>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">目标可达</div>
            <div class="metric-value">
              <el-tag :type="booleanTagType(currentDevice?.targetReachable)">
                {{ booleanText(currentDevice?.targetReachable) }}
              </el-tag>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">当前上传链路</div>
            <div class="metric-value">
              <el-tag :type="uploadLinkTagType(smsReceiveStatus.uploadLinkStatus)">
                {{ uploadLinkStatusText(smsReceiveStatus.uploadLinkStatus) }}
              </el-tag>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">短信接收能力</div>
            <div class="metric-value">
              <el-tag :type="smsReceiveCapabilityTagType(smsReceiveStatus.smsReceiveCapability)">
                {{ smsReceiveCapabilityText(smsReceiveStatus.smsReceiveCapability) }}
              </el-tag>
            </div>
            <div class="metric-meta">{{ smsReceiveReasonText(smsReceiveStatus.smsReceiveUnavailableReason || smsReceiveStatus.smsReceiveIdleReason) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">待上传队列</div>
            <div class="metric-value warning">
              {{ runtimeOverview?.pendingUploadQueueCount ?? currentDevice?.pendingUploadQueueCount ?? 0 }}
            </div>
            <div class="metric-meta">
              {{ formatDurationSeconds(runtimeOverview?.oldestPendingAge ?? currentDevice?.oldestPendingAgeSeconds) }}
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">手机本地最近短信</div>
            <div class="metric-value small">
              {{ formatNullableDate(runtimeOverview?.phoneLocalLastSmsAt || currentDevice?.phoneLocalLastSmsAt) }}
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card v-if="currentDevice">
      <template #header>
        <div class="section-header">
          <span>设备健康概览</span>
          <span class="section-meta">{{ currentDevice.deviceId }}</span>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="电量">
          {{ formatPercent(runtimeOverview?.batteryPercent ?? currentDevice.deviceHealth?.batteryPercent) }}
        </el-descriptions-item>
        <el-descriptions-item label="是否充电">
          {{ booleanText(runtimeOverview?.isCharging ?? currentDevice.deviceHealth?.isCharging) }}
        </el-descriptions-item>
        <el-descriptions-item label="充电来源">
          {{ runtimeOverview?.chargeSource || currentDevice.deviceHealth?.chargeSource || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="电池温度">
          {{ currentDevice.deviceHealth?.batteryTemperature ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="电池优化">
          {{ currentDevice.deviceHealth?.batteryOptimizationStatus || runtimeOverview?.batteryOptimizationStatus || 'unknown' }}
        </el-descriptions-item>
        <el-descriptions-item label="应用前后台">
          {{ currentDevice.deviceHealth?.appVisibilityStatus || runtimeOverview?.appVisibilityStatus || 'unknown' }}
        </el-descriptions-item>
        <el-descriptions-item label="服务运行状态">
          {{ currentDevice.deviceHealth?.serviceRunningStatus || runtimeOverview?.serviceRunningStatus || 'unknown' }}
        </el-descriptions-item>
        <el-descriptions-item label="网络类型">
          {{ currentDevice.deviceHealth?.networkType || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="数据网络类型">
          {{ carrierDiagnostics.dataNetworkType || currentDevice.deviceHealth?.dataNetworkType || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="信号强度">
          {{ carrierDiagnostics.signalStrength || currentDevice.deviceHealth?.signalStrength || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="SIM 是否存在">
          {{ simPresentText(carrierDiagnostics.simPresent, carrierDiagnostics.simPresentStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="SIM 状态">
          {{ carrierDiagnostics.simState || currentDevice.deviceHealth?.simState || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="卡槽状态">
          {{ carrierDiagnostics.slotState || currentDevice.deviceHealth?.slotState || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="Service State">
          {{ serviceStateText(carrierDiagnostics.serviceState || currentDevice.deviceHealth?.serviceState) }}
        </el-descriptions-item>
        <el-descriptions-item label="是否漫游">
          {{ booleanText(carrierDiagnostics.isRoaming ?? currentDevice.deviceHealth?.isRoaming) }}
        </el-descriptions-item>
        <el-descriptions-item label="运营商">
          {{ carrierDiagnostics.networkOperatorName || currentDevice.deviceHealth?.networkOperatorName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="短信接收前置条件">
          {{ booleanText(carrierDiagnostics.smsReceivePrerequisitesSatisfied) }}
        </el-descriptions-item>
        <el-descriptions-item label="不可接收 / 空闲原因">
          {{ smsReceiveReasonText(carrierDiagnostics.smsReceiveUnavailableReason || carrierDiagnostics.smsReceiveIdleReason) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近系统短信时间">
          {{ formatNullableDate(carrierDiagnostics.lastSystemSmsReceivedAt || runtimeOverview?.phoneLocalLastSmsAt || currentDevice.phoneLocalLastSmsAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近 receiver 触发">
          {{ formatNullableDate(carrierDiagnostics.lastReceiverTriggeredAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近 inbox scan">
          {{ formatNullableDate(carrierDiagnostics.lastInboxScanAt || currentDevice.lastInboxSyncAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="可用存储">
          {{ formatBytes(currentDevice.deviceHealth?.storageAvailable) }}
        </el-descriptions-item>
        <el-descriptions-item label="Android 版本">
          {{ currentDevice.deviceHealth?.androidVersion || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="应用版本">
          {{ currentDevice.deviceHealth?.appVersion || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="构建 ID">
          {{ currentDevice.deviceHealth?.buildId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="最近开机时间">
          {{ formatNullableDate(currentDevice.deviceHealth?.lastBootTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="设备上报时间">
          {{ formatNullableDate(currentDevice.deviceReportedAt) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="currentDevice">
      <template #header>
        <div class="section-header">
          <span>桥接连接概览</span>
          <span class="section-meta">目标地址 / 连接方式 / 上传队列</span>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="后端目标">
          {{ runtimeOverview?.backendTarget || currentDevice.bridgeConnectivity?.backendTarget || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="目标来源">
          {{ targetSourceText(targetAutoHeal.targetSource || currentDevice.bridgeConnectivity?.baseUrlSource) }}
        </el-descriptions-item>
        <el-descriptions-item label="当前 active target">
          {{ targetAutoHeal.currentActiveTarget || runtimeOverview?.backendTarget || currentDevice.bridgeConnectivity?.backendTarget || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="last successful target">
          {{ targetAutoHeal.lastSuccessfulTarget || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="当前 WiFi">
          {{ runtimeOverview?.networkProfile?.wifiSsid || currentDevice.networkProfile?.wifiSsid || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="WiFi 绑定命中">
          {{ booleanText(runtimeOverview?.networkProfile?.wifiProfileMatched ?? currentDevice.networkProfile?.wifiProfileMatched) }}
        </el-descriptions-item>
        <el-descriptions-item label="WiFi 本机地址">
          {{ runtimeOverview?.networkProfile?.wifiLocalIp || currentDevice.networkProfile?.wifiLocalIp || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="WiFi 网关">
          {{ runtimeOverview?.networkProfile?.wifiGateway || currentDevice.networkProfile?.wifiGateway || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="最近失败 target">
          {{ targetAutoHeal.lastFailureTarget || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="target 与手机网段不一致">
          <el-tag :type="booleanTagType(targetAutoHeal.targetSubnetMismatch)">
            {{ booleanText(targetAutoHeal.targetSubnetMismatch) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="自动发现状态">
          {{ autoDiscoveryStatusText(targetAutoHeal.autoDiscoveryStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="发现候选数量">
          {{ targetAutoHeal.autoDiscoveryCandidateCount ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="发现到的后台">
          {{ targetAutoHeal.autoDiscoverySelectedUrl || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="最近 rebind">
          {{ formatNullableDate(targetAutoHeal.lastRebindAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="pending 队列 target 规则">
          {{ pendingQueueTargetText(targetAutoHeal) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近队列重试" :span="2">
          {{ pendingQueueRetryText(targetAutoHeal) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近队列 flush" :span="2">
          {{ pendingQueueFlushText(targetAutoHeal) }}
        </el-descriptions-item>
        <el-descriptions-item label="pending 状态分布" :span="2">
          {{ pendingQueueDistributionText(targetAutoHeal.pendingQueueStatusDistribution) }}
        </el-descriptions-item>
        <el-descriptions-item label="pending 是否等待 backoff">
          {{ booleanText(targetAutoHeal.pendingQueueWaitingBackoff) }}
        </el-descriptions-item>
        <el-descriptions-item label="rebind 是否触发 flush">
          {{ booleanText(targetAutoHeal.pendingQueueLastFlushTriggered) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近 flush active target">
          {{ targetAutoHeal.pendingQueueLastFlushActiveTarget || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="pending auto-drain diagnostics" :span="2">
          {{ pendingQueueDrainDiagnosticsText(pendingQueueDrainDiagnostics) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近强制重试">
          {{ formatNullableDate(targetAutoHeal.lastPendingQueueForceRetryAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="SSID 权限">
          {{ wifiPermissionText(runtimeOverview?.networkProfile?.wifiSsidPermission || currentDevice.networkProfile?.wifiSsidPermission) }}
        </el-descriptions-item>
        <el-descriptions-item label="上次绑定 WiFi">
          {{ runtimeOverview?.networkProfile?.lastBoundWifiSsid || currentDevice.networkProfile?.lastBoundWifiSsid || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="连接方式">
          {{ connectionModeText(runtimeOverview?.connectionMode || currentDevice.bridgeConnectivity?.transportMode) }}
        </el-descriptions-item>
        <el-descriptions-item label="依赖 ADB 反向代理">
          {{ booleanText(currentDevice.bridgeConnectivity?.dependsOnAdbReverse) }}
        </el-descriptions-item>
        <el-descriptions-item label="目标可达">
          {{ booleanText(currentDevice.bridgeConnectivity?.targetReachable) }}
        </el-descriptions-item>
        <el-descriptions-item label="上传链路状态">
          {{ uploadLinkStatusText(smsReceiveStatus.uploadLinkStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="后台目标状态">
          {{ backendTargetStatusText(smsReceiveStatus.backendTargetStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="pending 队列状态">
          {{ pendingQueueStatusText(smsReceiveStatus.pendingQueueStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="短信接收状态" :span="2">
          {{ smsReceiveDiagnosticText(smsReceiveStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="支持配置后端">
          {{ booleanText(currentDevice.bridgeConnectivity?.configurableBackendSupported) }}
        </el-descriptions-item>
        <el-descriptions-item label="待上传队列">
          {{ runtimeOverview?.pendingUploadQueueCount ?? currentDevice.pendingUploadQueueCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="最近收到短信">
          {{ formatNullableDate(runtimeOverview?.lastSmsReceived || currentDevice.lastSmsReceived) }}
        </el-descriptions-item>
        <el-descriptions-item label="手机本地最近短信">
          {{ formatNullableDate(runtimeOverview?.phoneLocalLastSmsAt || currentDevice.phoneLocalLastSmsAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近上传成功">
          {{ formatNullableDate(runtimeOverview?.lastUploadSuccess || currentDevice.lastUploadSuccessAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近上传失败">
          {{ formatNullableDate(runtimeOverview?.lastUploadFailure || currentDevice.lastUploadFailureAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近上传失败原因" :span="2">
          {{ currentDevice.lastUploadFailureReason || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="最近接口成功">
          {{ formatNullableDate(currentDevice.lastApiSuccessAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近接口失败">
          {{ formatNullableDate(currentDevice.lastApiFailureAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近接口失败原因" :span="2">
          {{ currentDevice.lastApiFailureReason || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="最近 target 失败原因" :span="2">
          {{ targetAutoHeal.lastFailureReason || targetAutoHeal.backendErrorCategory || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="最近命令轮询">
          {{ formatNullableDate(runtimeOverview?.lastCommandPollAt || currentDevice.lastCommandPollAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="命令轮询距今">
          {{ formatDurationSeconds(runtimeOverview?.lastCommandPollAgeSeconds ?? currentDevice.lastCommandPollAgeSeconds) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近实时广播接收">
          {{ formatNullableDate(currentDevice.lastBroadcastReceivedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近收件箱同步">
          {{ formatNullableDate(currentDevice.lastInboxSyncAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近进入 sms_message_raw">
          {{ formatNullableDate(runtimeOverview?.smsMessageRawLatestCreatedAt || currentDevice.smsMessageRawLatestCreatedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近进入 bank_sms_transaction">
          {{ formatNullableDate(runtimeOverview?.bankSmsTransactionLatestCreatedAt || currentDevice.bankSmsTransactionLatestCreatedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近心跳">
          {{ formatNullableDate(runtimeOverview?.lastHeartbeat || currentDevice.lastHeartbeatAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="心跳距今">
          {{ formatDurationSeconds(runtimeOverview?.lastHeartbeatAgeSeconds ?? currentDevice.lastHeartbeatAgeSeconds) }}
        </el-descriptions-item>
        <el-descriptions-item label="最老待上传时长">
          {{ formatDurationSeconds(runtimeOverview?.oldestPendingAge ?? currentDevice.oldestPendingAgeSeconds) }}
        </el-descriptions-item>
        <el-descriptions-item label="权限未知原因" :span="2">
          {{ permissionUnknownText(runtimeOverview?.permissionUnknownReason || currentDevice.permissionUnknownReason) }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="note-list">
        <div class="note-title">当前运行模式</div>
        <div v-for="item in runningModeLines" :key="`mode-${item}`" class="note-item">
          {{ item }}
        </div>
        <div class="note-title">剩余正式化步骤</div>
        <div
          v-for="item in translatedBridgeSteps"
          :key="item"
          class="note-item"
        >
          {{ item }}
        </div>
        <div
          v-if="!translatedBridgeSteps.length"
          class="note-item"
        >
          当前桥接连接面没有新增正式化阻塞项。
        </div>
      </div>
    </el-card>

    <el-card v-if="carrierRiskSummary">
      <template #header>
        <div class="section-header">
          <span>运营商余额风险</span>
          <span class="section-meta">话费、欠费、停机提醒</span>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="检测到余额短信">
          {{ booleanText(carrierRiskSummary.balanceSmsDetected) }}
        </el-descriptions-item>
        <el-descriptions-item label="低余额候选">
          {{ booleanText(carrierRiskSummary.lowBalanceCandidate ?? carrierRiskSummary.lowBalanceRisk) }}
        </el-descriptions-item>
        <el-descriptions-item label="欠费候选">
          {{ booleanText(carrierRiskSummary.arrearsCandidate) }}
        </el-descriptions-item>
        <el-descriptions-item label="停机候选">
          {{ booleanText(carrierRiskSummary.stopServiceCandidate ?? carrierRiskSummary.stopServiceRisk) }}
        </el-descriptions-item>
        <el-descriptions-item label="最新余额金额">
          {{ carrierRiskSummary.latestBalanceAmount ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="最新余额时间">
          {{ formatNullableDate(carrierRiskSummary.latestBalanceObservedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近充值短信时间">
          {{ formatNullableDate(carrierRiskSummary.lastRechargeSmsTime) }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="note-list">
        <div class="note-title">当前 10086 规则</div>
        <div v-for="item in carrierRuleLines" :key="item" class="note-item">
          {{ item }}
        </div>
      </div>

      <el-table
        :data="carrierRiskSummary.recentCarrierAlertSummary || []"
        empty-text="最近没有检测到运营商余额、欠费或停机类短信。"
        style="margin-top: 16px"
      >
        <el-table-column prop="receivedAt" label="收到时间" width="180">
          <template #default="{ row }">{{ formatNullableDate(row.receivedAt) }}</template>
        </el-table-column>
        <el-table-column prop="sender" label="发送方" width="120" />
        <el-table-column label="来源路径" width="140">
          <template #default="{ row }">{{ sourcePathText(row.sourcePath) }}</template>
        </el-table-column>
        <el-table-column label="分类" width="180">
          <template #default="{ row }">{{ carrierCategoryText(row.category) }}</template>
        </el-table-column>
        <el-table-column prop="balanceAmount" label="余额" width="120" />
        <el-table-column prop="summary" label="摘要" min-width="320" show-overflow-tooltip />
      </el-table>
    </el-card>

    <el-card v-if="duplicateCauseSummary">
      <template #header>
        <div class="section-header">
          <span>重复原因汇总</span>
          <span class="section-meta">双路径 / 重试 / 数据库重复</span>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="界面投影重复">
          {{ duplicateCauseSummary.uiProjectionDuplicate?.count ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="双路径重复组数">
          {{ duplicateCauseSummary.dualPathDuplicate?.groupCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="上传重试重复组数">
          {{ duplicateCauseSummary.uploadRetryDuplicate?.groupCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="待上传队列">
          {{ duplicateCauseSummary.uploadRetryDuplicate?.pendingUploadQueueCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="桥接表重复组数">
          {{ duplicateCauseSummary.databaseTrueDuplicate?.bridgeEventGroupCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="原始短信表重复组数">
          {{ duplicateCauseSummary.databaseTrueDuplicate?.rawSmsGroupCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="主去重键" :span="2">
          {{ duplicateCauseSummary.dedupeKeyPolicy?.primary || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="回退去重键" :span="2">
          {{ duplicateCauseSummary.dedupeKeyPolicy?.fallback || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="统一写入入口" :span="2">
          {{ translateSingleUpsertEntry(duplicateCauseSummary.dedupeKeyPolicy?.singleUpsertEntry) }}
        </el-descriptions-item>
        <el-descriptions-item label="界面说明" :span="2">
          {{ translateUiProjectionNote(duplicateCauseSummary.uiProjectionDuplicate?.note) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近上传失败原因" :span="2">
          {{ duplicateCauseSummary.uploadRetryDuplicate?.lastUploadFailureReason || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="旧口径松键重复组数">
          {{ duplicateCauseSummary.dualPathVsRawLooseComparison?.legacyRawDbLooseGroupCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="松键组是否一一对应">
          {{ booleanText(duplicateCauseSummary.dualPathVsRawLooseComparison?.oneToOne) }}
        </el-descriptions-item>
        <el-descriptions-item label="统一入口证明" :span="2">
          {{ translateSingleUpsertProof(duplicateCauseSummary.dedupeKeyPolicy?.singleUpsertProof) }}
        </el-descriptions-item>
        <el-descriptions-item label="数据库重复说明" :span="2">
          {{ translateDatabaseDuplicateNote(duplicateCauseSummary.databaseTrueDuplicate?.note) }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="note-list">
        <div class="note-title">队列明细</div>
        <div v-for="item in queueDetailLines" :key="`queue-${item}`" class="note-item">
          {{ item }}
        </div>
        <div class="note-title">安全模式历史去重方案</div>
        <div
          v-for="item in translatedSafeHistoricalDedupPlan"
          :key="`plan-${item}`"
          class="note-item"
        >
          {{ item }}
        </div>
      </div>

      <el-table
        :data="duplicateSamples"
        empty-text="当前诊断窗口内没有可展示的重复样本。"
        style="margin-top: 16px"
      >
        <el-table-column prop="groupType" label="重复类型" width="180" />
        <el-table-column prop="count" label="组内数量" width="120" />
        <el-table-column prop="sourcesText" label="来源说明" min-width="240" show-overflow-tooltip />
        <el-table-column prop="sender" label="发送方" width="120" />
        <el-table-column prop="bodyPreview" label="正文摘要" min-width="320" show-overflow-tooltip />
      </el-table>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-header">
          <span>最近短信链路</span>
          <span class="section-meta">设备时间 / 入库时间 / 正文业务日期</span>
        </div>
      </template>

      <el-table :data="diagnostics.recentSmsTrace || []" v-loading="loading" empty-text="暂无链路记录">
        <el-table-column label="编号" width="170">
          <template #default="{ row }">
            <div>原始 {{ row.rawSmsId }}</div>
            <div>分类 {{ row.classificationId || '-' }}</div>
            <div>交易 {{ row.bankSmsTransactionId || '-' }}</div>
            <div>设备短信编号 {{ row.deviceSmsId || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="sender" label="发送方" width="120" />
        <el-table-column label="账户识别" width="180">
          <template #default="{ row }">
            <div>尾号 {{ row.recognizedAccountTail || '-' }}</div>
            <div>公司 {{ row.recognizedCompanyId || '-' }}</div>
            <div>{{ row.bindingSource || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="时间三元组" min-width="320">
          <template #default="{ row }">
            <div>设备时间：{{ formatNullableDate(row.bridgeReceivedAtDevice || row.rawReceivedAt) }}</div>
            <div>入库时间：{{ formatNullableDate(row.rawCreatedAt) }}</div>
            <div>分类时间：{{ formatNullableDate(row.classificationCreatedAt) }}</div>
            <div>正文业务日期：{{ row.bodyBusinessDate || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="220">
          <template #default="{ row }">
            <div>{{ classifyTypeText(row.classifyType) }}</div>
            <div>{{ businessCandidateTypeText(row.businessCandidateType) }}</div>
            <div>{{ reconcileStatusText(row.reconcileStatus) }}</div>
            <div>{{ sourcePathText(row.sourcePath) }}</div>
            <div>{{ dedupeHitText(row.dedupeHit) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="正文" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.body }}
            <div class="table-inline-meta">
              {{ sourcePathText(row.sourcePath || row.ingestSource) }} / {{ dedupeHitText(row.dedupeHit) }}
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-header">
          <span>最近桥接事件</span>
          <span class="section-meta">队列与桥接时间</span>
        </div>
      </template>

      <el-table :data="diagnostics.recentBridgeEvents || []" v-loading="loading" empty-text="暂无桥接事件">
        <el-table-column prop="id" label="编号" width="90" />
        <el-table-column prop="deviceSmsId" label="设备短信编号" width="140" />
        <el-table-column prop="sender" label="发送方" width="120" />
        <el-table-column label="时间" min-width="280">
          <template #default="{ row }">
            <div>设备时间：{{ formatNullableDate(row.deviceReceivedAt) }}</div>
            <div>入队时间：{{ formatNullableDate(row.queueEnqueuedAt) }}</div>
            <div>服务端时间：{{ formatNullableDate(row.serverReceivedAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="路径 / 状态" width="220">
          <template #default="{ row }">
            <div>{{ deliveryStatusText(row.deliveryStatus) }}</div>
            <div>{{ sourcePathText(row.sourcePath) }}</div>
            <div>{{ dedupeHitText(row.dedupeHit) }}</div>
            <div>{{ formatIngestPaths(row.ingestPaths) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="正文" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.body }}
            <div class="table-inline-meta">
              {{ sourcePathText(row.sourcePath || row.ingestSource) }} / {{ dedupeHitText(row.dedupeHit) }}
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-header">
          <span>最近原始短信</span>
          <span class="section-meta">最近 50 条原始短信</span>
        </div>
      </template>

      <el-table :data="diagnostics.recentRawSms || []" v-loading="loading" empty-text="暂无原始短信">
        <el-table-column prop="id" label="编号" width="90" />
        <el-table-column prop="deviceSmsId" label="设备短信编号" width="140" />
        <el-table-column prop="sender" label="发送方" width="120" />
        <el-table-column label="收到时间" width="180">
          <template #default="{ row }">{{ formatNullableDate(row.receivedAt) }}</template>
        </el-table-column>
        <el-table-column label="来源路径" width="120">
          <template #default="{ row }">{{ sourcePathText(row.sourcePath || row.ingestSource) }}</template>
        </el-table-column>
        <el-table-column label="上传状态" width="140">
          <template #default="{ row }">{{ uploadStatusText(row.uploadStatus) }}</template>
        </el-table-column>
        <el-table-column label="分类状态" width="160">
          <template #default="{ row }">{{ classifyStatusText(row.classifyStatus) }}</template>
        </el-table-column>
        <el-table-column label="正文" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.body }}
            <div class="table-inline-meta">
              {{ sourcePathText(row.sourcePath || row.ingestSource) }} / {{ dedupeHitText(row.dedupeHit) }}
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-header">
          <span>最近设备指令</span>
          <span class="section-meta">{{ recentCommandRows.length }} 条</span>
        </div>
      </template>

      <el-table :data="recentCommandRows" empty-text="当前没有设备指令">
        <el-table-column prop="id" label="指令 ID" width="100" />
        <el-table-column label="类型" width="140">
          <template #default="{ row }">{{ commandTypeText(row.commandType) }}</template>
        </el-table-column>
        <el-table-column label="下发时间" width="180">
          <template #default="{ row }">{{ formatNullableDate(row.requestedAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="commandStatusTagType(row.status)">
              {{ commandStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="手机拉取" width="110">
          <template #default="{ row }">{{ booleanText(row.devicePolled) }}</template>
        </el-table-column>
        <el-table-column label="手机执行" width="110">
          <template #default="{ row }">{{ booleanText(row.phoneExecuted) }}</template>
        </el-table-column>
        <el-table-column label="后端收到结果" width="130">
          <template #default="{ row }">{{ booleanText(row.backendReceivedResult) }}</template>
        </el-table-column>
        <el-table-column label="耗时" width="120">
          <template #default="{ row }">{{ formatDurationSeconds(row.durationSeconds) }}</template>
        </el-table-column>
        <el-table-column label="结果说明" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            {{ commandResultText(row) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-header">
          <span>手工原始短信导入</span>
          <span class="section-meta">保留现有调试入口</span>
        </div>
      </template>

      <el-form :model="importForm" label-width="96px">
        <el-form-item label="发送方">
          <el-input v-model="importForm.sender" placeholder="例如 95566" />
        </el-form-item>
        <el-form-item label="正文">
          <el-input v-model="importForm.body" type="textarea" :rows="4" placeholder="粘贴原始短信正文" />
        </el-form-item>
        <el-form-item label="收到时间">
          <el-date-picker
            v-model="importForm.receivedAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            placeholder="选择收到时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="importing" @click="submitRawImport">
            导入到短信中枢
          </el-button>
        </el-form-item>
      </el-form>

      <el-descriptions v-if="importResult" :column="2" border>
        <el-descriptions-item label="分类结果">
          {{ classifyTypeText(importResult.classifyType) }}
        </el-descriptions-item>
        <el-descriptions-item label="是否去重">
          {{ importResult.deduplicated ? '是' : '否' }}
        </el-descriptions-item>
        <el-descriptions-item label="原始短信 ID">
          {{ importResult.rawSmsId }}
        </el-descriptions-item>
        <el-descriptions-item label="下游结果">
          银行短信交易 {{ importResult.downstreamSummary?.bankSmsTransactionId || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <div v-if="importResult" class="result-actions">
        <el-button
          v-if="importResult.downstreamSummary?.bankSmsTransactionId"
          type="primary"
          plain
          @click="openImportedBankSmsList"
        >
          去银行短信列表查看这条短信
        </el-button>
      </div>

      <pre v-if="importResult" class="json-block">{{ JSON.stringify(importResult, null, 2) }}</pre>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  clearMobileTargetFailure,
  getMobileSmsDiagnosticsOverview,
  importRawSmsMessage,
  requestMobileBackendRediscovery,
  requestMobileInboxSync,
  requestMobilePendingQueueRetry,
  requestMobileSwitchDiscoveredBackend,
  requestMobileTestUpload,
} from '../../api/mobile-diagnostics';
import { formatDateTime } from '../../utils/format';

const router = useRouter();
const silentRequestConfig = {
  headers: {
    'x-suppress-global-error': '1',
  },
};

const loading = ref(false);
const importing = ref(false);
const pageError = ref('');
const activeDeviceId = ref('');
const importResult = ref<any>(null);
const lastCommandFeedback = ref<any>(null);
const diagnostics = reactive<any>({
  devices: [],
  activeDeviceId: '',
  diagnosticConclusion: null,
  runtimeOverview: null,
  bridgeConnectivitySummary: null,
  deviceHealthSummary: null,
  duplicateCauseSummary: null,
  carrierRiskSummary: null,
  recentBridgeEvents: [],
  recentRawSms: [],
  recentSmsTrace: [],
  pendingCommands: [],
  recentCommands: [],
});
const importForm = reactive({
  sender: '95566',
  body: '',
  receivedAt: '',
});

const connectionModeMap: Record<string, string> = {
  adb_reverse: 'ADB 反向代理（开发态）',
  wifi_lan: '局域网直连',
  vpn_tunnel: 'VPN 隧道',
  public_url: '公网地址',
  public_server: '公网服务',
  unknown: '未知',
};

const sourcePathMap: Record<string, string> = {
  live_broadcast: '实时广播',
  inbox_sync: '收件箱同步',
  manual_import: '手工导入',
};

const dedupeHitMap: Record<string, string> = {
  none: '未命中',
  dual_path_candidate: '双路径重复候选',
  retry_candidate: '重试重复候选',
  exact_key_conflict: '冻结键冲突',
};

const deliveryStatusMap: Record<string, string> = {
  received: '已接收',
  duplicate: '重复',
  stored: '已入库',
};

const uploadStatusMap: Record<string, string> = {
  stored: '已入库',
  uploaded: '已上传',
  failed: '上传失败',
  pending: '待上传',
  queued: '排队中',
};

const classifyStatusMap: Record<string, string> = {
  pending: '待分类',
  classified_other: '已归类为其他短信',
  classified_bank_transaction: '已归类为银行交易',
  classified_verification_code: '已归类为验证码',
};

const classifyTypeMap: Record<string, string> = {
  bank_transaction: '银行交易',
  verification_code: '验证码',
  other: '其他短信',
};

const businessCandidateTypeMap: Record<string, string> = {
  bank_transaction: '银行交易候选',
  income: '入账候选',
  expense: '出账候选',
  internal_transfer: '内部划拨候选',
};

const reconcileStatusMap: Record<string, string> = {
  pending_binding: '待绑定',
  pending: '待处理',
  confirmed: '已确认',
  excluded: '已排除',
  reference_only: '仅参考',
  included: '已纳入',
};

const commandTypeMap: Record<string, string> = {
  inbox_sync: '收件箱同步',
  test_upload: '测试上传',
  backend_rediscover: '重新发现后台',
  switch_discovered_backend: '切换发现后台',
  clear_target_failure: '清理旧失败 target',
};

const commandStatusMap: Record<string, string> = {
  pending: '待执行',
  completed: '已完成',
  failed: '失败',
};

const onlineStatusMap: Record<string, string> = {
  online: '在线',
  stale: '状态过期',
  offline: '离线',
  unknown: '未知',
};

const commandPendingReasonMap: Record<string, string> = {
  command_created_but_device_not_polled: '命令已创建，但设备尚未拉取',
  device_polled_but_result_not_returned: '设备已拉取，等待执行结果',
};

const carrierCategoryMap: Record<string, string> = {
  balance_info: '余额信息',
  low_balance_candidate: '低余额候选',
  arrears_candidate: '欠费候选',
  stop_service_candidate: '停机候选',
  recharge: '充值提醒',
  carrier_alert: '运营商提醒',
};

const currentDevice = computed(() =>
  (diagnostics.devices || []).find((item: any) => item.deviceId === activeDeviceId.value) ||
  diagnostics.devices?.[0] ||
  null,
);

const carrierRiskSummary = computed(() => diagnostics.carrierRiskSummary || currentDevice.value?.carrierRisk || null);
const duplicateCauseSummary = computed(
  () => diagnostics.duplicateCauseSummary || currentDevice.value?.duplicateDiagnostics || null,
);
const runtimeOverview = computed(() => diagnostics.runtimeOverview || currentDevice.value || null);
const smsReceiveStatus = computed(
  () => runtimeOverview.value?.smsReceiveStatus || currentDevice.value?.smsReceiveStatus || {},
);
const carrierDiagnostics = computed(
  () =>
    runtimeOverview.value?.carrierDiagnostics ||
    currentDevice.value?.carrierDiagnostics ||
    currentDevice.value?.deviceHealth ||
    {},
);
const targetAutoHeal = computed(
  () =>
    runtimeOverview.value?.targetAutoHeal ||
    currentDevice.value?.bridgeConnectivity?.targetAutoHeal ||
    currentDevice.value?.targetAutoHeal ||
    {},
);
const pendingQueueDrainDiagnostics = computed(
  () =>
    targetAutoHeal.value?.pendingQueueDrainDiagnostics ||
    runtimeOverview.value?.pendingQueueDrainDiagnostics ||
    currentDevice.value?.bridgeConnectivity?.pendingQueueDrainDiagnostics ||
    currentDevice.value?.pendingQueueDrainDiagnostics ||
    {},
);
const diagnosticConclusion = computed(() => diagnostics.diagnosticConclusion || null);
const diagnosticConclusionText = computed(() => {
  const conclusion = diagnosticConclusion.value;
  if (!conclusion) {
    return '';
  }
  const recommendations = (conclusion.recommendations || []).join('；');
  return recommendations ? `${conclusion.summary} 建议：${recommendations}` : conclusion.summary;
});
const recentCommandRows = computed(() => {
  const rows = diagnostics.recentCommands?.length ? diagnostics.recentCommands : diagnostics.pendingCommands || [];
  return rows;
});

const duplicateSamples = computed(() => {
  const summary = duplicateCauseSummary.value;
  if (!summary) {
    return [];
  }

  return (summary.duplicateGroupSamples || []).map((item: any) => ({
    ...item,
    groupType: '双路径重复样本',
    sourcesText: `来源：${translateSourcePathList(item.sourcePaths)}；原始短信：${(item.rawSmsIds || []).join(', ') || '-'}；桥接事件：${(item.bridgeEventIds || []).join(', ') || '-'}`,
    bodyPreview: `${item.bodyPreview}；设备短信编号：${(item.deviceSmsIds || []).join(', ') || '-'}`,
  }));
});

const carrierRuleLines = computed(() => {
  const rules = carrierRiskSummary.value?.classificationRules;
  if (!rules) {
    return [];
  }

  return [
    `${rules.carrier} 余额规则：余额金额小于等于 ${rules.thresholds?.lowBalanceLessThanOrEqualCny ?? '-'} 元，或命中低余额关键词。`,
    `${rules.carrier} 欠费规则：余额金额小于 ${rules.thresholds?.arrearsLessThanCny ?? '-'} 元，或命中欠费关键词。`,
    `${rules.carrier} 停机规则：命中停机或暂停服务关键词。`,
  ];
});

const queueDetailLines = computed(() => {
  const detail =
    duplicateCauseSummary.value?.queueItemCountDetail ||
    duplicateCauseSummary.value?.uploadRetryDuplicate?.queueItemCountDetail;
  if (!detail) {
    return [];
  }

  const statusText = (detail.recentRawSmsByUploadStatus || [])
    .map((item: any) => `${uploadStatusText(item.status)}：${item.count}`)
    .join('，');

  return [
    `运行时待上传队列：${detail.runtimePendingUploadQueueCount ?? 0}`,
    `最近带入队时间戳的桥接事件：${detail.recentBridgeEventsWithQueueTimestamp ?? 0}`,
    `最近缺设备短信编号的原始短信：${detail.recentRawSmsWithoutDeviceSmsId ?? 0}`,
    `最近原始短信上传状态分布：${statusText || '-'}`,
  ];
});

const runningModeLines = computed(() => {
  const summary =
    runtimeOverview.value?.runningModeSummary || currentDevice.value?.bridgeConnectivity?.runningModeSummary;
  if (!summary) {
    return [];
  }

  return [
    `当前模式：${connectionModeText(summary.currentMode)}`,
    `当前说明：${translateRunningModeNote(summary.currentModeNote)}`,
    `开发态建议：${connectionModeText(summary.recommendedModes?.development || 'adb_reverse')}`,
    `正式态建议：${(summary.recommendedModes?.formal || []).map(connectionModeText).join(' / ') || '-'}`,
  ];
});

const translatedBridgeSteps = computed(() =>
  (currentDevice.value?.bridgeConnectivity?.remainingFormalizationSteps || []).map((item: string) =>
    translateBridgeStep(item),
  ),
);

const translatedSafeHistoricalDedupPlan = computed(() =>
  (duplicateCauseSummary.value?.dedupeKeyPolicy?.safeHistoricalDedupPlan || []).map((item: string) =>
    translateSafeHistoricalDedupPlan(item),
  ),
);

async function loadPage() {
  loading.value = true;
  pageError.value = '';
  try {
    const { data } = await getMobileSmsDiagnosticsOverview(activeDeviceId.value || undefined, silentRequestConfig);
    Object.assign(diagnostics, data.data);
    if (!activeDeviceId.value) {
      activeDeviceId.value = data.data.activeDeviceId || '';
    }
  } catch (error: any) {
    pageError.value = error.response?.data?.message || '设备与短信诊断页加载失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

async function manualRefreshAction() {
  const startedAt = Date.now();
  await loadPage();
  lastCommandFeedback.value = {
    type: pageError.value ? 'error' : 'success',
    title: pageError.value ? '刷新失败' : '刷新完成',
    description: pageError.value || `已重新读取后端诊断缓存，耗时 ${Date.now() - startedAt} 毫秒。`,
  };
}

async function requestInboxSyncAction() {
  if (!activeDeviceId.value) {
    return;
  }

  try {
    const startedAt = Date.now();
    const { data } = await requestMobileInboxSync(activeDeviceId.value);
    ElMessage.success('已创建收件箱同步指令。');
    await loadPage();
    lastCommandFeedback.value = buildCommandFeedback('收件箱同步', data.data, Date.now() - startedAt);
  } catch (error: any) {
    lastCommandFeedback.value = {
      type: 'error',
      title: '收件箱同步指令创建失败',
      description: error.response?.data?.message || '后端没有成功创建命令，请检查登录权限和设备 ID。',
    };
  }
}

async function requestTestUploadAction() {
  if (!activeDeviceId.value) {
    return;
  }

  try {
    const startedAt = Date.now();
    const { data } = await requestMobileTestUpload(activeDeviceId.value);
    ElMessage.success('已创建测试上传指令。');
    await loadPage();
    lastCommandFeedback.value = buildCommandFeedback('测试上传', data.data, Date.now() - startedAt);
  } catch (error: any) {
    lastCommandFeedback.value = {
      type: 'error',
      title: '测试上传指令创建失败',
      description: error.response?.data?.message || '后端没有成功创建命令，请检查登录权限和设备 ID。',
    };
  }
}

async function requestPendingQueueRetryAction() {
  if (!activeDeviceId.value) {
    return;
  }

  try {
    const startedAt = Date.now();
    const { data } = await requestMobilePendingQueueRetry(activeDeviceId.value);
    ElMessage.success('已创建强制重试待上传队列指令，不会删除短信队列。');
    await loadPage();
    lastCommandFeedback.value = buildCommandFeedback('强制重试待上传队列', data.data, Date.now() - startedAt);
  } catch (error: any) {
    lastCommandFeedback.value = {
      type: 'error',
      title: '强制重试待上传队列指令创建失败',
      description:
        error.response?.data?.message ||
        '后端没有成功创建命令；如果手机无法连接后台，需要先在 Android bridge 本地重新发现后台。',
    };
  }
}

async function requestBackendRediscoveryAction() {
  if (!activeDeviceId.value) {
    return;
  }

  try {
    const startedAt = Date.now();
    const { data } = await requestMobileBackendRediscovery(activeDeviceId.value);
    ElMessage.success('已创建重新发现触发指令。');
    await loadPage();
    lastCommandFeedback.value = buildCommandFeedback('重新发现后台', data.data, Date.now() - startedAt);
  } catch (error: any) {
    lastCommandFeedback.value = {
      type: 'error',
      title: '重新发现触发失败',
      description:
        error.response?.data?.message ||
        '当前后台只能通过手机已连接的 command polling 触发；如果手机无法连接后台，请在 Android bridge 本地执行重新发现后台。',
    };
  }
}

async function switchToDiscoveredBackendAction() {
  if (!activeDeviceId.value) {
    return;
  }

  const selectedUrl = targetAutoHeal.value?.autoDiscoverySelectedUrl;
  if (!selectedUrl) {
    ElMessage.warning('当前没有发现到的新后台地址。');
    return;
  }

  try {
    const startedAt = Date.now();
    const { data } = await requestMobileSwitchDiscoveredBackend(activeDeviceId.value);
    ElMessage.success('已创建切换验证指令。');
    await loadPage();
    lastCommandFeedback.value = buildCommandFeedback('切换发现后台', data.data, Date.now() - startedAt);
  } catch (error: any) {
    lastCommandFeedback.value = {
      type: 'error',
      title: '切换验证指令创建失败',
      description:
        error.response?.data?.message ||
        'Android 端会在发现成功后自动保存 active target；如果当前设备断联，请在手机 App 本地切换或重新发现后台。',
    };
  }
}

async function clearTargetFailureAction() {
  if (!activeDeviceId.value) {
    return;
  }

  try {
    const startedAt = Date.now();
    await clearMobileTargetFailure(activeDeviceId.value);
    ElMessage.success('已清理旧失败 target 诊断记录，短信队列未删除。');
    await loadPage();
    lastCommandFeedback.value = {
      type: 'success',
      title: '旧失败 target 记录已清理',
      description: `只清理诊断缓存，不删除 pending 短信队列；页面刷新耗时 ${Date.now() - startedAt} 毫秒。`,
    };
  } catch (error: any) {
    lastCommandFeedback.value = {
      type: 'error',
      title: '旧失败 target 记录清理失败',
      description: error.response?.data?.message || '后端没有成功清理诊断记录，请检查登录权限和设备 ID。',
    };
  }
}

async function submitRawImport() {
  if (!importForm.sender.trim() || !importForm.body.trim() || !importForm.receivedAt) {
    ElMessage.warning('请先填写发送方、正文和收到时间。');
    return;
  }

  importing.value = true;
  try {
    const { data } = await importRawSmsMessage(
      {
        sender: importForm.sender.trim(),
        body: importForm.body.trim(),
        receivedAt: importForm.receivedAt,
        source: 'manual_import',
      },
      silentRequestConfig,
    );
    importResult.value = data.data;
    ElMessage.success('原始短信已导入到短信中枢。');
    await loadPage();
  } catch (error: any) {
    pageError.value = error.response?.data?.message || '原始短信导入失败，请稍后重试。';
  } finally {
    importing.value = false;
  }
}

function openImportedBankSmsList() {
  const rawSmsId = importResult.value?.rawSmsId;
  const bankSmsTransactionId = importResult.value?.downstreamSummary?.bankSmsTransactionId;

  if (!rawSmsId || !bankSmsTransactionId) {
    return;
  }

  void router.push({
    path: '/finance/bank-sms',
    query: {
      rawSmsId: String(rawSmsId),
    },
  });
}

function permissionText(value?: boolean | null) {
  if (value === true) {
    return '已授权';
  }
  if (value === false) {
    return '未授权';
  }
  return '未知';
}

function booleanText(value?: boolean | null) {
  if (value === true) {
    return '是';
  }
  if (value === false) {
    return '否';
  }
  return '未知';
}

function booleanTagType(value?: boolean | null) {
  if (value === true) {
    return 'success';
  }
  if (value === false) {
    return 'danger';
  }
  return 'info';
}

function diagnosticAlertType(value?: string | null) {
  if (value === 'success') {
    return 'success';
  }
  if (value === 'warning') {
    return 'warning';
  }
  if (value === 'error' || value === 'danger') {
    return 'error';
  }
  return 'info';
}

function onlineStatusText(value?: string | null) {
  if (!value) {
    return '未知';
  }
  return onlineStatusMap[value] || '未知';
}

function onlineStatusTagType(value?: string | null) {
  if (value === 'online') {
    return 'success';
  }
  if (value === 'stale') {
    return 'warning';
  }
  if (value === 'offline') {
    return 'danger';
  }
  return 'info';
}

function transportTagType(value?: string | null) {
  if (value === 'adb_reverse') {
    return 'warning';
  }
  if (value === 'wifi_lan' || value === 'vpn_tunnel' || value === 'public_url' || value === 'public_server') {
    return 'success';
  }
  return 'info';
}

function connectionModeText(value?: string | null) {
  if (!value) {
    return '未知';
  }
  return connectionModeMap[value] || '未知';
}

function sourcePathText(value?: string | null) {
  if (!value) {
    return '-';
  }
  if (value.includes(' + ')) {
    return value
      .split(' + ')
      .map((item) => sourcePathMap[item] || '未知路径')
      .join(' + ');
  }
  return sourcePathMap[value] || '未知路径';
}

function translateSourcePathList(value?: string[] | null) {
  if (!value || !value.length) {
    return '-';
  }
  return value.map((item) => sourcePathText(item)).join('、');
}

function dedupeHitText(value?: string | null) {
  if (!value) {
    return '-';
  }
  return dedupeHitMap[value] || '未知去重状态';
}

function deliveryStatusText(value?: string | null) {
  if (!value) {
    return '-';
  }
  return deliveryStatusMap[value] || '未知状态';
}

function uploadStatusText(value?: string | null) {
  if (!value) {
    return '-';
  }
  return uploadStatusMap[value] || '未知上传状态';
}

function classifyStatusText(value?: string | null) {
  if (!value) {
    return '-';
  }
  return classifyStatusMap[value] || '未知分类状态';
}

function classifyTypeText(value?: string | null) {
  if (!value) {
    return '-';
  }
  return classifyTypeMap[value] || '未知分类';
}

function businessCandidateTypeText(value?: string | null) {
  if (!value) {
    return '-';
  }
  return businessCandidateTypeMap[value] || '其他业务候选';
}

function reconcileStatusText(value?: string | null) {
  if (!value) {
    return '-';
  }
  return reconcileStatusMap[value] || '其他对账状态';
}

function commandTypeText(value?: string | null) {
  if (!value) {
    return '-';
  }
  return commandTypeMap[value] || '其他指令';
}

function commandStatusText(value?: string | null) {
  if (!value) {
    return '-';
  }
  return commandStatusMap[value] || '其他状态';
}

function commandStatusTagType(value?: string | null) {
  if (value === 'completed') {
    return 'success';
  }
  if (value === 'failed') {
    return 'danger';
  }
  if (value === 'pending') {
    return 'warning';
  }
  return 'info';
}

function permissionUnknownText(value?: string | null) {
  if (!value) {
    return '-';
  }
  if (value === 'device_did_not_report_permission_fields_or_old_apk') {
    return '设备心跳未携带权限字段，可能是旧 APK 或尚未重新上报。';
  }
  return value;
}

function wifiPermissionText(value?: string | null) {
  if (value === 'granted') {
    return '已授权';
  }
  if (value === 'missing') {
    return '未授权，无法稳定读取 WiFi 名称';
  }
  return value || '-';
}

function uploadLinkStatusText(value?: string | null) {
  const map: Record<string, string> = {
    upload_link_ok: '正常',
    current_upload_failed: '异常',
  };
  return value ? map[value] || value : '-';
}

function uploadLinkTagType(value?: string | null) {
  if (value === 'upload_link_ok') {
    return 'success';
  }
  if (value === 'current_upload_failed') {
    return 'danger';
  }
  return 'info';
}

function backendTargetStatusText(value?: string | null) {
  const map: Record<string, string> = {
    backend_target_ok: '后台目标正常',
    backend_target_unreachable: '后台目标不可达',
  };
  return value ? map[value] || value : '-';
}

function pendingQueueStatusText(value?: string | null) {
  const map: Record<string, string> = {
    pending_queue_empty: '待上传队列为空',
    pending_queue_backlog: '待上传队列有积压',
    pending_queue_quarantined_unreplayable: '缺 payload 队列项已隔离',
    pending_scan_limit_reached_not_quarantined: '扫描上限命中，未隔离',
    pending_payload_not_found_in_scan_window: '扫描窗口未找到，仍保留',
  };
  return value ? map[value] || value : '-';
}

function smsReceiveCapabilityText(value?: string | null) {
  const map: Record<string, string> = {
    can_receive: '可接收',
    unavailable: '不可接收',
    unknown: '未知',
  };
  return value ? map[value] || value : '-';
}

function smsReceiveCapabilityTagType(value?: string | null) {
  if (value === 'can_receive') {
    return 'success';
  }
  if (value === 'unavailable') {
    return 'warning';
  }
  return 'info';
}

function smsReceiveReasonText(value?: string | null) {
  const map: Record<string, string> = {
    sim_no_signal: 'SIM 无信号',
    no_sim: '无 SIM',
    permission_missing: '权限缺失',
    sms_receive_permission_unknown: '短信接收权限未知',
    default_sms_app_restricted: '默认短信应用限制',
    default_sms_app_limited: '非默认短信应用，部分 deliver 路径受限',
    system_inbox_idle_no_new_sms: '系统短信库暂无新短信',
  };
  return value ? map[value] || value : '-';
}

function simPresentText(value?: boolean | null, status?: string | null) {
  if (value === true) {
    return '存在';
  }
  if (value === false) {
    return '不存在';
  }
  return status || '未知';
}

function serviceStateText(value?: string | null) {
  const map: Record<string, string> = {
    in_service: 'in_service / 有运营商服务',
    out_of_service: 'out_of_service / 无运营商服务',
    emergency_only: 'emergency_only / 仅紧急呼叫',
    power_off: 'power_off / 蜂窝无线关闭',
    unknown: 'unknown / 未知',
  };
  return value ? map[value] || value : '-';
}

function smsReceiveDiagnosticText(value: any) {
  if (!value || Object.keys(value).length === 0) {
    return '-';
  }
  const statuses = Array.isArray(value.diagnosticStatuses)
    ? value.diagnosticStatuses.map(smsReceiveLayerStatusText).join('，')
    : '-';
  return [
    `上传链路：${uploadLinkStatusText(value.uploadLinkStatus)}`,
    `后台目标：${backendTargetStatusText(value.backendTargetStatus)}`,
    `pending：${pendingQueueStatusText(value.pendingQueueStatus)}`,
    `短信接收：${smsReceiveCapabilityText(value.smsReceiveCapability)}`,
    `原因：${smsReceiveReasonText(value.smsReceiveUnavailableReason || value.smsReceiveIdleReason)}`,
    `状态：${statuses}`,
  ].join('；');
}

function smsReceiveLayerStatusText(value?: string | null) {
  const map: Record<string, string> = {
    upload_link_ok: '上传链路正常',
    backend_target_ok: '后台目标正常',
    pending_queue_empty: '待上传队列为空',
    pending_queue_quarantined_unreplayable: '缺 payload 队列项已隔离',
    pending_scan_limit_reached_not_quarantined: '扫描上限命中，未隔离',
    pending_payload_not_found_in_scan_window: '扫描窗口未找到，仍保留',
    sms_receive_unavailable_no_signal: 'SIM 无信号不可接收',
    sms_receive_unavailable_no_sim: '无 SIM 不可接收',
    sms_receive_permission_unknown: '短信接收权限未知',
    sms_receive_idle_no_new_sms: '系统短信库暂无新短信',
    carrier_unavailable: '运营商不可用',
    roaming_required_or_unavailable: '漫游需要开启或不可用',
    current_upload_failed: '当前上传失败',
    backend_target_unreachable: '后台目标不可达',
    pending_queue_backlog: '待上传队列积压',
  };
  return value ? map[value] || value : '-';
}

function targetSourceText(value?: string | null) {
  const sourceMap: Record<string, string> = {
    manual: '手动绑定',
    ssid_binding: 'SSID 绑定',
    wifi_ssid_profile: 'SSID 绑定',
    auto_discovered: '自动发现',
    fallback: '回退地址',
    custom: '手动地址',
    build_config: '构建默认',
    stale: '旧地址',
    missing: '未配置',
  };
  return value ? sourceMap[value] || value : '-';
}

function autoDiscoveryStatusText(value?: string | null) {
  const statusMap: Record<string, string> = {
    not_run: '未运行',
    running: '正在发现',
    success: '成功',
    failure: '失败',
  };
  return value ? statusMap[value] || value : '未运行';
}

function pendingQueueTargetText(value: any) {
  if (value?.pendingQueueBoundToLegacyTarget) {
    return '异常：仍显示旧 target 绑定';
  }
  if (value?.pendingQueueUsesActiveTarget === false) {
    return '异常：未确认上传时读取 active target';
  }
  return '正常：队列只保存短信 payload，上传时读取 active target';
}

function pendingQueueRetryText(value: any) {
  const retryAt = formatNullableDate(value?.pendingQueueLastRetryAt);
  const previousTarget = value?.pendingQueueLastPreviousTarget || '-';
  const activeTarget = value?.pendingQueueLastActiveTarget || value?.currentActiveTarget || '-';
  const reason = value?.pendingQueueLastRetryReason || '-';
  if (retryAt === '-' && reason === '-') {
    return '暂无 target 切换后的队列重试记录';
  }
  return `时间：${retryAt}；previousTarget：${previousTarget}；activeTarget：${activeTarget}；原因：${reason}`;
}

function pendingQueueFlushText(value: any) {
  const finishedAt = formatNullableDate(value?.pendingQueueLastFlushFinishedAt);
  if (finishedAt === '-') {
    return '暂无 pending queue flush 记录';
  }
  return [
    `完成时间：${finishedAt}`,
    `触发：${value?.pendingQueueLastFlushReason || '-'}`,
    `flushActiveTarget：${value?.pendingQueueLastFlushActiveTarget || value?.currentActiveTarget || '-'}`,
    `before：${value?.pendingQueueLastFlushPendingBefore ?? '-'}`,
    `attempted：${value?.pendingQueueLastFlushAttempted ?? '-'}`,
    `succeeded：${value?.pendingQueueLastFlushSucceeded ?? '-'}`,
    `failed：${value?.pendingQueueLastFlushFailed ?? '-'}`,
    `blocked：${value?.pendingQueueLastFlushBlocked ?? '-'}`,
    `scanLimitReached=${booleanText(value?.pendingQueueLastScanLimitReached)}`,
    `scanLimitUnmatched=${value?.pendingQueueLastScanLimitUnmatched ?? '-'}`,
    `notQuarantinedUnmatched=${value?.pendingQueueLastNotQuarantinedUnmatched ?? '-'}`,
    `confirmedMissingPayload=${value?.pendingQueueLastConfirmedMissingPayload ?? '-'}`,
    `quarantined：${value?.pendingQueueQuarantinedCount ?? '-'}`,
    `unreplayable：${value?.pendingQueueUnreplayableCount ?? '-'}`,
    `closed_missing_payload：${value?.pendingQueueClosedMissingPayloadCount ?? '-'}`,
    `after：${value?.pendingQueueLastFlushPendingAfter ?? '-'}`,
  ].join('；');
}

function pendingQueueDrainDiagnosticsText(value: any) {
  if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
    return '-';
  }
  return [
    `status=${value.statusCode || '-'}`,
    `autoDrain=${booleanText(value.autoDrainTriggerExpected)}`,
    `oldTarget=${booleanText(value.oldTargetDetected)}`,
    `retriedStillPending=${booleanText(value.retriedStillPending)}`,
    `drainFailed=${booleanText(value.drainFailed)}`,
    `quarantined=${value.quarantinedCount ?? '-'}`,
    `unreplayable=${value.unreplayableCount ?? '-'}`,
    `closedMissingPayload=${value.closedMissingPayloadCount ?? '-'}`,
    `manualReview=${booleanText(value.manualReviewNeeded)}`,
    `scanLimitNotQuarantined=${booleanText(value.scanLimitReachedNotQuarantined)}`,
    `scanLimitUnmatched=${value.scanLimitUnmatchedCount ?? '-'}`,
    `notQuarantinedUnmatched=${value.notQuarantinedUnmatchedCount ?? '-'}`,
    `stillActiveAfterBoundedScan=${booleanText(value.stillActivePendingAfterBoundedScan)}`,
    `failure=${value.lastDrainFailureReason || '-'}`,
    `quarantine=${value.lastQuarantineReason || '-'}`,
    `current=${value.currentActiveTarget || '-'}`,
    `old=${value.lastFailureTarget || value.lastRetryPreviousTarget || '-'}`,
    `after=${value.lastFlushPendingAfter ?? '-'}`,
  ].join('; ');
}

function pendingQueueDistributionText(value: any) {
  if (!value || typeof value !== 'object') {
    return '-';
  }
  const labelMap: Record<string, string> = {
    pending: 'active pending',
    retry_scheduled: 'retry scheduled',
    blocked: 'blocked',
    duplicate_skipped: 'duplicate skipped',
    uploaded: 'uploaded',
    quarantined_unreplayable: 'quarantined/unreplayable',
    closed_missing_payload: 'closed missing payload',
    scan_limit_reached_not_quarantined: 'scan limit not quarantined',
    payload_not_found_in_scan_window: 'scan window miss active',
  };
  return Object.entries(value)
    .map(([key, count]) => `${labelMap[key] || key}：${count}`)
    .join('；') || '-';
}

function commandResultText(row: any) {
  const payload = row.responsePayload || {};
  if (payload.requestedAction === 'force_pending_queue_retry') {
    return `强制重试结果：before=${payload.pendingBefore ?? '-'}，attempted=${payload.attempted ?? '-'}，succeeded=${payload.succeeded ?? '-'}，failed=${payload.failed ?? '-'}，duplicate=${payload.skippedDuplicate ?? '-'}，blocked=${payload.blocked ?? '-'}，quarantined=${payload.quarantined ?? '-'}，unreplayable=${payload.unreplayable ?? '-'}，scanLimit=${payload.scanLimitReached ?? '-'}，scanLimitUnmatched=${payload.scanLimitUnmatched ?? '-'}，notQuarantined=${payload.notQuarantinedUnmatched ?? '-'}，after=${payload.pendingAfter ?? '-'}，activeTarget=${payload.activeTarget || '-'}`;
  }
  if (row.errorReason) {
    return row.errorReason;
  }
  if (row.pendingReason) {
    const reason = commandPendingReasonMap[row.pendingReason] || row.pendingReason;
    const pollAge = formatDurationSeconds(row.lastCommandPollAgeSeconds);
    return `${reason}; lastCommandPollAt=${formatNullableDate(row.lastCommandPollAt)}; pollAge=${pollAge}`;
  }
  if (row.status === 'completed') {
    return '手机已执行成功，后端已收到执行结果。';
  }
  if (row.status === 'failed') {
    return '手机已执行失败，后端已收到失败结果。';
  }
  return '-';
}

function buildCommandFeedback(label: string, command: any, elapsedMs: number) {
  const row = (diagnostics.recentCommands || []).find((item: any) => item.id === command?.id) || command || {};
  const lastPollAt = runtimeOverview.value?.lastCommandPollAt || currentDevice.value?.lastCommandPollAt || null;
  const lastPollAge =
    runtimeOverview.value?.lastCommandPollAgeSeconds ?? currentDevice.value?.lastCommandPollAgeSeconds ?? null;

  if (row.backendReceivedResult || row.status === 'completed' || row.status === 'failed') {
    return {
      type: row.status === 'failed' ? 'error' : 'success',
      title: `${label}指令已有执行结果`,
      description: `命令 #${row.id} 已创建；手机已拉取：${booleanText(row.devicePolled)}；手机执行：${booleanText(row.phoneExecuted)}；后端收到结果：${booleanText(row.backendReceivedResult)}；执行耗时：${formatDurationSeconds(row.durationSeconds)}；页面刷新耗时 ${elapsedMs} 毫秒；${commandResultText(row)}`,
    };
  }

  if (row.devicePolled) {
    return {
      type: 'warning',
      title: `${label}指令已被设备拉取`,
      description: `命令 #${row.id} 已创建，手机已拉取但尚未回传执行结果；最后轮询时间：${formatNullableDate(lastPollAt)}；页面刷新耗时 ${elapsedMs} 毫秒。`,
    };
  }

  return {
    type: 'warning',
    title: `${label}指令已创建，等待设备拉取`,
    description: `命令 #${row.id} 已创建，但设备尚未拉取，最后轮询时间为 ${formatDurationSeconds(lastPollAge)} 前。请检查 Android bridge 是否仍在后台轮询。页面刷新耗时 ${elapsedMs} 毫秒。`,
  };
}

function carrierCategoryText(value?: string | null) {
  if (!value) {
    return '-';
  }
  return carrierCategoryMap[value] || '其他运营商提醒';
}

function translateRunningModeNote(value?: string | null) {
  if (!value) {
    return '-';
  }
  if (value === 'Current app depends on 127.0.0.1/localhost plus adb reverse.') {
    return '当前应用仍依赖 127.0.0.1 / localhost 与 ADB 反向代理。';
  }
  if (value === 'Current app is already using a non-loopback backend target.') {
    return '当前应用已经使用非回环地址的后端目标。';
  }
  return value;
}

function translateBridgeStep(value?: string | null) {
  if (!value) {
    return '-';
  }
  if (value === 'Replace localhost target with a reachable LAN, VPN, or public backend address.') {
    return '将 localhost 目标替换为设备可达的局域网、VPN 或公网后端地址。';
  }
  if (value === 'Verify the configured backend target is reachable from the device at runtime.') {
    return '确认当前配置的后端目标在设备运行时可达。';
  }
  if (value === 'Detected stale backend target from another LAN subnet; run backend rediscovery before retrying uploads.') {
    return '检测到旧局域网后台地址残留，请先重新发现后台，再重试上传队列。';
  }
  if (value === 'Pending upload queue still reports a legacy target binding; upload worker must resolve the active target at send time.') {
    return '待上传队列仍报告旧 target 绑定风险；上传 worker 必须在发送时读取当前 active target。';
  }
  if (value === 'Drain the pending upload queue and confirm queue size returns to 0 after success.') {
    return '清空待上传队列，并确认上传成功后队列归零。';
  }
  if (value.startsWith('Clear the latest upload failure: ')) {
    return `清除最近一次上传失败：${value.replace('Clear the latest upload failure: ', '')}`;
  }
  return value;
}

function translateUiProjectionNote(value?: string | null) {
  if (!value) {
    return '-';
  }
  if (value === 'Current diagnostics intentionally project the same ids into bridge, raw, and trace panels. This is not a storage duplicate.') {
    return '当前诊断页会有意把同一条记录投影到桥接、原始短信和链路追踪面板中，这不是存储层重复。';
  }
  return value;
}

function translateSingleUpsertEntry(value?: string | null) {
  if (!value) {
    return '-';
  }
  if (value === 'MobileBridgeService.createSmsEvent -> MessageHubService.processInboundSms -> ingestSmsMessage') {
    return '统一写入链路：MobileBridgeService.createSmsEvent -> MessageHubService.processInboundSms -> ingestSmsMessage';
  }
  return value;
}

function translateSingleUpsertProof(value?: string | null) {
  if (!value) {
    return '-';
  }
  if (value === 'Both live_broadcast and inbox_sync converge on POST /mobile-bridge/sms-events and then reuse the same backend upsert path.') {
    return '实时广播与收件箱同步都会汇聚到 POST /mobile-bridge/sms-events，再复用同一条后端统一写入链路。';
  }
  return value;
}

function translateDatabaseDuplicateNote(value?: string | null) {
  if (!value) {
    return '-';
  }
  if (value === 'True DB duplicates require the frozen primary/fallback key to collide. Loose dual-path groups are tracked separately.') {
    return '只有冻结后的主去重键或回退去重键真正碰撞，才算数据库真实重复；双路径松键重复会单独统计。';
  }
  return value;
}

function translateSafeHistoricalDedupPlan(value?: string | null) {
  if (!value) {
    return '-';
  }
  if (value === 'Review legacy dual-path groups one by one and keep the earliest evidence row as the survivor.') {
    return '逐组审查历史双路径重复样本，并保留最早的证据行作为留存记录。';
  }
  if (value === 'Backfill deviceSmsId or dedupeFingerprint only when the original device evidence is trustworthy.') {
    return '只有原始设备证据足够可信时，才允许回填设备短信编号或去重指纹。';
  }
  if (value === 'Do not run bulk delete in SAFE mode; archive or soft-merge only after sample review.') {
    return '安全模式下不要做批量删除；只能在样本审查后做归档或软合并。';
  }
  return value;
}

function formatNullableDate(value?: string | null) {
  return value ? formatDateTime(value) : '-';
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${value}%`;
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = Number(value);
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDurationSeconds(value?: number | null) {
  if (value === null || value === undefined) {
    return '-';
  }
  if (value < 60) {
    return `${value} 秒`;
  }
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes < 60) {
    return `${minutes} 分 ${seconds} 秒`;
  }
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours} 小时 ${remainMinutes} 分`;
}

function formatIngestPaths(value?: string[] | null) {
  if (!value || !value.length) {
    return '-';
  }
  return value.map((item) => sourcePathText(item)).join('、');
}

onMounted(() => {
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
  justify-content: flex-end;
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
  font-size: 22px;
  font-weight: 700;
  color: #172033;
}

.metric-value.small {
  font-size: 14px;
  line-height: 1.6;
}

.metric-value.warning {
  color: #c2410c;
}

.metric-meta {
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}

.page-alert {
  margin-top: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.section-meta {
  color: #667085;
  font-size: 12px;
}

.note-list {
  margin-top: 16px;
  display: grid;
  gap: 8px;
}

.note-title {
  font-size: 12px;
  color: #64748b;
}

.note-item {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 10px 12px;
  color: #334155;
}

.table-inline-meta {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
}

.json-block {
  margin: 16px 0 0;
  padding: 12px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  overflow: auto;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .toolbar-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
