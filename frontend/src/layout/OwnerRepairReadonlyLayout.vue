<template>
  <el-container class="owner-repair-shell">
    <el-header class="owner-repair-header">
      <div>
        <div class="owner-repair-title">斯塔克总部 · 汽修只读验收</div>
        <div class="owner-repair-subtitle">
          OWNER 保护入口 · 复用正式工单与汽修主链 · 手机号中间四位隐藏
        </div>
      </div>
      <div class="owner-repair-badges">
        <el-tag type="success" effect="dark">GET-only</el-tag>
        <el-tag type="warning" effect="plain">禁止业务写入</el-tag>
      </div>
    </el-header>
    <el-main class="owner-repair-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>
.owner-repair-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(28, 110, 95, 0.12), transparent 38%),
    #f3f6f5;
}

.owner-repair-header {
  height: auto;
  min-height: 84px;
  padding: 18px clamp(16px, 4vw, 52px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: #f7fffc;
  background: linear-gradient(135deg, #102d2a 0%, #14594e 100%);
  box-shadow: 0 10px 28px rgba(16, 45, 42, 0.22);
}

.owner-repair-title {
  font-size: 21px;
  font-weight: 750;
  letter-spacing: 0.04em;
}

.owner-repair-subtitle {
  margin-top: 6px;
  color: rgba(247, 255, 252, 0.76);
  font-size: 13px;
}

.owner-repair-badges {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.owner-repair-main {
  width: min(1500px, 100%);
  margin: 0 auto;
  padding: clamp(16px, 3vw, 32px);
}

@media (max-width: 720px) {
  .owner-repair-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .owner-repair-title {
    font-size: 18px;
  }

  .owner-repair-badges {
    justify-content: flex-start;
  }
}
</style>
