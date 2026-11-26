<template>
  <div v-loading="loading" class="procurement-stack">
    <el-alert
      type="info"
      :closable="false"
      title="VIN 是车辆与配件适配主键；OCR、EPC、第三方 API 和 AI 只形成候选证据，必须人工确认。库存、审批、付款及银行流水继续由总部现有模块掌权。"
    />
    <el-alert
      v-if="workspace && !workspace.fieldAccess?.procurementManage"
      type="warning"
      :closable="false"
      title="当前账号只有汽修基础只读权限：VIN、报价、审批、付款及证据快照已按字段策略隐藏或掩码。"
    />
    <el-alert
      v-if="actionError"
      type="error"
      show-icon
      closable
      title="操作或回读结果需要核对；结果未确认时不要重复提交"
      :description="actionError"
      @close="actionError = ''"
    />

    <el-card shadow="never">
      <template #header>
        <div class="toolbar">
          <div>
            <h3>VIN / 配件采购全链</h3>
            <span class="muted">适配 → 报料 → 库存 → 询价比价 → 客户/领导授权 → 采购付款 → 物流收货 → 安装售后</span>
          </div>
          <el-button @click="load">刷新</el-button>
        </div>
      </template>
      <el-descriptions v-if="workspace" :column="5" border>
        <el-descriptions-item label="车牌">{{ workspace.vehicle?.plateNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="VIN"><strong>{{ workspace.vehicle?.vin || '尚未确认' }}</strong></el-descriptions-item>
        <el-descriptions-item label="车型">{{ vehicleLabel }}</el-descriptions-item>
        <el-descriptions-item label="发动机 / 市场">{{ workspace.vehicle?.engineCode || '-' }} / {{ workspace.vehicle?.salesMarket || '-' }}</el-descriptions-item>
        <el-descriptions-item label="客户收款">
          <el-tag :type="workspace.customerCollectionReadiness?.ready ? 'success' : 'warning'">
            {{ workspace.customerCollectionReadiness?.ready ? '已覆盖' : '待资金主链确认' }}
          </el-tag>
          <span class="collection-amount">
            {{ workspace.customerCollectionReadiness?.confirmedAmount == null ? '金额待核实' : `¥${workspace.customerCollectionReadiness.confirmedAmount}` }} /
            {{ workspace.customerCollectionReadiness?.requiredQuoteTotal == null ? '报价待核实' : `¥${workspace.customerCollectionReadiness.requiredQuoteTotal}` }}
          </span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <RepairMaterialSourceReadback
      v-if="formalActorIdentityBound && workspace?.fieldAccess?.procurementFinancialFull === true"
      :rows="workspace.materialSourceReadback || []"
      :collection="workspace.customerCollectionReadiness || null"
    />

    <el-card shadow="never">
      <el-tabs v-model="activeStage">
        <el-tab-pane label="1 VIN / 适配" name="identity">
          <div class="two-column">
            <section>
              <h3>VIN 识别证据</h3>
              <el-form :model="vinForm" label-width="100px" class="editor">
                <el-form-item label="VIN 候选"><el-input v-model="vinForm.vinCandidate" maxlength="17" /></el-form-item>
                <el-form-item label="识别方式">
                  <el-select v-model="vinForm.evidenceType">
                    <el-option label="照片 OCR" value="vin_photo_ocr" />
                    <el-option label="人工录入" value="manual_entry" />
                    <el-option label="授权解码 API" value="licensed_decoder" />
                  </el-select>
                </el-form-item>
                <el-form-item label="服务提供方"><el-input v-model="vinForm.providerCode" placeholder="人工/OCR/API 服务名" /></el-form-item>
                <el-form-item label="证据引用"><el-input v-model="vinForm.evidenceRef" placeholder="脱敏内部引用" /></el-form-item>
                <el-form-item label="置信度"><el-input-number v-model="vinForm.confidence" :min="0" :max="100" /></el-form-item>
                <el-form-item><el-button type="primary" :disabled="vinWriteDisabled || !vehicleId" @click="saveVin">保存候选</el-button></el-form-item>
              </el-form>
              <el-table :data="workspace?.identityEvidence || []" max-height="270">
                <el-table-column prop="vinCandidate" label="VIN" min-width="180" />
                <el-table-column prop="evidenceType" label="来源" width="115" />
                <el-table-column prop="checksumStatus" label="校验" width="90" />
                <el-table-column prop="reviewStatus" label="状态" width="110" />
                <el-table-column label="人工确认" width="130">
                  <template #default="{ row }">
                    <template v-if="row.reviewStatus === 'review_pending'">
                      <el-button link type="success" :disabled="vinWriteDisabled" @click="reviewVin(row, 'confirmed')">确认</el-button>
                      <el-button link type="danger" :disabled="vinWriteDisabled" @click="reviewVin(row, 'rejected')">驳回</el-button>
                    </template>
                  </template>
                </el-table-column>
              </el-table>
            </section>

            <section>
              <h3>OE 号、适配与图纸证据</h3>
              <el-form :model="fitmentForm" label-width="100px" class="editor">
                <el-form-item label="证据来源">
                  <el-select v-model="fitmentForm.sourceType">
                    <el-option label="厂家 EPC" value="manufacturer_epc" />
                    <el-option label="授权目录/API" value="licensed_catalog" />
                    <el-option label="供应商" value="supplier" />
                    <el-option label="人工" value="manual" />
                    <el-option label="AI 候选" value="ai_candidate" />
                  </el-select>
                </el-form-item>
                <el-form-item label="提供方"><el-input v-model="fitmentForm.providerCode" /></el-form-item>
                <el-form-item label="OE / 配件"><div class="inline"><el-input v-model="fitmentForm.oeNumber" /><el-input v-model="fitmentForm.partName" /></div></el-form-item>
                <el-form-item label="来源引用"><el-input v-model="fitmentForm.sourceRef" /></el-form-item>
                <el-form-item label="图纸引用"><el-input v-model="fitmentForm.diagramRef" placeholder="授权图纸、EPC 页码或 API 引用" /></el-form-item>
                <el-form-item label="适用说明"><el-input v-model="fitmentForm.notes" type="textarea" /></el-form-item>
                <el-form-item><el-button type="primary" :disabled="writeDisabled || !workspace?.vehicle?.vin" @click="saveFitment">保存候选</el-button></el-form-item>
              </el-form>
              <el-table :data="workspace?.fitmentEvidence || []" max-height="270">
                <el-table-column prop="oeNumber" label="OE 号" min-width="120" />
                <el-table-column prop="partName" label="配件" min-width="120" />
                <el-table-column prop="sourceType" label="来源" width="115" />
                <el-table-column prop="fitmentStatus" label="状态" width="100" />
                <el-table-column label="图纸" width="65"><template #default="{ row }">{{ row.diagramRef ? '有' : '-' }}</template></el-table-column>
                <el-table-column label="人工确认" width="130">
                  <template #default="{ row }">
                    <template v-if="row.fitmentStatus === 'candidate'">
                      <el-button link type="success" :disabled="writeDisabled" @click="reviewFitment(row, 'confirmed')">确认</el-button>
                      <el-button link type="danger" :disabled="writeDisabled" @click="reviewFitment(row, 'rejected')">驳回</el-button>
                    </template>
                  </template>
                </el-table-column>
              </el-table>
            </section>
          </div>
        </el-tab-pane>

        <el-tab-pane label="2 报料 / 库存" name="demand">
          <el-alert
            type="info"
            :closable="false"
            title="操作提示：先在已确认维修方案的 materialNeeds 和配件报价行中填写同一方案项目、总部材料 ID、OE 号、配件名称与数量；报料必须逐项完全一致，系统不会用任意文本配件替代客户确认内容。"
          />
          <div class="two-column">
            <el-form :model="demandForm" label-width="105px" class="editor">
              <h3>从已确认方案报料</h3>
              <el-form-item label="方案项目"><el-input v-model="demandForm.planItemRef" placeholder="方案 itemRef" /></el-form-item>
              <el-form-item label="报价行"><el-input v-model="demandForm.quoteLineRef" placeholder="报价 lineRef" /></el-form-item>
              <el-form-item label="适配证据">
                <el-select v-model="demandForm.fitmentEvidenceId" style="width:100%" @change="fillFitment">
                  <el-option v-for="item in confirmedFitments" :key="item.id" :value="item.id" :label="`${item.oeNumber} · ${item.partName}`" />
                </el-select>
              </el-form-item>
              <el-form-item label="总部材料 ID"><el-input-number v-model="demandForm.materialId" :min="1" placeholder="可选，不新建主数据" /></el-form-item>
              <el-form-item label="OE / 名称"><div class="inline"><el-input v-model="demandForm.oeNumber" /><el-input v-model="demandForm.partName" /></div></el-form-item>
              <el-form-item label="规格"><el-input v-model="demandForm.specification" /></el-form-item>
              <el-form-item label="数量 / 单位"><div class="inline"><el-input v-model="demandForm.quantity" /><el-input v-model="demandForm.unit" /></div></el-form-item>
              <el-form-item label="履约方式"><el-select v-model="demandForm.fulfillmentMode"><el-option label="先查库存" value="stock_first" /><el-option label="采购" value="procure" /><el-option label="直送工单" value="direct_delivery" /></el-select></el-form-item>
              <el-form-item><el-button type="primary" :disabled="writeDisabled" @click="saveDemand">建立报料</el-button></el-form-item>
            </el-form>
            <section>
              <h3>报料及现有库存快照</h3>
              <el-table :data="workspace?.demands || []" max-height="520">
                <el-table-column prop="partName" label="配件" min-width="120" />
                <el-table-column prop="oeNumber" label="OE" min-width="110" />
                <el-table-column label="数量" width="90"><template #default="{ row }">{{ row.quantity }} {{ row.unit }}</template></el-table-column>
                <el-table-column prop="status" label="状态" width="120" />
                <el-table-column label="库存判断" min-width="140"><template #default="{ row }">{{ row.inventorySnapshot?.result || '未检查' }}</template></el-table-column>
                <el-table-column label="操作" width="85"><template #default="{ row }"><el-button link :disabled="writeDisabled" @click="checkInventory(row)">查库存</el-button></template></el-table-column>
              </el-table>
            </section>
          </div>
        </el-tab-pane>

        <el-tab-pane label="3 询价 / AI 比价" name="quotes">
          <el-alert type="warning" :closable="false" title="系统只生成询价草稿并登记人工收到的报价；不会自动联系供应商。AI 只能解释价格与风险，不能选供应商或批准付款。" />
          <div class="three-column">
            <el-form :model="inquiryForm" label-width="95px" class="editor">
              <h3>询价草稿</h3>
              <el-form-item label="报料"><el-select v-model="inquiryForm.demandId" style="width:100%"><el-option v-for="item in workspace?.demands || []" :key="item.id" :value="item.id" :label="`${item.partName} · #${item.id}`" /></el-select></el-form-item>
              <el-form-item label="供应商 IDs"><el-input v-model="inquiryForm.supplierIds" placeholder="至少两个，如 1,2" /></el-form-item>
              <el-form-item label="询价说明"><el-input v-model="inquiryForm.inquiryNote" type="textarea" /></el-form-item>
              <el-form-item><el-button type="primary" :disabled="writeDisabled" @click="saveInquiries">生成草稿</el-button></el-form-item>
            </el-form>

            <el-form :model="quoteForm" label-width="95px" class="editor">
              <h3>登记报价</h3>
              <el-form-item label="询价"><el-select v-model="quoteForm.inquiryId" style="width:100%"><el-option v-for="item in workspace?.inquiries || []" :key="item.id" :value="item.id" :label="`${item.supplierNameSnapshot} · ${item.inquiryNo}`" /></el-select></el-form-item>
              <el-form-item label="适配证据"><el-select v-model="quoteForm.fitmentEvidenceId" style="width:100%"><el-option v-for="item in confirmedFitments" :key="item.id" :value="item.id" :label="`${item.oeNumber} · ${item.partName}`" /></el-select></el-form-item>
              <el-form-item label="单价 / 数量"><div class="inline"><el-input v-model="quoteForm.unitPrice" /><el-input v-model="quoteForm.quantity" /></div></el-form-item>
              <el-form-item label="运费 / 交期"><div class="inline"><el-input v-model="quoteForm.freightAmount" /><el-input-number v-model="quoteForm.leadTimeDays" :min="0" /></div></el-form-item>
              <el-form-item label="含税 / 可退"><div class="inline"><el-switch v-model="quoteForm.taxIncluded" /><el-switch v-model="quoteForm.returnable" /></div></el-form-item>
              <el-form-item label="付款条款"><el-input v-model="quoteForm.paymentTerms" /></el-form-item>
              <el-form-item label="报价证据"><el-input v-model="quoteForm.sourceRef" /></el-form-item>
              <el-form-item><el-button type="primary" :disabled="writeDisabled" @click="saveQuote">登记报价</el-button></el-form-item>
            </el-form>

            <el-form :model="decisionForm" label-width="105px" class="editor">
              <h3>AI 比价 + 人工选择</h3>
              <el-form-item label="报料"><el-select v-model="decisionForm.demandId" style="width:100%"><el-option v-for="item in workspace?.demands || []" :key="item.id" :value="item.id" :label="`${item.partName} · #${item.id}`" /></el-select></el-form-item>
              <el-form-item label="人工选报价"><el-select v-model="decisionForm.selectedQuoteId" style="width:100%"><el-option v-for="item in decisionQuotes" :key="item.id" :value="item.id" :label="`#${item.id} · ¥${item.unitPrice}`" /></el-select></el-form-item>
              <el-form-item label="授权方式"><el-select v-model="decisionForm.approvalMode"><el-option label="客户" value="customer" /><el-option label="领导" value="leader" /><el-option label="两者" value="both" /></el-select></el-form-item>
              <el-form-item label="客户确认 ID"><el-input-number v-model="decisionForm.customerConfirmationRequestId" :min="1" /></el-form-item>
              <el-form-item label="总部审批 ID"><div class="inline"><el-input-number v-model="decisionForm.approvalRequestId" :min="1" /><el-button :disabled="writeDisabled" @click="requestLeaderApproval">创建精确审批</el-button></div></el-form-item>
              <el-form-item label="审批申请理由"><el-input v-model="decisionForm.leaderApprovalReason" placeholder="提交后仍须领导在现有审批中心批准" /></el-form-item>
              <el-form-item label="外部价格来源"><div class="inline"><el-input v-model="decisionForm.externalPriceProvider" placeholder="授权平台/API" /><el-input v-model="decisionForm.externalUnitPrice" placeholder="含税参考单价" /></div></el-form-item>
              <el-form-item label="外部证据引用"><el-input v-model="decisionForm.externalPriceRef" placeholder="脱敏引用，不填密钥或抓取链接参数" /></el-form-item>
              <el-form-item label="使用许可依据"><el-input v-model="decisionForm.externalLicenseBasis" placeholder="合同、授权目录或公开许可" /></el-form-item>
              <el-form-item label="人工复核理由"><el-input v-model="decisionForm.overrideReason" type="textarea" /></el-form-item>
              <el-form-item><el-button type="primary" :disabled="writeDisabled" @click="saveDecision">生成决策</el-button></el-form-item>
            </el-form>
          </div>
          <el-table :data="workspace?.decisions || []" max-height="270" class="section-table">
            <el-table-column prop="id" label="决策" width="70" />
            <el-table-column prop="selectedQuoteId" label="报价" width="70" />
            <el-table-column prop="approvalMode" label="授权" width="90" />
            <el-table-column prop="decisionStatus" label="状态" width="160" />
            <el-table-column label="AI 结论" min-width="160"><template #default="{ row }">{{ row.aiAnalysisSnapshot?.conclusion }}</template></el-table-column>
            <el-table-column label="选择 / 参考中位价" min-width="160"><template #default="{ row }">¥{{ row.aiAnalysisSnapshot?.selectedNormalizedUnitCost ?? '-' }} / ¥{{ row.aiAnalysisSnapshot?.referenceMedianUnitCost ?? '-' }}</template></el-table-column>
            <el-table-column label="偏差" width="90"><template #default="{ row }">{{ row.aiAnalysisSnapshot?.deviationRatio === undefined ? '-' : `${Math.round(row.aiAnalysisSnapshot.deviationRatio * 100)}%` }}</template></el-table-column>
            <el-table-column label="风险" min-width="240"><template #default="{ row }">{{ (row.aiAnalysisSnapshot?.riskFlags || []).join('、') || '无特殊风险' }}</template></el-table-column>
            <el-table-column label="操作" width="90"><template #default="{ row }"><el-button link :disabled="writeDisabled" @click="refreshDecision(row)">刷新授权</el-button></template></el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="4 采购 / 付款 / 物流" name="orders">
          <div class="three-column">
            <el-form :model="orderForm" label-width="100px" class="editor">
              <h3>建立采购单</h3>
              <el-form-item label="批准决策 IDs"><el-input v-model="orderForm.decisionIds" placeholder="如 1,2" /></el-form-item>
              <el-form-item label="付款审批 ID"><el-input-number v-model="orderForm.approvalRequestId" :min="1" /></el-form-item>
              <el-form-item label="预计到货"><el-date-picker v-model="orderForm.expectedArrivalAt" type="datetime" /></el-form-item>
              <el-form-item><el-button type="primary" :disabled="writeDisabled" @click="saveOrder">建立采购单</el-button></el-form-item>
            </el-form>
            <el-form :model="shippingForm" label-width="100px" class="editor">
              <h3>付款意图 / 下发 / 发货</h3>
              <el-form-item label="采购单"><el-select v-model="shippingForm.orderId" style="width:100%"><el-option v-for="item in workspace?.purchaseOrders || []" :key="item.id" :value="item.id" :label="`${item.orderNo} · ${item.supplierNameSnapshot}`" /></el-select></el-form-item>
              <el-form-item label="付款意图 ID"><div class="inline"><el-input-number v-model="shippingForm.paymentIntentId" :min="1" /><el-button :disabled="writeDisabled" @click="bindPayment">关联</el-button></div></el-form-item>
              <el-form-item label="下发凭证"><div class="inline"><el-input v-model="shippingForm.issueEvidenceRef" placeholder="先关联正式付款意图" /><el-button :disabled="writeDisabled" @click="issueOrder">登记</el-button></div></el-form-item>
              <el-form-item label="物流 / 单号"><div class="inline"><el-input v-model="shippingForm.carrierName" /><el-input v-model="shippingForm.trackingNo" /></div></el-form-item>
              <el-form-item label="发货证据"><el-input v-model="shippingForm.shipmentEvidenceRef" /></el-form-item>
              <el-form-item><el-button type="primary" :disabled="writeDisabled" @click="saveShipment">登记发货</el-button></el-form-item>
            </el-form>
            <el-form :model="receiptForm" label-width="100px" class="editor">
              <h3>到货验收（不会自动入库）</h3>
              <el-form-item label="采购单"><el-select v-model="receiptForm.orderId" style="width:100%"><el-option v-for="item in workspace?.purchaseOrders || []" :key="item.id" :value="item.id" :label="item.orderNo" /></el-select></el-form-item>
              <el-form-item label="发货记录"><el-select v-model="receiptForm.shipmentId" style="width:100%"><el-option v-for="item in receiptShipments" :key="item.id" :value="item.id" :label="`${item.carrierName} · ${item.trackingNo}`" /></el-select></el-form-item>
              <el-form-item label="收货方式"><el-select v-model="receiptForm.receiptMode"><el-option label="进现有库存链" value="stock" /><el-option label="直达工单" value="direct_work_order" /></el-select></el-form-item>
              <el-form-item v-if="receiptForm.receiptMode === 'stock'" label="仓库 ID"><el-input-number v-model="receiptForm.warehouseId" :min="1" /></el-form-item>
              <el-form-item label="验收"><el-select v-model="receiptForm.status"><el-option label="通过" value="accepted" /><el-option label="部分" value="partial" /><el-option label="拒收" value="rejected" /></el-select></el-form-item>
              <el-form-item label="收货明细">
                <div class="receipt-lines">
                  <div v-for="line in receiptLineForms" :key="line.demandId" class="receipt-line">
                    <span>{{ line.partName }}（#{{ line.demandId }}）</span>
                    <el-input v-model="line.quantity" placeholder="数量" />
                    <el-select v-model="line.status">
                      <el-option label="通过" value="accepted" />
                      <el-option label="拒收" value="rejected" />
                    </el-select>
                  </div>
                  <span v-if="!receiptLineForms.length" class="muted">请先选择包含采购行的采购单</span>
                </div>
              </el-form-item>
              <el-form-item label="说明"><el-input v-model="receiptForm.note" type="textarea" /></el-form-item>
              <el-form-item><el-button type="primary" :disabled="writeDisabled" @click="saveReceipt">登记收货</el-button></el-form-item>
            </el-form>
          </div>
          <el-table :data="workspace?.purchaseOrders || []" max-height="300" class="section-table">
            <el-table-column prop="orderNo" label="采购单" min-width="180" />
            <el-table-column prop="supplierNameSnapshot" label="供应商" min-width="130" />
            <el-table-column prop="totalAmount" label="金额" width="100" />
            <el-table-column prop="status" label="采购状态" width="125" />
            <el-table-column label="付款证据" min-width="220"><template #default="{ row }">{{ repairPaymentReadbackLabel(row.paymentState) }}</template></el-table-column>
            <el-table-column label="操作" width="90"><template #default="{ row }"><el-button v-if="row.paymentIntentId" link :disabled="writeDisabled" @click="refreshPayment(row)">刷付款</el-button></template></el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="5 安装 / 售后" name="after-sales">
          <div class="two-column">
            <el-form :model="allocationForm" label-width="115px" class="editor">
              <h3>关联现有工单材料 / 库存流水</h3>
              <el-form-item label="收货记录"><el-select v-model="allocationForm.receiptId" style="width:100%"><el-option v-for="item in workspace?.receipts || []" :key="item.id" :value="item.id" :label="item.receiptNo" /></el-select></el-form-item>
              <el-form-item label="报料需求"><el-select v-model="allocationForm.demandId" style="width:100%"><el-option v-for="item in workspace?.demands || []" :key="item.id" :value="item.id" :label="`${item.partName} · #${item.id}`" /></el-select></el-form-item>
              <el-form-item label="原工单材料"><el-select v-model="allocationForm.workOrderMaterialId" filterable style="width:100%" placeholder="选择已有材料，不按名称新建"><el-option v-for="item in workspace?.materialSourceReadback || []" :key="item.workOrderMaterialId" :value="item.workOrderMaterialId" :label="`${item.materialName} · ${item.specification || '规格待核对'} · 用量 ${item.quantity ?? '待核实'} · #${item.workOrderMaterialId}`" /></el-select></el-form-item>
              <el-form-item label="库存流水 ID"><el-input-number v-model="allocationForm.inventoryTransactionId" :min="1" /></el-form-item>
              <el-form-item label="数量"><el-input v-model="allocationForm.quantity" /></el-form-item>
              <el-form-item label="关联凭证"><el-input v-model="allocationForm.linkEvidenceRef" /></el-form-item>
              <el-form-item><el-button type="primary" :disabled="writeDisabled" @click="saveAllocation">建立关联</el-button></el-form-item>
            </el-form>
            <el-form :model="claimForm" label-width="115px" class="editor">
              <h3>供应商售后草稿</h3>
              <el-form-item label="采购单 ID"><el-input-number v-model="claimForm.purchaseOrderId" :min="1" /></el-form-item>
              <el-form-item label="收货记录 ID"><el-input-number v-model="claimForm.receiptId" :min="1" /></el-form-item>
              <el-form-item label="安装关联 ID"><el-input-number v-model="claimForm.allocationId" :min="1" /></el-form-item>
              <el-form-item label="汽修保修 ID"><el-input-number v-model="claimForm.repairWarrantyRecordId" :min="1" /></el-form-item>
              <el-form-item label="问题说明"><el-input v-model="claimForm.issue" type="textarea" /></el-form-item>
              <el-form-item label="证据引用"><el-input v-model="claimForm.evidenceRefs" placeholder="逗号分隔" /></el-form-item>
              <el-form-item><el-button type="primary" :disabled="writeDisabled" @click="saveClaim">建立售后草稿</el-button></el-form-item>
            </el-form>
          </div>
          <el-table :data="workspace?.allocations || []" max-height="260" class="section-table">
            <el-table-column prop="id" label="关联" width="70" />
            <el-table-column prop="workOrderMaterialId" label="工单材料" width="105" />
            <el-table-column prop="inventoryTransactionId" label="库存流水" width="105" />
            <el-table-column prop="quantity" label="数量" width="90" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column label="登记安装" min-width="220">
              <template #default="{ row }">
                <div v-if="row.status === 'linked'" class="inline">
                  <el-input-number v-model="installTaskIds[row.id]" :min="1" placeholder="已完成任务 ID" />
                  <el-button link :disabled="writeDisabled" @click="install(row)">安装</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-table :data="workspace?.warrantyClaims || []" max-height="220" class="section-table">
            <el-table-column prop="claimNo" label="供应商售后单" min-width="190" />
            <el-table-column prop="supplierId" label="供应商" width="100" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column label="外部效果"><template #default>草稿；尚未自动发送</template></el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, reactive, ref, watch } from 'vue';
import {
  bindRepairProcurementAllocation, bindRepairPurchasePaymentIntent,
  checkRepairProcurementInventory, createRepairFitmentEvidence,
  createRepairProcurementDecision, createRepairProcurementDemand,
  createRepairPurchaseOrder, createRepairSupplierInquiries,
  createRepairSupplierWarrantyClaim, createRepairVehicleIdentityEvidence,
  getRepairProcurementWorkspace, issueRepairPurchaseOrder,
  markRepairProcurementInstalled, recordRepairGoodsReceipt,
  recordRepairSupplierQuote, recordRepairSupplierShipment,
  refreshRepairProcurementDecision, refreshRepairPurchasePaymentState,
  requestRepairProcurementLeaderApproval,
  reviewRepairFitmentEvidence, reviewRepairVehicleIdentityEvidence,
} from '../../api/repair-shop';
import { authenticatedUserIdentity, formalActorIdentityBound } from '../../utils/permissions';
import RepairMaterialSourceReadback from './components/RepairMaterialSourceReadback.vue';
import { repairPaymentReadbackLabel } from './repair-payment-readback';

const props = defineProps<{ workOrderId: string | number; profile: any; vehicle: any }>();
const workspace = ref<any>(null);
const loading = ref(false);
const activeStage = ref('identity');
const actionError = ref('');
let loadGeneration = 0;
const installTaskIds = reactive<Record<number, number | undefined>>({});
const receiptLineForms = ref<Array<{ demandId: number; partName: string; quantity: string; status: 'accepted' | 'rejected' }>>([]);
const writeDisabled = computed(() =>
  !formalActorIdentityBound.value || workspace.value?.fieldAccess?.procurementManage !== true,
);
const vinWriteDisabled = computed(() =>
  !formalActorIdentityBound.value || workspace.value?.fieldAccess?.vehicleIdentityFull !== true,
);
const vehicleId = computed(() => workspace.value?.vehicle?.id || props.vehicle?.id);
const vehicleLabel = computed(() => [workspace.value?.vehicle?.brand, workspace.value?.vehicle?.model, workspace.value?.vehicle?.modelYear].filter(Boolean).join(' ') || '-');
const confirmedFitments = computed(() => (workspace.value?.fitmentEvidence || []).filter((item: any) => item.fitmentStatus === 'confirmed'));
const decisionQuotes = computed(() => (workspace.value?.quotes || []).filter((item: any) => item.demandId === decisionForm.demandId && ['candidate', 'shortlisted'].includes(item.status)));
const receiptShipments = computed(() => (workspace.value?.shipments || []).filter((item: any) => item.purchaseOrderId === receiptForm.orderId));

const vinForm = reactive({ vinCandidate: props.vehicle?.vin || '', evidenceType: 'vin_photo_ocr', providerCode: 'manual-review', evidenceRef: '', confidence: 90 });
const fitmentForm = reactive({ sourceType: 'licensed_catalog', providerCode: '', oeNumber: '', partName: '', sourceRef: '', diagramRef: '', notes: '' });
const demandForm = reactive({ planItemRef: '', quoteLineRef: '', fitmentEvidenceId: undefined as number | undefined, materialId: undefined as number | undefined, oeNumber: '', partName: '', specification: '', quantity: '1.00', unit: '件', fulfillmentMode: 'stock_first' });
const inquiryForm = reactive({ demandId: undefined as number | undefined, supplierIds: '', inquiryNote: '' });
const quoteForm = reactive({ inquiryId: undefined as number | undefined, fitmentEvidenceId: undefined as number | undefined, unitPrice: '0.00', quantity: '1.00', freightAmount: '0.00', taxIncluded: true, returnable: true, leadTimeDays: 1, paymentTerms: '按总部已批准付款条件', sourceRef: '' });
const decisionForm = reactive({ demandId: undefined as number | undefined, selectedQuoteId: undefined as number | undefined, approvalMode: 'both', customerConfirmationRequestId: undefined as number | undefined, approvalRequestId: undefined as number | undefined, leaderApprovalReason: '汽修配件采购报价审批', externalPriceProvider: '', externalPriceRef: '', externalUnitPrice: '', externalLicenseBasis: '', overrideReason: '' });
const orderForm = reactive({ decisionIds: '', approvalRequestId: undefined as number | undefined, expectedArrivalAt: undefined as Date | undefined });
const shippingForm = reactive({ orderId: undefined as number | undefined, issueEvidenceRef: '', paymentIntentId: undefined as number | undefined, carrierName: '', trackingNo: '', shipmentEvidenceRef: '' });
const receiptForm = reactive({ orderId: undefined as number | undefined, shipmentId: undefined as number | undefined, receiptMode: 'direct_work_order', warehouseId: undefined as number | undefined, status: 'accepted', note: '' });
const allocationForm = reactive({ receiptId: undefined as number | undefined, demandId: undefined as number | undefined, workOrderMaterialId: undefined as number | undefined, inventoryTransactionId: undefined as number | undefined, quantity: '1.00', linkEvidenceRef: '' });
const claimForm = reactive({ purchaseOrderId: undefined as number | undefined, receiptId: undefined as number | undefined, allocationId: undefined as number | undefined, repairWarrantyRecordId: undefined as number | undefined, issue: '', evidenceRefs: '' });

async function load() {
  const generation = ++loadGeneration;
  const workOrderId = props.workOrderId;
  workspace.value = null;
  actionError.value = '';
  loading.value = true;
  try {
    const response = await getRepairProcurementWorkspace(workOrderId);
    if (generation !== loadGeneration || String(workOrderId) !== String(props.workOrderId)) return;
    if (String(response.data.data?.workOrderId) !== String(workOrderId)) throw new Error('工单回读不一致，请刷新核对');
    workspace.value = response.data.data;
    vinForm.vinCandidate = workspace.value.vehicle?.vin || vinForm.vinCandidate;
  } catch {
    if (generation === loadGeneration) {
      workspace.value = null;
      actionError.value = '采购资料未能重新核验，旧供应商和付款信息已隐藏；请重试或核对权限。';
    }
  } finally {
    if (generation === loadGeneration) loading.value = false;
  }
}
async function mutate(action: () => Promise<unknown>, message: string) {
  loading.value = true;
  actionError.value = '';
  try {
    await action();
    ElMessage.success(message);
    await load();
  } catch (error: any) {
    actionError.value = error?.response?.data?.message || error?.message || '操作失败';
    if (!error?.response) ElMessage.error(actionError.value);
  } finally {
    loading.value = false;
  }
}
const key = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
const parseIds = (value: string) => [...new Set(value.split(/[,，\s]+/).map(Number).filter((item) => Number.isInteger(item) && item > 0))];
async function reviewNote(title: string) { const result = await ElMessageBox.prompt('请输入人工复核说明', title, { inputValidator: (value) => value.trim().length >= 2 || '至少填写 2 个字符' }); return result.value.trim(); }
function selectedOrder() { const order = (workspace.value?.purchaseOrders || []).find((item: any) => item.id === shippingForm.orderId); if (!order) throw new Error('请选择采购单'); return order; }

function saveVin() { return mutate(() => createRepairVehicleIdentityEvidence(vehicleId.value, { ...vinForm, decodeSnapshot: { entry: 'repair_procurement_ui' }, requestIdempotencyKey: key('vin') }), 'VIN 候选已保存'); }
async function reviewVin(row: any, decision: string) { const note = await reviewNote('VIN 人工复核'); return mutate(() => reviewRepairVehicleIdentityEvidence(vehicleId.value, row.id, { expectedVersion: row.version, decision, reviewNote: note }), 'VIN 复核完成'); }
function saveFitment() { return mutate(() => createRepairFitmentEvidence(props.workOrderId, { sourceType: fitmentForm.sourceType, providerCode: fitmentForm.providerCode, sourceRef: fitmentForm.sourceRef, oeNumber: fitmentForm.oeNumber, partName: fitmentForm.partName, diagramRef: fitmentForm.diagramRef || undefined, applicabilitySnapshot: { notes: fitmentForm.notes }, confidence: 90, requestIdempotencyKey: key('fitment') }), '适配候选已保存'); }
async function reviewFitment(row: any, decision: string) { const note = await reviewNote('适配人工复核'); return mutate(() => reviewRepairFitmentEvidence(props.workOrderId, row.id, { expectedVersion: row.version, decision, reviewNote: note }), '适配复核完成'); }
function fillFitment(id: number) { const item = confirmedFitments.value.find((row: any) => row.id === id); if (item) { demandForm.oeNumber = item.oeNumber; demandForm.partName = item.partName; } }
function saveDemand() { return mutate(() => createRepairProcurementDemand(props.workOrderId, { ...demandForm, planVersion: props.profile.activePlanVersion, quoteVersion: props.profile.activeQuoteVersion, requestIdempotencyKey: key('demand') }), '报料需求已建立'); }
function checkInventory(row: any) { return mutate(() => checkRepairProcurementInventory(props.workOrderId, row.id, row.version), '库存快照已刷新'); }
function saveInquiries() { return mutate(() => createRepairSupplierInquiries(props.workOrderId, inquiryForm.demandId!, { supplierIds: parseIds(inquiryForm.supplierIds), inquiryNote: inquiryForm.inquiryNote, requestIdempotencyKey: key('inquiry') }), '询价草稿已生成'); }
function saveQuote() { return mutate(() => recordRepairSupplierQuote(props.workOrderId, quoteForm.inquiryId!, { fitmentEvidenceId: quoteForm.fitmentEvidenceId, unitPrice: quoteForm.unitPrice, quantity: quoteForm.quantity, freightAmount: quoteForm.freightAmount, taxIncluded: quoteForm.taxIncluded, returnable: quoteForm.returnable, leadTimeDays: quoteForm.leadTimeDays, paymentTerms: quoteForm.paymentTerms, sourceRef: quoteForm.sourceRef, warrantyMonths: 12, validUntil: new Date(Date.now() + 7 * 86400000).toISOString(), requestIdempotencyKey: key('quote') }), '报价已登记'); }
async function requestLeaderApproval() {
  if (!decisionForm.demandId || !decisionForm.selectedQuoteId || !decisionForm.leaderApprovalReason.trim()) {
    ElMessage.warning('请先选择报料、报价并填写审批申请理由');
    return;
  }
  return mutate(async () => {
    const response = await requestRepairProcurementLeaderApproval(
      props.workOrderId,
      decisionForm.demandId,
      { selectedQuoteId: decisionForm.selectedQuoteId, reason: decisionForm.leaderApprovalReason.trim() },
    );
    decisionForm.approvalRequestId = Number(response.data.data.id);
  }, '审批请求已进入现有审批中心；领导批准后再生成或刷新决策');
}
function saveDecision() {
  const externalFields = [decisionForm.externalPriceProvider, decisionForm.externalPriceRef, decisionForm.externalUnitPrice, decisionForm.externalLicenseBasis];
  if (externalFields.some(Boolean) && !externalFields.every((item) => String(item).trim())) {
    ElMessage.warning('外部价格证据必须同时填写来源、单价、证据引用和许可依据');
    return;
  }
  if (decisionForm.externalUnitPrice && (!Number.isFinite(Number(decisionForm.externalUnitPrice)) || Number(decisionForm.externalUnitPrice) < 0)) {
    ElMessage.warning('外部参考单价必须是非负数字');
    return;
  }
  const externalPriceCandidates = externalFields.every((item) => String(item).trim())
    ? [{ sourceRef: decisionForm.externalPriceRef.trim(), provider: decisionForm.externalPriceProvider.trim(), collectedAt: new Date().toISOString(), unitPrice: Number(decisionForm.externalUnitPrice), currency: 'CNY', licenseBasis: decisionForm.externalLicenseBasis.trim() }]
    : [];
  return mutate(() => createRepairProcurementDecision(props.workOrderId, decisionForm.demandId!, { selectedQuoteId: decisionForm.selectedQuoteId, approvalMode: decisionForm.approvalMode, customerConfirmationRequestId: decisionForm.customerConfirmationRequestId, approvalRequestId: decisionForm.approvalRequestId, overrideReason: decisionForm.overrideReason || undefined, externalPriceCandidates, requestIdempotencyKey: key('decision') }), '比价决策已生成');
}
function refreshDecision(row: any) { return mutate(() => refreshRepairProcurementDecision(props.workOrderId, row.id, row.version), '授权状态已刷新'); }
function saveOrder() { return mutate(() => createRepairPurchaseOrder(props.workOrderId, { decisionIds: parseIds(orderForm.decisionIds), approvalRequestId: orderForm.approvalRequestId, expectedArrivalAt: orderForm.expectedArrivalAt?.toISOString(), requestIdempotencyKey: key('order') }), '采购单已建立'); }
function issueOrder() { const order = selectedOrder(); return mutate(() => issueRepairPurchaseOrder(props.workOrderId, order.id, { expectedVersion: order.version, issueEvidenceRef: shippingForm.issueEvidenceRef }), '人工下发证据已登记'); }
function bindPayment() { const order = selectedOrder(); return mutate(() => bindRepairPurchasePaymentIntent(props.workOrderId, order.id, { expectedVersion: order.version, paymentIntentId: shippingForm.paymentIntentId }), '总部付款意图已关联'); }
function refreshPayment(row: any) { return mutate(() => refreshRepairPurchasePaymentState(props.workOrderId, row.id, row.version), '付款证据投影已刷新'); }
function saveShipment() { return mutate(() => recordRepairSupplierShipment(props.workOrderId, shippingForm.orderId!, { carrierName: shippingForm.carrierName, trackingNo: shippingForm.trackingNo, shipmentEvidenceRef: shippingForm.shipmentEvidenceRef, shippedAt: new Date().toISOString(), requestIdempotencyKey: key('shipment') }), '发货已登记'); }
function saveReceipt() { return mutate(() => recordRepairGoodsReceipt(props.workOrderId, receiptForm.orderId!, { shipmentId: receiptForm.shipmentId, receiptMode: receiptForm.receiptMode, warehouseId: receiptForm.warehouseId, inspectionSnapshot: { note: receiptForm.note, inventoryEffect: 'none' }, receivedLines: receiptLineForms.value.map(({ demandId, quantity, status }) => ({ demandId, quantity, status })), receivedAt: new Date().toISOString(), status: receiptForm.status, requestIdempotencyKey: key('receipt') }), '到货验收已登记，库存未自动改变'); }
function saveAllocation() { return mutate(() => bindRepairProcurementAllocation(props.workOrderId, allocationForm.receiptId!, { demandId: allocationForm.demandId, workOrderMaterialId: allocationForm.workOrderMaterialId, inventoryTransactionId: allocationForm.inventoryTransactionId, quantity: allocationForm.quantity, linkEvidenceRef: allocationForm.linkEvidenceRef, requestIdempotencyKey: key('allocation') }), '现有材料/库存记录已关联'); }
function install(row: any) { return mutate(() => markRepairProcurementInstalled(props.workOrderId, row.id, { expectedVersion: row.version, repairTaskId: installTaskIds[row.id] }), '安装关联已登记'); }
function saveClaim() { return mutate(() => createRepairSupplierWarrantyClaim(props.workOrderId, { purchaseOrderId: claimForm.purchaseOrderId, receiptId: claimForm.receiptId, allocationId: claimForm.allocationId, repairWarrantyRecordId: claimForm.repairWarrantyRecordId, issueSnapshot: { issue: claimForm.issue }, evidenceRefs: claimForm.evidenceRefs.split(/[,，\n]+/).map((item) => item.trim()).filter(Boolean), requestIdempotencyKey: key('claim') }), '供应商售后草稿已建立'); }

watch(() => props.workOrderId, () => {
  Object.assign(allocationForm, { receiptId: undefined, demandId: undefined, workOrderMaterialId: undefined, inventoryTransactionId: undefined, quantity: '1.00', linkEvidenceRef: '' });
  return load();
}, { immediate: true, flush: 'sync' });
watch(authenticatedUserIdentity, () => {
  ++loadGeneration;
  workspace.value = null;
  loading.value = false;
  vinForm.vinCandidate = '';
  actionError.value = '账号或权限上下文已改变，原采购与付款信息已隐藏，请刷新重新核验。';
}, { deep: true, flush: 'sync' });
watch(() => receiptForm.orderId, (orderId) => {
  const order = (workspace.value?.purchaseOrders || []).find((item: any) => item.id === orderId);
  receiptLineForms.value = (order?.lineSnapshot || []).map((line: any) => ({
    demandId: Number(line.demandId),
    partName: String(line.partName || line.oeNumber || '配件'),
    quantity: String(line.quantity),
    status: 'accepted' as const,
  }));
});
watch(() => receiptForm.status, (status) => {
  if (status === 'accepted' || status === 'rejected') {
    receiptLineForms.value.forEach((line) => { line.status = status; });
  }
});
</script>

<style scoped>
.procurement-stack { display: grid; gap: 14px; }
.toolbar, .inline { display: flex; align-items: center; gap: 10px; }
.toolbar { justify-content: space-between; }
.inline > * { flex: 1; }
h3 { margin: 0 0 12px; }
.muted { color: #6b7280; font-size: 12px; }
.collection-amount { margin-left: 8px; color: #4b5563; font-size: 12px; }
.two-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.three-column { display: grid; grid-template-columns: repeat(3, minmax(300px, 1fr)); gap: 16px; margin-top: 14px; }
.editor { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; background: #fafafa; }
.section-table { margin-top: 14px; }
.receipt-lines { display: grid; gap: 8px; width: 100%; }
.receipt-line { display: grid; grid-template-columns: minmax(130px, 1fr) 90px 90px; gap: 8px; align-items: center; }
@media (max-width: 1280px) { .two-column, .three-column { grid-template-columns: 1fr; } }
</style>
