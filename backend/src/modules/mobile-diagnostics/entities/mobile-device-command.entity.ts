import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mobile_device_command')
export class MobileDeviceCommand {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'device_id', type: 'varchar', length: 100 })
  deviceId!: string;

  @Column({
    name: 'command_type',
    type: 'enum',
    enum: ['inbox_sync', 'test_upload'],
  })
  commandType!: 'inbox_sync' | 'test_upload';

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: 'pending' | 'completed' | 'failed';

  @Column({ name: 'requested_by', type: 'int', nullable: true })
  requestedBy!: number | null;

  @Column({ name: 'requested_at', type: 'datetime' })
  requestedAt!: Date;

  @Column({ name: 'executed_at', type: 'datetime', nullable: true })
  executedAt!: Date | null;

  @Column({ name: 'response_payload', type: 'json', nullable: true })
  responsePayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
