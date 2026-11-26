import { Injectable } from '@nestjs/common';
import {
  RepairDocumentVersion,
  RepairKnowledgeReference,
  RepairVehicleProfile,
} from './entities/repair-shop.entities';
import { knowledgeAuthorityRank } from './repair-shop-workflow.policy';

interface BuildRepairAiDraftInput {
  draftType:
    | 'fault_assessment'
    | 'repair_plan'
    | 'customer_explanation'
    | 'consistency_review'
    | 'knowledge_recommendation';
  symptoms?: string;
  customerQuestion?: string;
  searchTerms?: string[];
  context?: Record<string, unknown>;
  vehicle: RepairVehicleProfile;
  documents: RepairDocumentVersion[];
  knowledge: RepairKnowledgeReference[];
}

type RankedKnowledgeReference = RepairKnowledgeReference & {
  similarityScore: number;
  matchingReason: string;
};

@Injectable()
export class RepairShopAiDraftService {
  build(input: BuildRepairAiDraftInput): Record<string, unknown> {
    const documents = this.latestDocuments(input.documents);
    const terms = this.buildSearchTerms(input, documents);
    const references = this.rankKnowledge(input.knowledge, terms, input.vehicle);
    const base = {
      contractVersion: 'repair_ai_draft_v1',
      providerMode: 'stark_ai_policy_assisted',
      draftOnly: true,
      requiresHumanReview: true,
      executionBlocked: true,
      prohibitedActions: [
        'confirm_payment',
        'issue_inventory',
        'complete_repair_task',
        'pass_quality_inspection',
        'confirm_delivery',
        'change_customer_rights',
      ],
      evidencePriority: [
        'regulation',
        'manufacturer_manual',
        'service_bulletin',
        'case',
        'video',
      ],
      vehicleContext: {
        brand: input.vehicle.brand,
        model: input.vehicle.model,
        modelYear: input.vehicle.modelYear,
        engineCode: input.vehicle.engineCode,
        salesMarket: input.vehicle.salesMarket,
        odometerKm: input.vehicle.odometerKm,
      },
      sourceReferences: references.map((item) => ({
        id: item.id,
        type: item.referenceType,
        title: item.title,
        url: item.url,
        authority: item.sourceAuthority,
        authorityRank: item.authorityRank,
        similarityScore: item.similarityScore,
        matchingReason: item.matchingReason,
        applicability: item.applicability,
        revision: item.revision,
        effectiveAt: item.effectiveAt,
        reviewStatus: item.reviewStatus,
        riskNotice: item.riskNotice,
        verifiedAt: item.verifiedAt,
        validUntil: item.validUntil,
      })),
      searchTerms: terms,
    };

    switch (input.draftType) {
      case 'fault_assessment':
        return { ...base, ...this.faultAssessment(input, documents, references) };
      case 'repair_plan':
        return { ...base, ...this.repairPlan(input, documents, references) };
      case 'customer_explanation':
        return { ...base, ...this.customerExplanation(input, documents) };
      case 'consistency_review':
        return { ...base, ...this.consistencyReview(documents) };
      case 'knowledge_recommendation':
        return { ...base, ...this.knowledgeRecommendation(terms, references) };
    }
  }

  private faultAssessment(
    input: BuildRepairAiDraftInput,
    documents: Map<string, RepairDocumentVersion>,
    references: RankedKnowledgeReference[],
  ) {
    const inspection = documents.get('intake_inspection');
    const symptomText = input.symptoms?.trim() || inspection?.summary || '尚未提供明确故障现象';
    return {
      title: '故障判断辅助草稿',
      symptomSummary: symptomText,
      hypotheses: [
        {
          rank: 1,
          statement: '优先复核接车检查中可重复、可量化的异常项，再进入部件级拆检。',
          confidence: 'needs_measurement',
        },
        {
          rank: 2,
          statement: '将报码、路试、异响位置和工况条件交叉验证，避免只凭单一现象换件。',
          confidence: 'needs_evidence',
        },
      ],
      recommendedChecks: [
        '复现故障并记录触发工况、频率和环境条件',
        '读取并保存诊断报码、冻结帧或测量值',
        '按制造商资料执行无损检查，再决定是否拆检',
        '对安全相关系统设置停工和升级确认条件',
      ],
      evidenceGaps: [
        inspection ? null : '缺少接车检查版本',
        references.length ? null : '知识库暂无匹配的权威资料或案例',
        input.symptoms?.trim() ? null : '缺少维修工补充的故障现象',
      ].filter(Boolean),
      stopConditions: ['制动、转向、高压、电池热失控或燃油泄漏风险必须立即停工并人工升级'],
    };
  }

  private repairPlan(
    input: BuildRepairAiDraftInput,
    documents: Map<string, RepairDocumentVersion>,
    references: RankedKnowledgeReference[],
  ) {
    const diagnosis = documents.get('diagnosis');
    return {
      title: '维修方案辅助草稿',
      diagnosisBasis: diagnosis?.summary ?? input.symptoms ?? '缺少正式诊断版本',
      recommendedSequence: [
        { step: 1, action: '确认诊断证据与客户诉求', gate: '维修技师复核' },
        { step: 2, action: '按权威资料列出拆检、维修或更换路径', gate: '方案负责人确认' },
        { step: 3, action: '绑定工时项目和既有工单材料引用', gate: '报价版本复核' },
        { step: 4, action: '生成客户解释并绑定同一方案/报价版本', gate: '客户确认请求' },
        { step: 5, action: '施工后提交证据并进入独立质检', gate: '质检员人工判定' },
      ],
      alternativeOptions: [
        {
          label: '诊断优先方案',
          useWhen: '证据不足或故障不能稳定复现',
          customerImpact: '先产生诊断工时，避免未经验证直接换件',
        },
        {
          label: '标准维修方案',
          useWhen: '诊断证据和技术资料一致',
          customerImpact: '按确认版本执行，任何增项必须重新报价确认',
        },
      ],
      authoritativeReferenceCount: references.filter((item) =>
        ['regulation', 'manufacturer_manual', 'service_bulletin'].includes(item.referenceType),
      ).length,
      disclaimer: '本草稿不构成客户授权、配件出库、任务完工或质检结论。',
    };
  }

  private customerExplanation(
    input: BuildRepairAiDraftInput,
    documents: Map<string, RepairDocumentVersion>,
  ) {
    const plan = documents.get('repair_plan');
    const quote = documents.get('quote');
    const quotePayload = quote?.payload ?? {};
    return {
      title: '客户沟通一致性草稿',
      customerQuestion: input.customerQuestion?.trim() || null,
      explanation: [
        `检测结论：${documents.get('diagnosis')?.summary ?? '等待维修技师确认诊断结论'}`,
        `建议方案：${plan?.summary ?? '等待形成正式维修方案'}`,
        `本次报价：${quote?.summary ?? '等待形成正式报价版本'}`,
        '施工中如出现增项，将暂停相关工作并重新生成报价，请您确认后再继续。',
      ],
      boundVersions: {
        planVersion: plan?.version ?? null,
        quoteVersion: quote?.version ?? null,
      },
      quoteTotal: this.readMoney(quotePayload, 'total'),
      consistencyWarning:
        plan && quote ? null : '方案或报价版本不完整，禁止向客户发送为正式结论',
    };
  }

  private consistencyReview(documents: Map<string, RepairDocumentVersion>) {
    const plan = documents.get('repair_plan');
    const quote = documents.get('quote');
    const explanation = documents.get('customer_explanation');
    const quotePayload = quote?.payload ?? {};
    const quotePlanVersion = this.readNumber(quotePayload, 'planVersion');
    const explanationPayload = explanation?.payload ?? {};
    const issues: string[] = [];

    if (!plan) issues.push('缺少维修方案版本');
    if (!quote) issues.push('缺少报价版本');
    if (!explanation) issues.push('缺少客户解释版本');
    if (plan && quotePlanVersion && quotePlanVersion !== plan.version) {
      issues.push(`报价绑定方案 v${quotePlanVersion}，当前方案为 v${plan.version}`);
    }
    const explanationQuoteVersion = this.readNumber(explanationPayload, 'quoteVersion');
    if (quote && explanationQuoteVersion && explanationQuoteVersion !== quote.version) {
      issues.push(`客户解释绑定报价 v${explanationQuoteVersion}，当前报价为 v${quote.version}`);
    }
    const calculatedTotal = ['laborTotal', 'partsTotal', 'otherTotal']
      .map((key) => this.readMoney(quotePayload, key))
      .reduce((sum, value) => sum + value, 0);
    const statedTotal = this.readMoney(quotePayload, 'total');
    if (quote && Math.abs(calculatedTotal - statedTotal) > 0.009) {
      issues.push(`报价合计不一致：分项 ${calculatedTotal.toFixed(2)}，总额 ${statedTotal.toFixed(2)}`);
    }

    return {
      title: '方案、报价与客户解释一致性检查',
      passed: issues.length === 0,
      issues,
      boundVersions: {
        planVersion: plan?.version ?? null,
        quoteVersion: quote?.version ?? null,
        explanationVersion: explanation?.version ?? null,
      },
      rule: '客户确认请求必须绑定完全相同的方案、报价和解释版本。',
    };
  }

  private knowledgeRecommendation(terms: string[], references: RankedKnowledgeReference[]) {
    return {
      title: '案例、资料与视频推荐草稿',
      officialReferences: references.filter((item) =>
        ['regulation', 'manufacturer_manual', 'service_bulletin'].includes(item.referenceType),
      ).map((item) => this.safeKnowledgeReference(item)),
      similarCases: references
        .filter((item) => item.referenceType === 'case')
        .map((item) => this.safeKnowledgeReference(item)),
      videoCandidates: references
        .filter((item) => item.referenceType === 'video')
        .map((item) => this.safeKnowledgeReference(item)),
      videoSearchQueries: [
        `${terms.join(' ')} 制造商 维修 手册`,
        `${terms.join(' ')} 故障 诊断 案例`,
        `${terms.join(' ')} 维修 操作 视频 安全`,
      ].map((item) => item.trim()),
      caution: '视频只能作为操作参考；最终步骤必须以适用车型的制造商资料和安全规范为准。',
    };
  }

  private latestDocuments(documents: RepairDocumentVersion[]) {
    const map = new Map<string, RepairDocumentVersion>();
    for (const document of documents.filter((item) =>
      ['approved', 'authorized'].includes(item.status),
    )) {
      const existing = map.get(document.documentType);
      if (!existing || document.version > existing.version) {
        map.set(document.documentType, document);
      }
    }
    return map;
  }

  private safeKnowledgeReference(item: RankedKnowledgeReference) {
    return {
      id: item.id,
      type: item.referenceType,
      title: item.title,
      url: item.url,
      authority: item.sourceAuthority,
      authorityRank: item.authorityRank,
      similarityScore: item.similarityScore,
      matchingReason: item.matchingReason,
      applicability: item.applicability,
      revision: item.revision,
      effectiveAt: item.effectiveAt,
      reviewStatus: item.reviewStatus,
      riskNotice: item.riskNotice,
      verifiedAt: item.verifiedAt,
      validUntil: item.validUntil,
    };
  }

  private buildSearchTerms(
    input: BuildRepairAiDraftInput,
    documents: Map<string, RepairDocumentVersion>,
  ) {
    return [...new Set([
      input.vehicle.brand,
      input.vehicle.model,
      input.vehicle.modelYear?.toString(),
      input.vehicle.engineCode,
      input.vehicle.salesMarket,
      ...(input.searchTerms ?? []),
      input.symptoms,
      documents.get('diagnosis')?.summary,
    ])]
      .filter((item): item is string => Boolean(item?.trim()))
      .flatMap((item) => item.trim().split(/[\s,，;；/]+/))
      .filter((item) => item.length >= 2)
      .slice(0, 16);
  }

  private rankKnowledge(
    references: RepairKnowledgeReference[],
    terms: string[],
    vehicle: RepairVehicleProfile,
  ) {
    const now = Date.now();
    return references
      .filter(
        (item) =>
          item.active &&
          item.reviewStatus === 'verified' &&
          (!item.effectiveAt || item.effectiveAt.getTime() <= now) &&
          (!item.validUntil || item.validUntil.getTime() >= now) &&
          this.matchesApplicability(item.applicability, vehicle),
      )
      .map((item) => ({
        item,
        matchedTerms: terms.filter((term) =>
          `${item.title} ${item.tags.join(' ')} ${JSON.stringify(item.applicability)}`
            .toLowerCase()
            .includes(term.toLowerCase()),
        ),
      }))
      .filter(({ matchedTerms }) => !terms.length || matchedTerms.length > 0)
      .map(({ item, matchedTerms }) => ({
        ...item,
        authorityRank: knowledgeAuthorityRank(item.referenceType),
        similarityScore: terms.length
          ? Number((matchedTerms.length / terms.length).toFixed(4))
          : 0,
        matchingReason: matchedTerms.length
          ? `匹配关键词：${matchedTerms.join('、')}`
          : '按权威等级和当前有效性纳入候选',
      }))
      .sort(
        (left, right) =>
          right.authorityRank - left.authorityRank ||
          right.similarityScore - left.similarityScore ||
          right.id - left.id,
      )
      .slice(0, 12);
  }

  private matchesApplicability(
    applicability: Record<string, unknown>,
    vehicle: RepairVehicleProfile,
  ) {
    const matchesText = (candidate: unknown, actual: string | null | undefined) => {
      if (candidate === undefined || candidate === null || candidate === '') return true;
      if (!actual?.trim()) return false;
      const expected = Array.isArray(candidate) ? candidate : [candidate];
      return expected.some(
        (item) => String(item).trim().toLowerCase() === actual.trim().toLowerCase(),
      );
    };
    if (!matchesText(applicability.brand ?? applicability.brands, vehicle.brand)) return false;
    if (!matchesText(applicability.model ?? applicability.models, vehicle.model)) return false;
    if (
      !matchesText(
        applicability.engineCode ?? applicability.engineCodes,
        vehicle.engineCode,
      )
    ) {
      return false;
    }
    if (
      !matchesText(
        applicability.salesMarket ??
          applicability.salesMarkets ??
          applicability.market ??
          applicability.markets,
        vehicle.salesMarket,
      )
    ) {
      return false;
    }
    const year = vehicle.modelYear;
    const yearFrom = Number(applicability.modelYearFrom ?? applicability.yearFrom);
    const yearTo = Number(applicability.modelYearTo ?? applicability.yearTo);
    if (Number.isFinite(yearFrom) && (!year || year < yearFrom)) return false;
    if (Number.isFinite(yearTo) && (!year || year > yearTo)) return false;
    const vin = vehicle.vin?.trim().toUpperCase() ?? '';
    const vinPrefixesValue = applicability.vinPrefix ?? applicability.vinPrefixes;
    if (vinPrefixesValue !== undefined && vinPrefixesValue !== null) {
      const vinPrefixes = (Array.isArray(vinPrefixesValue) ? vinPrefixesValue : [vinPrefixesValue])
        .map((item) => String(item).trim().toUpperCase())
        .filter(Boolean);
      if (!vin || !vinPrefixes.some((prefix) => vin.startsWith(prefix))) return false;
    }
    const vinFrom = String(applicability.vinFrom ?? '').trim().toUpperCase();
    const vinTo = String(applicability.vinTo ?? '').trim().toUpperCase();
    if ((vinFrom || vinTo) && !vin) return false;
    if (vinFrom && vin < vinFrom) return false;
    if (vinTo && vin > vinTo) return false;
    return true;
  }

  private readNumber(payload: Record<string, unknown>, key: string) {
    const value = Number(payload[key]);
    return Number.isFinite(value) ? value : null;
  }

  private readMoney(payload: Record<string, unknown>, key: string) {
    const value = Number(payload[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
  }
}
