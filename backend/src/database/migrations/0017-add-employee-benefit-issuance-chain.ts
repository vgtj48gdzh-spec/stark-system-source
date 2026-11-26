import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeBenefitIssuanceChain1710800017000 implements MigrationInterface {
  name = 'AddEmployeeBenefitIssuanceChain1710800017000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employee_benefit_issues (
        id INT NOT NULL AUTO_INCREMENT,
        issue_no VARCHAR(50) NOT NULL,
        employee_id INT NOT NULL,
        period_key VARCHAR(20) NOT NULL,
        issue_type VARCHAR(30) NOT NULL DEFAULT 'monthly_benefit',
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        total_item_count INT NOT NULL DEFAULT 0,
        confirmed_flag TINYINT(1) NOT NULL DEFAULT 0,
        confirmed_by INT NULL,
        confirmed_at DATETIME NULL,
        issued_by INT NULL,
        issued_at DATETIME NULL,
        remark VARCHAR(500) NULL,
        normalized_payload JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_employee_benefit_issues_issue_no (issue_no),
        KEY idx_employee_benefit_issues_employee_period (employee_id, period_key),
        KEY idx_employee_benefit_issues_status (status),
        CONSTRAINT fk_employee_benefit_issues_employee_id FOREIGN KEY (employee_id) REFERENCES employees(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employee_benefit_issue_items (
        id INT NOT NULL AUTO_INCREMENT,
        issue_id INT NOT NULL,
        item_type VARCHAR(30) NOT NULL,
        item_name VARCHAR(100) NOT NULL,
        amount_standard DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        quantity_standard DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        validity_days INT NOT NULL DEFAULT 180,
        effective_at DATETIME NULL,
        expires_at DATETIME NULL,
        source_system VARCHAR(50) NULL,
        source_table VARCHAR(100) NULL,
        source_id VARCHAR(100) NULL,
        source_order_no VARCHAR(100) NULL,
        remark VARCHAR(500) NULL,
        normalized_payload JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_employee_benefit_issue_items_issue_id (issue_id),
        KEY idx_employee_benefit_issue_items_source (source_system, source_table, source_id),
        CONSTRAINT fk_employee_benefit_issue_items_issue_id FOREIGN KEY (issue_id) REFERENCES employee_benefit_issues(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employee_benefit_card_records (
        id INT NOT NULL AUTO_INCREMENT,
        issue_item_id INT NOT NULL,
        employee_id INT NOT NULL,
        card_category VARCHAR(30) NOT NULL DEFAULT 'employee_benefit',
        amount_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        amount_remaining DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        amount_consumed DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        effective_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        validity_days INT NOT NULL DEFAULT 180,
        consumption_priority INT NOT NULL DEFAULT 0,
        source_system VARCHAR(50) NULL,
        source_table VARCHAR(100) NULL,
        source_id VARCHAR(100) NULL,
        source_order_no VARCHAR(100) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        normalized_payload JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_employee_benefit_card_records_issue_item (issue_item_id),
        KEY idx_employee_benefit_card_records_employee_status (employee_id, status),
        KEY idx_employee_benefit_card_records_expiring (employee_id, expires_at),
        CONSTRAINT fk_employee_benefit_card_records_issue_item_id FOREIGN KEY (issue_item_id) REFERENCES employee_benefit_issue_items(id) ON DELETE CASCADE,
        CONSTRAINT fk_employee_benefit_card_records_employee_id FOREIGN KEY (employee_id) REFERENCES employees(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employee_benefit_fund_links (
        id INT NOT NULL AUTO_INCREMENT,
        issue_id INT NOT NULL,
        issue_item_id INT NOT NULL,
        employee_id INT NOT NULL,
        fund_link_type VARCHAR(30) NOT NULL,
        amount_standard DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        linked_period_key VARCHAR(20) NULL,
        linked_summary_type VARCHAR(50) NULL,
        linked_summary_id VARCHAR(100) NULL,
        source_system VARCHAR(50) NULL,
        source_table VARCHAR(100) NULL,
        source_id VARCHAR(100) NULL,
        source_order_no VARCHAR(100) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'linked',
        remark VARCHAR(500) NULL,
        normalized_payload JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_employee_benefit_fund_links_item_type (issue_item_id, fund_link_type),
        KEY idx_employee_benefit_fund_links_employee_period (employee_id, linked_period_key),
        CONSTRAINT fk_employee_benefit_fund_links_issue_id FOREIGN KEY (issue_id) REFERENCES employee_benefit_issues(id) ON DELETE CASCADE,
        CONSTRAINT fk_employee_benefit_fund_links_issue_item_id FOREIGN KEY (issue_item_id) REFERENCES employee_benefit_issue_items(id) ON DELETE CASCADE,
        CONSTRAINT fk_employee_benefit_fund_links_employee_id FOREIGN KEY (employee_id) REFERENCES employees(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employee_benefit_notifications (
        id INT NOT NULL AUTO_INCREMENT,
        employee_id INT NOT NULL,
        card_record_id INT NOT NULL,
        notification_type VARCHAR(30) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        amount_standard DECIMAL(18,2) NULL,
        balance_amount DECIMAL(18,2) NULL,
        expiring_amount DECIMAL(18,2) NULL,
        expired_amount DECIMAL(18,2) NULL,
        latest_consumption_summary VARCHAR(500) NULL,
        notify_at DATETIME NOT NULL,
        read_flag TINYINT(1) NOT NULL DEFAULT 0,
        read_at DATETIME NULL,
        source_system VARCHAR(50) NULL,
        source_table VARCHAR(100) NULL,
        source_id VARCHAR(100) NULL,
        source_order_no VARCHAR(100) NULL,
        normalized_payload JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_employee_benefit_notifications_card_type_time (card_record_id, notification_type, notify_at),
        KEY idx_employee_benefit_notifications_employee_read (employee_id, read_flag),
        KEY idx_employee_benefit_notifications_type (notification_type),
        CONSTRAINT fk_employee_benefit_notifications_employee_id FOREIGN KEY (employee_id) REFERENCES employees(id),
        CONSTRAINT fk_employee_benefit_notifications_card_record_id FOREIGN KEY (card_record_id) REFERENCES employee_benefit_card_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS employee_benefit_notifications');
    await queryRunner.query('DROP TABLE IF EXISTS employee_benefit_fund_links');
    await queryRunner.query('DROP TABLE IF EXISTS employee_benefit_card_records');
    await queryRunner.query('DROP TABLE IF EXISTS employee_benefit_issue_items');
    await queryRunner.query('DROP TABLE IF EXISTS employee_benefit_issues');
  }
}
