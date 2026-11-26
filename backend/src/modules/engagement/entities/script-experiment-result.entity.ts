import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ScriptExperiment } from './script-experiment.entity';
import { ScriptTemplate } from './script-template.entity';

@Entity('script_experiment_results')
export class ScriptExperimentResult {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'script_experiment_id', type: 'int' })
  scriptExperimentId!: number;

  @Column({ name: 'script_template_id', type: 'int' })
  scriptTemplateId!: number;

  @Column({ name: 'sample_count', type: 'int', default: 0 })
  sampleCount!: number;

  @Column({ name: 'followed_up_count', type: 'int', default: 0 })
  followedUpCount!: number;

  @Column({ name: 'replied_count', type: 'int', default: 0 })
  repliedCount!: number;

  @Column({ name: 'converted_count', type: 'int', default: 0 })
  convertedCount!: number;

  @Column({ name: 'ignored_count', type: 'int', default: 0 })
  ignoredCount!: number;

  @Column({ name: 'reply_rate', type: 'decimal', precision: 7, scale: 4, default: '0.0000' })
  replyRate!: string;

  @Column({ name: 'conversion_rate', type: 'decimal', precision: 7, scale: 4, default: '0.0000' })
  conversionRate!: string;

  @Column({ name: 'summary_json', type: 'json', nullable: true })
  summaryJson!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => ScriptExperiment, { nullable: false })
  @JoinColumn({ name: 'script_experiment_id' })
  scriptExperiment!: ScriptExperiment;

  @ManyToOne(() => ScriptTemplate, { nullable: false })
  @JoinColumn({ name: 'script_template_id' })
  scriptTemplate!: ScriptTemplate;
}
