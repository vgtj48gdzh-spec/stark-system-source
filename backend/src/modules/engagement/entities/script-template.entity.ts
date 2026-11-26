import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('script_templates')
export class ScriptTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'template_code', type: 'varchar', length: 100 })
  templateCode!: string;

  @Column({ name: 'template_name', type: 'varchar', length: 120 })
  templateName!: string;

  @Column({ name: 'template_group', type: 'varchar', length: 30 })
  templateGroup!: string;

  @Column({ name: 'recommendation_type', type: 'varchar', length: 50, nullable: true })
  recommendationType!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  channel!: string | null;

  @Column({ name: 'opening_text', type: 'varchar', length: 255, nullable: true })
  openingText!: string | null;

  @Column({ name: 'script_content', type: 'text' })
  scriptContent!: string;

  @Column({ name: 'closing_text', type: 'varchar', length: 255, nullable: true })
  closingText!: string | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
