import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('ai_assistant_interactions')
export class AiAssistantInteraction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'thread_key', type: 'varchar', length: 191 })
  threadKey!: string;

  @Column({ name: 'route_path', type: 'varchar', length: 191 })
  routePath!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64, nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 100, nullable: true })
  entityId!: string | null;

  @Column({ name: 'role_code', type: 'varchar', length: 64, nullable: true })
  roleCode!: string | null;

  @Column({ name: 'scene_code', type: 'varchar', length: 64, nullable: true })
  sceneCode!: string | null;

  @Column({ name: 'source_action_id', type: 'varchar', length: 191, nullable: true })
  sourceActionId!: string | null;

  @Column({ name: 'user_message', type: 'text' })
  userMessage!: string;

  @Column({ name: 'assistant_reply', type: 'text' })
  assistantReply!: string;

  @Column({ name: 'suggested_actions', type: 'json', nullable: true })
  suggestedActions!: Array<Record<string, unknown>> | null;

  @Column({ name: 'suggested_command_draft', type: 'json', nullable: true })
  suggestedCommandDraft!: Record<string, unknown> | null;

  @Column({ name: 'provider_key', type: 'varchar', length: 100, nullable: true })
  providerKey!: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 120, nullable: true })
  createdByName!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;
}
