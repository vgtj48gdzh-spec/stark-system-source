import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMobileDiagnosticRuntimeSnapshot00431777025200000 implements MigrationInterface {
  name = 'AddMobileDiagnosticRuntimeSnapshot00431777025200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE mobile_device_diagnostics
      ADD COLUMN device_reported_at datetime NULL AFTER read_sms_permission,
      ADD COLUMN runtime_snapshot_json json NULL AFTER base_url_source
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE mobile_device_diagnostics
      DROP COLUMN runtime_snapshot_json,
      DROP COLUMN device_reported_at
    `);
  }
}
