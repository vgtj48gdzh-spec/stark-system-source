import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
} from 'typeorm';

export class AddPointsRedemptionBridge1710800033000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('points_redeemables'))) {
      await queryRunner.createTable(
        new Table({
          name: 'points_redeemables',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'redeemable_type', type: 'varchar', length: '64' },
            { name: 'redeemable_code', type: 'varchar', length: '100' },
            { name: 'redeemable_name', type: 'varchar', length: '150' },
            { name: 'provider_system', type: 'varchar', length: '64' },
            { name: 'provider_entity_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'points_cost', type: 'decimal', precision: 18, scale: 2, isNullable: true },
            { name: 'face_value', type: 'decimal', precision: 18, scale: 2, isNullable: true },
            { name: 'enabled_flag', type: 'tinyint', width: 1, default: '1' },
            { name: 'scene_scope', type: 'varchar', length: '100', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
            { name: 'normalized_payload', type: 'json', isNullable: true },
          ],
        }),
      );
      await queryRunner.createIndices('points_redeemables', [
        new TableIndex({
          name: 'idx_points_redeemable_type_enabled',
          columnNames: ['redeemable_type', 'enabled_flag'],
        }),
        new TableIndex({
          name: 'uq_points_redeemable_code',
          columnNames: ['redeemable_code'],
          isUnique: true,
        }),
      ]);

      await queryRunner.query(`
        INSERT INTO points_redeemables
          (redeemable_type, redeemable_code, redeemable_name, provider_system, provider_entity_id, points_cost, face_value, enabled_flag, scene_scope, normalized_payload)
        VALUES
          ('abc_shopping_card', 'abc-shopping-card-1', 'ABC 购物卡（A购物卡）', 'abc', '1', NULL, NULL, 1, 'points_redemption', JSON_OBJECT('providerTable', 'shopping_card', 'providerCardName', 'A购物卡')),
          ('abc_shopping_card', 'abc-shopping-card-2', 'ABC 购物卡（微佳购物卡）', 'abc', '2', NULL, NULL, 1, 'points_redemption', JSON_OBJECT('providerTable', 'shopping_card', 'providerCardName', '微佳购物卡')),
          ('abc_shopping_card', 'abc-shopping-card-3', 'ABC 购物卡（优优购商超购物卡）', 'abc', '3', NULL, NULL, 1, 'points_redemption', JSON_OBJECT('providerTable', 'shopping_card', 'providerCardName', '优优购商超购物卡', 'preferredForBridge', true))
      `);
    }

    if (!(await queryRunner.hasTable('points_redemption_requests'))) {
      await queryRunner.createTable(
        new Table({
          name: 'points_redemption_requests',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'request_status', type: 'varchar', length: '32', default: "'drafted'" },
            { name: 'owner_type', type: 'varchar', length: '32' },
            { name: 'owner_id', type: 'int', isNullable: true },
            { name: 'owner_mobile', type: 'varchar', length: '32', isNullable: true },
            { name: 'redeemable_type', type: 'varchar', length: '64' },
            { name: 'redeemable_code', type: 'varchar', length: '100' },
            { name: 'redeemable_name', type: 'varchar', length: '150' },
            { name: 'points_cost', type: 'decimal', precision: 18, scale: 2 },
            { name: 'target_value', type: 'decimal', precision: 18, scale: 2, isNullable: true },
            { name: 'provider_system', type: 'varchar', length: '64' },
            { name: 'request_source', type: 'varchar', length: '32', default: "'manual'" },
            { name: 'requested_by', type: 'int', isNullable: true },
            { name: 'requested_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'requested_at', type: 'datetime', isNullable: true },
            { name: 'confirmed_by', type: 'int', isNullable: true },
            { name: 'confirmed_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'confirmed_at', type: 'datetime', isNullable: true },
            { name: 'fulfilled_by', type: 'int', isNullable: true },
            { name: 'fulfilled_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'fulfilled_at', type: 'datetime', isNullable: true },
            { name: 'cancelled_by', type: 'int', isNullable: true },
            { name: 'cancelled_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'cancelled_at', type: 'datetime', isNullable: true },
            { name: 'provider_key', type: 'varchar', length: '100', isNullable: true },
            { name: 'source_action_id', type: 'varchar', length: '150', isNullable: true },
            { name: 'thread_key', type: 'varchar', length: '150', isNullable: true },
            { name: 'external_entity_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'external_no', type: 'varchar', length: '100', isNullable: true },
            { name: 'reason_code', type: 'varchar', length: '100', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
            { name: 'normalized_payload', type: 'json', isNullable: true },
          ],
        }),
      );
      await queryRunner.createIndices('points_redemption_requests', [
        new TableIndex({
          name: 'idx_points_redemption_status_owner',
          columnNames: ['request_status', 'owner_type', 'owner_mobile'],
        }),
        new TableIndex({
          name: 'idx_points_redemption_redeemable_status',
          columnNames: ['redeemable_code', 'request_status'],
        }),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('points_redemption_requests')) {
      await this.dropIndexIfExists(queryRunner, 'points_redemption_requests', 'idx_points_redemption_redeemable_status');
      await this.dropIndexIfExists(queryRunner, 'points_redemption_requests', 'idx_points_redemption_status_owner');
      await queryRunner.dropTable('points_redemption_requests');
    }
    if (await queryRunner.hasTable('points_redeemables')) {
      await this.dropIndexIfExists(queryRunner, 'points_redeemables', 'uq_points_redeemable_code');
      await this.dropIndexIfExists(queryRunner, 'points_redeemables', 'idx_points_redeemable_type_enabled');
      await queryRunner.dropTable('points_redeemables');
    }
  }

  private async dropIndexIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ) {
    const table = await queryRunner.getTable(tableName);
    const target = table?.indices.find((item) => item.name === indexName);
    if (target) {
      await queryRunner.dropIndex(tableName, target);
    }
  }
}
