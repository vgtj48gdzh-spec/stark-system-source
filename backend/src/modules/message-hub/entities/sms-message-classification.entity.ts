import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SmsMessageRaw } from './sms-message-raw.entity';

@Entity('sms_message_classification')
export class SmsMessageClassification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'raw_sms_id', type: 'int' })
  rawSmsId!: number;

  @Column({
    name: 'classify_type',
    type: 'enum',
    enum: ['verification_code', 'bank_transaction', 'other'],
  })
  classifyType!: 'verification_code' | 'bank_transaction' | 'other';

  @Column({ type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  confidence!: string;

  @Column({ name: 'parsed_json', type: 'json', nullable: true })
  parsedJson!: Record<string, unknown> | null;

  @Column({ name: 'parser_policy_version', type: 'varchar', length: 64, nullable: true })
  parserPolicyVersion!: string | null;

  @Column({ name: 'evidence_fingerprint', type: 'char', length: 64, nullable: true })
  evidenceFingerprint!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => SmsMessageRaw, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'raw_sms_id' })
  rawSms!: SmsMessageRaw;
}
