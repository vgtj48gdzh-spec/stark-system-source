import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mobile_sms_raw')
export class MobileSmsRaw {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'device_id', type: 'varchar', length: 100 })
  deviceId!: string;

  @Column({ type: 'varchar', length: 100 })
  sender!: string;

  @Column({ type: 'longtext' })
  body!: string;

  @Column({ name: 'received_at', type: 'datetime' })
  receivedAt!: Date;

  @Column({ name: 'raw_json', type: 'json', nullable: true })
  rawJson!: Record<string, unknown> | null;

  @Column({ name: 'parse_status', type: 'varchar', length: 32, default: 'pending' })
  parseStatus!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
