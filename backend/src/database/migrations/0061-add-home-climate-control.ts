import { MigrationInterface, QueryRunner } from 'typeorm';

const tables = [
  'home_device_control_log',
  'home_device_command_preset',
  'home_device_registry',
] as const;

export class AddHomeClimateControl00611787200001000 implements MigrationInterface {
  name = 'AddHomeClimateControl00611787200001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE home_device_registry (
        id INT NOT NULL AUTO_INCREMENT,
        device_code VARCHAR(64) NOT NULL,
        name VARCHAR(120) NOT NULL,
        did VARCHAR(128) NOT NULL,
        model VARCHAR(120) NULL,
        location VARCHAR(120) NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_home_device_code (device_code),
        UNIQUE KEY uq_home_device_did (did),
        CONSTRAINT fk_home_device_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_home_device_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE home_device_command_preset (
        id INT NOT NULL AUTO_INCREMENT,
        device_id INT NOT NULL,
        preset_code VARCHAR(64) NOT NULL,
        preset_name VARCHAR(120) NOT NULL,
        properties JSON NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_by INT NOT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_home_device_preset_code (device_id, preset_code),
        CONSTRAINT fk_home_preset_device FOREIGN KEY (device_id) REFERENCES home_device_registry(id) ON DELETE RESTRICT,
        CONSTRAINT fk_home_preset_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_home_preset_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE home_device_control_log (
        id INT NOT NULL AUTO_INCREMENT,
        device_id INT NOT NULL,
        preset_id INT NOT NULL,
        device_code_snapshot VARCHAR(64) NOT NULL,
        preset_code_snapshot VARCHAR(64) NOT NULL,
        preset_name_snapshot VARCHAR(120) NOT NULL,
        properties_snapshot JSON NOT NULL,
        trigger_source VARCHAR(32) NOT NULL,
        operator_user_id INT NULL,
        request_id VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        nonce_hash CHAR(64) NULL,
        service_id_hash CHAR(64) NULL,
        owner_peer_hash CHAR(64) NULL,
        delivery_status VARCHAR(32) NOT NULL DEFAULT 'pending',
        bridge_accepted TINYINT(1) NOT NULL DEFAULT 0,
        device_confirmed TINYINT(1) NOT NULL DEFAULT 0,
        readback_snapshot JSON NULL,
        error_code VARCHAR(96) NULL,
        requested_at DATETIME(6) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_home_device_control_request (request_id),
        UNIQUE KEY uq_home_device_control_nonce (nonce_hash),
        KEY idx_home_device_control_device_created (device_id, created_at),
        KEY idx_home_device_control_delivery (delivery_status, created_at),
        CONSTRAINT fk_home_control_device FOREIGN KEY (device_id) REFERENCES home_device_registry(id) ON DELETE RESTRICT,
        CONSTRAINT fk_home_control_preset FOREIGN KEY (preset_id) REFERENCES home_device_command_preset(id) ON DELETE RESTRICT,
        CONSTRAINT fk_home_control_operator FOREIGN KEY (operator_user_id) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of tables) {
      if (!(await queryRunner.hasTable(table))) {
        continue;
      }
      const rows = (await queryRunner.query(
        `SELECT COUNT(*) AS row_count FROM \`${table}\``,
      )) as Array<{ row_count?: string | number }>;
      if (Number(rows[0]?.row_count ?? 0) > 0) {
        throw new Error(
          `Refusing to drop ${table} while home-climate configuration or audit evidence exists`,
        );
      }
    }
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
    }
  }
}
