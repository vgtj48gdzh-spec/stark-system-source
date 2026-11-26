import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('ai_knowledge_entries')
export class AiKnowledgeEntry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'knowledge_type', type: 'varchar', length: 64 })
  knowledgeType!: string;

  @Column({ name: 'scope_type', type: 'varchar', length: 64 })
  scopeType!: string;

  @Column({ name: 'scope_key', type: 'varchar', length: 191, nullable: true })
  scopeKey!: string | null;

  @Column({ type: 'varchar', length: 191 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  summary!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'json', nullable: true })
  tags!: string[] | null;

  @Column({ name: 'role_scope', type: 'json', nullable: true })
  roleScope!: string[] | null;

  @Column({ name: 'scene_scope', type: 'json', nullable: true })
  sceneScope!: string[] | null;

  @Column({ name: 'enabled_flag', type: 'boolean', default: true })
  enabledFlag!: boolean;

  @Column({ name: 'source_type', type: 'varchar', length: 64, nullable: true })
  sourceType!: string | null;

  @Column({ name: 'ai_learning_mode', type: 'varchar', length: 64, nullable: true })
  aiLearningMode!: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;
}
