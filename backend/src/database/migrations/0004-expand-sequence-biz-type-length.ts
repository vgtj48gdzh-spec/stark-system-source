import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandSequenceBizTypeLength1710800003000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sequences
      MODIFY COLUMN biz_type VARCHAR(50) NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sequences
      MODIFY COLUMN biz_type VARCHAR(20) NOT NULL
    `);
  }
}
