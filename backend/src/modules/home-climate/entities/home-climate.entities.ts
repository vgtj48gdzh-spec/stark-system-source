import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HomeClimateTriggerSource = 'web' | 'wechat_lobster';
export type HomeClimateDeliveryStatus =
  | 'pending'
  | 'command_sent'
  | 'device_confirmed'
  | 'failed';

@Entity('home_device_registry')
@Index('uq_home_device_code', ['deviceCode'], { unique: true })
@Index('uq_home_device_did', ['did'], { unique: true })
export class HomeClimateDevice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'device_code', type: 'varchar', length: 64 })
  deviceCode!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 128 })
  did!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location!: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  enabled!: boolean;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('home_device_command_preset')
@Index('uq_home_device_preset_code', ['deviceId', 'presetCode'], { unique: true })
export class HomeClimatePreset {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'device_id', type: 'int' })
  deviceId!: number;

  @Column({ name: 'preset_code', type: 'varchar', length: 64 })
  presetCode!: string;

  @Column({ name: 'preset_name', type: 'varchar', length: 120 })
  presetName!: string;

  @Column({ type: 'json' })
  properties!: Record<string, unknown>;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  enabled!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('home_device_control_log')
@Index('uq_home_device_control_request', ['requestId'], { unique: true })
@Index('uq_home_device_control_nonce', ['nonceHash'], { unique: true })
@Index('idx_home_device_control_device_created', ['deviceId', 'createdAt'])
export class HomeClimateControlLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'device_id', type: 'int' })
  deviceId!: number;

  @Column({ name: 'preset_id', type: 'int' })
  presetId!: number;

  @Column({ name: 'device_code_snapshot', type: 'varchar', length: 64 })
  deviceCodeSnapshot!: string;

  @Column({ name: 'preset_code_snapshot', type: 'varchar', length: 64 })
  presetCodeSnapshot!: string;

  @Column({ name: 'preset_name_snapshot', type: 'varchar', length: 120 })
  presetNameSnapshot!: string;

  @Column({ name: 'properties_snapshot', type: 'json' })
  propertiesSnapshot!: Record<string, unknown>;

  @Column({ name: 'trigger_source', type: 'varchar', length: 32 })
  triggerSource!: HomeClimateTriggerSource;

  @Column({ name: 'operator_user_id', type: 'int', nullable: true })
  operatorUserId!: number | null;

  @Column({ name: 'request_id', type: 'varchar', length: 96 })
  requestId!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'nonce_hash', type: 'char', length: 64, nullable: true })
  nonceHash!: string | null;

  @Column({ name: 'service_id_hash', type: 'char', length: 64, nullable: true })
  serviceIdHash!: string | null;

  @Column({ name: 'owner_peer_hash', type: 'char', length: 64, nullable: true })
  ownerPeerHash!: string | null;

  @Column({ name: 'delivery_status', type: 'varchar', length: 32, default: 'pending' })
  deliveryStatus!: HomeClimateDeliveryStatus;

  @Column({ name: 'bridge_accepted', type: 'tinyint', width: 1, default: 0 })
  bridgeAccepted!: boolean;

  @Column({ name: 'device_confirmed', type: 'tinyint', width: 1, default: 0 })
  deviceConfirmed!: boolean;

  @Column({ name: 'readback_snapshot', type: 'json', nullable: true })
  readbackSnapshot!: Record<string, unknown> | null;

  @Column({ name: 'error_code', type: 'varchar', length: 96, nullable: true })
  errorCode!: string | null;

  @Column({ name: 'requested_at', type: 'datetime', precision: 6 })
  requestedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

export const HOME_CLIMATE_ENTITIES = [
  HomeClimateDevice,
  HomeClimatePreset,
  HomeClimateControlLog,
] as const;
