import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SmsMessageRaw } from '../../message-hub/entities/sms-message-raw.entity';

@Entity('verification_code_dispatch_log')
export class VerificationCodeDispatchLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'raw_sms_id', type: 'int' })
  rawSmsId!: number;

  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'enum', enum: ['ai_alert', 'email'] })
  channel!: 'ai_alert' | 'email';

  @Column({ type: 'varchar', length: 200 })
  receiver!: string;

  @Column({ name: 'dispatched_at', type: 'datetime' })
  dispatchedAt!: Date;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @Column({ name: 'response_payload', type: 'json', nullable: true })
  responsePayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => SmsMessageRaw, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'raw_sms_id' })
  rawSms!: SmsMessageRaw;
}
