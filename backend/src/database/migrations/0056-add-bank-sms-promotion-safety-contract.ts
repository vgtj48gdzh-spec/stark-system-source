import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const RAW_TABLE = 'sms_message_raw';
const CLASSIFICATION_TABLE = 'sms_message_classification';
const TRANSACTION_TABLE = 'bank_sms_transaction';
const OPERATION_LOG_TABLE = 'operation_logs';

export class AddBankSmsPromotionSafetyContract00561785441000000
  implements MigrationInterface
{
  name = 'AddBankSmsPromotionSafetyContract00561785441000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addRawEvidenceColumns(queryRunner);
    await this.addClassificationEvidenceColumns(queryRunner);
    await this.addTransactionEvidenceColumns(queryRunner);
    await this.addSystemActorColumns(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.assertPromotionEvidenceRollbackSafe(queryRunner);
    await this.assertSystemActorRollbackSafe(queryRunner);
    await this.dropSystemActorColumns(queryRunner);
    await this.dropTransactionEvidenceColumns(queryRunner);
    await this.dropClassificationEvidenceColumns(queryRunner);
    await this.dropRawEvidenceColumns(queryRunner);
  }

  private async addRawEvidenceColumns(queryRunner: QueryRunner) {
    await this.addColumnIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableColumn({ name: 'mobile_sms_event_id', type: 'int', isNullable: true }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableColumn({
        name: 'promotion_admission_key',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableColumn({
        name: 'promotion_policy_version',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableColumn({
        name: 'promotion_admission_outcome',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableColumn({
        name: 'promotion_decision_fingerprint',
        type: 'char',
        length: '64',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableColumn({
        name: 'promotion_evidence_fingerprint',
        type: 'char',
        length: '64',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableColumn({
        name: 'promotion_blocker_codes',
        type: 'json',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableColumn({
        name: 'promotion_evidence_blocker_codes',
        type: 'json',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableColumn({
        name: 'promotion_target_status_preview',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );

    await this.createIndexIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableIndex({
        name: 'uq_sms_message_raw_mobile_sms_event_id',
        columnNames: ['mobile_sms_event_id'],
        isUnique: true,
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableIndex({
        name: 'uq_sms_message_raw_promotion_admission_key',
        columnNames: ['promotion_admission_key'],
        isUnique: true,
      }),
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      RAW_TABLE,
      new TableForeignKey({
        name: 'fk_sms_message_raw_mobile_sms_event',
        columnNames: ['mobile_sms_event_id'],
        referencedTableName: 'mobile_sms_events',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  private async addClassificationEvidenceColumns(queryRunner: QueryRunner) {
    await this.addColumnIfMissing(
      queryRunner,
      CLASSIFICATION_TABLE,
      new TableColumn({
        name: 'parser_policy_version',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      CLASSIFICATION_TABLE,
      new TableColumn({
        name: 'evidence_fingerprint',
        type: 'char',
        length: '64',
        isNullable: true,
      }),
    );
  }

  private async addTransactionEvidenceColumns(queryRunner: QueryRunner) {
    for (const column of [
      new TableColumn({
        name: 'parser_policy_version',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'promotion_policy_version',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'promotion_admission_key',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'promotion_evidence_fingerprint',
        type: 'char',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'promotion_decision_fingerprint',
        type: 'char',
        length: '64',
        isNullable: true,
      }),
    ]) {
      await this.addColumnIfMissing(queryRunner, TRANSACTION_TABLE, column);
    }

    await this.createIndexIfMissing(
      queryRunner,
      TRANSACTION_TABLE,
      new TableIndex({
        name: 'uq_bank_sms_transaction_promotion_admission_key',
        columnNames: ['promotion_admission_key'],
        isUnique: true,
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      TRANSACTION_TABLE,
      new TableIndex({
        name: 'uq_bank_sms_transaction_promotion_decision_fingerprint',
        columnNames: ['promotion_decision_fingerprint'],
        isUnique: true,
      }),
    );
  }

  private async addSystemActorColumns(queryRunner: QueryRunner) {
    await this.addColumnIfMissing(
      queryRunner,
      OPERATION_LOG_TABLE,
      new TableColumn({
        name: 'actor_type',
        type: 'enum',
        enum: ['human', 'system'],
        default: "'human'",
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      OPERATION_LOG_TABLE,
      new TableColumn({
        name: 'actor_ref',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );

    const table = await queryRunner.getTable(OPERATION_LOG_TABLE);
    const operatorColumn = table?.findColumnByName('operator_id');
    if (operatorColumn && !operatorColumn.isNullable) {
      const foreignKey = table?.foreignKeys.find((item) =>
        item.columnNames.includes('operator_id'),
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey(OPERATION_LOG_TABLE, foreignKey);
      }
      await queryRunner.changeColumn(
        OPERATION_LOG_TABLE,
        operatorColumn,
        new TableColumn({ name: 'operator_id', type: 'int', isNullable: true }),
      );
    }
    await this.createForeignKeyIfMissing(
      queryRunner,
      OPERATION_LOG_TABLE,
      new TableForeignKey({
        name: 'fk_operation_logs_operator',
        columnNames: ['operator_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );
  }

  private async assertPromotionEvidenceRollbackSafe(queryRunner: QueryRunner) {
    for (const [tableName, columnName] of [
      [RAW_TABLE, 'mobile_sms_event_id'],
      [RAW_TABLE, 'promotion_admission_key'],
      [CLASSIFICATION_TABLE, 'parser_policy_version'],
      [CLASSIFICATION_TABLE, 'evidence_fingerprint'],
      [TRANSACTION_TABLE, 'promotion_admission_key'],
    ] as const) {
      if (
        !(await queryRunner.hasTable(tableName)) ||
        !(await queryRunner.hasColumn(tableName, columnName))
      ) {
        continue;
      }
      const rows = (await queryRunner.query(`
        SELECT COUNT(*) AS row_count
        FROM \`${tableName}\`
        WHERE \`${columnName}\` IS NOT NULL
      `)) as Array<{ row_count: string | number }>;
      if (Number(rows[0]?.row_count ?? 0) > 0) {
        throw new Error(
          `Cannot roll back bank SMS promotion schema while ${tableName}.${columnName} evidence exists.`,
        );
      }
    }
  }

  private async assertSystemActorRollbackSafe(queryRunner: QueryRunner) {
    if (!(await queryRunner.hasTable(OPERATION_LOG_TABLE))) {
      return;
    }
    if (!(await queryRunner.hasColumn(OPERATION_LOG_TABLE, 'actor_type'))) {
      return;
    }
    const rows = (await queryRunner.query(`
      SELECT COUNT(*) AS row_count
      FROM operation_logs
      WHERE operator_id IS NULL OR actor_type = 'system'
    `)) as Array<{ row_count: string | number }>;
    if (Number(rows[0]?.row_count ?? 0) > 0) {
      throw new Error(
        'Cannot roll back bank SMS promotion actor schema while system/null-operator audit rows exist.',
      );
    }
  }

  private async dropSystemActorColumns(queryRunner: QueryRunner) {
    const table = await queryRunner.getTable(OPERATION_LOG_TABLE);
    const operatorForeignKey = table?.foreignKeys.find((item) =>
      item.columnNames.includes('operator_id'),
    );
    if (operatorForeignKey) {
      await queryRunner.dropForeignKey(OPERATION_LOG_TABLE, operatorForeignKey);
    }
    const operatorColumn = table?.findColumnByName('operator_id');
    if (operatorColumn?.isNullable) {
      await queryRunner.changeColumn(
        OPERATION_LOG_TABLE,
        operatorColumn,
        new TableColumn({ name: 'operator_id', type: 'int', isNullable: false }),
      );
    }
    await this.createForeignKeyIfMissing(
      queryRunner,
      OPERATION_LOG_TABLE,
      new TableForeignKey({
        name: 'fk_operation_logs_operator',
        columnNames: ['operator_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );
    await this.dropColumnIfPresent(queryRunner, OPERATION_LOG_TABLE, 'actor_ref');
    await this.dropColumnIfPresent(queryRunner, OPERATION_LOG_TABLE, 'actor_type');
  }

  private async dropTransactionEvidenceColumns(queryRunner: QueryRunner) {
    await this.dropIndexIfPresent(
      queryRunner,
      TRANSACTION_TABLE,
      'uq_bank_sms_transaction_promotion_decision_fingerprint',
    );
    await this.dropIndexIfPresent(
      queryRunner,
      TRANSACTION_TABLE,
      'uq_bank_sms_transaction_promotion_admission_key',
    );
    for (const column of [
      'promotion_decision_fingerprint',
      'promotion_evidence_fingerprint',
      'promotion_admission_key',
      'promotion_policy_version',
      'parser_policy_version',
    ]) {
      await this.dropColumnIfPresent(queryRunner, TRANSACTION_TABLE, column);
    }
  }

  private async dropClassificationEvidenceColumns(queryRunner: QueryRunner) {
    await this.dropColumnIfPresent(queryRunner, CLASSIFICATION_TABLE, 'evidence_fingerprint');
    await this.dropColumnIfPresent(queryRunner, CLASSIFICATION_TABLE, 'parser_policy_version');
  }

  private async dropRawEvidenceColumns(queryRunner: QueryRunner) {
    const table = await queryRunner.getTable(RAW_TABLE);
    const eventForeignKey = table?.foreignKeys.find((item) =>
      item.columnNames.includes('mobile_sms_event_id'),
    );
    if (eventForeignKey) {
      await queryRunner.dropForeignKey(RAW_TABLE, eventForeignKey);
    }
    await this.dropIndexIfPresent(
      queryRunner,
      RAW_TABLE,
      'uq_sms_message_raw_promotion_admission_key',
    );
    await this.dropIndexIfPresent(
      queryRunner,
      RAW_TABLE,
      'uq_sms_message_raw_mobile_sms_event_id',
    );
    for (const column of [
      'promotion_target_status_preview',
      'promotion_evidence_blocker_codes',
      'promotion_blocker_codes',
      'promotion_evidence_fingerprint',
      'promotion_decision_fingerprint',
      'promotion_admission_outcome',
      'promotion_policy_version',
      'promotion_admission_key',
      'mobile_sms_event_id',
    ]) {
      await this.dropColumnIfPresent(queryRunner, RAW_TABLE, column);
    }
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    column: TableColumn,
  ) {
    if (!(await queryRunner.hasColumn(tableName, column.name))) {
      await queryRunner.addColumn(tableName, column);
    }
  }

  private async dropColumnIfPresent(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ) {
    if (await queryRunner.hasColumn(tableName, columnName)) {
      await queryRunner.dropColumn(tableName, columnName);
    }
  }

  private async createIndexIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    index: TableIndex,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (!table?.indices.some((item) => item.name === index.name)) {
      await queryRunner.createIndex(tableName, index);
    }
  }

  private async dropIndexIfPresent(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (table?.indices.some((item) => item.name === indexName)) {
      await queryRunner.dropIndex(tableName, indexName);
    }
  }

  private async createForeignKeyIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    foreignKey: TableForeignKey,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (
      !table?.foreignKeys.some(
        (item) =>
          item.name === foreignKey.name ||
          item.columnNames.join(',') === foreignKey.columnNames.join(','),
      )
    ) {
      await queryRunner.createForeignKey(tableName, foreignKey);
    }
  }
}
