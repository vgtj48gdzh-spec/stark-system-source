import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mobile_sms_events')
export class MobileSmsEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'device_id', type: 'varchar', length: 100 })
  deviceId!: string;

  @Column({ name: 'sender_address', type: 'varchar', length: 100 })
  senderAddress!: string;

  @Column({ name: 'message_body', type: 'longtext' })
  messageBody!: string;

  @Column({ name: 'device_sms_id', type: 'varchar', length: 64, nullable: true })
  deviceSmsId!: string | null;

  @Column({ name: 'dedupe_fingerprint', type: 'varchar', length: 255, nullable: true })
  dedupeFingerprint!: string | null;

  @Column({ name: 'received_at_device', type: 'datetime' })
  receivedAtDevice!: Date;

  @Column({
    name: 'received_at_server',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  receivedAtServer!: Date;

  @Column({ name: 'sms_format', type: 'varchar', length: 32, nullable: true })
  smsFormat!: string | null;

  @Column({ name: 'pdu_count', type: 'int', default: 1 })
  pduCount!: number;

  @Column({ name: 'raw_payload_json', type: 'json', nullable: true })
  rawPayloadJson!: Record<string, unknown> | null;

  @Column({ name: 'delivery_status', type: 'varchar', length: 32, default: 'received' })
  deliveryStatus!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
