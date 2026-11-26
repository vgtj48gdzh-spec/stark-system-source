import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class InitRbacAndMvpTables1710800000000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'username', type: 'varchar', length: '50', isUnique: true },
          { name: 'password_hash', type: 'varchar', length: '255' },
          { name: 'real_name', type: 'varchar', length: '50' },
          { name: 'mobile', type: 'varchar', length: '20', isNullable: true },
          { name: 'status', type: 'tinyint', default: 1 },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }
        ]
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'name', type: 'varchar', length: '50' },
          { name: 'code', type: 'varchar', length: '50', isUnique: true },
          { name: 'description', type: 'varchar', length: '255', isNullable: true }
        ]
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_roles',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'user_id', type: 'int' },
          { name: 'role_id', type: 'int' }
        ],
        indices: [
          {
            name: 'uniq_user_role',
            columnNames: ['user_id', 'role_id'],
            isUnique: true,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'work_orders',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'work_order_no', type: 'varchar', length: '20', isUnique: true },
          { name: 'title', type: 'varchar', length: '100' },
          { name: 'customer_name', type: 'varchar', length: '100' },
          { name: 'customer_mobile', type: 'varchar', length: '20', isNullable: true },
          { name: 'amount_due', type: 'decimal', precision: 12, scale: 2 },
          { name: 'amount_received', type: 'decimal', precision: 12, scale: 2, default: '0.00' },
          { name: 'status', type: 'enum', enum: ['draft', 'pending_payment', 'paid', 'in_progress', 'completed', 'closed'], default: "'pending_payment'" },
          { name: 'responsible_user_id', type: 'int', isNullable: true },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by', type: 'int' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }
        ]
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'payment_records',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'payment_no', type: 'varchar', length: '20', isUnique: true },
          { name: 'work_order_id', type: 'int' },
          { name: 'amount', type: 'decimal', precision: 12, scale: 2 },
          { name: 'payment_method', type: 'varchar', length: '30' },
          { name: 'payment_status', type: 'enum', enum: ['pending', 'success', 'failed'], default: "'pending'" },
          { name: 'paid_at', type: 'datetime', isNullable: true },
          { name: 'payer_name', type: 'varchar', length: '100', isNullable: true },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by', type: 'int' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' }
        ]
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'approval_requests',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'approval_no', type: 'varchar', length: '20', isUnique: true },
          { name: 'approval_type', type: 'enum', enum: ['payout'], default: "'payout'" },
          { name: 'related_work_order_id', type: 'int' },
          { name: 'applicant_user_id', type: 'int' },
          { name: 'amount', type: 'decimal', precision: 12, scale: 2 },
          { name: 'reason', type: 'varchar', length: '500' },
          { name: 'current_status', type: 'enum', enum: ['pending', 'approved', 'rejected'], default: "'pending'" },
          { name: 'final_approver_id', type: 'int', isNullable: true },
          { name: 'verification_code', type: 'varchar', length: '20', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }
        ]
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'approval_logs',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'approval_request_id', type: 'int' },
          { name: 'action_by', type: 'int' },
          { name: 'action_type', type: 'varchar', length: '30' },
          { name: 'action_remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'action_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' }
        ]
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'payout_records',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'payout_no', type: 'varchar', length: '20', isUnique: true },
          { name: 'approval_request_id', type: 'int' },
          { name: 'amount', type: 'decimal', precision: 12, scale: 2 },
          { name: 'payee_name', type: 'varchar', length: '100' },
          { name: 'payment_method', type: 'varchar', length: '30' },
          { name: 'paid_at', type: 'datetime' },
          { name: 'created_by', type: 'int' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' }
        ]
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'operation_logs',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'module', type: 'varchar', length: '50' },
          { name: 'target_id', type: 'int' },
          { name: 'action', type: 'varchar', length: '50' },
          { name: 'operator_id', type: 'int' },
          { name: 'detail', type: 'varchar', length: '1000', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' }
        ]
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'sequences',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'biz_type', type: 'varchar', length: '50' },
          { name: 'biz_date', type: 'date' },
          { name: 'current_value', type: 'int', default: 0 },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }
        ],
        indices: [
          {
            name: 'uniq_biz_type_biz_date',
            columnNames: ['biz_type', 'biz_date'],
            isUnique: true,
          },
        ],
      }),
    );

    await queryRunner.createForeignKeys('user_roles', [
      new TableForeignKey({ columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
      new TableForeignKey({ columnNames: ['role_id'], referencedTableName: 'roles', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
    ]);

    await queryRunner.createForeignKeys('work_orders', [
      new TableForeignKey({ columnNames: ['responsible_user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      new TableForeignKey({ columnNames: ['created_by'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);

    await queryRunner.createForeignKeys('payment_records', [
      new TableForeignKey({ columnNames: ['work_order_id'], referencedTableName: 'work_orders', referencedColumnNames: ['id'] }),
      new TableForeignKey({ columnNames: ['created_by'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);

    await queryRunner.createForeignKeys('approval_requests', [
      new TableForeignKey({ columnNames: ['related_work_order_id'], referencedTableName: 'work_orders', referencedColumnNames: ['id'] }),
      new TableForeignKey({ columnNames: ['applicant_user_id'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
      new TableForeignKey({ columnNames: ['final_approver_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
    ]);

    await queryRunner.createForeignKeys('approval_logs', [
      new TableForeignKey({ columnNames: ['approval_request_id'], referencedTableName: 'approval_requests', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
      new TableForeignKey({ columnNames: ['action_by'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);

    await queryRunner.createForeignKeys('payout_records', [
      new TableForeignKey({ columnNames: ['approval_request_id'], referencedTableName: 'approval_requests', referencedColumnNames: ['id'] }),
      new TableForeignKey({ columnNames: ['created_by'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);

    await queryRunner.createForeignKeys('operation_logs', [
      new TableForeignKey({ columnNames: ['operator_id'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('operation_logs');
    await queryRunner.dropTable('payout_records');
    await queryRunner.dropTable('approval_logs');
    await queryRunner.dropTable('approval_requests');
    await queryRunner.dropTable('payment_records');
    await queryRunner.dropTable('work_orders');
    await queryRunner.dropTable('user_roles');
    await queryRunner.dropTable('roles');
    await queryRunner.dropTable('users');
    await queryRunner.dropTable('sequences');
  }
}
