<template>
  <RepairAuthorityCaptureWorkspace v-if="authorityOnly" :work-order-id="workOrderId" :profile-version="null" />
  <div v-else class="page-stack" v-loading="loading">
    <el-card>
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">汽修业务工作台 · 工单 #{{ workOrderId }}</div>
            <div class="subtitle">
              {{ intakeExecutionOnly ? '原接车单 → 核实资料与独立复核 → 客户确认 → 施工工时 → 独立质检（不含结算/工资）' : prequoteOnly ? '原接车单 → 核实客户/车辆 → 检查、诊断、报价版本；后续业务尚未开放' : '客户/车辆 → 接车检查 → 诊断报价 → 客户确认 → 施工领料 → 质检 → 交车 → 售后' }}
            </div>
          </div>
          <div class="actions">
            <el-button @click="router.push(ownerIntakeEnabled ? `/work-orders/intake/${workOrderId}` : `/work-orders/${workOrderId}`)">
              {{ ownerIntakeEnabled ? '原接车资料' : ownerRepairAcceptanceEnabled ? '合成工单' : '正式工单' }}
            </el-button>
            <el-button @click="loadWorkspace">刷新</el-button>
          </div>
        </div>
      </template>
      <el-alert
        v-if="!formalActorIdentityBound"
        type="warning"
        :closable="false"
        title="当前为本地演示身份：只能查询安全视图；AI 草稿和正式业务写入都必须经受信任代理绑定员工身份。"
      />
      <el-alert
        class="boundary-alert"
        :type="ownerRepairAcceptanceEnabled ? 'warning' : 'info'"
        :closable="false"
        :title="
          intakeExecutionOnly
            ? '复用原工单采集：独立复核报价后记录客户决定，再施工、记工时和独立质检；不收付款、不确认工资。'
            : prequoteOnly
            ? '当前仅为报价前资料流程，接车信息仍须独立核实；不会确认客户决定、施工、收付款或工资。'
            : ownerRepairAcceptanceEnabled
            ? '当前工作台只连接隔离数据库；审批、资金、库存和客户确认均为 SYNTHETIC 验收效果，不得录入真实资料。'
            : '本工作台复用正式工单、库存、审批、财务和操作日志；不会在这里直接确认付款、执行出库或替客户确认。'
        "
      />
      <el-alert
        v-if="actionError"
        class="boundary-alert"
        type="error"
        show-icon
        closable
        title="本次操作未确认完成，请先回读原工单，不要重复建单"
        :description="actionError"
        @close="actionError = ''"
      />
    </el-card>

    <el-alert v-if="workspaceLoadError" type="error" :closable="false" :title="workspaceLoadError" />
    <RepairCaptureGapPreview
      v-if="captureWorkspace && !prequoteOnly"
      :workspace="captureWorkspace"
      :work-order-id="workOrderId"
      @navigate="openWorkbenchTab"
    />

    <el-card
      v-if="workspace && workspace.profile === null && String(workspace.workOrder?.id) === workOrderId"
      v-show="!loading && !workspaceLoadError"
    >
      <template #header>
        <div>
          <div class="title">{{ prequoteOnly ? '原接车单：核实后进入报价前流程' : '建立汽修档案' }}</div>
          <div class="subtitle">{{ prequoteOnly ? '仅选择已核实的客户和车辆；实际 VIN、里程及需求须先在原接车单补齐，未知不可编造。' : '先选择公司、业务板块、门店和客户范围，再登记或选择车辆并挂到当前正式工单。' }}</div>
        </div>
      </template>
      <RepairSoloWorkflowRehearsal v-if="ownerQuoteRehearsalContext" :key="'solo-' + ownerQuoteRehearsalContext"
        :blocked="prequoteLocked || firstVisitLocked" />
      <RepairQuoteRehearsal v-if="ownerQuoteRehearsalContext" :key="ownerQuoteRehearsalContext"
        :work-order-id="workOrderId" :blocked="prequoteLocked || firstVisitLocked" />
      <RepairFirstVisitReview v-if="prequoteOnly && formalActorIdentityBound"
        :work-order-id="workOrderId" :business-sector-ref="scopeForm.businessSectorRef"
        :blocked="prequoteLocked" @locked="firstVisitLocked = $event" @resolved="applyFirstVisitSelection" />
      <el-form :model="scopeForm" :disabled="prequoteLocked || firstVisitLocked" label-width="120px" class="setup-form">
        <el-form-item label="组织经营范围">
          <el-select
            v-model="selectedScopeKey"
            filterable
            placeholder="选择当前账号获授权的公司 / 板块 / 门店"
            style="width: 100%"
            @change="handleScopeSelection"
          >
            <el-option
              v-for="item in scopeOptions"
              :key="scopeKey(item)"
              :value="scopeKey(item)"
              :label="`${item.companyName} / ${item.businessSectorName} / ${item.storeName}`"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="客户引用">
          <el-select
            v-model="scopeForm.customerRef"
            filterable
            placeholder="选择共享客户主档的脱敏安全视图"
            style="width: 100%"
            :disabled="!selectedScopeKey"
          >
            <el-option
              v-for="customer in customerOptions"
              :key="customer.customerRef"
              :value="customer.customerRef"
              :label="`${customer.displayName}${customer.mobileMasked ? ` · ${customer.mobileMasked}` : ''}`"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="车辆">
          <div class="inline-fill">
            <el-select v-model="attachVehicleId" filterable placeholder="查询后选择车辆" style="flex: 1">
              <el-option
                v-for="vehicle in vehicleOptions"
                :key="vehicle.id"
                :value="vehicle.id"
                :label="`${vehicle.plateNumber} · ${vehicle.brand || ''} ${vehicle.model || ''}`"
              />
            </el-select>
            <el-button @click="loadVehicles">查询车辆</el-button>
            <el-button v-if="!prequoteOnly" type="primary" :disabled="!formalActorIdentityBound" @click="vehicleDialog = true">
              登记车辆
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="映射审核凭证">
          <el-input
            v-model="scopeResolutionEvidenceRef"
            placeholder="内部不透明引用，例如 scope-review:2026-0001（不得填写手机号、VIN 或外部链接）"
          />
        </el-form-item>
        <el-alert
          class="boundary-alert"
          type="warning"
          :closable="false"
          title="历史工单首次挂接需要 scope.resolve 权限、已人工绑定的共享客户证据和审核凭证；无法证明时保持 scope_resolution_pending。"
        />
        <el-form-item v-if="!prequoteOnly">
          <el-button
            type="success"
            :disabled="!formalActorIdentityBound || !attachVehicleId || !scopeResolutionEvidenceRef.trim()"
            :loading="submitting"
            @click="handleAttach"
          >
            建立汽修工单档案
          </el-button>
        </el-form-item>
      </el-form>
      <RepairPrequoteAdmission v-if="prequoteOnly && formalActorIdentityBound" :work-order-id="workOrderId"
        :blocked="firstVisitLocked"
        :selection="prequoteSelection" :evidence-ref="scopeResolutionEvidenceRef"
        @locked="prequoteLocked = $event" @admitted="loadWorkspace" />
    </el-card>

    <div
      v-if="workspace?.profile && String(workspace.profile.workOrderId) === workOrderId"
      v-show="!loading && !workspaceLoadError"
      class="page-stack"
    >
      <el-card>
        <div class="status-grid">
          <div>
            <div class="status-label">当前阶段</div>
            <el-tag size="large" type="primary">{{ lifecycleLabel(workspace.profile.lifecycleStatus) }}</el-tag>
          </div>
          <div>
            <div class="status-label">客户确认</div>
            <el-tag size="large" :type="workspace.profile.customerConfirmationState === 'confirmed' ? 'success' : 'warning'">
              {{ workspace.profile.customerConfirmationState }}
            </el-tag>
          </div>
          <div>
            <div class="status-label">当前版本</div>
            <strong>v{{ workspace.profile.version }}</strong>
          </div>
          <div>
            <div class="status-label">车辆</div>
            <strong>{{ workspace.vehicle?.plateNumber || '-' }}</strong>
            <span class="muted"> {{ workspace.vehicle?.brand }} {{ workspace.vehicle?.model }}</span>
          </div>
        </div>
        <el-steps class="lifecycle" :active="lifecycleStep" finish-status="success" align-center>
          <el-step title="接车检查" />
          <el-step title="诊断方案" />
          <el-step v-if="prequoteOnly && !intakeExecutionOnly" title="报价独立复核" />
          <el-step v-if="operationalTabsAvailable" title="客户确认" />
          <el-step v-if="operationalTabsAvailable" title="维修施工" />
          <el-step v-if="operationalTabsAvailable" title="质检" />
          <el-step v-if="!prequoteOnly" title="交车售后" />
        </el-steps>
        <el-descriptions :column="4" border>
          <el-descriptions-item label="公司">{{ workspace.profile.companyDisplaySnapshot }}</el-descriptions-item>
          <el-descriptions-item label="业务板块">{{ workspace.profile.businessSectorDisplaySnapshot }}</el-descriptions-item>
          <el-descriptions-item label="门店">{{ workspace.profile.storeDisplaySnapshot }}</el-descriptions-item>
          <el-descriptions-item label="客户引用">{{ workspace.profile.customerRef }}</el-descriptions-item>
          <el-descriptions-item label="方案版本">{{ workspace.profile.activePlanVersion || '-' }}</el-descriptions-item>
          <el-descriptions-item label="报价版本">{{ workspace.profile.activeQuoteVersion || '-' }}</el-descriptions-item>
          <el-descriptions-item label="解释版本">{{ workspace.profile.activeExplanationVersion || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="prequoteOnly ? '接车里程（待核实）' : '里程'">{{ displayedOdometerKm ?? '-' }} km</el-descriptions-item>
        </el-descriptions>
        <div v-if="canSuperviseLifecycle" class="actions lifecycle-controls">
          <el-button
            v-if="!['suspended', 'delivered', 'after_sales', 'closed', 'cancelled'].includes(workspace.profile.lifecycleStatus)"
            type="warning"
            @click="handleLifecycleTransition('suspended')"
          >
            暂停并留因
          </el-button>
          <el-button
            v-if="workspace.profile.lifecycleStatus === 'suspended'"
            type="success"
            @click="handleLifecycleTransition('resume')"
          >
            恢复到暂停前阶段
          </el-button>
          <el-button
            v-if="!['delivered', 'after_sales', 'closed', 'cancelled'].includes(workspace.profile.lifecycleStatus)"
            type="danger"
            @click="handleLifecycleTransition('cancelled')"
          >
            取消工单
          </el-button>
          <el-button
            v-if="['delivered', 'after_sales'].includes(workspace.profile.lifecycleStatus)"
            @click="handleLifecycleTransition('closed')"
          >
            关闭工单
          </el-button>
        </div>
      </el-card>

      <el-card v-if="ownerRepairAcceptanceEnabled" class="workbench-guide-card">
        <div class="workbench-next">
          <div>
            <div class="workbench-guide-label">本页下一步</div>
            <h3>{{ workflowAdvice.title }}</h3>
            <p>{{ workflowAdvice.description }}</p>
          </div>
          <div class="workbench-guide-actions">
            <el-button type="primary" @click="openWorkbenchTab(workflowAdvice.tab)">
              打开“{{ workflowAdvice.tabLabel }}”
            </el-button>
            <el-button type="warning" plain @click="openWorkbenchTab('procurement')">
              本轮重点：VIN / 配件采购
            </el-button>
          </div>
        </div>
        <div class="tab-guide-list">
          <button
            v-for="item in visibleTabGuides"
            :key="item.name"
            type="button"
            :class="['tab-guide-button', { active: activeTab === item.name }]"
            @click="openWorkbenchTab(item.name)"
          >
            <strong>{{ item.label }}</strong>
            <span>{{ item.help }}</span>
          </button>
        </div>
      </el-card>

      <el-card>
        <el-tabs v-model="activeTab">
          <el-tab-pane label="检查 / 方案 / 报价" name="documents">
            <RepairProposalDocumentSource v-if="prequoteOnly && formalActorIdentityBound"
              :work-order-id="workOrderId" :profile-version="workspace.profile.version" @saved="loadWorkspace" />
            <div class="two-column">
              <div>
                <h3>版本记录</h3>
                <el-table :data="workspace.documents" max-height="500">
                  <el-table-column label="类型" width="150">
                    <template #default="{ row }">{{ documentLabel(row.documentType) }}</template>
                  </el-table-column>
                  <el-table-column prop="version" label="版本" width="70" />
                  <el-table-column prop="status" label="状态" width="100" />
                  <el-table-column prop="summary" label="摘要" min-width="220" show-overflow-tooltip />
                  <el-table-column label="来源" width="80">
                    <template #default="{ row }">{{ row.generatedBy === 'ai' ? 'AI 草稿' : '人工' }}</template>
                  </el-table-column>
                  <el-table-column label="人工审核" width="150" fixed="right">
                    <template #default="{ row }">
                      <template v-if="['draft', 'review_pending'].includes(row.status)">
                        <el-button link type="success" :disabled="!formalActorIdentityBound" @click="handleReviewDocument(row, 'approved')">通过</el-button>
                        <el-button link type="danger" :disabled="!formalActorIdentityBound" @click="handleReviewDocument(row, 'rejected')">驳回</el-button>
                      </template>
                      <span v-else>{{ row.reviewNote || '-' }}</span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <el-form :model="documentForm" label-width="100px" class="editor-form">
                <h3>新增不可变版本</h3>
                <el-form-item label="文档类型">
                  <el-select v-model="documentForm.documentType" @change="applyDocumentTemplate">
                    <el-option label="接车检查" value="intake_inspection" />
                    <el-option label="诊断记录" value="diagnosis" />
                    <el-option label="维修方案" value="repair_plan" />
                    <el-option label="报价版本" value="quote" />
                    <el-option label="客户解释" value="customer_explanation" />
                  </el-select>
                </el-form-item>
                <el-form-item label="摘要">
                  <el-input v-model="documentForm.summary" type="textarea" :rows="2" />
                </el-form-item>
                <el-form-item label="结构化内容">
                  <el-input v-model="documentForm.payloadJson" type="textarea" :rows="14" class="code-input" />
                </el-form-item>
                <el-form-item label="资料引用">
                  <el-input
                    v-model="documentForm.sourceReferencesJson"
                    type="textarea"
                    :rows="4"
                    placeholder='可选 JSON 数组，例如 [{"type":"manual","ref":"..."}]'
                  />
                </el-form-item>
                <el-form-item>
                  <el-button
                    type="primary"
                    :loading="submitting"
                    :disabled="!formalActorIdentityBound"
                    @click="handleCreateDocument"
                  >
                    保存新版本
                  </el-button>
                  <el-button @click="applyDocumentTemplate">重置模板</el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>

          <el-tab-pane v-if="operationalTabsAvailable" label="客户确认" name="confirmation">
            <div class="two-column">
              <div>
                <h3>确认请求</h3>
                <el-table :data="workspace.confirmationRequests">
                  <el-table-column prop="id" label="#" width="60" />
                  <el-table-column label="绑定版本" min-width="170">
                    <template #default="{ row }">方案 v{{ row.planVersion }} / 报价 v{{ row.quoteVersion }} / 解释 v{{ row.explanationVersion }}</template>
                  </el-table-column>
                  <el-table-column prop="channel" label="渠道" width="90" />
                  <el-table-column prop="recipientMasked" label="接收人（脱敏）" min-width="130" />
                  <el-table-column prop="status" label="状态" width="100" />
                  <el-table-column label="操作" width="150">
                    <template #default="{ row }">
                      <template v-if="row.status === 'pending'">
                        <el-button link type="success" :disabled="!formalActorIdentityBound" @click="handleDecision(row, 'confirmed')">记录客户已确认</el-button>
                        <el-button link type="danger" :disabled="!formalActorIdentityBound" @click="handleDecision(row, 'rejected')">记录客户拒绝</el-button>
                      </template>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <el-form :model="confirmationForm" label-width="110px" class="editor-form">
                <h3>生成请求（不是替客户确认）</h3>
                <el-form-item label="绑定版本">
                  <span>方案 v{{ workspace.profile.activePlanVersion || '-' }} / 报价 v{{ workspace.profile.activeQuoteVersion || '-' }} / 解释 v{{ workspace.profile.activeExplanationVersion || '-' }}</span>
                </el-form-item>
                <el-form-item label="渠道">
                  <el-select v-model="confirmationForm.channel">
                    <el-option label="到店" value="in_store" />
                    <el-option label="电话" value="phone" />
                    <el-option label="微信" value="wechat" />
                    <el-option label="短信" value="sms" />
                    <el-option label="客户门户" value="portal" />
                  </el-select>
                </el-form-item>
                <el-form-item label="接收人脱敏值">
                  <el-input v-model="confirmationForm.recipientMasked" placeholder="例如 138****1234" />
                </el-form-item>
                <el-form-item label="说明">
                  <el-input v-model="confirmationForm.message" type="textarea" :rows="4" />
                </el-form-item>
                <el-form-item>
                  <el-button
                    type="primary"
                    :loading="submitting"
                    :disabled="!formalActorIdentityBound || !confirmationReady"
                    @click="handleRequestConfirmation"
                  >
                    请求客户确认
                  </el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>

          <el-tab-pane v-if="operationalTabsAvailable" label="维修施工" name="execution">
            <el-alert :closable="false" type="info" title="员工施工：开始任务 → 记录实际工时 → 完工留证 → 独立质检" description="这里只记录工作事实。对客工时费率不是员工工资标准，记录工时不会生成应发工资或付款。最后一项任务完工前，请先保存并核对工时。" />
            <div class="execution-toolbar">
              <el-radio-group v-model="executionTaskView" aria-label="施工任务范围">
                <el-radio-button value="mine">我的任务</el-radio-button>
                <el-radio-button value="all">本单全部任务</el-radio-button>
              </el-radio-group>
              <span class="muted">{{ currentExecutionEmployeeId ? `当前绑定员工 #${currentExecutionEmployeeId}` : '未取得当前员工绑定，请刷新或联系管理员核实；不会按用户名猜测' }}。全部任务仅显示当前工单已授权的查询结果，操作仍由服务端核验权限。</span>
            </div>
            <div class="two-column">
              <div>
                <h3>{{ executionTaskView === 'mine' ? '我的施工任务' : '本单施工任务' }} · {{ visibleExecutionTasks.length }}</h3>
                <el-empty v-if="!visibleExecutionTasks.length" :description="executionTaskView === 'mine' ? '当前没有可显示的本人任务；请先核实员工绑定和主管派工，不要代用他人账号' : '当前工单没有施工任务'" :image-size="64" />
                <div class="execution-task-list">
                  <article v-for="task in visibleExecutionTasks" :key="task.id" class="execution-task-card">
                    <div class="execution-task-heading"><strong>#{{ task.id }} · {{ task.title }}</strong><el-tag>{{ taskStatusLabel(task.status) }}</el-tag></div>
                    <p class="muted">方案 {{ task.planItemRef }} · 指派员工 #{{ task.technicianEmployeeId }}<span v-if="task.reworkOfInspectionId"> · 返工质检 #{{ task.reworkOfInspectionId }}</span></p>
                    <p class="muted">已存工时记录 {{ taskLaborRecords(task.id).length }} 条（非工资结论）</p>
                    <div class="execution-task-actions">
                      <el-button v-if="task.status === 'pending' || task.status === 'blocked'" :disabled="submitting || !isCurrentExecutionTask(task)" @click="handleTaskStatus(task, 'in_progress')">{{ task.status === 'blocked' ? '继续施工' : '开始施工' }}</el-button>
                      <el-button v-if="task.status === 'in_progress'" :disabled="submitting || !isCurrentExecutionTask(task)" @click="handleTaskStatus(task, 'blocked')">标记阻塞</el-button>
                      <el-button type="primary" :disabled="submitting || laborSaveNeedsReadback || !isCurrentExecutionTask(task)" @click="handleLaborTaskSelection(task.id, true)">记录工时</el-button>
                      <el-button v-if="task.status === 'in_progress'" type="success" :disabled="submitting || !isCurrentExecutionTask(task)" @click="handleTaskStatus(task, 'completed')">完工留证</el-button>
                    </div>
                  </article>
                </div>
                <h3>{{ executionTaskView === 'mine' ? '我的已存工时' : '本单已存工时' }} · {{ visibleLaborItems.length }}</h3>
                <el-table :data="visibleLaborItems" size="small" empty-text="暂无已存工时；保存后刷新核对，不代表工资已确认">
                  <el-table-column prop="taskId" label="任务" width="70" />
                  <el-table-column prop="laborCode" label="编码" />
                  <el-table-column prop="name" label="名称" />
                  <el-table-column prop="technicianEmployeeId" label="员工" width="70" />
                  <el-table-column prop="standardHours" label="标准工时" />
                  <el-table-column prop="actualHours" label="实际工时" />
                  <el-table-column prop="hourlyRate" label="对客费率（非工资）" min-width="145" />
                  <el-table-column prop="quoteLineRef" label="报价行" />
                </el-table>
                <h3>配件关联（仅引用既有工单材料）</h3>
                <el-table :data="workspace.partLinks" size="small">
                  <el-table-column prop="workOrderMaterialId" label="工单材料 ID" />
                  <el-table-column prop="taskId" label="任务 ID" />
                  <el-table-column prop="quoteLineRef" label="报价行" />
                  <el-table-column prop="usageNote" label="用途" />
                </el-table>
              </div>
              <div class="stacked-forms">
                <el-form ref="laborEntryForm" :model="laborForm" :disabled="submitting || laborSaveNeedsReadback" label-width="110px" class="editor-form labor-entry-form">
                  <h3>记录实际施工工时</h3>
                  <el-form-item label="施工任务">
                    <el-select v-model="laborForm.taskId" placeholder="从任务卡片选入，或在此选择" @change="handleLaborTaskSelection">
                      <el-option v-for="task in selectableLaborTasks" :key="task.id" :label="`#${task.id} ${task.title}`" :value="task.id" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="指派员工"><span>{{ laborForm.technicianEmployeeId ? `员工 #${laborForm.technicianEmployeeId}（随任务自动关联）` : '请先选择施工任务' }}</span></el-form-item>
                  <el-form-item label="工时编码"><el-input v-model="laborForm.laborCode" maxlength="64" placeholder="本任务内唯一的工时记录编码" /></el-form-item>
                  <el-form-item label="工作内容"><el-input v-model="laborForm.name" maxlength="160" /></el-form-item>
                  <el-form-item label="标准工时(h)"><el-input v-model="laborForm.standardHours" inputmode="decimal" placeholder="按已确认项目填写，不预填" /></el-form-item>
                  <el-form-item label="实际工时(h)"><el-input v-model="laborForm.actualHours" inputmode="decimal" placeholder="本人实际投入时间，不估造" /></el-form-item>
                  <el-form-item label="对客费率(元/h)"><el-input v-model="laborForm.hourlyRate" inputmode="decimal" placeholder="报价口径，不是员工工资；免费也须明确填0" /></el-form-item>
                  <el-form-item label="对应报价行">
                    <el-select v-model="laborForm.quoteLineRef" filterable placeholder="仅显示当前任务的已确认工时报价">
                      <el-option v-for="line in selectedTaskLaborQuoteLines" :key="line.lineRef" :label="`${line.lineRef} · ${line.name || ''}${!line.planItemRef && line.approvedFeeBasisRef ? '（已批准费用依据，须核对后选择）' : ''}`" :value="line.lineRef" />
                    </el-select>
                  </el-form-item>
                  <p class="muted" role="status">{{ laborEntryHint }}</p>
                  <el-form-item><el-button type="primary" :loading="submitting" :disabled="!laborEntryReady" @click="handleCreateLabor">保存工时并回读</el-button></el-form-item>
                </el-form>
                <el-alert v-if="laborSaveNeedsReadback" type="warning" :closable="false" title="工时保存结果待核对，请先点页面顶部“刷新”回读原单；不要换编码重复提交。" />
                <el-form :model="taskForm" label-width="100px" class="editor-form">
                  <h3>主管派工（需现有权限）</h3>
                  <el-form-item label="方案项目">
                    <el-select v-model="taskForm.planItemRef" filterable>
                      <el-option v-for="item in activePlanItems" :key="item.itemRef" :label="`${item.itemRef} · ${item.action || ''}`" :value="item.itemRef" />
                    </el-select>
                  </el-form-item>
                  <el-form-item v-if="pendingReworkInspection" label="返工来源">
                    <span>失败质检 #{{ pendingReworkInspection.id }}（只允许其指定项目）</span>
                  </el-form-item>
                  <el-form-item label="任务名称"><el-input v-model="taskForm.title" /></el-form-item>
                  <el-form-item label="车辆系统"><el-input v-model="taskForm.system" /></el-form-item>
                  <el-form-item label="技师员工 ID"><el-input-number v-model="taskForm.technicianEmployeeId" :min="1" /></el-form-item>
                  <el-form-item label="安全说明"><el-input v-model="taskForm.safetyNotes" type="textarea" /></el-form-item>
                  <el-form-item>
                    <el-button type="primary" :disabled="!formalActorIdentityBound || !taskForm.technicianEmployeeId || !taskForm.planItemRef" @click="handleCreateTask">新增任务</el-button>
                  </el-form-item>
                </el-form>
                <el-form :model="partForm" label-width="120px" class="editor-form">
                  <h3>关联既有材料</h3>
                  <el-form-item label="任务">
                    <el-select v-model="partForm.taskId">
                      <el-option v-for="task in workspace.tasks" :key="task.id" :label="`#${task.id} ${task.title}`" :value="task.id" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="工单材料 ID"><el-input-number v-model="partForm.workOrderMaterialId" :min="1" /></el-form-item>
                  <el-form-item label="报价行引用">
                    <el-select v-model="partForm.quoteLineRef" filterable>
                      <el-option v-for="line in partQuoteLines" :key="line.lineRef" :label="`${line.lineRef} · ${line.name || ''}`" :value="line.lineRef" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="用途"><el-input v-model="partForm.usageNote" /></el-form-item>
                  <el-form-item><el-button :disabled="!formalActorIdentityBound || !partForm.taskId || !partForm.workOrderMaterialId || !partForm.quoteLineRef" @click="handleCreatePartLink">关联（不出库）</el-button></el-form-item>
                </el-form>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane v-if="operationalTabsAvailable" :label="intakeExecutionOnly ? '独立质检（未结算）' : '质检 / 交车 / 售后'" name="completion">
            <el-alert v-if="intakeExecutionOnly" :closable="false" type="warning" title="质检通过只表示维修验收完成，不代表已收款、交车结算或工资确认。采购出入库仍须走既有授权流程。" />
            <div class="three-column">
              <el-form :model="qualityForm" label-width="100px" class="editor-form">
                <h3>质检记录</h3>
                <el-form-item label="质检员 ID"><el-input-number v-model="qualityForm.inspectedByEmployeeId" :min="1" /></el-form-item>
                <el-form-item label="结果">
                  <el-radio-group v-model="qualityForm.result">
                    <el-radio-button value="passed">通过</el-radio-button>
                    <el-radio-button value="failed">返工</el-radio-button>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="检查表 JSON"><el-input v-model="qualityForm.checklistJson" type="textarea" :rows="8" /></el-form-item>
                <el-form-item label="路试结果"><el-input v-model="qualityForm.roadTestResult" type="textarea" /></el-form-item>
                <el-form-item v-if="qualityForm.result === 'failed'" label="返工原因"><el-input v-model="qualityForm.reworkReason" type="textarea" /></el-form-item>
                <el-form-item v-if="qualityForm.result === 'failed'" label="返工项目">
                  <el-select v-model="qualityForm.reworkPlanItemRefs" multiple filterable>
                    <el-option v-for="item in activePlanItems" :key="item.itemRef" :label="`${item.itemRef} · ${item.action || ''}`" :value="item.itemRef" />
                  </el-select>
                </el-form-item>
                <el-form-item><el-button type="primary" :disabled="!formalActorIdentityBound" @click="handleQuality">提交质检</el-button></el-form-item>
              </el-form>
              <el-form v-if="!prequoteOnly" :model="deliveryForm" label-width="100px" class="editor-form">
                <h3>交车记录</h3>
                <el-alert
                  :type="workspace.financeReadiness?.ready ? 'success' : 'warning'"
                  :closable="false"
                  show-icon
                  :title="workspace.financeReadiness?.ready
                    ? `既有资金主链已提供交车前置证据（${workspace.financeReadiness.evidenceCount} 条，只读）`
                    : '既有资金主链尚无覆盖当前报价的已确认收款记录，暂不可交车'"
                />
                <el-form-item label="交车人 ID"><el-input-number v-model="deliveryForm.deliveredByEmployeeId" :min="1" /></el-form-item>
                <el-form-item label="交车时间"><el-date-picker v-model="deliveryForm.deliveredAt" type="datetime" /></el-form-item>
                <el-form-item label="最终里程 km"><el-input-number v-model="deliveryForm.finalOdometerKm" :min="0" /></el-form-item>
                <el-form-item label="维修摘要"><el-input v-model="deliveryForm.repairSummary" type="textarea" :rows="3" /></el-form-item>
                <el-form-item label="未决提醒">
                  <el-input v-model="deliveryForm.unresolvedRemindersText" type="textarea" :rows="3" placeholder="每行一项；没有可留空" />
                </el-form-item>
                <el-form-item label="客户凭证引用">
                  <el-input
                    v-model="deliveryForm.customerAckEvidenceRef"
                    placeholder="例如 ack:20260809:xxxx（内部不透明引用，不填 URL）"
                  />
                </el-form-item>
                <el-form-item label="交车清单 JSON"><el-input v-model="deliveryForm.checklistJson" type="textarea" :rows="8" /></el-form-item>
                <el-form-item><el-button type="success" :disabled="!formalActorIdentityBound || !workspace.financeReadiness?.ready || deliveryForm.finalOdometerKm === undefined || !deliveryForm.repairSummary.trim()" @click="handleDelivery">记录交车</el-button></el-form-item>
              </el-form>
              <el-form v-if="!prequoteOnly" :model="warrantyForm" label-width="100px" class="editor-form">
                <h3>保修 / 售后</h3>
                <el-form-item label="类型">
                  <el-select v-model="warrantyForm.warrantyType">
                    <el-option label="保修覆盖" value="coverage" />
                    <el-option label="售后索赔" value="claim" />
                  </el-select>
                </el-form-item>
                <el-form-item label="开始时间"><el-date-picker v-model="warrantyForm.startsAt" type="datetime" /></el-form-item>
                <el-form-item label="结束时间"><el-date-picker v-model="warrantyForm.endsAt" type="datetime" /></el-form-item>
                <el-form-item label="覆盖快照 JSON"><el-input v-model="warrantyForm.coverageJson" type="textarea" :rows="8" /></el-form-item>
                <el-form-item label="说明"><el-input v-model="warrantyForm.claimNote" type="textarea" /></el-form-item>
                <el-form-item><el-button :disabled="!formalActorIdentityBound" @click="handleWarranty">保存售后记录</el-button></el-form-item>
              </el-form>
            </div>
            <el-divider />
            <el-table :data="workspace.qualityInspections" size="small">
              <el-table-column prop="id" label="质检 #" />
              <el-table-column prop="result" label="结果" />
              <el-table-column prop="roadTestResult" label="路试" />
              <el-table-column prop="reworkReason" label="返工原因" />
              <el-table-column prop="createdAt" label="时间" />
            </el-table>
          </el-tab-pane>

          <el-tab-pane v-if="!prequoteOnly" label="AI 维修助手" name="ai">
            <div class="two-column">
              <el-form :model="aiForm" label-width="110px" class="editor-form">
                <h3>生成辅助草稿</h3>
                <el-alert type="warning" :closable="false" title="AI 只给建议、案例、视频候选、客户解释和一致性检查；技师必须复核，AI 不能完工、出库、质检或确认付款。" />
                <el-form-item label="能力">
                  <el-select v-model="aiForm.draftType">
                    <el-option label="故障判断辅助" value="fault_assessment" />
                    <el-option label="维修方案草稿" value="repair_plan" />
                    <el-option label="客户解释草稿" value="customer_explanation" />
                    <el-option label="方案/报价一致性" value="consistency_review" />
                    <el-option label="案例/视频推荐" value="knowledge_recommendation" />
                  </el-select>
                </el-form-item>
                <el-form-item label="故障现象"><el-input v-model="aiForm.symptoms" type="textarea" :rows="5" /></el-form-item>
                <el-form-item label="客户问题"><el-input v-model="aiForm.customerQuestion" type="textarea" :rows="3" /></el-form-item>
                <el-form-item label="检索词"><el-input v-model="aiForm.searchTerms" placeholder="空格分隔，例如 宝马 N20 怠速抖动" /></el-form-item>
                <el-form-item>
                  <el-button type="primary" :loading="submitting" :disabled="!formalActorIdentityBound" @click="handleAiDraft">生成 AI 草稿</el-button>
                  <el-button @click="loadKnowledge">查案例/视频</el-button>
                </el-form-item>
              </el-form>
              <div>
                <h3>最新 AI 输出</h3>
                <el-alert
                  v-if="latestAiDraft && ['stale', 'blocked', 'superseded'].includes(latestAiDraft.status)"
                  type="error"
                  :closable="false"
                  :title="`该 AI 草稿状态为 ${latestAiDraft.status}，依赖已变化，禁止继续使用；请以新幂等键重新生成并人工复核。`"
                />
                <pre class="json-panel">{{ latestAiOutput }}</pre>
                <h3>已验证知识引用</h3>
                <el-table
                  :data="knowledgeRows"
                  max-height="260"
                  empty-text="没有可验证的案例或视频；接入经授权的厂家资料或知识库前，系统不会编造来源。"
                >
                  <el-table-column prop="referenceType" label="类型" width="100" />
                  <el-table-column prop="authorityRank" label="权威" width="65" />
                  <el-table-column prop="similarityScore" label="相关度" width="80" />
                  <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
                  <el-table-column prop="sourceAuthority" label="来源" min-width="120" />
                  <el-table-column prop="reviewStatus" label="审核" width="100" />
                  <el-table-column label="链接" width="80">
                    <template #default="{ row }"><el-link :href="row.url" target="_blank">打开</el-link></template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane v-if="!prequoteOnly" label="VIN / 配件采购" name="procurement">
            <RepairProcurementWorkspace
              :work-order-id="workOrderId"
              :profile="workspace.profile"
              :vehicle="workspace.vehicle"
            />
          </el-tab-pane>

          <el-tab-pane v-if="!prequoteOnly" label="正式资料与复核" name="authority_capture">
            <RepairAuthorityCaptureWorkspace :work-order-id="workOrderId" :profile-version="workspace.profile.version" />
          </el-tab-pane>

          <el-tab-pane label="审计边界" name="audit">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="正式工单根">{{ workspace.boundaries.formalWorkOrderRoot }}</el-descriptions-item>
              <el-descriptions-item label="库存真源">{{ workspace.boundaries.inventorySource }}</el-descriptions-item>
              <el-descriptions-item label="财务真源">{{ workspace.boundaries.financeSource }}</el-descriptions-item>
              <el-descriptions-item label="审批真源">{{ workspace.boundaries.approvalSource }}</el-descriptions-item>
              <el-descriptions-item label="助手可直接执行">否</el-descriptions-item>
            </el-descriptions>
            <el-alert
              class="boundary-alert"
              type="warning"
              :closable="false"
              title="这里只展示权威边界，不展开完整工作台载荷；详细操作证据请通过既有操作日志按权限查询。"
            />
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>

    <el-dialog v-model="vehicleDialog" title="登记车辆档案" width="680px">
      <el-form :model="vehicleForm" label-width="100px">
        <el-form-item label="车牌号"><el-input v-model="vehicleForm.plateNumber" /></el-form-item>
        <el-form-item label="号牌证据"><el-input v-model="vehicleForm.plateEvidenceRef" placeholder="内部不透明证据引用" /></el-form-item>
        <el-form-item label="客户关系">
          <el-select v-model="vehicleForm.customerRelationshipType">
            <el-option label="车主" value="owner" />
            <el-option label="使用人" value="user" />
            <el-option label="联系人" value="contact" />
          </el-select>
        </el-form-item>
        <el-form-item label="关系证据"><el-input v-model="vehicleForm.customerRelationshipEvidenceRef" placeholder="内部不透明证据引用" /></el-form-item>
        <el-form-item label="VIN"><el-input v-model="vehicleForm.vin" maxlength="17" placeholder="必填；17 位且不含 I/O/Q" /></el-form-item>
        <el-form-item label="品牌"><el-input v-model="vehicleForm.brand" /></el-form-item>
        <el-form-item label="车型"><el-input v-model="vehicleForm.model" /></el-form-item>
        <el-form-item label="年款"><el-input-number v-model="vehicleForm.modelYear" :min="1900" :max="2200" /></el-form-item>
        <el-form-item label="发动机代码"><el-input v-model="vehicleForm.engineCode" /></el-form-item>
        <el-form-item label="销售市场"><el-input v-model="vehicleForm.salesMarket" placeholder="例如 CN" /></el-form-item>
        <el-form-item label="里程 km"><el-input-number v-model="vehicleForm.odometerKm" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="vehicleDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreateVehicle">保存车辆</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  attachRepairWorkOrder,
  createRepairAiDraft,
  createRepairConfirmationRequest,
  createRepairDelivery,
  createRepairDocument,
  createRepairLaborItem,
  createRepairPartLink,
  createRepairQualityInspection,
  createRepairTask,
  createRepairVehicle,
  createRepairWarranty,
  getAvailableBusinessScopes,
  getBusinessCustomers,
  getRepairKnowledge,
  getRepairVehicles,
  getRepairWorkspace,
  recordRepairConfirmationDecision,
  reviewRepairDocument,
  transitionRepairLifecycle,
  updateRepairTaskStatus,
  type RepairDocumentType,
} from '../../api/repair-shop';
import { authenticatedUserIdentity, formalActorIdentityBound, hasAnyRole } from '../../utils/permissions';
import RepairProcurementWorkspace from './RepairProcurementWorkspace.vue';
import RepairCaptureGapPreview from './RepairCaptureGapPreview.vue';
import RepairAuthorityCaptureWorkspace from './RepairAuthorityCaptureWorkspace.vue';
import RepairPrequoteAdmission from './components/RepairPrequoteAdmission.vue';
import RepairFirstVisitReview from './components/RepairFirstVisitReview.vue';
import RepairQuoteRehearsal from './components/RepairQuoteRehearsal.vue';
import RepairSoloWorkflowRehearsal from './components/RepairSoloWorkflowRehearsal.vue';
import RepairProposalDocumentSource from './components/RepairProposalDocumentSource.vue';

const route = useRoute();
const router = useRouter();
const ownerRepairAcceptanceEnabled = __OWNER_REPAIR_ACCEPTANCE__;
const ownerIntakeEnabled = __OWNER_INTAKE__;
const workOrderId = computed(() => String(route.params.id));
// An explicit capture entry is independent of the legacy financial workspace,
// including for admins. The query selects UI only; server RBAC still authorizes.
const authorityOnly = computed(() => !ownerIntakeEnabled && (route.query.tab === 'authority_capture' || !hasAnyRole(['operator', 'admin'])));
const loading = ref(false);
const submitting = ref(false);
const allowedTabs = ['documents', 'confirmation', 'execution', 'completion', 'ai', 'procurement', 'authority_capture', 'audit'];
const activeTab = ref(ownerIntakeEnabled ? 'documents' : normalizeTab(route.query.tab));
const workspace = ref<any>(null);
const prequoteOnly = computed(() => ownerIntakeEnabled || workspace.value?.prequoteOnly === true);
// The build flag/URL never grants operational access; require a safe, matching server response.
const intakeExecutionOnly = computed(() => prequoteOnly.value && workspace.value?.intakeExecutionOnly === true
  && workspace.value?.financialEffect === false && workspace.value?.wagesAvailable === false
  && String(workspace.value?.profile?.workOrderId) === workOrderId.value);
const operationalTabsAvailable = computed(() => !prequoteOnly.value || intakeExecutionOnly.value);
const intakeAllowedTabs = computed(() => intakeExecutionOnly.value
  ? ['documents', 'confirmation', 'execution', 'completion', 'audit'] : ['documents', 'audit']);
const displayedOdometerKm = computed(() => prequoteOnly.value
  ? workspace.value?.intakeSnapshot?.odometerKm ?? null : workspace.value?.vehicle?.odometerKm ?? null);
const prequoteLocked = ref(false);
const firstVisitLocked = ref(false);
const captureWorkspace = ref<unknown>(null);
const workspaceLoadError = ref('');
// Owner proposal API persists only a distinct unverified document, never a formal
// repair quote. Drop unsaved page input when
// the actor, root, loading/error state or admitted profile changes.
const ownerQuoteRehearsalContext = computed(() => {
  const actor = authenticatedUserIdentity?.value;
  if (!ownerIntakeEnabled || authorityOnly.value || !formalActorIdentityBound.value
    || actor?.identitySource !== 'trusted_proxy' || !Number.isSafeInteger(actor?.id) || actor.id <= 0
    || loading.value || workspaceLoadError.value || workspace.value?.profile !== null
    || workspace.value?.prequoteOnly !== true || workspace.value?.financialEffect !== false
    || workspace.value?.wagesAvailable !== false || String(workspace.value?.workOrder?.id) !== workOrderId.value) return '';
  return JSON.stringify([workOrderId.value, actor.id, actor.username]);
});
let workspaceLoadSequence = 0;
watch(authorityOnly, () => {
  workspaceLoadSequence++;
  workspace.value = null;
  captureWorkspace.value = null;
  workspaceLoadError.value = '';
  loading.value = false;
}, { flush: 'sync' });
const vehicleOptions = ref<any[]>([]);
const attachVehicleId = ref<number>();
const scopeResolutionEvidenceRef = ref('');
const vehicleDialog = ref(false);
const knowledgeRows = ref<any[]>([]);
const actionError = ref('');
const scopeOptions = ref<any[]>([]);
const customerOptions = ref<any[]>([]);
const selectedScopeKey = ref('');

const scopeForm = reactive({
  companyRef: '',
  businessSectorRef: '',
  storeRef: '',
  customerRef: '',
});
const prequoteSelection = computed(() => ({ ...scopeForm, vehicleId: attachVehicleId.value || 0 }));
const vehicleForm = reactive({
  plateNumber: '',
  plateEvidenceRef: '',
  customerRelationshipType: 'owner' as 'owner' | 'user' | 'contact',
  customerRelationshipEvidenceRef: '',
  vin: '',
  brand: '',
  model: '',
  modelYear: undefined as number | undefined,
  engineCode: '',
  salesMarket: '',
  odometerKm: undefined as number | undefined,
});
const documentForm = reactive({
  documentType: 'intake_inspection' as RepairDocumentType,
  summary: '',
  payloadJson: '',
  sourceReferencesJson: '',
});
const confirmationForm = reactive({ channel: 'wechat', recipientMasked: '', message: '' });
const pendingConfirmation = ref<{ workOrderId: string; payload: Record<string, unknown> } | null>(null);
const taskForm = reactive({ planItemRef: '', title: '', system: '', technicianEmployeeId: undefined as number | undefined, safetyNotes: '' });
const laborForm = reactive({ taskId: undefined as number | undefined, technicianEmployeeId: undefined as number | undefined, laborCode: '', name: '', standardHours: '', actualHours: '', hourlyRate: '', quoteLineRef: '' });
const executionTaskView = ref<'mine' | 'all'>('mine');
const laborEntryForm = ref<{ $el?: HTMLElement }>();
const laborSaveNeedsReadback = ref(false);
const laborSelectionContext = ref<string | null>(null);
const executionWorkspaceCurrent = computed(() => formalActorIdentityBound.value && !authorityOnly.value
  && !loading.value && !workspaceLoadError.value && operationalTabsAvailable.value
  && String(workspace.value?.workOrder?.id) === workOrderId.value
  && String(workspace.value?.profile?.workOrderId) === workOrderId.value);
const currentExecutionEmployeeId = computed(() => {
  const employeeId = workspace.value?.actorContext?.employeeId;
  return executionWorkspaceCurrent.value && Number.isSafeInteger(employeeId) && employeeId > 0 ? employeeId as number : null;
});
// These filters are presentation only. Existing API permissions and current task assignment remain authoritative.
const executionTasks = computed<any[]>(() => executionWorkspaceCurrent.value && Array.isArray(workspace.value?.tasks)
  ? workspace.value.tasks.filter((task: any) => String(task.workOrderId) === workOrderId.value) : []);
const visibleExecutionTasks = computed(() => executionTasks.value.filter(task => executionTaskView.value === 'all'
  || (currentExecutionEmployeeId.value !== null && task.technicianEmployeeId === currentExecutionEmployeeId.value)));
const executionLaborItems = computed<any[]>(() => executionWorkspaceCurrent.value && Array.isArray(workspace.value?.laborItems)
  ? workspace.value.laborItems.filter((item: any) => String(item.workOrderId) === workOrderId.value) : []);
const visibleLaborItems = computed(() => executionLaborItems.value.filter(item => executionTaskView.value === 'all'
  || (currentExecutionEmployeeId.value !== null && item.technicianEmployeeId === currentExecutionEmployeeId.value)));
const selectableLaborTasks = computed(() => visibleExecutionTasks.value.filter(isCurrentExecutionTask));
const selectedLaborTask = computed(() => executionTasks.value.find(task => task.id === laborForm.taskId));
const selectedTaskLaborQuoteLines = computed(() => taskLaborQuoteLines(selectedLaborTask.value));
const laborEntryHint = computed(() => {
  if (laborSaveNeedsReadback.value) return '保存结果待核对，请先刷新回读，不要更换编码重试。';
  const task = selectedLaborTask.value;
  if (!task) return '先从本人任务卡片选择“记录工时”；没有派工时请联系主管。';
  if (!isCurrentExecutionTask(task) || laborSelectionContext.value !== taskContext(task)) return '任务、指派员工或方案/报价版本已变化，请刷新后重新选择任务。';
  if (!selectedTaskLaborQuoteLines.value.length) return '当前任务没有可关联的已确认工时报价行，请主管核实，不能自行借用其他项目。';
  if (executionLaborItems.value.some(item => item.taskId === task.id && item.laborCode === laborForm.laborCode.trim())) return '本任务的该工时编码已经保存，请核对下方已存记录，不要重复提交。';
  return '填写实际工作事实后保存；多条匹配报价须本人选择。保存并回读成功后，再完工留证。';
});
const laborEntryReady = computed(() => {
  const task = selectedLaborTask.value;
  const decimal = (value: string, positive = false) => /^\d+(?:\.\d{1,2})?$/.test(value.trim())
    && Number.isFinite(Number(value)) && (positive ? Number(value) > 0 : Number(value) >= 0);
  return !laborSaveNeedsReadback.value && !!task && isCurrentExecutionTask(task)
    && laborSelectionContext.value === taskContext(task) && laborForm.technicianEmployeeId === task.technicianEmployeeId
    && selectedTaskLaborQuoteLines.value.filter(line => line.lineRef === laborForm.quoteLineRef).length === 1
    && !!laborForm.laborCode.trim() && laborForm.laborCode.trim().length <= 64
    && !!laborForm.name.trim() && laborForm.name.trim().length <= 160
    && decimal(laborForm.standardHours, true) && decimal(laborForm.actualHours) && decimal(laborForm.hourlyRate)
    && !executionLaborItems.value.some(item => item.taskId === task.id && item.laborCode === laborForm.laborCode.trim());
});
const partForm = reactive({ taskId: undefined as number | undefined, workOrderMaterialId: undefined as number | undefined, quoteLineRef: '', usageNote: '' });
const qualityForm = reactive({ inspectedByEmployeeId: undefined as number | undefined, result: 'passed' as 'passed' | 'failed', checklistJson: '[\n  {"item":"施工项目复核","passed":true},\n  {"item":"故障复现检查","passed":true}\n]', roadTestResult: '', reworkReason: '', reworkPlanItemRefs: [] as string[] });
const deliveryForm = reactive({ deliveredByEmployeeId: undefined as number | undefined, deliveredAt: new Date(), finalOdometerKm: undefined as number | undefined, repairSummary: '', unresolvedRemindersText: '', customerAckEvidenceRef: '', checklistJson: '[\n  {"item":"旧件/随车物品交接","done":true},\n  {"item":"保修与注意事项说明","done":true}\n]' });
const warrantyForm = reactive({ warrantyType: 'coverage' as 'coverage' | 'claim', startsAt: new Date(), endsAt: undefined as Date | undefined, coverageJson: '{\n  "parts": [],\n  "labor": [],\n  "exclusions": []\n}', claimNote: '' });
const aiForm = reactive({ draftType: 'fault_assessment', symptoms: '', customerQuestion: '', searchTerms: '' });

const tabGuides = [
  { name: 'documents', label: '检查 / 方案 / 报价', help: '建立检查、诊断、方案、报价和客户解释的版本链。' },
  { name: 'confirmation', label: '客户确认', help: '确认同一套方案、报价和解释，不代替客户决定。' },
  { name: 'execution', label: '维修施工', help: '把确认项目拆成任务，并关联工时与既有工单材料。' },
  { name: 'completion', label: '质检 / 交车 / 售后', help: '核对返工、收款门禁、交车证据、保修和售后。' },
  { name: 'ai', label: 'AI 维修助手', help: '看故障判断、方案、解释、一致性、案例和视频草稿。' },
  { name: 'procurement', label: 'VIN / 配件采购', help: '核对 VIN、OE/EPC、询价比价、审批、付款、物流和安装。' },
  { name: 'audit', label: '审计边界', help: '确认库存、资金、审批仍由总公司既有中心负责。' },
] as const;
const visibleTabGuides = computed(() => prequoteOnly.value ? tabGuides.filter((item) => intakeAllowedTabs.value.includes(item.name)) : tabGuides);
watch([prequoteOnly, intakeAllowedTabs], () => { if (prequoteOnly.value && !intakeAllowedTabs.value.includes(activeTab.value)) activeTab.value = 'documents'; });

const lifecycleStep = computed(() => {
  const status = workspace.value?.profile?.lifecycleStatus;
  if (['intake_draft', 'intake_checked'].includes(status)) return 1;
  if (['diagnosed', 'quote_pending_customer'].includes(status)) return 2;
  if (status === 'authorized') return 3;
  if (['repair_scheduled', 'repairing', 'rework_required'].includes(status)) return 4;
  if (['qc_pending', 'ready_for_delivery'].includes(status)) return 5;
  if (['delivered', 'after_sales', 'closed'].includes(status)) return 6;
  return 0;
});
const workflowAdvice = computed(() => {
  if (prequoteOnly.value && !intakeExecutionOnly.value) return { title: '原工单报价前资料流程', description: '依次录入检查、诊断、方案和报价，由另一位有权人员审核。客户确认、施工、收款和工资仍关闭。', tab: 'documents', tabLabel: '检查 / 方案 / 报价' };
  const status = workspace.value?.profile?.lifecycleStatus;
  if (intakeExecutionOnly.value && ['qc_pending', 'ready_for_delivery'].includes(status)) return {
    title: status === 'ready_for_delivery' ? '本单已通过独立质检，尚未结算' : '施工完成，请由非施工人员质检',
    description: '工时可作为后续统计的原始记录，不是应发工资；未收款、未交车结算。', tab: 'completion', tabLabel: '独立质检（未结算）',
  };
  if (['intake_draft', 'intake_checked', 'diagnosed'].includes(status)) {
    return {
      title: '先把检查、诊断、维修方案、报价和客户解释做成一致的版本',
      description: '从接车事实开始，依次保存并人工审核；方案项目、报价行和客户解释必须引用同一版本。',
      tab: 'documents',
      tabLabel: '检查 / 方案 / 报价',
    };
  }
  if (status === 'quote_pending_customer') {
    return {
      title: '方案与报价已准备，下一步核对客户确认',
      description: '确认请求只能绑定当前方案、报价和解释；“请求确认”不等于替客户确认。',
      tab: 'confirmation',
      tabLabel: '客户确认',
    };
  }
  if (['authorized', 'repair_scheduled', 'repairing', 'rework_required'].includes(status)) {
    return {
      title: '客户已确认，下一步按方案项目安排施工并留证',
      description: '每个任务都要绑定已确认的方案项目，工时和配件要绑定相应报价行；返工必须关联失败质检。',
      tab: 'execution',
      tabLabel: '维修施工',
    };
  }
  if (['qc_pending', 'ready_for_delivery', 'delivered', 'after_sales', 'closed'].includes(status)) {
    return {
      title: '施工阶段已完成，下一步核对质检、交车、保修和售后',
      description: '交车前必须通过质检和已确认收款门禁；交车后再记录保修、提醒和售后。',
      tab: 'completion',
      tabLabel: '质检 / 交车 / 售后',
    };
  }
  return {
    title: '先查看当前状态，再从检查与方案开始',
    description: '如果当前状态与预期不一致，先不要强行推进，记录页面和状态后集中反馈。',
    tab: 'documents',
    tabLabel: '检查 / 方案 / 报价',
  };
});
const confirmationReady = computed(() =>
  Boolean(
    workspace.value?.profile?.activePlanVersion &&
      workspace.value?.profile?.activeQuoteVersion &&
      workspace.value?.profile?.activeExplanationVersion &&
      confirmationForm.recipientMasked,
  ),
);
const canSuperviseLifecycle = computed(
  () => !prequoteOnly.value && formalActorIdentityBound.value && hasAnyRole(['admin']),
);
const latestAiDraft = computed(() => workspace.value?.aiDrafts?.[0] ?? null);
const latestAiOutput = computed(() => {
  if (latestAiDraft.value && ['stale', 'blocked', 'superseded'].includes(latestAiDraft.value.status)) {
    return '草稿依赖已失效，旧输出已隐藏。请重新生成并人工复核。';
  }
  const output = latestAiDraft.value?.outputSnapshot;
  return output ? JSON.stringify(output, null, 2) : '尚未生成 AI 草稿';
});
const activeQuoteLines = computed<any[]>(() => {
  const version = workspace.value?.profile?.activeQuoteVersion;
  const quote = workspace.value?.documents?.find(
    (item: any) => item.documentType === 'quote' && item.version === version,
  );
  return Array.isArray(quote?.payload?.lineItems) ? quote.payload.lineItems : [];
});
const activePlanItems = computed<any[]>(() => {
  const version = workspace.value?.profile?.activePlanVersion;
  const plan = workspace.value?.documents?.find(
    (item: any) => item.documentType === 'repair_plan' && item.version === version,
  );
  const quotedRefs = new Set(
    activeQuoteLines.value.map((line: any) => line?.planItemRef).filter(Boolean),
  );
  return Array.isArray(plan?.payload?.items)
    ? plan.payload.items.filter((item: any) => quotedRefs.has(item?.itemRef))
    : [];
});
const pendingReworkInspection = computed(() => {
  const latest = workspace.value?.qualityInspections?.[0];
  return latest?.result === 'failed' ? latest : null;
});
const laborQuoteLines = computed(() => activeQuoteLines.value.filter((item) => item.category === 'labor'));
const partQuoteLines = computed(() => activeQuoteLines.value.filter((item) => item.category === 'part'));

watch(
  () => route.query.tab,
  (tab) => {
    openWorkbenchTab(typeof tab === 'string' ? tab : 'documents');
  },
);

watch(activeTab, (tab) => {
  if (!ownerRepairAcceptanceEnabled || route.query.tab === tab) return;
  router.replace({ query: { ...route.query, tab } });
});

function normalizeTab(tab: unknown) {
  return typeof tab === 'string' && allowedTabs.includes(tab) ? tab : 'documents';
}

function openWorkbenchTab(tab: string) {
  activeTab.value = prequoteOnly.value && !intakeAllowedTabs.value.includes(tab) ? 'documents' : normalizeTab(tab);
}

async function loadWorkspace() {
  if (authorityOnly.value) return;
  const requestSequence = ++workspaceLoadSequence;
  const requestedWorkOrderId = workOrderId.value;
  const canResolveLaborReadback = !submitting.value;
  loading.value = true;
  // Keep the quoted workbench mounted for procurement retries; v-show and
  // executionWorkspaceCurrent hide stale state and reject actions during refresh.
  if (prequoteOnly.value) workspace.value = null;
  captureWorkspace.value = null;
  workspaceLoadError.value = '';
  try {
    const { data } = await getRepairWorkspace(requestedWorkOrderId);
    if (authorityOnly.value || requestSequence !== workspaceLoadSequence || requestedWorkOrderId !== workOrderId.value) return;
    if (String(data?.data?.workOrder?.id) !== requestedWorkOrderId ||
      (data?.data?.profile !== null && String(data?.data?.profile?.workOrderId) !== requestedWorkOrderId)) {
      workspaceLoadError.value = '返回数据与当前工单不一致，已隐藏旧数据；请刷新后重试。';
      return;
    }
    workspace.value = data.data;
    captureWorkspace.value = data.data;
    if (canResolveLaborReadback && !submitting.value) laborSaveNeedsReadback.value = false;
    if (workspace.value.profile) {
      qualityForm.inspectedByEmployeeId = workspace.value.actorContext?.employeeId;
      deliveryForm.deliveredByEmployeeId = workspace.value.actorContext?.employeeId;
      deliveryForm.finalOdometerKm = workspace.value.vehicle?.odometerKm ?? undefined;
      if (workspace.value.delivery?.deliveredAt) {
        const deliveredAt = new Date(workspace.value.delivery.deliveredAt);
        if (warrantyForm.startsAt < deliveredAt) warrantyForm.startsAt = deliveredAt;
      }
      applyDocumentTemplate();
    }
  } catch {
    if (requestSequence === workspaceLoadSequence && requestedWorkOrderId === workOrderId.value) {
      captureWorkspace.value = null;
      workspaceLoadError.value = '修理工作区加载失败，已隐藏旧数据；请刷新后重试。';
    }
  } finally {
    if (requestSequence === workspaceLoadSequence) loading.value = false;
  }
}

function requireScope() {
  if (!scopeForm.companyRef || !scopeForm.storeRef || !scopeForm.businessSectorRef || !scopeForm.customerRef) {
    throw new Error('请完整填写公司、业务板块、门店和客户引用');
  }
  return {
    companyRef: scopeForm.companyRef,
    businessSectorRef: scopeForm.businessSectorRef,
    storeRef: scopeForm.storeRef,
    customerRef: scopeForm.customerRef.trim(),
  };
}

function scopeKey(item: any) {
  return `${item.companyRef}|${item.businessSectorRef}|${item.storeRef}`;
}

async function loadAvailableScopes() {
  const { data } = await getAvailableBusinessScopes();
  scopeOptions.value = data.data;
  if (scopeOptions.value.length === 1) {
    selectedScopeKey.value = scopeKey(scopeOptions.value[0]);
    await handleScopeSelection(selectedScopeKey.value);
  }
}

async function handleScopeSelection(key: string) {
  const selected = scopeOptions.value.find((item) => scopeKey(item) === key);
  scopeForm.companyRef = selected?.companyRef || '';
  scopeForm.businessSectorRef = selected?.businessSectorRef || '';
  scopeForm.storeRef = selected?.storeRef || '';
  scopeForm.customerRef = '';
  if (selected?.actorEmployeeId) {
    qualityForm.inspectedByEmployeeId = selected.actorEmployeeId;
    deliveryForm.deliveredByEmployeeId = selected.actorEmployeeId;
  }
  customerOptions.value = [];
  vehicleOptions.value = [];
  attachVehicleId.value = undefined;
  scopeResolutionEvidenceRef.value = '';
  if (!selected) return;
  const { data } = await getBusinessCustomers({
    companyRef: scopeForm.companyRef,
    businessSectorRef: scopeForm.businessSectorRef,
    storeRef: scopeForm.storeRef,
  });
  customerOptions.value = data.data;
}

async function loadVehicles() {
  try {
    const { data } = await getRepairVehicles(requireScope());
    vehicleOptions.value = data.data;
  } catch (error: any) {
    if (!error?.response) ElMessage.error(error.message);
  }
}

async function handleCreateVehicle() {
  await runMutation(async () => {
    const { data } = await createRepairVehicle({ ...requireScope(), ...vehicleForm });
    attachVehicleId.value = data.data.id;
    vehicleDialog.value = false;
    await loadVehicles();
    ElMessage.success('车辆档案已创建');
  });
}

async function handleAttach() {
  if (!attachVehicleId.value) return;
  await runMutation(async () => {
    await attachRepairWorkOrder(workOrderId.value, {
      ...requireScope(),
      vehicleId: attachVehicleId.value!,
      scopeResolutionEvidenceRef: scopeResolutionEvidenceRef.value.trim(),
    });
    ElMessage.success('汽修档案已建立');
    await loadWorkspace();
  });
}

function applyDocumentTemplate() {
  const profile = workspace.value?.profile;
  const plan = findDocument('repair_plan', profile?.activePlanVersion);
  const quote = findDocument('quote', profile?.activeQuoteVersion);
  const firstPlanItemRef = Array.isArray(plan?.payload?.items)
    ? plan.payload.items.find((item: any) => item?.itemRef)?.itemRef
    : null;
  const quoteLineRefs = Array.isArray(quote?.payload?.lineItems)
    ? quote.payload.lineItems.map((item: any) => item?.lineRef).filter(Boolean)
    : [];
  const templates: Record<RepairDocumentType, Record<string, unknown>> = {
    intake_inspection: { customerSymptoms: '', checklist: [{ item: '接车外观与客户诉求复核', result: 'needs_input', evidenceRef: '' }], odometerKm: displayedOdometerKm.value, photos: [] },
    diagnosis: { inspectionVersion: latestApprovedVersion('intake_inspection'), findings: [{ item: '待填写检测事实' }], evidence: [{ type: 'measurement', ref: '待填写' }], confidence: 'needs_review', safetyRisks: [] },
    repair_plan: { diagnosisVersion: latestApprovedVersion('diagnosis'), items: [{ itemRef: 'plan-item-1', action: '', expectedLaborHours: null, materialNeeds: [] }], risks: [], alternatives: [] },
    quote: { planVersion: profile?.activePlanVersion ?? null, lineItems: [{ lineRef: 'quote-line-1', category: 'labor', planItemRef: firstPlanItemRef, name: '', amount: null }], laborTotal: null, partsTotal: null, otherTotal: null, total: null, currency: 'CNY' },
    customer_explanation: { planVersion: profile?.activePlanVersion ?? null, quoteVersion: profile?.activeQuoteVersion ?? null, quoteTotal: quote?.payload?.total ?? null, includedLineRefs: quoteLineRefs, explanation: '', exclusions: [], warrantySummary: '' },
  };
  documentForm.payloadJson = JSON.stringify(templates[documentForm.documentType], null, 2);
  documentForm.summary = '';
  documentForm.sourceReferencesJson = '';
}

function taskContext(task: any) {
  return JSON.stringify([workOrderId.value, currentExecutionEmployeeId.value, task.id, task.version,
    task.technicianEmployeeId, task.planVersion, task.planItemRef,
    workspace.value?.profile?.activePlanVersion, workspace.value?.profile?.activeQuoteVersion]);
}

function applyFirstVisitSelection(value: { selection: any; evidenceRef: string }) {
  const s = value.selection;
  if (s.companyRef !== scopeForm.companyRef || s.storeRef !== scopeForm.storeRef
    || s.businessSectorRef !== scopeForm.businessSectorRef || !Number.isSafeInteger(s.vehicleId) || s.vehicleId < 1) return;
  scopeForm.customerRef = s.customerRef;
  customerOptions.value = [{ customerRef: s.customerRef, displayName: '原单已核实客户' }];
  attachVehicleId.value = s.vehicleId;
  vehicleOptions.value = [{ id: s.vehicleId, plateNumber: '原单已核实车辆' }];
  scopeResolutionEvidenceRef.value = value.evidenceRef;
}

function isCurrentExecutionTask(task: any) {
  const current = task && executionTasks.value.find(item => item.id === task.id);
  return !!current && currentExecutionEmployeeId.value !== null && current.version === task.version
    && String(task.workOrderId) === workOrderId.value && current.planItemRef === task.planItemRef
    && current.technicianEmployeeId === task.technicianEmployeeId && current.planVersion === task.planVersion
    && current.planVersion === workspace.value?.profile?.activePlanVersion && current.status !== 'cancelled'
    && ['authorized', 'repair_scheduled', 'repairing', 'rework_required'].includes(workspace.value?.profile?.lifecycleStatus);
}

function taskLaborQuoteLines(task: any): any[] {
  if (!task || !executionWorkspaceCurrent.value || task.planVersion !== workspace.value?.profile?.activePlanVersion) return [];
  const quote = findDocument('quote', workspace.value?.profile?.activeQuoteVersion);
  if (quote?.status !== 'authorized' || !Array.isArray(quote.payload?.lineItems)) return [];
  return quote.payload.lineItems.filter((line: any) => line.category === 'labor'
    && (String(line.planItemRef ?? '').trim() === task.planItemRef
      // Ordinary repair already accepts approved fee-basis lines. Preserve that
      // explicit choice, but never use it to bypass intake's exact task mapping.
      || (!prequoteOnly.value && !String(line.planItemRef ?? '').trim()
        && typeof line.approvedFeeBasisRef === 'string' && !!line.approvedFeeBasisRef.trim())));
}

function taskLaborRecords(taskId: number) {
  return executionLaborItems.value.filter(item => item.taskId === taskId);
}

function taskStatusLabel(status: string) {
  return ({ pending: '待开始', in_progress: '施工中', blocked: '已阻塞', completed: '已完工', cancelled: '已取消' } as Record<string, string>)[status] || status;
}

function resetLaborEntry() {
  Object.assign(laborForm, { taskId: undefined, technicianEmployeeId: undefined, laborCode: '', name: '',
    standardHours: '', actualHours: '', hourlyRate: '', quoteLineRef: '' });
  laborSelectionContext.value = null;
}

function handleLaborTaskSelection(taskId: number, scrollToEntry = false) {
  if (submitting.value || laborSaveNeedsReadback.value) return;
  resetLaborEntry();
  const task = selectableLaborTasks.value.find(item => item.id === taskId);
  if (!task) return;
  Object.assign(laborForm, { taskId: task.id, technicianEmployeeId: task.technicianEmployeeId, name: task.title });
  laborSelectionContext.value = taskContext(task);
  const onlyLine = selectedTaskLaborQuoteLines.value.length === 1 ? selectedTaskLaborQuoteLines.value[0] : null;
  if (onlyLine && String(onlyLine.planItemRef ?? '').trim() === task.planItemRef) laborForm.quoteLineRef = onlyLine.lineRef;
  if (scrollToEntry) laborEntryForm.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function handleCreateDocument() {
  await runMutation(async () => {
    const payload = parseObject(documentForm.payloadJson, '结构化内容');
    const sourceReferences = documentForm.sourceReferencesJson.trim()
      ? parseArray(documentForm.sourceReferencesJson, '资料引用')
      : undefined;
    await createRepairDocument(workOrderId.value, {
      documentType: documentForm.documentType,
      expectedProfileVersion: workspace.value.profile.version,
      summary: documentForm.summary,
      payload,
      sourceReferences,
      generatedBy: 'human',
    });
    ElMessage.success('新版本已保存，需人工审核后才能推进流程');
    await loadWorkspace();
  });
}

async function handleReviewDocument(row: any, decision: 'approved' | 'rejected') {
  const { value: reviewNote } = await ElMessageBox.prompt(
    decision === 'approved' ? '填写审核依据/说明' : '填写驳回原因',
    decision === 'approved' ? '人工审核通过' : '人工审核驳回',
    { inputValidator: (value) => Boolean(value?.trim()) || '审核说明不能为空' },
  );
  await runMutation(async () => {
    await reviewRepairDocument(workOrderId.value, row.id, {
      expectedProfileVersion: workspace.value.profile.version,
      decision,
      reviewNote,
    });
    ElMessage.success(decision === 'approved' ? '版本已人工审核通过' : '版本已驳回');
    await loadWorkspace();
  });
}

async function handleRequestConfirmation() {
  await runMutation(async () => {
    const profile = workspace.value.profile;
    if (!pendingConfirmation.value || pendingConfirmation.value.workOrderId !== workOrderId.value) pendingConfirmation.value = { workOrderId: workOrderId.value, payload: {
      requestIdempotencyKey: createKey('confirmation'),
      expectedProfileVersion: profile.version,
      planVersion: profile.activePlanVersion,
      quoteVersion: profile.activeQuoteVersion,
      explanationVersion: profile.activeExplanationVersion,
      ...confirmationForm,
    } };
    await createRepairConfirmationRequest(workOrderId.value, pendingConfirmation.value.payload);
    pendingConfirmation.value = null;
    ElMessage.success('已生成确认请求，尚未代表客户确认');
    await loadWorkspace();
  });
}

async function handleDecision(row: any, decision: 'confirmed' | 'rejected') {
  const { value: evidenceRef } = await ElMessageBox.prompt('填写客户决定的证据引用（不得粘贴完整敏感原文）', '记录客户决定', {
    inputValidator: (value) => Boolean(value?.trim()) || '证据引用不能为空',
  });
  await runMutation(async () => {
    await recordRepairConfirmationDecision(workOrderId.value, row.id, {
      expectedVersion: row.version,
      decision,
      evidenceRef,
    });
    ElMessage.success('客户决定已记录');
    await loadWorkspace();
  });
}

async function handleLifecycleTransition(
  targetStatus: 'suspended' | 'cancelled' | 'closed' | 'resume',
) {
  const labels = {
    suspended: '暂停',
    cancelled: '取消',
    closed: '关闭',
    resume: '恢复',
  };
  const { value: reason } = await ElMessageBox.prompt(
    `填写${labels[targetStatus]}原因；该动作将记录正式人员和当前版本。`,
    `${labels[targetStatus]}汽修工单`,
    { inputValidator: (value) => Boolean(value?.trim()) || '原因不能为空' },
  );
  await runMutation(async () => {
    await transitionRepairLifecycle(workOrderId.value, {
      expectedProfileVersion: workspace.value.profile.version,
      targetStatus,
      reason: reason.trim(),
    });
    ElMessage.success(`汽修工单已${labels[targetStatus]}`);
    await loadWorkspace();
  });
}

async function handleCreateTask() {
  await runMutation(async () => {
    await createRepairTask(workOrderId.value, {
      expectedProfileVersion: workspace.value.profile.version,
      planVersion: workspace.value.profile.activePlanVersion,
      reworkOfInspectionId: pendingReworkInspection.value?.id,
      ...taskForm,
    });
    taskForm.planItemRef = '';
    taskForm.title = '';
    ElMessage.success('维修任务已创建');
    await loadWorkspace();
  });
}

async function handleTaskStatus(row: any, status: string) {
  const requestedOrder = workOrderId.value;
  const requestedContext = taskContext(row);
  const requestedStatus = row.status;
  await runMutation(async () => {
    const transitions: Record<string, string[]> = { pending: ['in_progress'], blocked: ['in_progress'], in_progress: ['blocked', 'completed'] };
    if (!isCurrentExecutionTask(row) || !transitions[requestedStatus]?.includes(status)) throw new Error('任务状态已变化，请刷新后重试。');
    let completionEvidence: Record<string, unknown> | undefined;
    if (status === 'completed') {
      if (laborSaveNeedsReadback.value) throw new Error('请先刷新核对工时保存结果，再完工留证。');
      const laborLines = taskLaborQuoteLines(row).filter(line => String(line.planItemRef ?? '').trim() === row.planItemRef);
      if (laborLines.length && !taskLaborRecords(row.id).some(item => item.technicianEmployeeId === row.technicianEmployeeId
        && laborLines.some(line => line.lineRef === item.quoteLineRef))) {
        throw new Error('该任务含工时报价，请先保存并回读实际工时，再完工留证；进入质检后不能在此补记。');
      }
      try {
        const { value } = await ElMessageBox.prompt('填写施工证据摘要或附件引用（请勿填写证件、电话或 VIN）', '任务完工留证', {
          inputValidator: (input) => Boolean(input?.trim()) || '完工证据不能为空',
        });
        completionEvidence = { summary: value.trim() };
      } catch (error) {
        if (error === 'cancel' || error === 'close') return;
        throw error;
      }
    }
    // The dialog is asynchronous. Do not apply an old decision to another root, actor, assignment or refreshed task.
    if (requestedOrder !== workOrderId.value || !isCurrentExecutionTask(row)
      || requestedContext !== taskContext(row) || requestedStatus !== executionTasks.value.find(item => item.id === row.id)?.status) {
      throw new Error('工单、员工或任务版本已变化，本次没有提交；请刷新后重新操作。');
    }
    await updateRepairTaskStatus(requestedOrder, row.id, {
      expectedVersion: row.version,
      status,
      completionEvidence,
    });
    if (requestedOrder !== workOrderId.value || requestedContext !== taskContext(row)) return;
    ElMessage.success('任务状态已更新');
    await loadWorkspace();
  });
}

async function handleCreateLabor() {
  await runMutation(async () => {
    if (!laborEntryReady.value) throw new Error(laborEntryHint.value + ' 请核对员工、报价行、编码及实际工时/费率。');
    const requestedOrder = workOrderId.value;
    const requestedContext = laborSelectionContext.value;
    const payload = { ...laborForm, laborCode: laborForm.laborCode.trim(), name: laborForm.name.trim(),
      standardHours: laborForm.standardHours.trim(), actualHours: laborForm.actualHours.trim(), hourlyRate: laborForm.hourlyRate.trim() };
    laborSaveNeedsReadback.value = true;
    await createRepairLaborItem(requestedOrder, payload);
    if (requestedOrder !== workOrderId.value || !selectedLaborTask.value
      || requestedContext !== taskContext(selectedLaborTask.value)) return;
    laborSaveNeedsReadback.value = false;
    resetLaborEntry();
    ElMessage.success('工时已保存，正在回读原单；这不是工资确认。');
    await loadWorkspace();
  });
}

async function handleCreatePartLink() {
  await runMutation(async () => {
    await createRepairPartLink(workOrderId.value, partForm);
    ElMessage.success('已引用工单材料，没有执行库存出库');
    await loadWorkspace();
  });
}

async function handleQuality() {
  await runMutation(async () => {
    await createRepairQualityInspection(workOrderId.value, {
      expectedProfileVersion: workspace.value.profile.version,
      result: qualityForm.result,
      checklist: parseArray(qualityForm.checklistJson, '质检表'),
      roadTestResult: qualityForm.roadTestResult,
      reworkReason: qualityForm.reworkReason,
      reworkPlanItemRefs: qualityForm.result === 'failed'
        ? qualityForm.reworkPlanItemRefs
        : undefined,
      inspectedByEmployeeId: qualityForm.inspectedByEmployeeId,
    });
    ElMessage.success('质检结果已记录');
    await loadWorkspace();
  });
}

async function handleDelivery() {
  await runMutation(async () => {
    await createRepairDelivery(workOrderId.value, {
      expectedProfileVersion: workspace.value.profile.version,
      checklist: parseArray(deliveryForm.checklistJson, '交车清单'),
      customerAckEvidenceRef: deliveryForm.customerAckEvidenceRef,
      finalOdometerKm: deliveryForm.finalOdometerKm,
      repairSummary: deliveryForm.repairSummary,
      unresolvedReminders: deliveryForm.unresolvedRemindersText
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
      deliveredByEmployeeId: deliveryForm.deliveredByEmployeeId,
      deliveredAt: new Date(deliveryForm.deliveredAt).toISOString(),
    });
    ElMessage.success('交车记录已保存');
    await loadWorkspace();
  });
}

async function handleWarranty() {
  await runMutation(async () => {
    await createRepairWarranty(workOrderId.value, {
      expectedProfileVersion: workspace.value.profile.version,
      warrantyType: warrantyForm.warrantyType,
      coverageSnapshot: parseObject(warrantyForm.coverageJson, '保修覆盖快照'),
      startsAt: new Date(warrantyForm.startsAt).toISOString(),
      endsAt: warrantyForm.endsAt ? new Date(warrantyForm.endsAt).toISOString() : undefined,
      claimNote: warrantyForm.claimNote,
    });
    ElMessage.success('保修/售后记录已保存');
    await loadWorkspace();
  });
}

async function handleAiDraft() {
  await runMutation(async () => {
    await createRepairAiDraft(workOrderId.value, {
      requestIdempotencyKey: createKey('ai-draft'),
      expectedProfileVersion: workspace.value.profile.version,
      draftType: aiForm.draftType,
      symptoms: aiForm.symptoms,
      customerQuestion: aiForm.customerQuestion,
      searchTerms: aiForm.searchTerms.split(/\s+/).filter(Boolean),
    });
    ElMessage.success('AI 草稿已生成，必须由维修人员复核');
    await Promise.all([loadWorkspace(), loadKnowledge()]);
  });
}

async function loadKnowledge() {
  const { data } = await getRepairKnowledge({ query: aiForm.searchTerms || aiForm.symptoms });
  knowledgeRows.value = data.data;
}

async function runMutation(action: () => Promise<void>) {
  if (submitting.value) return;
  if (!formalActorIdentityBound.value || loading.value || workspaceLoadError.value
    || String(workspace.value?.workOrder?.id) !== workOrderId.value) {
    actionError.value = '请先使用正式身份重新读取当前工单，再提交操作。';
    return;
  }
  submitting.value = true;
  actionError.value = '';
  try {
    await action();
  } catch (error: any) {
    actionError.value = error?.response?.data?.message || error?.message || '操作失败';
    if (!error?.response) ElMessage.error(actionError.value);
  } finally {
    submitting.value = false;
  }
}

function parseObject(value: string, label: string) {
  const parsed = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(`${label}必须是 JSON 对象`);
  return parsed as Record<string, unknown>;
}

function parseArray(value: string, label: string) {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error(`${label}必须是 JSON 数组`);
  return parsed as Array<Record<string, unknown>>;
}

function latestApprovedVersion(type: string) {
  return workspace.value?.documents?.find(
    (item: any) => item.documentType === type && ['approved', 'authorized'].includes(item.status),
  )?.version ?? null;
}

function findDocument(type: string, version?: number | null) {
  if (!version) return null;
  return workspace.value?.documents?.find(
    (item: any) => item.documentType === type && item.version === version,
  ) ?? null;
}

function createKey(prefix: string) {
  return `${prefix}:${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

function lifecycleLabel(status: string) {
  if (intakeExecutionOnly.value && status === 'ready_for_delivery') return '质检通过（未结算）';
  const labels: Record<string, string> = {
    intake_draft: '接车草稿', intake_checked: '接车检查完成', diagnosed: '已诊断', quote_pending_customer: '待客户确认',
    authorized: '客户已授权', repair_scheduled: '已排施工', repairing: '维修中', qc_pending: '待质检',
    rework_required: '返工', ready_for_delivery: '待交车', delivered: '已交车', after_sales: '售后处理中', closed: '已关闭',
    cancelled: '已取消', suspended: '已暂停',
  };
  return labels[status] || status;
}

function documentLabel(type: string) {
  return { intake_inspection: '接车检查', diagnosis: '诊断记录', repair_plan: '维修方案', quote: '报价', customer_explanation: '客户解释' }[type] || type;
}

onMounted(async () => {
  if (authorityOnly.value) return;
  applyDocumentTemplate();
  await loadWorkspace();
  if (workspace.value?.profile === null && String(workspace.value?.workOrder?.id) === workOrderId.value) {
    await loadAvailableScopes();
  }
});
</script>

<style scoped>
.page-stack { display: grid; gap: 16px; }
.toolbar, .actions, .inline-fill { display: flex; gap: 12px; align-items: center; }
.toolbar { justify-content: space-between; }
.title { font-size: 17px; font-weight: 650; }
.subtitle, .muted { color: #6b7280; font-size: 12px; margin-top: 4px; }
.boundary-alert { margin-top: 10px; }
.lifecycle-controls { margin-top: 16px; flex-wrap: wrap; }
.setup-form { max-width: 820px; }
.inline-fill { width: 100%; }
.status-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 22px; }
.status-label { color: #6b7280; font-size: 12px; margin-bottom: 6px; }
.lifecycle { margin: 18px 0 24px; }
.two-column { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(380px, 1fr); gap: 24px; align-items: start; }
.three-column { display: grid; grid-template-columns: repeat(3, minmax(300px, 1fr)); gap: 18px; align-items: start; }
.stacked-forms { display: grid; gap: 16px; }
.execution-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 16px 0; }
.execution-task-list { display: grid; gap: 12px; margin-bottom: 24px; }
.execution-task-card { border: 1px solid #dfe7e3; border-radius: 10px; padding: 14px; min-width: 0; }
.execution-task-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; overflow-wrap: anywhere; }
.execution-task-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.execution-task-actions :deep(.el-button) { margin-left: 0; min-height: 40px; }
.labor-entry-form { border-color: #90c5b1; }
.labor-entry-form :deep(.el-select) { width: 100%; }
.labor-entry-form .muted { line-height: 1.65; margin-bottom: 14px; }
.editor-form { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; background: #fafafa; }
.editor-form h3, h3 { margin: 0 0 14px; font-size: 15px; }
.code-input :deep(textarea), .json-panel { font-family: Consolas, 'Courier New', monospace; }
.json-panel { max-height: 520px; overflow: auto; padding: 14px; border-radius: 8px; background: #111827; color: #e5e7eb; white-space: pre-wrap; word-break: break-word; font-size: 12px; }
.workbench-guide-card { border-color: #cfe3d8; }
.workbench-next { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.workbench-guide-label { color: #b7791f; font-size: 12px; font-weight: 750; letter-spacing: 0.1em; }
.workbench-next h3 { margin: 5px 0 0; color: #173f31; font-size: 17px; }
.workbench-next p { margin: 6px 0 0; color: #52635d; line-height: 1.65; }
.workbench-guide-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.tab-guide-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; margin-top: 16px; }
.tab-guide-button { display: grid; gap: 5px; min-height: 82px; padding: 11px 12px; text-align: left; border: 1px solid #dfe7e3; border-radius: 9px; color: #31443d; background: #f8faf9; cursor: pointer; }
.tab-guide-button:hover, .tab-guide-button.active { border-color: #2f855a; background: #edf8f2; }
.tab-guide-button strong { font-size: 13px; }
.tab-guide-button span { color: #66756f; font-size: 12px; line-height: 1.5; }
@media (max-width: 1180px) { .two-column, .three-column { grid-template-columns: 1fr; } .status-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 1180px) { .tab-guide-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) { .workbench-next { align-items: flex-start; flex-direction: column; } .workbench-guide-actions { justify-content: flex-start; } .tab-guide-list { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .execution-task-actions :deep(.el-button) { flex: 1 0 42%; } .two-column > * { min-width: 0; } .toolbar, .actions { flex-wrap: wrap; } }
</style>
