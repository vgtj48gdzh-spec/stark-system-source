<template>
  <div class="page-shell">
    <div class="page-heading">
      <div>
        <h1>小组经营与人工成本</h1>
        <p>按完全人工成本计算经营保底，先配置证据，再生成可追溯目标快照。</p>
      </div>
      <el-button
        type="primary"
        :disabled="!canManageGroup"
        @click="groupDialogVisible = true"
      >
        新建经营小组
      </el-button>
    </div>

    <el-alert
      v-if="!formalActorIdentityBound"
      title="当前为本地演示身份，只能查看和预览；发布组织、工资结构、日历或目标必须绑定正式身份。"
      type="warning"
      show-icon
      :closable="false"
      class="identity-alert"
    />

    <el-card shadow="never">
      <div class="toolbar">
        <el-select
          v-model="selectedGroupId"
          placeholder="请选择经营小组"
          filterable
          class="group-select"
          @change="loadSelectedGroup"
        >
          <el-option
            v-for="group in groups"
            :key="group.id"
            :label="`${group.groupName}（${group.groupCode}）`"
            :value="group.id"
          />
        </el-select>
        <el-date-picker
          v-model="settlementPeriod"
          type="month"
          value-format="YYYY-MM"
          format="YYYY 年 MM 月"
          placeholder="选择结算月份"
          @change="loadPeriodContext"
        />
        <el-button :loading="loading" @click="refreshAll">刷新</el-button>
      </div>

      <el-empty v-if="!groups.length && !loading" description="尚未建立经营小组" />

      <template v-if="selectedGroup">
        <el-descriptions :column="3" border class="group-summary">
          <el-descriptions-item label="小组">{{ selectedGroup.groupName }}</el-descriptions-item>
          <el-descriptions-item label="公司范围">{{ selectedGroup.companyRef }}</el-descriptions-item>
          <el-descriptions-item label="板块 / 门店">
            {{ selectedGroup.businessSectorRef || '公司级' }} / {{ selectedGroup.storeRef || '全部门店' }}
          </el-descriptions-item>
          <el-descriptions-item label="在册成员">{{ activeMemberCount }} 人</el-descriptions-item>
          <el-descriptions-item label="安全系数规则">{{ selectedGroup.safetyFactorPolicyVersionId }}</el-descriptions-item>
          <el-descriptions-item label="爬坡规则">{{ selectedGroup.rampUpPolicyVersionId }}</el-descriptions-item>
        </el-descriptions>

        <div class="metric-grid">
          <div class="metric-card">
            <span>当期完全人工成本</span>
            <strong>{{ formatCents(displayedTarget?.groupFixedLaborCostCents) }}</strong>
          </div>
          <div class="metric-card">
            <span>经营保底</span>
            <strong>{{ formatCents(displayedTarget?.breakEvenTargetCents) }}</strong>
          </div>
          <div class="metric-card">
            <span>目标状态</span>
            <strong>{{ targetStatusLabel(displayedTarget?.calculationStatus) }}</strong>
          </div>
          <div class="metric-card">
            <span>目标版本</span>
            <strong>{{ displayedTarget ? `第 ${displayedTarget.calculationVersion} 版` : '尚未生成' }}</strong>
          </div>
          <div class="metric-card">
            <span>实际有效贡献</span>
            <strong>{{ formatCents(contributionSummary?.validContributionMarginCents) }}</strong>
          </div>
          <div class="metric-card">
            <span>经营保底完成率</span>
            <strong>{{ formatRateBps(contributionSummary?.achievement.achievementRateBps) }}</strong>
          </div>
        </div>

        <el-tabs v-model="activeTab" class="workspace-tabs">
          <el-tab-pane label="成员与岗位" name="members">
            <div class="section-heading">
              <h2>成员生效关系</h2>
              <el-button
                type="primary"
                plain
                :disabled="!canManageGroup"
                @click="memberDialogVisible = true"
              >
                增加成员
              </el-button>
            </div>
            <el-table :data="groupMembers" border row-key="id">
              <el-table-column prop="employeeId" label="员工" min-width="180">
                <template #default="{ row }">
                  {{ employeeLabel(row.employeeId) }}
                </template>
              </el-table-column>
              <el-table-column prop="jobLevel" label="层级" width="90" />
              <el-table-column prop="roleCode" label="岗位编码" min-width="150" show-overflow-tooltip />
              <el-table-column prop="effectiveFrom" label="生效日期" min-width="130" />
              <el-table-column prop="effectiveTo" label="结束日期" min-width="130">
                <template #default="{ row }">{{ row.effectiveTo || '持续有效' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="230" fixed="right">
                <template #default="{ row }">
                  <el-button
                    link
                    type="primary"
                    :disabled="!canViewCompensation"
                    @click="openCompensation(row.employeeId)"
                  >
                    工资结构
                  </el-button>
                  <el-button
                    v-if="!row.effectiveTo"
                    link
                    type="danger"
                    :disabled="!canManageGroup"
                    @click="endMember(row)"
                  >
                    结束关系
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="完全人工成本" name="compensation">
            <div class="section-heading">
              <div>
                <h2>工资结构版本</h2>
                <p>岗位绩效按满额预算计入完全人工成本；金额全部以整数分保存。</p>
              </div>
              <div class="inline-actions">
                <el-select
                  v-model="compensationEmployeeId"
                  filterable
                  placeholder="选择本组员工"
                  @change="loadCompensationProfiles"
                >
                  <el-option
                    v-for="member in uniqueMembers"
                    :key="member.employeeId"
                    :label="employeeLabel(member.employeeId)"
                    :value="member.employeeId"
                  />
                </el-select>
                <el-button
                  type="primary"
                  :disabled="!canManageCompensation || !compensationEmployeeId"
                  @click="compensationDialogVisible = true"
                >
                  发布新版本
                </el-button>
              </div>
            </div>
            <el-table :data="compensationProfiles" border row-key="id">
              <el-table-column prop="version" label="版本" width="80" />
              <el-table-column prop="effectiveFrom" label="生效日期" min-width="130" />
              <el-table-column prop="effectiveTo" label="结束日期" min-width="130">
                <template #default="{ row }">{{ row.effectiveTo || '持续有效' }}</template>
              </el-table-column>
              <el-table-column prop="baseGuaranteeCents" label="基础保障" min-width="130">
                <template #default="{ row }">{{ formatCents(row.baseGuaranteeCents) }}</template>
              </el-table-column>
              <el-table-column prop="positionPerformanceBudgetCents" label="岗位绩效预算" min-width="150">
                <template #default="{ row }">{{ formatCents(row.positionPerformanceBudgetCents) }}</template>
              </el-table-column>
              <el-table-column prop="employerSocialCostCents" label="公司社保" min-width="130">
                <template #default="{ row }">{{ formatCents(row.employerSocialCostCents) }}</template>
              </el-table-column>
              <el-table-column prop="fixedBenefitCostCents" label="固定福利" min-width="130">
                <template #default="{ row }">{{ formatCents(row.fixedBenefitCostCents) }}</template>
              </el-table-column>
              <el-table-column prop="fullyLoadedLaborCostCents" label="完全人工成本" min-width="150">
                <template #default="{ row }">
                  <strong>{{ formatCents(row.fullyLoadedLaborCostCents) }}</strong>
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">{{ profileStatusLabel(row.status) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="经营贡献" name="contribution">
            <el-alert
              title="本页只读：只汇总已确认、已冲销及追加更正；待确认草稿不计入。经营奖励门槛只表示是否达标，不代表奖励已经生成。"
              type="info"
              show-icon
              :closable="false"
              class="contribution-alert"
            />
            <el-alert
              v-if="contributionSummaryLoadFailed"
              title="经营贡献汇总暂不可用；页面不会生成推测结果，请稍后重试或检查只读接口。"
              type="error"
              show-icon
              :closable="false"
              class="contribution-alert"
            />
            <el-alert
              v-if="contributionSummary?.achievement.calculationStatus === 'calculation_blocked'"
              :title="achievementBlockerLabel(
                contributionSummary.achievement.blockedReasonCode,
                contributionSummary.formalSourceCoverage,
              )"
              type="warning"
              show-icon
              :closable="false"
              class="contribution-alert"
            />
            <div class="contribution-summary">
              <el-statistic
                title="实际有效贡献"
                :value="formatCents(contributionSummary?.validContributionMarginCents)"
              />
              <el-statistic
                title="经营保底"
                :value="formatCents(contributionSummary?.targetSnapshot?.breakEvenTargetCents)"
              />
              <el-statistic
                title="完成率"
                :value="formatRateBps(contributionSummary?.achievement.achievementRateBps)"
              />
              <el-statistic
                title="超额贡献"
                :value="formatCents(contributionSummary?.achievement.excessMarginCents)"
              />
              <el-statistic
                title="经营状态"
                :value="operatingStatusLabel(
                  contributionSummary?.achievement.operatingStatus,
                  contributionSummary?.achievement.blockedReasonCode,
                )"
              />
              <el-statistic
                title="经营奖励门槛"
                :value="rewardGateLabel(contributionSummary)"
              />
            </div>
            <div class="section-heading contribution-heading">
              <div>
                <h2>业务板块贡献拆分</h2>
                <p>金额来自统一贡献台账的有效快照；正式来源适配器仍由后端门禁控制。</p>
              </div>
            </div>
            <el-table v-if="contributionDomainRows.length" :data="contributionDomainRows" border>
              <el-table-column prop="domainLabel" label="业务板块" min-width="150" />
              <el-table-column prop="count" label="有效记录" width="110" />
              <el-table-column prop="correctionCount" label="追加更正" width="110" />
              <el-table-column prop="marginCents" label="有效贡献" min-width="150">
                <template #default="{ row }">{{ formatCents(row.marginCents) }}</template>
              </el-table-column>
            </el-table>
            <el-empty
              v-else
              :description="contributionSummaryLoadFailed ? '汇总读取失败' : '当期暂无已确认经营贡献'"
            />
          </el-tab-pane>

          <el-tab-pane label="日历与经营保底" name="target">
            <div class="two-column-grid">
              <el-card shadow="never" class="inner-card">
                <template #header>
                  <div class="card-header">
                    <span>公司计薪日历</span>
                    <el-button
                      link
                      type="primary"
                      :disabled="!canManageTarget"
                      @click="calendarDialogVisible = true"
                    >
                      发布日历
                    </el-button>
                  </div>
                </template>
                <el-table :data="calendarRules" border size="small">
                  <el-table-column prop="calendarRuleVersionId" label="规则版本" min-width="170" show-overflow-tooltip />
                  <el-table-column prop="standardPayrollDays" label="标准天数" width="100" />
                  <el-table-column prop="version" label="发布序号" width="100" />
                </el-table>
              </el-card>

              <el-card shadow="never" class="inner-card">
                <template #header>
                  <div class="card-header">
                    <span>小组目标政策</span>
                    <el-button
                      link
                      type="primary"
                      :disabled="!canManageTarget || !calendarRules.length"
                      @click="policyDialogVisible = true"
                    >
                      发布政策
                    </el-button>
                  </div>
                </template>
                <el-table :data="targetPolicies" border size="small">
                  <el-table-column prop="policyVersionId" label="政策版本" min-width="170" show-overflow-tooltip />
                  <el-table-column label="安全系数" width="100">
                    <template #default="{ row }">{{ formatFactor(row.safetyFactorBps) }}</template>
                  </el-table-column>
                  <el-table-column label="爬坡系数" width="100">
                    <template #default="{ row }">{{ formatFactor(row.rampFactorBps) }}</template>
                  </el-table-column>
                  <el-table-column prop="status" label="状态" width="100">
                    <template #default="{ row }">{{ policyStatusLabel(row.status) }}</template>
                  </el-table-column>
                </el-table>
              </el-card>
            </div>

            <el-card shadow="never" class="preview-card">
              <template #header>
                <div class="card-header">
                  <span>确定性计算输入预览</span>
                  <div class="inline-actions">
                    <el-select v-model="selectedPolicyVersionId" placeholder="选择已批准政策">
                      <el-option
                        v-for="policy in approvedTargetPolicies"
                        :key="policy.id"
                        :label="policy.policyVersionId"
                        :value="policy.policyVersionId"
                      />
                    </el-select>
                    <el-button
                      :disabled="!selectedPolicyVersionId || !canViewTarget"
                      :loading="previewLoading"
                      @click="previewTargetInput"
                    >
                      生成预览
                    </el-button>
                    <el-button
                      type="primary"
                      :disabled="!canCalculateTarget"
                      :loading="calculateLoading"
                      @click="confirmCalculateTarget"
                    >
                      确认生成目标快照
                    </el-button>
                  </div>
                </div>
              </template>

              <el-alert
                v-if="targetInputPreview?.status === 'calculation_blocked'"
                :title="targetInputPreview.blockers.join('；')"
                type="error"
                show-icon
                :closable="false"
              />
              <div v-if="targetInputPreview?.status === 'ready'" class="preview-summary">
                <el-statistic title="完全人工成本" :value="formatCents(targetInputPreview.groupFixedLaborCostCents)" />
                <el-statistic title="经营保底" :value="formatCents(targetInputPreview.breakEvenTargetCents)" />
                <el-statistic title="成员关系段" :value="targetInputPreview.members.length" suffix="段" />
              </div>
              <el-table v-if="targetInputPreview?.members.length" :data="targetInputPreview.members" border>
                <el-table-column prop="employeeId" label="员工" min-width="180">
                  <template #default="{ row }">{{ employeeLabel(Number(row.employeeId)) }}</template>
                </el-table-column>
                <el-table-column prop="jobLevel" label="层级" width="90" />
                <el-table-column prop="activePayrollDays" label="有效计薪天数" width="130" />
                <el-table-column prop="proratedLaborCostCents" label="当期人工成本" min-width="150">
                  <template #default="{ row }">{{ formatCents(String(row.proratedLaborCostCents)) }}</template>
                </el-table-column>
                <el-table-column prop="allocatedLaborCostCents" label="计入本组成本" min-width="150">
                  <template #default="{ row }">{{ formatCents(String(row.allocatedLaborCostCents)) }}</template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-tab-pane>

          <el-tab-pane label="增员影响" name="hiring">
            <el-form label-width="150px" class="compact-form">
              <el-form-item label="基础保障工资（元）"><el-input v-model="hiringForm.baseGuaranteeYuan" /></el-form-item>
              <el-form-item label="岗位绩效预算（元）"><el-input v-model="hiringForm.positionPerformanceBudgetYuan" /></el-form-item>
              <el-form-item label="公司社保（元）"><el-input v-model="hiringForm.employerSocialCostYuan" /></el-form-item>
              <el-form-item label="固定福利成本（元）"><el-input v-model="hiringForm.fixedBenefitCostYuan" /></el-form-item>
              <el-form-item label="其他固定成本（元）"><el-input v-model="hiringForm.otherFixedEmploymentCostYuan" /></el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  :disabled="!canPreviewHiring || !latestTarget"
                  :loading="hiringLoading"
                  @click="previewHiring"
                >
                  测算增员影响
                </el-button>
              </el-form-item>
            </el-form>
            <el-descriptions v-if="hiringPreview" :column="2" border>
              <el-descriptions-item label="新增完全人工成本">{{ formatCents(hiringPreview.addedFullyLoadedLaborCostCents) }}</el-descriptions-item>
              <el-descriptions-item label="新增边际经营要求">{{ formatCents(hiringPreview.marginalTargetCents) }}</el-descriptions-item>
              <el-descriptions-item label="当前经营保底">{{ formatCents(hiringPreview.currentBreakEvenTargetCents) }}</el-descriptions-item>
              <el-descriptions-item label="增员后经营保底"><strong>{{ formatCents(hiringPreview.projectedBreakEvenTargetCents) }}</strong></el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-card>

    <el-dialog v-model="groupDialogVisible" title="新建经营小组" width="720px">
      <el-form label-width="150px">
        <el-form-item label="小组编码"><el-input v-model="groupForm.groupCode" placeholder="例如 fresh-water-01" /></el-form-item>
        <el-form-item label="小组名称"><el-input v-model="groupForm.groupName" /></el-form-item>
        <el-form-item label="公司引用"><el-input v-model="groupForm.companyRef" /></el-form-item>
        <el-form-item label="业务板块引用"><el-input v-model="groupForm.businessSectorRef" clearable /></el-form-item>
        <el-form-item label="门店引用"><el-input v-model="groupForm.storeRef" clearable /></el-form-item>
        <el-form-item label="组长"><employee-select v-model="groupForm.leaderEmployeeId" :employees="employees" /></el-form-item>
        <el-form-item label="业务负责人"><employee-select v-model="groupForm.businessOwnerEmployeeId" :employees="employees" /></el-form-item>
        <el-form-item label="成立日期"><el-date-picker v-model="groupForm.establishedAt" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="安全系数规则族"><el-input v-model="groupForm.safetyFactorPolicyVersionId" /></el-form-item>
        <el-form-item label="爬坡规则族"><el-input v-model="groupForm.rampUpPolicyVersionId" /></el-form-item>
        <el-form-item label="变更原因"><el-input v-model="groupForm.reason" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitGroup">确认创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="memberDialogVisible" title="增加小组成员" width="620px">
      <el-form label-width="140px">
        <el-form-item label="员工"><employee-select v-model="memberForm.employeeId" :employees="employees" /></el-form-item>
        <el-form-item label="岗位层级">
          <el-select v-model="memberForm.jobLevel">
            <el-option v-for="level in ['L0', 'L1', 'L2', 'L3']" :key="level" :label="level" :value="level" />
          </el-select>
        </el-form-item>
        <el-form-item label="岗位编码"><el-input v-model="memberForm.roleCode" placeholder="例如 business_development" /></el-form-item>
        <el-form-item label="生效日期"><el-date-picker v-model="memberForm.effectiveFrom" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="memberForm.effectiveTo" type="date" value-format="YYYY-MM-DD" clearable /></el-form-item>
        <el-form-item label="责任权重（%）"><el-input-number v-model="memberForm.responsibilityWeightPercent" :min="1" :max="100" /></el-form-item>
        <el-form-item label="变更原因"><el-input v-model="memberForm.reason" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="memberDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitMember">确认增加</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="compensationDialogVisible" title="发布工资结构版本" width="680px">
      <el-alert title="现金福利抵扣尚未接入权威规则，本阶段固定为 0 元。" type="info" :closable="false" />
      <el-form label-width="170px" class="dialog-form">
        <el-form-item label="基础保障工资（元）"><el-input v-model="compensationForm.baseGuaranteeYuan" /></el-form-item>
        <el-form-item label="岗位绩效满额预算（元）"><el-input v-model="compensationForm.positionPerformanceBudgetYuan" /></el-form-item>
        <el-form-item label="公司承担社保（元）"><el-input v-model="compensationForm.employerSocialCostYuan" /></el-form-item>
        <el-form-item label="固定福利成本（元）"><el-input v-model="compensationForm.fixedBenefitCostYuan" /></el-form-item>
        <el-form-item label="其他固定用工成本（元）"><el-input v-model="compensationForm.otherFixedEmploymentCostYuan" /></el-form-item>
        <el-form-item label="生效日期"><el-date-picker v-model="compensationForm.effectiveFrom" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="compensationForm.effectiveTo" type="date" value-format="YYYY-MM-DD" clearable /></el-form-item>
        <el-form-item label="变更原因"><el-input v-model="compensationForm.reason" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="compensationDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitCompensation">确认发布</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="calendarDialogVisible" title="发布公司计薪日历" width="680px">
      <el-form label-width="150px">
        <el-form-item label="公司引用"><el-input :model-value="selectedGroup?.companyRef" disabled /></el-form-item>
        <el-form-item label="结算月份"><el-input :model-value="settlementPeriod" disabled /></el-form-item>
        <el-form-item label="日历规则版本"><el-input v-model="calendarForm.calendarRuleVersionId" /></el-form-item>
        <el-form-item label="计薪日期">
          <el-input v-model="calendarForm.payrollDatesText" type="textarea" :rows="6" placeholder="每行一个 YYYY-MM-DD，也可用逗号分隔" />
        </el-form-item>
        <el-form-item label="发布原因"><el-input v-model="calendarForm.reason" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="calendarDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitCalendar">确认发布</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="policyDialogVisible" title="发布小组目标政策" width="680px">
      <el-form label-width="170px">
        <el-form-item label="政策版本"><el-input v-model="policyForm.policyVersionId" /></el-form-item>
        <el-form-item label="计薪日历">
          <el-select v-model="policyForm.calendarRuleVersionId" @change="syncPolicyCalendarDays">
            <el-option v-for="rule in calendarRules" :key="rule.id" :label="`${rule.calendarRuleVersionId}（${rule.standardPayrollDays} 天）`" :value="rule.calendarRuleVersionId" />
          </el-select>
        </el-form-item>
        <el-form-item label="安全系数"><el-input-number v-model="policyForm.safetyFactor" :min="0.0001" :max="10" :step="0.05" :precision="4" /></el-form-item>
        <el-form-item label="爬坡系数"><el-input-number v-model="policyForm.rampFactor" :min="0.0001" :max="1" :step="0.25" :precision="4" /></el-form-item>
        <el-form-item label="标准计薪天数"><el-input-number v-model="policyForm.standardPayrollDays" :min="1" :max="31" disabled /></el-form-item>
        <el-form-item label="安全系数规则族"><el-input :model-value="selectedGroup?.safetyFactorPolicyVersionId" disabled /></el-form-item>
        <el-form-item label="爬坡规则族"><el-input :model-value="selectedGroup?.rampUpPolicyVersionId" disabled /></el-form-item>
        <el-form-item label="发布原因"><el-input v-model="policyForm.reason" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="policyDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitPolicy">确认发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox, ElOption, ElSelect } from 'element-plus';
import { getEmployees } from '../../api/performance';
import {
  addOrganizationGroupMember,
  calculateGroupTarget,
  createCompensationProfile,
  createGroupTargetPolicy,
  createOrganizationGroup,
  createPayrollCalendarRule,
  endOrganizationGroupMember,
  getCompensationProfiles,
  getGroupContributionSummary,
  getGroupTargetPolicies,
  getLatestGroupTarget,
  getOrganizationGroup,
  getOrganizationGroups,
  getPayrollCalendarRules,
  previewGroupHiringImpact,
  previewGroupTargetCalculationInput,
  type CommandMetadata,
  type CompensationProfile,
  type GroupContributionSummary,
  type GroupMember,
  type GroupOperatingStatus,
  type GroupTarget,
  type GroupTargetInputPreview,
  type GroupTargetPolicy,
  type HiringImpactPreview,
  type OrganizationGroup,
  type PayrollCalendarRule,
} from '../../api/group-operations';
import {
  formalActorIdentityBound,
  hasAnyRole,
  hasPermission,
} from '../../utils/permissions';
import { companyDateKey, companyPeriodKey } from '../../utils/company-calendar';
import {
  fetchAllAtApiPageLimit,
  type ApiPagePayload,
} from '../../utils/paginated-fetch';

interface EmployeeOption {
  id: number;
  name: string;
  positionName?: string | null;
  sourceCompanyName?: string | null;
}

const EmployeeSelect = defineComponent({
  name: 'EmployeeSelect',
  props: {
    modelValue: { type: Number, default: undefined },
    employees: { type: Array as () => EmployeeOption[], required: true },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        ElSelect,
        {
          modelValue: props.modelValue,
          filterable: true,
          clearable: true,
          placeholder: '选择员工',
          style: { width: '100%' },
          'onUpdate:modelValue': (value: number | undefined) => emit('update:modelValue', value),
        },
        () =>
          props.employees.map((employee) =>
            h(ElOption, {
              key: employee.id,
              value: employee.id,
              label: `${employee.name}（员工 ${employee.id}${employee.positionName ? ` · ${employee.positionName}` : ''}）`,
            }),
          ),
      );
  },
});

const loading = ref(false);
const previewLoading = ref(false);
const calculateLoading = ref(false);
const hiringLoading = ref(false);
const submitLoading = ref(false);
const groups = ref<OrganizationGroup[]>([]);
const selectedGroupId = ref<number>();
const selectedGroup = ref<OrganizationGroup>();
const groupMembers = ref<GroupMember[]>([]);
const employees = ref<EmployeeOption[]>([]);
const compensationEmployeeId = ref<number>();
const compensationProfiles = ref<CompensationProfile[]>([]);
const calendarRules = ref<PayrollCalendarRule[]>([]);
const targetPolicies = ref<GroupTargetPolicy[]>([]);
const latestTarget = ref<GroupTarget>();
const contributionSummary = ref<GroupContributionSummary>();
const contributionSummaryLoadFailed = ref(false);
const targetInputPreview = ref<GroupTargetInputPreview>();
const hiringPreview = ref<HiringImpactPreview>();
const selectedPolicyVersionId = ref('');
const activeTab = ref('members');
const settlementPeriod = ref(currentPeriod());

const groupDialogVisible = ref(false);
const memberDialogVisible = ref(false);
const compensationDialogVisible = ref(false);
const calendarDialogVisible = ref(false);
const policyDialogVisible = ref(false);

const groupForm = ref(newGroupForm());
const memberForm = ref(newMemberForm());
const compensationForm = ref(newCompensationForm());
const calendarForm = ref(newCalendarForm());
const policyForm = ref(newPolicyForm());
const hiringForm = ref(newHiringForm());
const commandAttempts = new Map<string, Omit<CommandMetadata, 'reason'>>();
let selectedGroupLoadSequence = 0;
let periodContextLoadSequence = 0;

const canManageGroup = computed(() => hasPermission('groupOperations.group.manage'));
const canViewCompensation = computed(() => hasPermission('groupOperations.compensation.view'));
const canManageCompensation = computed(() => hasPermission('groupOperations.compensation.manage'));
const canViewTarget = computed(() => hasPermission('groupOperations.target.view'));
const canManageTarget = computed(() => hasPermission('groupOperations.target.manage'));
const canPreviewHiring = computed(() => hasPermission('groupOperations.hiringPreview'));
const canCalculateTarget = computed(
  () =>
    canManageTarget.value &&
    targetInputPreview.value?.status === 'ready' &&
    Boolean(targetInputPreview.value.calculationInput),
);
const approvedTargetPolicies = computed(() =>
  targetPolicies.value.filter((policy) => policy.status === 'approved'),
);
const displayedTarget = computed(
  () => contributionSummary.value?.targetSnapshot ?? latestTarget.value,
);
const contributionDomainRows = computed(() => {
  const domainOrder = new Map(
    ['fresh', 'water', 'repair', 'software'].map((domain, index) => [domain, index]),
  );
  return Object.entries(contributionSummary.value?.byBusinessDomain ?? {})
    .map(([domain, value]) => ({
      domain,
      domainLabel: businessDomainLabel(domain),
      ...value,
    }))
    .sort(
      (left, right) =>
        (domainOrder.get(left.domain) ?? Number.MAX_SAFE_INTEGER) -
          (domainOrder.get(right.domain) ?? Number.MAX_SAFE_INTEGER) ||
        left.domain.localeCompare(right.domain),
    );
});
const uniqueMembers = computed(() => {
  const seen = new Set<number>();
  return groupMembers.value.filter((member) => {
    if (seen.has(member.employeeId)) return false;
    seen.add(member.employeeId);
    return true;
  });
});
const activeMemberCount = computed(
  () => new Set(groupMembers.value.filter((member) => !member.effectiveTo).map((member) => member.employeeId)).size,
);
const employeeById = computed(() => new Map(employees.value.map((employee) => [employee.id, employee])));

function currentPeriod() {
  return companyPeriodKey();
}

function currentDate() {
  return companyDateKey();
}

function newGroupForm() {
  return {
    groupCode: '', groupName: '', companyRef: '', businessSectorRef: '', storeRef: '',
    leaderEmployeeId: undefined as number | undefined,
    businessOwnerEmployeeId: undefined as number | undefined,
    establishedAt: currentDate(), safetyFactorPolicyVersionId: 'safety-factor-v1',
    rampUpPolicyVersionId: 'ramp-up-v1', reason: '建立经营小组并明确经营责任',
  };
}

function newMemberForm() {
  return {
    employeeId: undefined as number | undefined, jobLevel: 'L0' as 'L0' | 'L1' | 'L2' | 'L3',
    roleCode: '', effectiveFrom: currentDate(), effectiveTo: '', responsibilityWeightPercent: 100,
    reason: '成员加入经营小组',
  };
}

function newCompensationForm() {
  return {
    baseGuaranteeYuan: '', positionPerformanceBudgetYuan: '', employerSocialCostYuan: '',
    fixedBenefitCostYuan: '', otherFixedEmploymentCostYuan: '0', effectiveFrom: currentDate(),
    effectiveTo: '', reason: '发布完全人工成本结构版本',
  };
}

function newCalendarForm() {
  return { calendarRuleVersionId: '', payrollDatesText: '', reason: '发布公司当期计薪日历' };
}

function newPolicyForm() {
  return {
    policyVersionId: '', calendarRuleVersionId: '', safetyFactor: 1.5, rampFactor: 1,
    standardPayrollDays: 0, reason: '发布小组当期经营保底政策',
  };
}

function newHiringForm() {
  return {
    baseGuaranteeYuan: '2020', positionPerformanceBudgetYuan: '980', employerSocialCostYuan: '1000',
    fixedBenefitCostYuan: '200', otherFixedEmploymentCostYuan: '0',
  };
}

function unwrap<T>(response: { data?: { data?: T } }): T {
  return response.data?.data as T;
}

function commandMetadata(action: string, reason: string): CommandMetadata {
  let attempt = commandAttempts.get(action);
  if (!attempt) {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    attempt = {
      sourceChannel: 'hq_web',
      correlationId: `gov1:${action}:${id}`,
      idempotencyKey: `gov1:${action}:${id}`,
    };
    commandAttempts.set(action, attempt);
  }
  return { ...attempt, reason: reason.trim() };
}

function completeCommand(action: string) {
  commandAttempts.delete(action);
}

function requireText(value: string, label: string) {
  if (!value?.trim()) throw new Error(`请填写${label}`);
  return value.trim();
}

function yuanToCents(value: string, label: string) {
  const normalized = String(value ?? '').trim();
  const match = /^(0|[1-9]\d{0,15})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error(`${label}必须是非负金额，最多保留两位小数`);
  return (BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')).toString();
}

function formatCents(value?: string | null) {
  if (value === undefined || value === null || !/^-?\d+$/.test(String(value))) return '—';
  const amount = BigInt(String(value));
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  return `${negative ? '-' : ''}¥${(absolute / 100n).toLocaleString('zh-CN')}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

function formatFactor(value: number) {
  return (value / 10_000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function formatRateBps(value?: string | null) {
  if (value === undefined || value === null || !/^-?\d+$/.test(String(value))) return '—';
  const rate = BigInt(String(value));
  const negative = rate < 0n;
  const absolute = negative ? -rate : rate;
  return `${negative ? '-' : ''}${absolute / 100n}.${(absolute % 100n)
    .toString()
    .padStart(2, '0')}%`;
}

function businessDomainLabel(domain: string) {
  return (
    {
      fresh: '生鲜',
      water: '斯塔克水业',
      repair: '汽修',
      software: '软件',
    } as Record<string, string>
  )[domain] ?? domain;
}

function operatingStatusLabel(
  status?: GroupOperatingStatus | 'calculation_blocked',
  blockedReasonCode?: string | null,
) {
  if (
    status === 'calculation_blocked' &&
    blockedReasonCode === 'formal_contribution_source_coverage_incomplete'
  ) {
    return '数据未接入';
  }
  return (
    {
      excellent: '优秀',
      achieved: '达标',
      warning: '预警',
      severe_warning: '严重预警',
      business_failure: '经营失败',
      calculation_blocked: '计算阻断',
    } as Record<string, string>
  )[status ?? ''] ?? '—';
}

function achievementBlockerLabel(
  code?: string | null,
  coverage?: GroupContributionSummary['formalSourceCoverage'],
) {
  if (code === 'formal_contribution_source_coverage_incomplete') {
    const progress = coverage
      ? `（${coverage.readyDomainCount}/${coverage.requiredDomainCount}）`
      : '';
    return `正式经营贡献来源尚未完整接入${progress}；当前金额只表示已入账记录，不能据此判断完成率或经营失败。`;
  }
  return (
    {
      group_target_missing: '当期经营保底尚未生成，完成率保持计算阻断。',
      group_target_calculation_blocked: '当期经营保底仍处于计算阻断状态。',
      group_target_recalculation_required: '当期经营保底需要重算，完成率暂不出结论。',
      group_target_lock_state_inconsistent: '当期经营保底冻结状态不一致，完成率保持计算阻断。',
      group_target_snapshot_invalid: '当期经营保底快照无效，完成率保持计算阻断。',
    } as Record<string, string>
  )[code ?? ''] ?? '当期经营保底不可用于计算，完成率保持阻断。';
}

function rewardGateLabel(summary?: GroupContributionSummary) {
  if (!summary || summary.achievement.calculationStatus === 'calculation_blocked') return '未计算';
  return summary.achievement.rewardGateOpen ? '达到（不等于已生成）' : '未达到';
}

function employeeLabel(id: number) {
  const employee = employeeById.value.get(id);
  return employee ? `${employee.name}（员工 ${id}）` : `员工 ${id}`;
}

function targetStatusLabel(status?: GroupTarget['calculationStatus']) {
  return ({ calculated: '已计算', calculation_blocked: '计算阻断', recalculation_required: '需要重算', locked: '已冻结' } as Record<string, string>)[status ?? ''] ?? '尚未生成';
}

function profileStatusLabel(status: CompensationProfile['status']) {
  return status === 'approved' ? '有效' : '已替代';
}

function policyStatusLabel(status: GroupTargetPolicy['status']) {
  return status === 'approved' ? '已批准' : '已替代';
}

async function loadEmployees() {
  if (!hasAnyRole(['admin', 'finance', 'founder', 'super_admin', 'owner'])) {
    employees.value = [];
    return;
  }
  try {
    employees.value = await fetchAllAtApiPageLimit<EmployeeOption>(async ({ page, pageSize }) => {
      const response = await getEmployees({ status: 1, page, pageSize, sortBy: 'name', sortOrder: 'ASC' });
      return unwrap<ApiPagePayload<EmployeeOption>>(response);
    });
  } catch {
    employees.value = [];
  }
}

async function loadGroups() {
  const response = await getOrganizationGroups({ status: 'active' });
  groups.value = unwrap<OrganizationGroup[]>(response) ?? [];
  if (!selectedGroupId.value || !groups.value.some((group) => group.id === selectedGroupId.value)) {
    selectedGroupId.value = groups.value[0]?.id;
  }
}

async function loadSelectedGroup() {
  const requestSequence = ++selectedGroupLoadSequence;
  const groupId = selectedGroupId.value;
  targetInputPreview.value = undefined;
  hiringPreview.value = undefined;
  contributionSummary.value = undefined;
  contributionSummaryLoadFailed.value = false;
  compensationProfiles.value = [];
  if (!groupId) {
    selectedGroup.value = undefined;
    groupMembers.value = [];
    return;
  }
  const response = await getOrganizationGroup(groupId);
  if (requestSequence !== selectedGroupLoadSequence || groupId !== selectedGroupId.value) return;
  const detail = unwrap<{ group: OrganizationGroup; members: GroupMember[] }>(response);
  selectedGroup.value = detail.group;
  groupMembers.value = detail.members;
  compensationEmployeeId.value = uniqueMembers.value[0]?.employeeId;
  await Promise.all([loadCompensationProfiles(), loadPeriodContext()]);
}

async function loadCompensationProfiles() {
  compensationProfiles.value = [];
  if (!compensationEmployeeId.value || !canViewCompensation.value) return;
  const response = await getCompensationProfiles(compensationEmployeeId.value);
  compensationProfiles.value = unwrap<CompensationProfile[]>(response) ?? [];
}

async function loadPeriodContext() {
  const requestSequence = ++periodContextLoadSequence;
  const groupId = selectedGroupId.value;
  const period = settlementPeriod.value;
  const isCurrentRequest = () =>
    requestSequence === periodContextLoadSequence &&
    groupId === selectedGroupId.value &&
    period === settlementPeriod.value;
  calendarRules.value = [];
  targetPolicies.value = [];
  latestTarget.value = undefined;
  contributionSummary.value = undefined;
  contributionSummaryLoadFailed.value = false;
  targetInputPreview.value = undefined;
  hiringPreview.value = undefined;
  if (!groupId || !period) return;
  const [calendars, policies] = await Promise.all([
    getPayrollCalendarRules(groupId, period),
    getGroupTargetPolicies(groupId, period),
  ]);
  if (!isCurrentRequest()) return;
  calendarRules.value = unwrap<PayrollCalendarRule[]>(calendars) ?? [];
  targetPolicies.value = unwrap<GroupTargetPolicy[]>(policies) ?? [];
  selectedPolicyVersionId.value = approvedTargetPolicies.value[0]?.policyVersionId ?? '';
  policyForm.value.calendarRuleVersionId = calendarRules.value[0]?.calendarRuleVersionId ?? '';
  syncPolicyCalendarDays();
  try {
    const targetResponse = await getLatestGroupTarget(groupId, period);
    if (!isCurrentRequest()) return;
    latestTarget.value = unwrap<GroupTarget>(targetResponse);
  } catch {
    if (isCurrentRequest()) latestTarget.value = undefined;
  }
  if (!isCurrentRequest()) return;
  try {
    const contributionResponse = await getGroupContributionSummary(groupId, period);
    if (!isCurrentRequest()) return;
    contributionSummary.value = unwrap<GroupContributionSummary>(contributionResponse);
  } catch {
    if (isCurrentRequest()) {
      contributionSummary.value = undefined;
      contributionSummaryLoadFailed.value = true;
    }
  }
}

async function refreshAll() {
  loading.value = true;
  try {
    await Promise.all([loadEmployees(), loadGroups()]);
    await loadSelectedGroup();
  } finally {
    loading.value = false;
  }
}

async function openCompensation(employeeId: number) {
  compensationEmployeeId.value = employeeId;
  activeTab.value = 'compensation';
  await loadCompensationProfiles();
}

async function submitGroup() {
  const action = 'group-create';
  submitLoading.value = true;
  try {
    const form = groupForm.value;
    await createOrganizationGroup({
      groupCode: requireText(form.groupCode, '小组编码'),
      groupName: requireText(form.groupName, '小组名称'),
      companyRef: requireText(form.companyRef, '公司引用'),
      businessSectorRef: form.businessSectorRef.trim() || undefined,
      storeRef: form.storeRef.trim() || undefined,
      leaderEmployeeId: form.leaderEmployeeId,
      businessOwnerEmployeeId: form.businessOwnerEmployeeId,
      establishedAt: requireText(form.establishedAt, '成立日期'),
      safetyFactorPolicyVersionId: requireText(form.safetyFactorPolicyVersionId, '安全系数规则族'),
      rampUpPolicyVersionId: requireText(form.rampUpPolicyVersionId, '爬坡规则族'),
      ...commandMetadata(action, requireText(form.reason, '变更原因')),
    });
    completeCommand(action);
    groupDialogVisible.value = false;
    groupForm.value = newGroupForm();
    ElMessage.success('经营小组已创建');
    await refreshAll();
  } catch (error) {
    if (error instanceof Error && !('response' in error)) ElMessage.error(error.message);
  } finally {
    submitLoading.value = false;
  }
}

async function submitMember() {
  if (!selectedGroupId.value) return;
  const action = `member-add-${selectedGroupId.value}`;
  submitLoading.value = true;
  try {
    const form = memberForm.value;
    if (!form.employeeId) throw new Error('请选择员工');
    await addOrganizationGroupMember(selectedGroupId.value, {
      employeeId: form.employeeId,
      jobLevel: form.jobLevel,
      roleCode: requireText(form.roleCode, '岗位编码'),
      effectiveFrom: requireText(form.effectiveFrom, '生效日期'),
      effectiveTo: form.effectiveTo || undefined,
      responsibilityWeightBps: Math.round(form.responsibilityWeightPercent * 100),
      ...commandMetadata(action, requireText(form.reason, '变更原因')),
    });
    completeCommand(action);
    memberDialogVisible.value = false;
    memberForm.value = newMemberForm();
    ElMessage.success('成员关系已创建');
    await loadSelectedGroup();
  } catch (error) {
    if (error instanceof Error && !('response' in error)) ElMessage.error(error.message);
  } finally {
    submitLoading.value = false;
  }
}

async function endMember(member: GroupMember) {
  const result = await ElMessageBox.prompt('请输入成员关系最后有效日期（YYYY-MM-DD）', '结束成员关系', {
    confirmButtonText: '确认结束', cancelButtonText: '取消', inputValue: currentDate(),
    inputPattern: /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    inputErrorMessage: '日期格式必须为 YYYY-MM-DD',
  }).catch(() => null);
  if (!result) return;
  const action = `member-end-${member.id}`;
  await endOrganizationGroupMember(member.id, {
    effectiveTo: result.value,
    ...commandMetadata(action, '结束成员小组关系'),
  });
  completeCommand(action);
  ElMessage.success('成员关系已按日期结束');
  await loadSelectedGroup();
}

function costPayload(form: ReturnType<typeof newCompensationForm> | ReturnType<typeof newHiringForm>) {
  return {
    baseGuaranteeCents: yuanToCents(form.baseGuaranteeYuan, '基础保障工资'),
    positionPerformanceBudgetCents: yuanToCents(form.positionPerformanceBudgetYuan, '岗位绩效预算'),
    employerSocialCostCents: yuanToCents(form.employerSocialCostYuan, '公司社保'),
    fixedBenefitCostCents: yuanToCents(form.fixedBenefitCostYuan, '固定福利成本'),
    benefitCashOffsetCents: '0',
    otherFixedEmploymentCostCents: yuanToCents(form.otherFixedEmploymentCostYuan, '其他固定用工成本'),
  };
}

async function submitCompensation() {
  if (!compensationEmployeeId.value) return;
  const action = `compensation-${compensationEmployeeId.value}`;
  submitLoading.value = true;
  try {
    const form = compensationForm.value;
    await createCompensationProfile(compensationEmployeeId.value, {
      ...costPayload(form), currency: 'CNY', effectiveFrom: requireText(form.effectiveFrom, '生效日期'),
      effectiveTo: form.effectiveTo || undefined,
      ...commandMetadata(action, requireText(form.reason, '变更原因')),
    });
    completeCommand(action);
    compensationDialogVisible.value = false;
    compensationForm.value = newCompensationForm();
    ElMessage.success('工资结构版本已发布');
    await Promise.all([loadCompensationProfiles(), loadPeriodContext()]);
  } catch (error) {
    if (error instanceof Error && !('response' in error)) ElMessage.error(error.message);
  } finally {
    submitLoading.value = false;
  }
}

function parsePayrollDates(value: string) {
  const dates = value.split(/[\s,，;；]+/).map((item) => item.trim()).filter(Boolean);
  if (!dates.length) throw new Error('请至少填写一个计薪日期');
  return [...new Set(dates)].sort();
}

async function submitCalendar() {
  if (!selectedGroup.value) return;
  const action = `calendar-${selectedGroup.value.companyRef}-${settlementPeriod.value}`;
  submitLoading.value = true;
  try {
    const form = calendarForm.value;
    await createPayrollCalendarRule({
      companyRef: selectedGroup.value.companyRef,
      settlementPeriod: settlementPeriod.value,
      calendarRuleVersionId: requireText(form.calendarRuleVersionId, '日历规则版本'),
      payrollDates: parsePayrollDates(form.payrollDatesText),
      ...commandMetadata(action, requireText(form.reason, '发布原因')),
    });
    completeCommand(action);
    calendarDialogVisible.value = false;
    calendarForm.value = newCalendarForm();
    ElMessage.success('公司计薪日历已发布');
    await loadPeriodContext();
  } catch (error) {
    if (error instanceof Error && !('response' in error)) ElMessage.error(error.message);
  } finally {
    submitLoading.value = false;
  }
}

function syncPolicyCalendarDays() {
  const rule = calendarRules.value.find((item) => item.calendarRuleVersionId === policyForm.value.calendarRuleVersionId);
  policyForm.value.standardPayrollDays = rule?.standardPayrollDays ?? 0;
}

async function submitPolicy() {
  if (!selectedGroup.value || !selectedGroupId.value) return;
  const action = `policy-${selectedGroupId.value}-${settlementPeriod.value}`;
  submitLoading.value = true;
  try {
    const form = policyForm.value;
    if (!form.standardPayrollDays) throw new Error('请选择有效计薪日历');
    await createGroupTargetPolicy(selectedGroupId.value, {
      settlementPeriod: settlementPeriod.value,
      policyVersionId: requireText(form.policyVersionId, '政策版本'),
      safetyFactorBps: Math.round(form.safetyFactor * 10_000),
      rampFactorBps: Math.round(form.rampFactor * 10_000),
      standardPayrollDays: form.standardPayrollDays,
      calendarRuleVersionId: requireText(form.calendarRuleVersionId, '计薪日历'),
      safetyFactorPolicyVersionId: selectedGroup.value.safetyFactorPolicyVersionId,
      rampUpPolicyVersionId: selectedGroup.value.rampUpPolicyVersionId,
      currency: 'CNY',
      ...commandMetadata(action, requireText(form.reason, '发布原因')),
    });
    completeCommand(action);
    policyDialogVisible.value = false;
    policyForm.value = newPolicyForm();
    ElMessage.success('小组目标政策已发布');
    await loadPeriodContext();
  } catch (error) {
    if (error instanceof Error && !('response' in error)) ElMessage.error(error.message);
  } finally {
    submitLoading.value = false;
  }
}

async function previewTargetInput() {
  if (!selectedGroupId.value || !selectedPolicyVersionId.value) return;
  previewLoading.value = true;
  try {
    targetInputPreview.value = unwrap<GroupTargetInputPreview>(
      await previewGroupTargetCalculationInput(
        selectedGroupId.value,
        settlementPeriod.value,
        selectedPolicyVersionId.value,
      ),
    );
  } finally {
    previewLoading.value = false;
  }
}

async function confirmCalculateTarget() {
  if (!selectedGroupId.value || !targetInputPreview.value?.calculationInput) return;
  await ElMessageBox.confirm(
    `确认按当前冻结输入生成 ${settlementPeriod.value} 目标快照？经营保底为 ${formatCents(targetInputPreview.value.breakEvenTargetCents)}。`,
    '确认生成经营保底',
    { confirmButtonText: '确认生成', cancelButtonText: '取消', type: 'warning' },
  );
  const action = `target-calculate-${selectedGroupId.value}-${settlementPeriod.value}`;
  calculateLoading.value = true;
  try {
    await calculateGroupTarget(selectedGroupId.value, {
      ...targetInputPreview.value.calculationInput,
      ...commandMetadata(action, '经管理端确认生成当期人工成本与经营保底快照'),
    });
    completeCommand(action);
    ElMessage.success('小组人工成本与经营保底快照已生成');
    await loadPeriodContext();
  } finally {
    calculateLoading.value = false;
  }
}

async function previewHiring() {
  if (!selectedGroupId.value) return;
  hiringLoading.value = true;
  try {
    hiringPreview.value = unwrap<HiringImpactPreview>(
      await previewGroupHiringImpact(
        selectedGroupId.value,
        settlementPeriod.value,
        costPayload(hiringForm.value),
      ),
    );
  } catch (error) {
    if (error instanceof Error && !('response' in error)) ElMessage.error(error.message);
  } finally {
    hiringLoading.value = false;
  }
}

onMounted(refreshAll);
</script>

<style scoped>
.page-shell { display: grid; gap: 16px; }
.page-heading, .section-heading, .toolbar, .card-header, .inline-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.page-heading h1, .section-heading h2 { margin: 0; color: #172033; }
.page-heading p, .section-heading p { margin: 6px 0 0; color: #667085; }
.identity-alert { margin-bottom: 0; }
.toolbar { justify-content: flex-start; flex-wrap: wrap; margin-bottom: 16px; }
.group-select { width: min(420px, 100%); }
.group-summary { margin-bottom: 16px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
.metric-card { border: 1px solid #e4e7ed; border-radius: 8px; padding: 16px; background: #fafcff; display: grid; gap: 8px; }
.metric-card span { color: #667085; }
.metric-card strong { font-size: 22px; color: #172033; }
.workspace-tabs { margin-top: 8px; }
.section-heading { margin-bottom: 14px; }
.inline-actions { justify-content: flex-end; flex-wrap: wrap; }
.inline-actions .el-select { width: 240px; }
.two-column-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.inner-card, .preview-card { margin-bottom: 16px; }
.preview-summary,
.contribution-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
.contribution-alert { margin-bottom: 16px; }
.contribution-heading { margin-top: 22px; }
.compact-form { max-width: 620px; }
.dialog-form { margin-top: 16px; }
@media (max-width: 1100px) {
  .metric-grid, .two-column-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .page-heading, .section-heading, .card-header { align-items: flex-start; flex-direction: column; }
  .metric-grid, .two-column-grid, .preview-summary, .contribution-summary { grid-template-columns: 1fr; }
}
</style>
