import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_connector_configs')
export class PlatformConnectorConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  platform!: string;

  @Column({ name: 'account_id', type: 'varchar', length: 100 })
  accountId!: string;

  @Column({ name: 'connector_code', type: 'varchar', length: 100 })
  connectorCode!: string;

  @Column({ name: 'connector_name', type: 'varchar', length: 100 })
  connectorName!: string;

  @Column({ name: 'connector_type', type: 'varchar', length: 30 })
  connectorType!: string;

  @Column({ name: 'auth_mode', type: 'varchar', length: 30, nullable: true })
  authMode!: string | null;

  @Column({ name: 'config_json', type: 'json', nullable: true })
  configJson!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ name: 'last_synced_at', type: 'datetime', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
