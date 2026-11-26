<template>
  <section class="review-checklist" aria-label="本类资料复核清单">
    <header>
      <h4>本类资料复核清单</h4>
      <span class="read-only">只读提示 · 不执行操作</span>
    </header>
    <p>{{ checklist.label }} · 工单 {{ checklist.workOrderRef }} · 档案版本 {{ checklist.profileVersion }}</p>
    <p class="boundary">仅反映本次读取的单类资料；跨类有效版本、来源内容摘要、正式贡献及工资条件尚未核验。使用前请重新读取；本清单不代替人工独立复核。</p>
    <ol>
      <li v-for="(item, index) in checklist.items" :key="item.ref || 'missing'">
        <h5>{{ index + 1 }} · {{ item.label }}</h5>
        <p>{{ item.explanation }}</p>
        <dl class="guidance"><dt>建议下一步</dt><dd>{{ item.nextLabel }}</dd><dt>应由谁处理</dt><dd>{{ item.roleLabel }}</dd></dl>
        <details v-if="item.ref">
          <summary>查看对应记录、版本与摘要</summary>
          <dl><dt>记录引用</dt><dd>{{ item.ref }}</dd><dt>资料版本</dt><dd>{{ item.version ?? '经济事实关联提议（无权威版本）' }}</dd><dt>绑定的工单版本</dt><dd>{{ item.expectedProfileVersion }}</dd><dt>来源摘要（未重新核验）</dt><dd>{{ item.evidenceHash }}</dd></dl>
        </details>
      </li>
    </ol>
    <details>
      <summary>查看本次快照指纹及使用限制</summary>
      <p class="fingerprint">{{ checklist.evidenceFingerprint }}</p>
      <p>指纹仅用于区分这次读取的快照，不是审批令牌、证据真实性证明或工资计算凭证。切换工单、身份、资料类别或档案版本后必须重新读取。</p>
    </details>
  </section>
</template>
<script setup lang="ts">
import type { ReviewChecklistView } from '../../utils/repair-capture-review-checklist';
defineProps<{ checklist: ReviewChecklistView }>();
</script>
<style scoped>
.review-checklist { display: grid; gap: 12px; min-width: 0; padding: 16px; border: 1px solid #cbd8e8; border-radius: 8px; background: #f5f8fc; overflow-wrap: anywhere; }
header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; justify-content: space-between; }
h4, h5, p { margin: 0; } h4 { font-size: 17px; } h5 { font-size: 15px; } p, dd, summary { line-height: 1.7; }
.read-only, .boundary, dt { color: #475a73; } .read-only { font-size: 13px; }
ol { display: grid; gap: 12px; padding: 0; margin: 0; list-style: none; } li { display: grid; gap: 8px; min-width: 0; padding: 14px; background: white; border: 1px solid #dae3ee; border-radius: 6px; }
dl { display: grid; grid-template-columns: minmax(110px, 160px) minmax(0, 1fr); gap: 6px 12px; margin: 10px 0 0; } dd { margin: 0; } summary { cursor: pointer; color: #245985; } summary:focus-visible { outline: 2px solid #245985; outline-offset: 3px; }
.fingerprint { margin: 8px 0; font-family: monospace; }
@media (max-width: 600px) { .review-checklist, li { padding: 12px; } dl { grid-template-columns: minmax(0, 1fr); gap: 3px; } dd { margin-bottom: 6px; } }
</style>
