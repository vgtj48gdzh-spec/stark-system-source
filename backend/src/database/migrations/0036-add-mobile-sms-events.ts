import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddMobileSmsEvents00361745152200000 implements MigrationInterface {
  name = 'AddMobileSmsEvents00361745152200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('mobile_sms_events')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'mobile_sms_events',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'device_id', type: 'varchar', length: '100' },
          { name: 'sender_address', type: 'varchar', length: '100' },
          { name: 'message_body', type: 'longtext' },
          { name: 'received_at_device', type: 'datetime' },
          { name: 'received_at_server', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'sms_format', type: 'varchar', length: '32', isNullable: true },
          { name: 'pdu_count', type: 'int', default: '1' },
          { name: 'raw_payload_json', type: 'json', isNullable: true },
          { name: 'delivery_status', type: 'varchar', length: '32', default: "'received'" },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'mobile_sms_events',
      new TableIndex({
        name: 'idx_mobile_sms_events_received_at_server',
        columnNames: ['received_at_server', 'id'],
      }),
    );

    await queryRunner.createIndex(
      'mobile_sms_events',
      new TableIndex({
        name: 'idx_mobile_sms_events_device_id',
        columnNames: ['device_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('mobile_sms_events'))) {
      return;
    }

    await queryRunner.dropIndex(
      'mobile_sms_events',
      'idx_mobile_sms_events_received_at_server',
    );
    await queryRunner.dropIndex('mobile_sms_events', 'idx_mobile_sms_events_device_id');
    await queryRunner.dropTable('mobile_sms_events');
  }
}
