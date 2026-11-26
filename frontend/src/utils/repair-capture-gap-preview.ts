/** Display-only observations from the already-authorized repair workspace response.
 * No IO, totals, authority validation, source admission or wage decisions belong here.
 */
export type RepairCaptureTab = 'documents' | 'confirmation' | 'execution' | 'completion';
export type RepairCaptureState = 'recorded' | 'missing' | 'review' | 'unverified';
export interface RepairCaptureGapItem {
  readonly key: string;
  readonly label: string;
  readonly state: RepairCaptureState;
  readonly detail: string;
  readonly tab?: RepairCaptureTab;
}
type Row = Record<string, unknown>;
const row = (value: unknown): Row | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
const rows = (value: unknown): Row[] | null =>
  Array.isArray(value) && value.every((item) => row(item) !== null) ? value as Row[] : null;
const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
function id(value: unknown): string | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  return Number.isSafeInteger(Number(value)) ? value : null;
}
const hoursRecorded = (value: unknown) => typeof value === 'string' && /^(0|[1-9]\d*)\.\d{2}$/.test(value);

export function projectRepairCaptureGaps(input: unknown, expectedWorkOrderId: string) {
  const items: RepairCaptureGapItem[] = [];
  const add = (key: string, label: string, state: RepairCaptureState, detail: string, tab?: RepairCaptureTab) => {
    items.push(Object.freeze({ key, label, state, detail, ...(tab && scoped ? { tab } : {}) }));
  };
  const workspace = row(input);
  const workOrder = row(workspace?.workOrder);
  const profile = row(workspace?.profile);
  const expectedId = id(expectedWorkOrderId);
  const sameOrder = expectedId !== null && id(workOrder?.id) === expectedId &&
    profile !== null && id(profile.workOrderId) === expectedId;
  const scoped = sameOrder && ['companyRef', 'businessSectorRef', 'storeRef'].every((key) => hasText(profile?.[key]));
  const observations = scoped ? workspace : null;
  const ownRows = (value: unknown) => {
    const result = rows(value);
    return result && result.every((item) => id(item.workOrderId) === expectedId) ? result : null;
  };

  add('scope', '工单与组织档案', scoped ? 'recorded' : expectedId !== null && workspace?.profile === null && id(workOrder?.id) === expectedId ? 'missing' : 'unverified',
    scoped ? '响应中有当前工单的组织档案。这里只检查记录，不替代服务端权限或归属审核。' :
      '当前工单档案或组织范围尚不能核对；请先建立档案或刷新。不会借用其他工单的数据。');

  const documents = ownRows(observations?.documents);
  const currentPlans = documents?.filter((item) => item.documentType === 'repair_plan' &&
    item.version === profile?.activePlanVersion && id(item.version) !== null) ?? [];
  const planItems = currentPlans.length === 1 ? rows(row(currentPlans[0].payload)?.items) : null;
  const tasks = ownRows(observations?.tasks);
  const taskIds = tasks?.map((item) => id(item.id));
  const taskShapeOk = tasks !== null && taskIds?.every(Boolean) && new Set(taskIds).size === taskIds.length;
  const activeTasks = tasks?.filter((item) => item.status !== 'cancelled') ?? [];
  const taskRefsOk = taskShapeOk && activeTasks.every((item) => id(item.technicianEmployeeId) !== null &&
    hasText(item.planItemRef) && planItems?.filter((planItem) => planItem.itemRef === item.planItemRef).length === 1 &&
    id(item.planVersion) !== null && item.planVersion === profile?.activePlanVersion &&
    ['pending', 'in_progress', 'blocked', 'completed'].includes(String(item.status)));
  add('tasks', '维修任务与技师', !tasks ? 'unverified' : !taskShapeOk ? 'review' : !activeTasks.length ? 'missing' : taskRefsOk ? 'recorded' : 'review',
    !tasks ? '响应未提供可核对的本单任务集合。' : !activeTasks.length && taskShapeOk ? '尚无非取消的维修任务；到维修施工关联方案项目与技师。' :
      taskRefsOk ? '有绑定本单方案与技师的任务记录；技师不自动等于经营贡献归属人。' :
        '任务标识、人员、方案版本或状态需要复核；不合并重复记录。', 'execution');

  const currentQuotes = documents?.filter((item) => item.documentType === 'quote' &&
    item.version === profile?.activeQuoteVersion && id(item.version) !== null) ?? [];
  const quotePayload = currentQuotes.length === 1 ? row(currentQuotes[0].payload) : null;
  const quoteLines = quotePayload?.planVersion === profile?.activePlanVersion ? rows(quotePayload?.lineItems) : null;
  const labor = ownRows(observations?.laborItems);
  const laborIds = labor?.map((item) => id(item.id));
  const laborOk = taskRefsOk && labor !== null && laborIds?.every(Boolean) && new Set(laborIds).size === laborIds.length &&
    labor.every((item) => activeTasks.some((task) => id(task.id) === id(item.taskId) &&
      id(task.technicianEmployeeId) === id(item.technicianEmployeeId) && quoteLines?.filter((line) =>
        line.category === 'labor' && line.lineRef === item.quoteLineRef && line.planItemRef === task.planItemRef).length === 1) &&
      hoursRecorded(item.standardHours) && hoursRecorded(item.actualHours) && hasText(item.quoteLineRef));
  add('labor', '工时与任务关联', !labor ? 'unverified' : !labor.length ? 'missing' : laborOk ? 'recorded' : 'review',
    !labor ? '响应未提供可核对的本单工时集合。' : !labor.length ? '尚无工时记录；到维修施工关联任务、员工和报价行。' :
      laborOk ? '有工时和关联字段记录，仍需业务复核；工时费、报价不等于员工工资。' :
        '工时、任务、人员或报价行引用需复核；不猜测工时，不计算工资。', 'execution');

  const activeDocuments = [
    ['repair_plan', profile?.activePlanVersion], ['quote', profile?.activeQuoteVersion],
    ['customer_explanation', profile?.activeExplanationVersion],
  ].map(([type, version]) => documents?.filter((item) => item.documentType === type && item.version === version && id(version) !== null) ?? []);
  const documentState: RepairCaptureState = !documents ? 'unverified' :
    activeDocuments.some((matches) => matches.length > 1) ? 'review' :
      activeDocuments.some((matches) => matches.length === 0) ? 'missing' :
        activeDocuments.every(([item]) => ['approved', 'authorized'].includes(String(item.status))) ? 'recorded' : 'review';
  add('documents', '当前方案、报价与解释', documentState,
    documentState === 'recorded' ? '当前版本有已审核状态的文档记录；未在此验证正式收入的完整证据与哈希。' :
      '当前版本文档缺失、重复或仍待审核；到检查、方案与报价核对，不能用旧版替代。', 'documents');

  const confirmations = rows(observations?.confirmationRequests);
  const matchingConfirmations = confirmations?.filter((item) => id(item.id) !== null &&
    item.planVersion === profile?.activePlanVersion && item.quoteVersion === profile?.activeQuoteVersion &&
    item.explanationVersion === profile?.activeExplanationVersion && item.status === 'confirmed') ?? [];
  const confirmationState: RepairCaptureState = !confirmations ? 'unverified' :
    !confirmations.length ? 'missing' : matchingConfirmations.length === 1 && profile?.customerConfirmationState === 'confirmed' &&
      documentState === 'recorded' && hasText(matchingConfirmations[0].decisionEvidenceRef) ? 'recorded' : 'review';
  add('confirmation', '客户确认记录', confirmationState,
    confirmationState === 'recorded' ? '响应有匹配当前版本的确认记录及证据引用；本预览不会代替客户确认。' :
      '尚不能核对当前方案、报价和解释对应的确认记录；待确认或旧版记录不能替代。', 'confirmation');

  const quality = ownRows(observations?.qualityInspections);
  const delivery = row(observations?.delivery);
  const deliveredHere = delivery !== null && id(delivery.id) !== null && id(delivery.workOrderId) === expectedId;
  add('delivery', '质检与交付记录', !quality || observations?.delivery === undefined ? 'unverified' :
    !quality.length || observations?.delivery === null ? 'missing' :
      deliveredHere && quality[0]?.result === 'passed' && id(quality[0]?.id) !== null ? 'recorded' : 'review',
    deliveredHere && quality?.[0]?.result === 'passed' ? '有质检通过与交付记录；未在此重验版本、金额和时间权威。' :
      '质检或交付记录尚未齐备/需复核；交付记录本身也不构成工资结论。', 'completion');

  add('revenue', '正式收款与收入权威', 'unverified',
    row(observations?.financeReadiness) ? '工作区已有收款提示，但该提示不等于正式收入权威。本视图不重新核验到账、收入或金额。' :
      '本视图未取得可用于验证正式收款与收入的权威证据。', 'completion');
  const parts = ownRows(observations?.partLinks);
  add('cost', '材料、外包与直接成本', 'unverified',
    parts?.length ? '已有材料关联，需审核实际领用成本及其他直接成本；不能据此假定符合零外部直接成本范围。' :
      '没有材料记录不等于成本为零；外包、损耗等成本完整性尚未验证。', 'execution');
  const warranties = ownRows(observations?.warranties);
  const hasExceptionRecord = quality?.some((item) => item.result === 'failed') ||
    tasks?.some((item) => id(item.reworkOfInspectionId) !== null) || warranties?.some((item) => item.warrantyType === 'claim');
  add('exceptions', '退款、返工与售后闭合', hasExceptionRecord ? 'review' : 'unverified',
    hasExceptionRecord ? '存在失败质检、返工或售后申请记录；是否已闭合需审核，不能覆盖历史。' :
      '当前响应不能证明退款、返工和售后已全部闭合；没有可见异常不等于没有异常。', 'completion');
  add('attribution', '责任人与三角色归属', 'unverified',
    '本响应没有已审核的经营归属权威；组员、技师或交付人员不能被自动当作开发、成交、维护归属人。');
  add('settlement', '本组本期结算与工资', 'unverified',
    '本视图不核验经营组结算范围、数据完整性、适配器准入或工资规则。即使记录齐全，也不能确认贡献或工资。');

  return Object.freeze({
    kind: 'repair_capture_observation_only' as const,
    formalEvaluation: 'not_performed' as const,
    items: Object.freeze(items),
    attentionCount: items.filter((item) => item.state === 'missing' || item.state === 'review').length,
    unverifiedCount: items.filter((item) => item.state === 'unverified').length,
  });
}
