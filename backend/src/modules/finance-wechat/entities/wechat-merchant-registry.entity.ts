import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wechat_merchant_registry')
export class WechatMerchantRegistry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId!: number;

  @Column({ name: 'merchant_id', type: 'varchar', length: 100 })
  merchantId!: string;

  @Column({ name: 'app_id', type: 'varchar', length: 100, nullable: true })
  appId!: string | null;

  @Column({ name: 'merchant_name', type: 'varchar', length: 200 })
  merchantName!: string;

  @Column({ name: 'settlement_bank_account_registry_id', type: 'int', nullable: true })
  settlementBankAccountRegistryId!: number | null;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status!: 'active' | 'inactive';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
