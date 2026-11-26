<template>
  <el-container class="owner-bank-shell">
    <el-header class="owner-bank-header">
      <div>
        <div class="owner-bank-title">斯塔克总部 · 银行短信证据</div>
        <div class="owner-bank-subtitle">
          OWNER 身份保护 · 只读查询 · 不确认、不入账、不回放历史短信
        </div>
      </div>
      <el-tag type="warning" effect="plain">GET-only</el-tag>
    </el-header>
    <el-main class="owner-bank-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>
.owner-bank-shell {
  min-height: 100vh;
  background: #f4f7fb;
}

.owner-bank-header {
  height: auto;
  min-height: 76px;
  padding: 16px clamp(16px, 4vw, 48px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: #f8fbff;
  background: linear-gradient(135deg, #10213f 0%, #173867 100%);
  box-shadow: 0 8px 24px rgba(16, 33, 63, 0.2);
}

.owner-bank-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.owner-bank-subtitle {
  margin-top: 5px;
  color: rgba(248, 251, 255, 0.76);
  font-size: 13px;
}

.owner-bank-main {
  width: min(1480px, 100%);
  margin: 0 auto;
  padding: clamp(16px, 3vw, 32px);
}

@media (max-width: 640px) {
  .owner-bank-header {
    align-items: flex-start;
  }

  .owner-bank-title {
    font-size: 17px;
  }
}
</style>
