<template>
  <div class="synthetic-demo">
    <section class="demo-hero">
      <div>
        <div class="eyebrow">OWNER 汽修只读验收</div>
        <h2>合成演示档案 · 非真实工单</h2>
        <p>
          本页数据仅用于检查界面、流程和权限边界，不来自数据库，不代表真实客户、车辆、库存、
          收付款、审批或客户权益。
        </p>
      </div>
      <div class="hero-badges">
        <el-tag type="warning" size="large" effect="dark">合成演示</el-tag>
        <el-tag type="success" size="large">GET-only</el-tag>
        <el-tag size="large">无业务写入</el-tag>
      </div>
    </section>

    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="演示内容与正式数据完全隔离：刷新页面不会创建工单，任何金额、确认、领料、质检和交车状态都只是页面内样例。"
    />

    <section class="summary-grid">
      <div class="summary-card primary">
        <span>演示工单</span>
        <strong>DEMO-REPAIR-001</strong>
        <small>当前：已交车 · 保修跟踪中（演示）</small>
      </div>
      <div class="summary-card plate">
        <span>车辆车牌（内部授权可见）</span>
        <strong>演示牌·A001</strong>
        <small>完整显示；这不是实际登记车牌</small>
      </div>
      <div class="summary-card">
        <span>客户 / 联系电话</span>
        <strong>演示客户 A</strong>
        <small>138****0000 · 中间四位隐藏</small>
      </div>
      <div class="summary-card service-due">
        <span>下次保养预测</span>
        <strong>约 42 天 / 2,100 km</strong>
        <small>车型规则 V4 · 与车内提示核对一致（演示）</small>
      </div>
      <div class="summary-card">
        <span>演示应收 / 已确认收款</span>
        <strong>¥3,260.00 / ¥3,260.00</strong>
        <small>仅演示 confirmed 门槛；无真实资金记录</small>
      </div>
    </section>

    <section class="flow-panel">
      <div class="section-heading">
        <div>
          <span class="section-kicker">维修全流程</span>
          <h3>八阶段业务档案</h3>
        </div>
        <el-tag type="success">8 / 8 演示完成</el-tag>
      </div>
      <div class="steps-scroll">
        <el-steps :active="8" finish-status="success" align-center>
          <el-step v-for="step in workflowSteps" :key="step.title" :title="step.title" :description="step.description" />
        </el-steps>
      </div>
      <div class="mobile-workflow" aria-label="汽修八阶段流程">
        <div v-for="(step, index) in workflowSteps" :key="step.title" class="mobile-workflow-item">
          <span>{{ index + 1 }}</span>
          <div>
            <strong>{{ step.title }}</strong>
            <small>{{ step.description }}</small>
          </div>
        </div>
      </div>
    </section>

    <el-tabs v-model="activeTab" class="demo-tabs">
      <el-tab-pane label="车辆与接车" name="overview">
        <div class="two-column">
          <el-card shadow="never">
            <template #header><strong>客户与车辆档案</strong></template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="客户">演示客户 A</el-descriptions-item>
              <el-descriptions-item label="联系电话">138****0000</el-descriptions-item>
              <el-descriptions-item label="完整车牌">演示牌·A001</el-descriptions-item>
              <el-descriptions-item label="车型">2022 款中型轿车（合成车型）</el-descriptions-item>
              <el-descriptions-item label="VIN">DEMO********0001</el-descriptions-item>
              <el-descriptions-item label="进厂里程">68,240 km（演示）</el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card shadow="never">
            <template #header><strong>接车检查记录 · R3</strong></template>
            <div class="finding-list">
              <div v-for="finding in inspectionFindings" :key="finding.area" class="finding-item">
                <div>
                  <strong>{{ finding.area }}</strong>
                  <p>{{ finding.result }}</p>
                </div>
                <el-tag :type="finding.type" effect="plain">{{ finding.level }}</el-tag>
              </div>
            </div>
          </el-card>
        </div>

        <el-card class="section-card" shadow="never">
          <template #header><strong>客户原始诉求与接车边界</strong></template>
          <p class="explanation">
            演示诉求：低速经过不平路面时前部异响，制动时方向盘轻微抖动。接车顾问已把原始描述、
            既有划痕和随车物品分别记录；检查结果只形成诊断依据，不会自动变成维修确认。
          </p>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="客户服务与保养" name="customer-service">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="这是 DESIGN 静态投影：复用统一客户中心，不保存真实关系、地址、车辆遥测，不发送提醒，也不创建接送车任务。"
        />

        <div class="two-column section-card">
          <el-card shadow="never">
            <template #header>
              <div class="card-header-inline">
                <strong>客户服务画像（演示）</strong>
                <el-tag type="success">结构化关系</el-tag>
              </div>
            </template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="转介绍来源">演示客户 B · 已核验介绍事件</el-descriptions-item>
              <el-descriptions-item label="家庭/单位关系">演示家庭多车组 · 2 辆车</el-descriptions-item>
              <el-descriptions-item label="服务区域">东区 · 示例社区 03 网格</el-descriptions-item>
              <el-descriptions-item label="完整地址">仅在接送任务授权期内可见；本页不展示</el-descriptions-item>
              <el-descriptions-item label="接送偏好">工作日 09:00–11:00 · 需人工确认</el-descriptions-item>
              <el-descriptions-item label="联系偏好">18:00–20:00 · 中间四位隐藏号码</el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card shadow="never">
            <template #header>
              <div class="card-header-inline">
                <strong>群体服务候选（演示）</strong>
                <el-tag type="warning">不自动联系</el-tag>
              </div>
            </template>
            <div class="opportunity-list">
              <div v-for="item in serviceOpportunities" :key="item.title" class="opportunity-item">
                <div>
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.description }}</p>
                </div>
                <el-tag :type="item.type" effect="plain">{{ item.status }}</el-tag>
              </div>
            </div>
          </el-card>
        </div>

        <div class="maintenance-banner section-card">
          <div>
            <span>车型化规则与保养灯核对</span>
            <strong>每款车独立规则 · 车型规则 V4 · 车内剩余 2,100 km / 42 天</strong>
            <small>门店预测与车辆仪表在演示误差范围内；没有重置证据时不会显示“已同步”。</small>
          </div>
          <el-tag type="success" size="large" effect="dark">aligned（演示）</el-tag>
        </div>

        <div class="two-column section-card">
          <el-card shadow="never">
            <template #header><strong>适用规则证据</strong></template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="车型匹配">2022 款合成车型 / 指定动力配置</el-descriptions-item>
              <el-descriptions-item label="销售市场">中国市场（演示）</el-descriptions-item>
              <el-descriptions-item label="规则来源">厂商手册修订版 + 门店审核工况</el-descriptions-item>
              <el-descriptions-item label="周期口径">时间或里程先到为准</el-descriptions-item>
              <el-descriptions-item label="提前窗口">按项目分别设置，不使用全店统一值</el-descriptions-item>
              <el-descriptions-item label="当前可信里程">68,240 km · 交车人工核验（演示）</el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card shadow="never">
            <template #header><strong>提醒进度（演示）</strong></template>
            <el-timeline>
              <el-timeline-item
                v-for="item in reminderTimeline"
                :key="item.title"
                :type="item.type"
                :hollow="item.hollow"
              >
                <strong>{{ item.title }}</strong>
                <p>{{ item.description }}</p>
              </el-timeline-item>
            </el-timeline>
          </el-card>
        </div>

        <el-table :data="maintenanceItems" border class="section-card">
          <el-table-column prop="item" label="保养项目" min-width="150" />
          <el-table-column prop="rule" label="适用周期" min-width="170" />
          <el-table-column prop="lastService" label="上次完成事实" min-width="180" />
          <el-table-column prop="forecast" label="门店预测" min-width="180" />
          <el-table-column prop="indicator" label="车辆显示/观测" min-width="180" />
          <el-table-column prop="advance" label="提前提醒" min-width="140" />
          <el-table-column label="核对状态" width="135">
            <template #default="{ row }">
              <el-tag :type="row.type" effect="plain">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <el-alert
          class="section-card"
          type="warning"
          :closable="false"
          title="AI 只计算候选、解释差异、组合服务区域和生成提醒草稿；不得自动联系客户、确认预约、调度司机、查看无目的完整地址或远程重置车辆保养灯。"
        />
      </el-tab-pane>

      <el-tab-pane label="诊断与 AI 辅助" name="diagnosis">
        <div class="section-heading compact">
          <div>
            <span class="section-kicker">维修工 AI 工作台</span>
            <h3>证据先行的故障判断</h3>
          </div>
          <el-tag type="warning">须由维修工确认</el-tag>
        </div>

        <div class="ai-grid">
          <article v-for="card in aiDiagnosisCards" :key="card.title" class="ai-card">
            <div class="ai-card-head">
              <strong>{{ card.title }}</strong>
              <el-tag :type="card.type" size="small">{{ card.badge }}</el-tag>
            </div>
            <p>{{ card.summary }}</p>
            <ul>
              <li v-for="item in card.items" :key="item">{{ item }}</li>
            </ul>
          </article>
        </div>

        <el-card class="section-card" shadow="never">
          <template #header>
            <div class="card-header-inline">
              <strong>AI 候选故障（演示）</strong>
              <span>概率不是结论，维修工必须结合实车证据判断</span>
            </div>
          </template>
          <el-table :data="diagnosisCandidates" border>
            <el-table-column prop="candidate" label="候选故障" min-width="180" />
            <el-table-column prop="evidence" label="支持证据" min-width="280" />
            <el-table-column prop="confidence" label="AI 置信度" width="110" />
            <el-table-column prop="humanDecision" label="人工结论" min-width="180" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="方案、报价与确认" name="plan">
        <div class="consistency-banner">
          <div>
            <span>一致性校验</span>
            <strong>维修方案 V3 = 报价 V3 = 客户解释 V3 = 客户确认 V3</strong>
          </div>
          <el-tag type="success" size="large" effect="dark">一致</el-tag>
        </div>

        <el-table :data="planItems" border class="section-card">
          <el-table-column prop="ref" label="方案项目" width="105" />
          <el-table-column prop="content" label="维修内容" min-width="250" />
          <el-table-column prop="reason" label="证据与理由" min-width="260" />
          <el-table-column prop="parts" label="配件" width="110" align="right" />
          <el-table-column prop="labor" label="工时/服务" width="115" align="right" />
          <el-table-column prop="total" label="合计" width="105" align="right" />
        </el-table>

        <div class="three-column section-card">
          <el-card shadow="never">
            <template #header><strong>报价版本轨迹</strong></template>
            <el-timeline>
              <el-timeline-item v-for="version in quoteVersions" :key="version.version" :type="version.type">
                <strong>{{ version.version }} · {{ version.amount }}</strong>
                <p>{{ version.note }}</p>
              </el-timeline-item>
            </el-timeline>
          </el-card>
          <el-card shadow="never">
            <template #header><strong>客户可读解释 · V3</strong></template>
            <p class="explanation">
              已确认异响来自前悬橡胶衬套间隙，制动抖动来自前制动盘跳动超差。本次只处理有实车证据的三项，
              更换件、工时、风险和保修均与报价 V3 对齐；未确认的空调建议不进入本次施工。
            </p>
          </el-card>
          <el-card shadow="never">
            <template #header><strong>客户确认绑定</strong></template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="确认状态">已确认（演示）</el-descriptions-item>
              <el-descriptions-item label="方案版本">V3</el-descriptions-item>
              <el-descriptions-item label="报价版本">V3</el-descriptions-item>
              <el-descriptions-item label="解释版本">V3</el-descriptions-item>
              <el-descriptions-item label="确认方式">门店签署（演示）</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="施工、配件与工时" name="execution">
        <el-alert
          type="info"
          :closable="false"
          title="每个维修任务必须绑定客户已确认的 planItemRef；未绑定或被取消的任务不能替代已确认项目。"
        />

        <el-table :data="repairTasks" border class="section-card">
          <el-table-column prop="taskNo" label="任务" width="105" />
          <el-table-column prop="planRef" label="绑定方案" width="110" />
          <el-table-column prop="title" label="施工内容" min-width="240" />
          <el-table-column prop="technician" label="执行角色" min-width="130" />
          <el-table-column prop="labor" label="工时" width="90" />
          <el-table-column label="状态" width="110">
            <template #default><el-tag type="success">完成（演示）</el-tag></template>
          </el-table-column>
        </el-table>

        <div class="two-column section-card">
          <el-card shadow="never">
            <template #header><strong>配件关联（无真实出库）</strong></template>
            <div v-for="part in parts" :key="part.ref" class="record-row">
              <div>
                <strong>{{ part.name }}</strong>
                <p>{{ part.ref }} · {{ part.quantity }} · 绑定 {{ part.planRef }}</p>
              </div>
              <el-tag type="info">页面演示</el-tag>
            </div>
          </el-card>
          <el-card shadow="never">
            <template #header><strong>工时项目</strong></template>
            <div v-for="labor in laborItems" :key="labor.ref" class="record-row">
              <div>
                <strong>{{ labor.name }}</strong>
                <p>{{ labor.ref }} · {{ labor.hours }} · 绑定 {{ labor.planRef }}</p>
              </div>
              <span>{{ labor.amount }}</span>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="质检、交车与售后" name="delivery">
        <div class="three-column">
          <el-card shadow="never">
            <template #header><strong>质检记录 · Q2</strong></template>
            <ul class="check-list">
              <li>✓ 紧固扭矩复核通过（演示）</li>
              <li>✓ 制动盘跳动复测通过（演示）</li>
              <li>✓ 四轮定位数据通过（演示）</li>
              <li>✓ 复检路试无异响（演示）</li>
            </ul>
            <el-tag type="success">质检通过（演示）</el-tag>
          </el-card>
          <el-card shadow="never">
            <template #header><strong>交车资金门槛</strong></template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="应收">¥3,260.00（演示）</el-descriptions-item>
              <el-descriptions-item label="资金证据">confirmed（演示）</el-descriptions-item>
              <el-descriptions-item label="候选证据">不能放行交车</el-descriptions-item>
              <el-descriptions-item label="交车状态">已交车（演示）</el-descriptions-item>
            </el-descriptions>
          </el-card>
          <el-card shadow="never">
            <template #header><strong>售后与保修</strong></template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="配件保修">12 个月 / 20,000 km</el-descriptions-item>
              <el-descriptions-item label="工时保修">6 个月 / 10,000 km</el-descriptions-item>
              <el-descriptions-item label="回访计划">交车后 7 / 30 天（演示）</el-descriptions-item>
              <el-descriptions-item label="当前状态">保修跟踪中（演示）</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="AI 案例与视频" name="knowledge">
        <div class="knowledge-grid">
          <article v-for="item in knowledgeItems" :key="item.title" class="knowledge-card">
            <div class="knowledge-cover" :class="item.kindClass">
              <span>{{ item.kind }}</span>
              <strong>{{ item.duration }}</strong>
            </div>
            <div class="knowledge-body">
              <el-tag size="small" :type="item.type">{{ item.sourceLevel }}</el-tag>
              <h4>{{ item.title }}</h4>
              <p>{{ item.summary }}</p>
              <div class="knowledge-meta">适用：{{ item.appliesTo }}</div>
              <div class="knowledge-meta">核验：{{ item.verification }}</div>
            </div>
          </article>
        </div>
        <el-alert
          class="section-card"
          type="warning"
          :closable="false"
          title="AI 只能推荐经过来源分级的案例和视频；维修手册、厂家技术通报与实车诊断证据优先，外部视频不能直接成为维修结论。"
        />
      </el-tab-pane>

      <el-tab-pane label="权限与小龙虾契约" name="permissions">
        <el-table :data="permissionRows" border>
          <el-table-column prop="role" label="角色" width="140" />
          <el-table-column prop="visible" label="允许查看" min-width="260" />
          <el-table-column prop="draft" label="允许草稿" min-width="210" />
          <el-table-column prop="forbidden" label="禁止事项" min-width="300" />
        </el-table>

        <div class="contract-grid section-card">
          <div v-for="item in assistantContract" :key="item.title" class="contract-card">
            <span>{{ item.order }}</span>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.description }}</p>
            </div>
          </div>
        </div>
        <el-alert
          type="error"
          :closable="false"
          title="小龙虾和其他 AI 不得直接确认付款、库存出库、任务完工、质检放行、正式交车或客户权益；所有请求仍经过正式身份、权限、确认与审计。"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const activeTab = ref('overview');

const workflowSteps = [
  { title: '客户/车辆', description: '身份与关系' },
  { title: '接车检查', description: '照片/症状/里程' },
  { title: '诊断报价', description: '证据与版本' },
  { title: '客户确认', description: '绑定 V3' },
  { title: '维修工单', description: '任务拆解' },
  { title: '配件/施工', description: '领料与工时' },
  { title: '质检交车', description: '复检与资金门' },
  { title: '售后保修', description: '回访与提醒' },
];

const inspectionFindings = [
  { area: '外观检查', result: '前保险杠左侧既有轻微划痕，已作为接车事实单独记录。', level: '已记录', type: 'info' as const },
  { area: '底盘检查', result: '左前下摆臂衬套存在可见裂纹与异常间隙。', level: '需诊断', type: 'warning' as const },
  { area: '制动检查', result: '前制动盘跳动测量值超出演示阈值。', level: '异常', type: 'danger' as const },
  { area: 'OBD 快照', result: '动力系统无当前故障码，快照版本已冻结。', level: '正常', type: 'success' as const },
];

const serviceOpportunities = [
  {
    title: '家庭多车联合检查',
    description: '同一已授权家庭服务组有 2 辆车将在 45 天内进入不同保养窗口；仅生成顾问排程候选。',
    status: '待顾问核对',
    type: 'warning' as const,
  },
  {
    title: '示例社区集中接送',
    description: '同一服务网格存在 4 个匿名化候选；不向客户互相公开身份或地址。',
    status: '路线草稿',
    type: 'info' as const,
  },
  {
    title: '转介绍回访',
    description: '介绍事件已核验，但感谢或奖励仍需现有审批与客户权益流程确认。',
    status: '不可自动执行',
    type: 'danger' as const,
  },
];

const reminderTimeline = [
  {
    title: '保养规则与当前里程已核对（演示）',
    description: '使用适用车型规则 V4 和交车可信里程，不使用全店统一周期。',
    type: 'success' as const,
    hollow: false,
  },
  {
    title: '车内保养灯观测已对账（演示）',
    description: '仪表显示与门店预测在允许误差内；原始照片/诊断快照不会进入 AI。',
    type: 'success' as const,
    hollow: false,
  },
  {
    title: '提前提醒草稿待审核',
    description: '顾问确认联系渠道、免打扰时段和文案后，才能请求正式触达。',
    type: 'warning' as const,
    hollow: true,
  },
  {
    title: '预约与接送尚未发生',
    description: '消息发送、客户已读、预约确认和接送调度是不同状态，不自动串联。',
    type: 'info' as const,
    hollow: true,
  },
];

const maintenanceItems = [
  {
    item: '机油与机油滤清器',
    rule: '12 个月 / 10,000 km，先到为准',
    lastService: '2026-02-18 · 60,340 km（演示）',
    forecast: '约 42 天 / 2,100 km',
    indicator: '剩余 2,100 km / 42 天',
    advance: '30 天 / 1,500 km',
    status: '一致',
    type: 'success' as const,
  },
  {
    item: '制动液检查',
    rule: '24 个月，车型规则 V2',
    lastService: '2025-04-06（演示）',
    forecast: '约 8 个月',
    indicator: '车辆无独立提示',
    advance: '45 天',
    status: '门店计划',
    type: 'info' as const,
  },
  {
    item: '空调滤清器检查',
    rule: '12 个月 / 工况复核',
    lastService: '证据不足',
    forecast: '待人工检查',
    indicator: '不可用',
    advance: '不自动提醒',
    status: '待核对',
    type: 'warning' as const,
  },
];

const aiDiagnosisCards = [
  {
    title: '故障判断辅助',
    badge: '证据驱动',
    type: 'success' as const,
    summary: 'AI 把症状、检查记录、测量值和车型知识整理成候选原因，不代替维修工结论。',
    items: ['列出支持与反证', '标明置信度和未知项', '建议下一项低风险检查'],
  },
  {
    title: '维修方案草稿',
    badge: '人工确认',
    type: 'warning' as const,
    summary: '根据已确认故障生成分项方案、配件建议、工时与风险说明。',
    items: ['每项生成 planItemRef', '替代方案与不修风险分开', '技师确认后才可进入报价'],
  },
  {
    title: '客户解释助手',
    badge: '版本锁定',
    type: 'primary' as const,
    summary: '把技术语言改写成客户可理解说明，并持续比对方案、报价和确认版本。',
    items: ['不夸大故障', '费用与项目逐项一致', '变更必须重新请求客户确认'],
  },
  {
    title: '案例与视频检索',
    badge: '来源分级',
    type: 'info' as const,
    summary: '优先查维修手册、厂家通报和可信培训资料，推荐可复核的案例或视频。',
    items: ['展示来源与适用车型', '提示发布时间和安全风险', '外部内容不得直接触发施工'],
  },
];

const diagnosisCandidates = [
  {
    candidate: '左前下摆臂衬套老化',
    evidence: '举升检查裂纹、撬动间隙、低速颠簸异响位置一致',
    confidence: '78%',
    humanDecision: '维修工复核后确认（演示）',
  },
  {
    candidate: '前制动盘跳动超差',
    evidence: '制动抖动症状与百分表测量结果一致',
    confidence: '84%',
    humanDecision: '质检员复测后确认（演示）',
  },
  {
    candidate: '空调性能下降',
    evidence: '客户未报告、接车检查无充分证据',
    confidence: '22%',
    humanDecision: '排除，不进入本次方案',
  },
];

const planItems = [
  { ref: 'P-001', content: '更换左前下摆臂衬套组件', reason: '裂纹与异常间隙经人工复核', parts: '¥980', labor: '¥520', total: '¥1,500' },
  { ref: 'P-002', content: '更换前制动盘一对并复测', reason: '制动盘跳动测量值超差', parts: '¥1,100', labor: '¥360', total: '¥1,460' },
  { ref: 'P-003', content: '四轮定位与路试复检', reason: '悬挂件施工后的必要校验', parts: '¥0', labor: '¥300', total: '¥300' },
];

const quoteVersions = [
  { version: 'V1', amount: '¥2,980', note: '初步检查草稿，未提交客户。', type: 'info' as const },
  { version: 'V2', amount: '¥3,420', note: '增加未充分证明的建议项，复核后撤回。', type: 'warning' as const },
  { version: 'V3', amount: '¥3,260', note: '仅保留有实车证据的项目，客户确认版本。', type: 'success' as const },
];

const repairTasks = [
  { taskNo: 'T-001', planRef: 'P-001', title: '下摆臂衬套组件更换与扭矩复核', technician: '维修技师（演示）', labor: '2.0h' },
  { taskNo: 'T-002', planRef: 'P-002', title: '前制动盘更换与跳动复测', technician: '制动技师（演示）', labor: '1.5h' },
  { taskNo: 'T-003', planRef: 'P-003', title: '四轮定位、路试与数据归档', technician: '定位技师（演示）', labor: '1.0h' },
];

const parts = [
  { ref: 'PART-DEMO-01', name: '下摆臂衬套组件（演示）', quantity: '1 套', planRef: 'P-001' },
  { ref: 'PART-DEMO-02', name: '前制动盘（演示）', quantity: '2 件', planRef: 'P-002' },
];

const laborItems = [
  { ref: 'LAB-DEMO-01', name: '悬挂件拆装', hours: '2.0h', planRef: 'P-001', amount: '¥520' },
  { ref: 'LAB-DEMO-02', name: '制动盘更换与复测', hours: '1.5h', planRef: 'P-002', amount: '¥360' },
  { ref: 'LAB-DEMO-03', name: '四轮定位与路试', hours: '1.0h', planRef: 'P-003', amount: '¥300' },
];

const knowledgeItems = [
  {
    kind: '案例',
    duration: '技术通报',
    kindClass: 'manual',
    type: 'success' as const,
    sourceLevel: 'A 级来源',
    title: '同平台车型前悬异响诊断路径（演示索引）',
    summary: '从路试复现、举升检查到衬套受力间隙测量的分步案例。',
    appliesTo: '同平台前悬结构，须核对车型和年份',
    verification: '维修手册章节与实车测量双重核验',
  },
  {
    kind: '视频',
    duration: '06:24',
    kindClass: 'video',
    type: 'primary' as const,
    sourceLevel: 'B 级来源',
    title: '下摆臂衬套间隙检查演示（演示索引）',
    summary: '展示安全举升、受力方向和撬动检查要点，不展示真实客户车辆。',
    appliesTo: '培训参考，不替代厂家工艺',
    verification: '维修主管审阅后才可加入内部知识库',
  },
  {
    kind: '视频',
    duration: '08:10',
    kindClass: 'video',
    type: 'warning' as const,
    sourceLevel: '待复核',
    title: '制动盘跳动测量方法（演示候选）',
    summary: 'AI 找到的外部候选内容，当前只显示摘要，不作为施工依据。',
    appliesTo: '需核对量具、扭矩与车型标准',
    verification: '尚待质检负责人确认，默认不可用于结论',
  },
];

const permissionRows = [
  { role: 'OWNER', visible: '公司范围内脱敏经营摘要和授权汽修档案', draft: '可查看 AI 建议与一致性检查', forbidden: '不能通过本只读入口执行任何业务动作' },
  { role: '门店接车顾问', visible: '本门店、本人职责范围内客户与工单', draft: '可生成客户解释与报价草稿', forbidden: '不得代客户确认、确认收款或放行交车' },
  { role: '维修技师', visible: '已分配任务、必要车辆与方案信息', draft: '可请求诊断、方案、案例和视频建议', forbidden: '不得查看无关客户，不得代质检或财务确认' },
  { role: '质检员', visible: '待检任务、施工证据与质检标准', draft: '可生成复检清单草稿', forbidden: '不得跳过返工任务直接复检通过' },
  { role: '客户', visible: '仅本人当前已发布的报价、解释和进度', draft: '不可生成员工内部草稿', forbidden: '不得查看成本、员工草稿、旧版或其他客户资料' },
];

const assistantContract = [
  { order: '01', title: '查询', description: '按调用者正式身份与组织范围查询脱敏档案或进度。' },
  { order: '02', title: '生成草稿', description: '生成诊断、方案、报价解释或沟通草稿，永远不是正式结论。' },
  { order: '03', title: '请求确认', description: '向有权角色发起正式确认请求，AI 本身不能替人确认。' },
  { order: '04', title: '查询进度', description: '只读取正式状态并解释卡点，不得自行推进状态。' },
];
</script>

<style scoped>
.synthetic-demo {
  display: grid;
  min-width: 0;
  gap: 18px;
  padding: 2px 2px 28px;
  color: #263a36;
}

.demo-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border-radius: 16px;
  background: linear-gradient(135deg, #0c4c42, #167466);
  color: #fff;
}

.demo-hero h2 {
  margin: 4px 0 8px;
  font-size: 26px;
}

.demo-hero p {
  max-width: 760px;
  margin: 0;
  line-height: 1.7;
  color: #d9eeea;
}

.eyebrow,
.section-kicker {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hero-badges {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
}

.summary-card {
  display: grid;
  gap: 8px;
  min-height: 104px;
  padding: 18px;
  border: 1px solid #dce8e4;
  border-radius: 12px;
  background: #fff;
}

.summary-card span,
.summary-card small {
  color: #6b7d77;
}

.summary-card strong {
  font-size: 18px;
  color: #153f37;
}

.summary-card.primary {
  border-color: #7ac0b3;
  background: #effaf7;
}

.summary-card.service-due {
  border-color: #e7bd66;
  background: #fffbef;
}

.summary-card.plate strong {
  display: inline-flex;
  width: fit-content;
  padding: 5px 10px;
  border-radius: 6px;
  background: #174f91;
  color: #fff;
  letter-spacing: 0.08em;
}

.flow-panel,
.demo-tabs {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  padding: 20px;
  border: 1px solid #dce8e4;
  border-radius: 14px;
  background: #fff;
}

.demo-tabs {
  overflow: hidden;
}

.demo-tabs :deep(.el-tabs__header),
.demo-tabs :deep(.el-tabs__content) {
  min-width: 0;
  max-width: 100%;
}

.section-heading,
.card-header-inline,
.consistency-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-heading h3 {
  margin: 4px 0 0;
  color: #153f37;
}

.section-heading.compact {
  margin-bottom: 16px;
}

.section-kicker {
  color: #2a8878;
}

.steps-scroll {
  margin-top: 24px;
  overflow-x: auto;
  padding: 6px 0 10px;
}

.steps-scroll :deep(.el-steps) {
  min-width: 980px;
}

.mobile-workflow {
  display: none;
}

.two-column,
.three-column,
.ai-grid,
.knowledge-grid,
.contract-grid {
  display: grid;
  gap: 16px;
}

.two-column {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.three-column {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ai-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.knowledge-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.contract-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.section-card {
  margin-top: 16px;
}

.finding-list {
  display: grid;
  gap: 12px;
}

.opportunity-list {
  display: grid;
  gap: 12px;
}

.opportunity-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 12px;
  border: 1px solid #e6eeeb;
  border-radius: 10px;
  background: #f9fcfb;
}

.opportunity-item p {
  margin: 5px 0 0;
  color: #657770;
  line-height: 1.6;
}

.maintenance-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border: 1px solid #e6c36d;
  border-radius: 12px;
  background: linear-gradient(120deg, #fff9e9, #effaf7);
}

.maintenance-banner > div {
  display: grid;
  gap: 6px;
}

.maintenance-banner span,
.maintenance-banner small {
  color: #756648;
}

.maintenance-banner strong {
  color: #4f481f;
}

.finding-item,
.record-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #edf2f0;
}

.finding-item:last-child,
.record-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.finding-item p,
.record-row p,
.ai-card p,
.ai-card li,
.knowledge-card p,
.contract-card p,
.explanation,
.card-header-inline span {
  color: #657770;
  line-height: 1.65;
}

.finding-item p,
.record-row p,
.contract-card p {
  margin: 4px 0 0;
}

.ai-card,
.knowledge-card,
.contract-card {
  border: 1px solid #dce8e4;
  border-radius: 12px;
  background: #fff;
}

.ai-card {
  padding: 18px;
}

.ai-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.ai-card ul,
.check-list {
  margin: 10px 0 0;
  padding-left: 20px;
}

.consistency-banner {
  padding: 18px;
  border-radius: 12px;
  background: linear-gradient(120deg, #effaf7, #f6fbff);
  border: 1px solid #98d0c5;
}

.consistency-banner div {
  display: grid;
  gap: 6px;
}

.consistency-banner span {
  color: #548078;
  font-size: 13px;
}

.consistency-banner strong {
  color: #0d5c4e;
}

.knowledge-card {
  overflow: hidden;
}

.knowledge-cover {
  display: flex;
  min-height: 110px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 18px;
  color: #fff;
  background: linear-gradient(135deg, #254f78, #397eaa);
}

.knowledge-cover.manual {
  background: linear-gradient(135deg, #215e51, #42a08c);
}

.knowledge-cover span {
  font-size: 24px;
  font-weight: 800;
}

.knowledge-body {
  padding: 18px;
}

.knowledge-body h4 {
  margin: 12px 0 8px;
}

.knowledge-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #71827c;
}

.contract-card {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.contract-card > span {
  display: grid;
  flex: 0 0 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: #e7f5f1;
  color: #167466;
  font-weight: 700;
}

@media (max-width: 1100px) {
  .summary-grid,
  .contract-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .three-column,
  .knowledge-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .demo-hero,
  .section-heading,
  .card-header-inline,
  .consistency-banner,
  .maintenance-banner,
  .opportunity-item {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid,
  .two-column,
  .ai-grid,
  .contract-grid {
    grid-template-columns: 1fr;
  }

  .flow-panel,
  .demo-tabs {
    padding: 14px;
  }

  .steps-scroll {
    display: none;
  }

  .mobile-workflow {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 18px;
  }

  .mobile-workflow-item {
    display: flex;
    min-width: 0;
    gap: 9px;
    padding: 10px;
    border: 1px solid #dce8e4;
    border-radius: 10px;
    background: #f7fbfa;
  }

  .mobile-workflow-item > span {
    display: grid;
    flex: 0 0 24px;
    height: 24px;
    place-items: center;
    border-radius: 50%;
    background: #2f9f5b;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
  }

  .mobile-workflow-item > div {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .mobile-workflow-item strong,
  .mobile-workflow-item small {
    overflow-wrap: anywhere;
  }

  .mobile-workflow-item small {
    color: #71827c;
  }

  .demo-tabs :deep(.el-descriptions__body table) {
    table-layout: fixed;
  }

  .demo-tabs :deep(.el-descriptions__label.el-descriptions__cell) {
    width: 92px;
  }

  .demo-tabs :deep(.el-descriptions__content.el-descriptions__cell) {
    overflow-wrap: anywhere;
  }
}
</style>
