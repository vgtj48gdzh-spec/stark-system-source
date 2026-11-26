import { AiActionState } from './entities/ai-action-state.entity';
import { AiAssistantInteraction } from './entities/ai-assistant-interaction.entity';
import { AiKnowledgeEntry } from './entities/ai-knowledge-entry.entity';
import { AiMemoryEntry } from './entities/ai-memory-entry.entity';

// AI 模块新增持久化实体时，请统一在这里登记，并同步复用到：
// 1. AppModule 运行态 TypeORM 注册
// 2. CLI/迁移用 DataSource 注册
// 3. AI Module forFeature 注册
// 这样可以避免“migration 已执行，但运行态缺实体元数据”的刷新时 500 问题。
export const AI_RUNTIME_ENTITIES = [
  AiActionState,
  AiAssistantInteraction,
  AiKnowledgeEntry,
  AiMemoryEntry,
] as const;
