<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">点值总览 / 操作指引</div>
            <div class="subtitle">
              先分清“总部积点”和“ABC 积分”，再进入对应的福利、命令、兑换和对账入口。
            </div>
          </div>
        </div>
      </template>

      <div class="hub-grid">
        <section class="hub-card">
          <div class="hub-title">总部积点（hq_points）</div>
          <div class="hub-text">
            总部积点的事实源在总部系统，用于员工福利积点、积点命令和积点兑换。
            所有高风险动作都必须走“草稿 -> 人工确认 -> 执行 -> 审计/账本”链路，不允许直接改库。
          </div>
          <div class="tag-row">
            <el-tag>总部系统事实源</el-tag>
            <el-tag type="success">可受控执行</el-tag>
            <el-tag type="warning">高风险动作需人工确认</el-tag>
          </div>
          <div class="action-list">
            <el-button text type="primary" @click="openPath('/points/welfare')">
              我要给员工发积点
            </el-button>
            <el-button text type="primary" @click="openPath('/points/commands')">
              我要查看积点命令
            </el-button>
            <el-button text type="primary" @click="openPath('/points/redemptions')">
              我要查看积点兑换购物卡
            </el-button>
          </div>
        </section>

        <section class="hub-card">
          <div class="hub-title">ABC 积分（abc_score）</div>
          <div class="hub-text">
            ABC 积分的事实源在 ABC 系统。当前先支持只读发现、命令草稿、人工确认和受控阻塞留痕。
            在 ABC 写入路径没有稳定确认前，执行必须进入 blocked，不能假成功，更不能回到手工改库。
          </div>
          <div class="tag-row">
            <el-tag type="info">ABC 系统事实源</el-tag>
            <el-tag type="warning">当前以只读发现为主</el-tag>
            <el-tag type="danger">禁止数据库手改</el-tag>
          </div>
          <div class="action-list">
            <el-button text type="primary" @click="openPath('/abc-points/overview')">
              我要看 ABC 积分总览
            </el-button>
            <el-button text type="primary" @click="openPath('/abc-points/commands')">
              我要草拟 ABC 积分命令
            </el-button>
            <el-button text type="primary" @click="openPath('/abc-points/ledger')">
              我要看 ABC 积分流水 / 对账
            </el-button>
          </div>
        </section>
      </div>

      <el-divider />

      <div class="hub-summary">
        <div class="summary-block">
          <div class="summary-title">积点和积分的区别</div>
          <ul class="bullet-list">
            <li>积点：总部系统管理的点值，用于福利发放、命令和兑换。</li>
            <li>积分：ABC 系统里的积分，来源可能包括产品赠送、历史遗留和未来的总部受控发放。</li>
            <li>AI 必须明确说明当前动作写入哪个系统，不能把“积点兑换”和“ABC 积分补发”混成一件事。</li>
          </ul>
        </div>
        <div class="summary-block">
          <div class="summary-title">审批与审计边界</div>
          <ul class="bullet-list">
            <li>总部积点命令：草稿 -> 人工确认 -> 执行 -> 账本。</li>
            <li>ABC 积分命令：草稿 -> 人工确认 -> 执行或 blocked -> 审计。</li>
            <li>AI 可以帮我们解释、草拟、提醒下一步，但不能自动执行高风险动作。</li>
          </ul>
        </div>
      </div>
    </el-card>

    <AiSideAssistant
      page-title="点值总览 / 操作指引"
      route-path="/points/hub"
      :current-filters="{}"
    />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';

const router = useRouter();

function openPath(path: string) {
  void router.push(path);
}
</script>

<style scoped>
.hub-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.hub-card {
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  background: var(--el-fill-color-blank);
}

.hub-title {
  margin-bottom: 12px;
  font-size: 18px;
  font-weight: 600;
}

.hub-text {
  margin-bottom: 12px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.action-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 12px;
}

.hub-summary {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.summary-block {
  padding: 16px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
}

.summary-title {
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 600;
}

.bullet-list {
  margin: 0;
  padding-left: 18px;
  line-height: 1.8;
}
</style>
