import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAbcBackfillMappingRules1710800015000
  implements MigrationInterface
{
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.seedStatusMappings(queryRunner);
    await this.seedAmountRules(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE FROM abc_amount_rules
        WHERE source_system = 'ABC'
          AND source_table IN ('goods_group', 'goods_group_order')
          AND amount_field IN ('price', 'shopping_card_money', 'total_price')
      `,
    );

    await queryRunner.query(
      `
        DELETE FROM abc_status_mappings
        WHERE source_system = 'ABC'
          AND (
            (source_table = 'goods_group' AND source_field = 'status')
            OR (source_table = 'goods_group_order' AND source_field = 'status')
          )
      `,
    );
  }

  private async seedStatusMappings(queryRunner: QueryRunner) {
    const rows = [
      [
        'ABC',
        'goods_group',
        'status',
        '1',
        'card_status',
        'active',
        'inferred',
        'goods_group.status=1 is inferred as active package/template based on current local ABC data.',
      ],
      [
        'ABC',
        'goods_group',
        'status',
        '2',
        'card_status',
        'inactive',
        'inferred',
        'goods_group.status=2 is inferred as inactive package/template based on current local ABC data.',
      ],
      [
        'ABC',
        'goods_group_order',
        'status',
        '1',
        'order_status',
        'pending_payment',
        'inferred',
        'goods_group_order.status=1 is inferred as pending payment / not fully completed.',
      ],
      [
        'ABC',
        'goods_group_order',
        'status',
        '3',
        'order_status',
        'completed',
        'inferred',
        'goods_group_order.status=3 is inferred as completed from 2026-02 wash-card order samples.',
      ],
    ];

    for (const row of rows) {
      await queryRunner.query(
        `
          INSERT INTO abc_status_mappings
            (source_system, source_table, source_field, source_value, target_domain, target_value, confidence_level, notes, is_active)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1
          FROM DUAL
          WHERE NOT EXISTS (
            SELECT 1
            FROM abc_status_mappings
            WHERE source_system = ?
              AND source_table = ?
              AND source_field = ?
              AND source_value = ?
              AND target_domain = ?
          )
        `,
        [...row, row[0], row[1], row[2], row[3], row[4]],
      );
    }
  }

  private async seedAmountRules(queryRunner: QueryRunner) {
    const rows = [
      [
        'ABC',
        'goods_group',
        'price',
        'fen',
        'yuan',
        '0.010000',
        2,
        'inferred',
        'goods_group.price is treated as fen based on package prices such as 60000 = 600.00 yuan.',
      ],
      [
        'ABC',
        'goods_group',
        'shopping_card_money',
        'fen',
        'yuan',
        '0.010000',
        2,
        'inferred',
        'goods_group.shopping_card_money is treated as fen based on wash-card package stored value.',
      ],
      [
        'ABC',
        'goods_group_order',
        'total_price',
        'fen',
        'yuan',
        '0.010000',
        2,
        'inferred',
        'goods_group_order.total_price is treated as fen based on 2026-02 package order totals such as 60000 = 600.00 yuan.',
      ],
    ];

    for (const row of rows) {
      await queryRunner.query(
        `
          INSERT INTO abc_amount_rules
            (source_system, source_table, amount_field, amount_unit_raw, standard_unit, conversion_rate, standard_scale, confidence_level, notes, is_active)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
          FROM DUAL
          WHERE NOT EXISTS (
            SELECT 1
            FROM abc_amount_rules
            WHERE source_system = ?
              AND source_table = ?
              AND amount_field = ?
          )
        `,
        [...row, row[0], row[1], row[2]],
      );
    }
  }
}
