import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class FormalizeMobileBridgeDedupe00421776920000000 implements MigrationInterface {
  name = 'FormalizeMobileBridgeDedupe00421776920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('mobile_sms_events')) {
      if (!(await queryRunner.hasColumn('mobile_sms_events', 'device_sms_id'))) {
        await queryRunner.addColumn(
          'mobile_sms_events',
          new TableColumn({
            name: 'device_sms_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          }),
        );
      }
      if (!(await queryRunner.hasColumn('mobile_sms_events', 'dedupe_fingerprint'))) {
        await queryRunner.addColumn(
          'mobile_sms_events',
          new TableColumn({
            name: 'dedupe_fingerprint',
            type: 'varchar',
            length: '255',
            isNullable: true,
          }),
        );
      }

      await queryRunner.query(`
        UPDATE mobile_sms_events
        SET device_sms_id = COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_payload_json, '$.deviceSmsId')), 'null'),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_payload_json, '$.smsId')), 'null')
        )
        WHERE device_sms_id IS NULL
      `);
      await queryRunner.query(`
        UPDATE mobile_sms_events
        SET dedupe_fingerprint = CASE
          WHEN device_sms_id IS NOT NULL AND device_sms_id <> ''
            THEN CONCAT('deviceSmsId|', device_id, '|', device_sms_id)
          ELSE CONCAT(
            'fallback|',
            device_id,
            '|',
            COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_payload_json, '$.simSlot')), 'null'), 'null'),
            '|',
            TRIM(sender_address),
            '|',
            DATE_FORMAT(received_at_device, '%Y-%m-%dT%H:%i:%s.000Z'),
            '|',
            REPLACE(REPLACE(REPLACE(TRIM(message_body), '\\r', ' '), '\\n', ' '), '  ', ' ')
          )
        END
        WHERE dedupe_fingerprint IS NULL
      `);

      const mobileEventTable = await queryRunner.getTable('mobile_sms_events');
      if (
        mobileEventTable &&
        !mobileEventTable.indices.some((item) => item.name === 'idx_mobile_sms_events_device_sms_id')
      ) {
        await queryRunner.createIndex(
          'mobile_sms_events',
          new TableIndex({
            name: 'idx_mobile_sms_events_device_sms_id',
            columnNames: ['device_id', 'device_sms_id'],
          }),
        );
      }
      if (
        mobileEventTable &&
        !mobileEventTable.indices.some((item) => item.name === 'idx_mobile_sms_events_dedupe_fingerprint')
      ) {
        await queryRunner.createIndex(
          'mobile_sms_events',
          new TableIndex({
            name: 'idx_mobile_sms_events_dedupe_fingerprint',
            columnNames: ['device_id', 'dedupe_fingerprint'],
          }),
        );
      }
    }

    if (await queryRunner.hasTable('sms_message_raw')) {
      if (!(await queryRunner.hasColumn('sms_message_raw', 'device_sms_id'))) {
        await queryRunner.addColumn(
          'sms_message_raw',
          new TableColumn({
            name: 'device_sms_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          }),
        );
      }
      if (!(await queryRunner.hasColumn('sms_message_raw', 'dedupe_fingerprint'))) {
        await queryRunner.addColumn(
          'sms_message_raw',
          new TableColumn({
            name: 'dedupe_fingerprint',
            type: 'varchar',
            length: '255',
            isNullable: true,
          }),
        );
      }

      const rawTable = await queryRunner.getTable('sms_message_raw');
      if (
        rawTable &&
        !rawTable.indices.some((item) => item.name === 'idx_sms_message_raw_device_sms_id')
      ) {
        await queryRunner.createIndex(
          'sms_message_raw',
          new TableIndex({
            name: 'idx_sms_message_raw_device_sms_id',
            columnNames: ['device_id', 'device_sms_id'],
          }),
        );
      }
      if (
        rawTable &&
        !rawTable.indices.some((item) => item.name === 'idx_sms_message_raw_dedupe_fingerprint')
      ) {
        await queryRunner.createIndex(
          'sms_message_raw',
          new TableIndex({
            name: 'idx_sms_message_raw_dedupe_fingerprint',
            columnNames: ['device_id', 'dedupe_fingerprint'],
          }),
        );
      }
    }

    if (await queryRunner.hasTable('mobile_device_diagnostics')) {
      if (!(await queryRunner.hasColumn('mobile_device_diagnostics', 'resolved_base_url'))) {
        await queryRunner.addColumn(
          'mobile_device_diagnostics',
          new TableColumn({
            name: 'resolved_base_url',
            type: 'varchar',
            length: '255',
            isNullable: true,
          }),
        );
      }
      if (!(await queryRunner.hasColumn('mobile_device_diagnostics', 'base_url_source'))) {
        await queryRunner.addColumn(
          'mobile_device_diagnostics',
          new TableColumn({
            name: 'base_url_source',
            type: 'varchar',
            length: '32',
            isNullable: true,
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('mobile_device_diagnostics')) {
      if (await queryRunner.hasColumn('mobile_device_diagnostics', 'base_url_source')) {
        await queryRunner.dropColumn('mobile_device_diagnostics', 'base_url_source');
      }
      if (await queryRunner.hasColumn('mobile_device_diagnostics', 'resolved_base_url')) {
        await queryRunner.dropColumn('mobile_device_diagnostics', 'resolved_base_url');
      }
    }

    if (await queryRunner.hasTable('sms_message_raw')) {
      const rawTable = await queryRunner.getTable('sms_message_raw');
      if (rawTable?.indices.some((item) => item.name === 'idx_sms_message_raw_dedupe_fingerprint')) {
        await queryRunner.dropIndex('sms_message_raw', 'idx_sms_message_raw_dedupe_fingerprint');
      }
      if (rawTable?.indices.some((item) => item.name === 'idx_sms_message_raw_device_sms_id')) {
        await queryRunner.dropIndex('sms_message_raw', 'idx_sms_message_raw_device_sms_id');
      }
      if (await queryRunner.hasColumn('sms_message_raw', 'dedupe_fingerprint')) {
        await queryRunner.dropColumn('sms_message_raw', 'dedupe_fingerprint');
      }
      if (await queryRunner.hasColumn('sms_message_raw', 'device_sms_id')) {
        await queryRunner.dropColumn('sms_message_raw', 'device_sms_id');
      }
    }

    if (await queryRunner.hasTable('mobile_sms_events')) {
      const mobileEventTable = await queryRunner.getTable('mobile_sms_events');
      if (
        mobileEventTable?.indices.some((item) => item.name === 'idx_mobile_sms_events_dedupe_fingerprint')
      ) {
        await queryRunner.dropIndex('mobile_sms_events', 'idx_mobile_sms_events_dedupe_fingerprint');
      }
      if (mobileEventTable?.indices.some((item) => item.name === 'idx_mobile_sms_events_device_sms_id')) {
        await queryRunner.dropIndex('mobile_sms_events', 'idx_mobile_sms_events_device_sms_id');
      }
      if (await queryRunner.hasColumn('mobile_sms_events', 'dedupe_fingerprint')) {
        await queryRunner.dropColumn('mobile_sms_events', 'dedupe_fingerprint');
      }
      if (await queryRunner.hasColumn('mobile_sms_events', 'device_sms_id')) {
        await queryRunner.dropColumn('mobile_sms_events', 'device_sms_id');
      }
    }
  }
}
