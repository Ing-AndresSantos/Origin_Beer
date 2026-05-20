-- =============================================================================
-- DATABASE: Origin Beer
-- Inventory and Multi-Branch Sales Management System
-- Tool: MySQL Workbench 8.0
-- Version: 2.1
-- Date: 2026-03-25
-- Based on: User Stories Sprint 2, 3, 4, 5 and 6
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CREATE AND SELECT DATABASE
-- -----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS origin_beer
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE origin_beer;

SELECT pb.id_product_branch, p.name, p.sale_price, pb.quantity
FROM product_branch pb
JOIN product p ON p.id_product = pb.id_product
WHERE pb.id_branch = 1;  -- cambia por tu id_branch

select*
From user;

delete from user where id_user IN (11);

-- =============================================================================
-- SPRINT 2 — SECURITY AND USER MANAGEMENT
-- US-04, US-05, US-06, US-07, US-08
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: role
-- Purpose: Catalog of system roles.
-- System role: Defines what type of user each person is (ADMIN, CASHIER, WAITER).
-- Relationships: Referenced by the `user` table.
-- US-07 — Role management and RBAC access control
-- -----------------------------------------------------------------------------
CREATE TABLE role (
    id_role     INT          NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the role',
    name        VARCHAR(30)  NOT NULL                COMMENT 'Role name: ADMIN, CASHIER, WAITER',
    description VARCHAR(150) NULL                    COMMENT 'Description of the role and its permissions',
    active      TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '1 = active, 0 = inactive',

    CONSTRAINT pk_role      PRIMARY KEY (id_role),
    CONSTRAINT uq_role_name UNIQUE (name)

) ENGINE=InnoDB
  COMMENT='System role catalog. Referenced by user. US-07';

-- Initial role data
INSERT INTO role (name, description) VALUES
    ('ADMIN',   'Full system access. Manages branches, products, users and reports across all branches.'),
    ('CASHIER', 'Closes orders, registers payments and views reports for their assigned branch only.'),
    ('WAITER',  'Creates table orders and checks available stock for their assigned branch only.');


-- -----------------------------------------------------------------------------
-- Table: user
-- Purpose: Stores system users with their credentials.
-- System role: Represents each person who accesses the system.
--              Their role determines their access permissions.
-- Relationships: Depends on `role`. Referenced by `user_branch`,
--                `order`, `invoice` and `inventory_movement`.
-- US-04 — User registration
-- US-05 — Authentication and login
-- US-06 — Password change
-- US-08 — User deactivation
-- -----------------------------------------------------------------------------
CREATE TABLE user (
    id_user          INT          NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the user',
    id_role          INT          NOT NULL                COMMENT 'FK → role. Defines user permissions',
    first_name       VARCHAR(80)  NOT NULL                COMMENT 'User first name',
    last_name        VARCHAR(80)  NOT NULL                COMMENT 'User last name',
    email            VARCHAR(120) NOT NULL                COMMENT 'Email address used to log in',
    password         VARCHAR(255) NOT NULL                COMMENT 'BCrypt-hashed password. US-05, US-06',
    phone            VARCHAR(20)  NULL                    COMMENT 'Optional contact phone number',
    active           TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '1 = active, 0 = deactivated. US-08',
    last_access      DATETIME     NULL                    COMMENT 'Date and time of last login. US-05',
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_user       PRIMARY KEY (id_user),
    CONSTRAINT uq_user_email UNIQUE (email),
    CONSTRAINT fk_user_role  FOREIGN KEY (id_role)
        REFERENCES role (id_role)
        ON UPDATE CASCADE
        ON DELETE RESTRICT

) ENGINE=InnoDB
  COMMENT='System users. Related to role, branch and order. US-04, US-05, US-06, US-08';


-- =============================================================================
-- SPRINT 3 — BRANCH MANAGEMENT
-- US-09, US-10, US-11, US-12
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: branch
-- Purpose: Represents each Origin Beer location or franchise.
-- System role: Central operational unit of the system.
--              Inventory, orders and reports are all tied to a branch.
-- Relationships: Referenced by `user_branch`, `product_branch`,
--                `order`, `invoice` and `inventory_movement`.
-- US-09 — Branch creation
-- US-10 — Branch configuration and editing
-- US-12 — Consolidated view of all branches
-- -----------------------------------------------------------------------------
CREATE TABLE branch (
    id_branch   INT          NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the branch',
    code        VARCHAR(10)  NOT NULL                COMMENT 'Unique branch code. e.g. BOG-01',
    name        VARCHAR(100) NOT NULL                COMMENT 'Descriptive name of the branch',
    address     VARCHAR(200) NULL                    COMMENT 'Physical address of the branch',
    city        VARCHAR(80)  NULL                    COMMENT 'City where the branch operates',
    phone       VARCHAR(20)  NULL                    COMMENT 'Branch contact phone number',
    email       VARCHAR(120) NULL                    COMMENT 'Branch email address',
    active      TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '1 = active, 0 = inactive',
    created_by  INT          NOT NULL                COMMENT 'FK → user. Admin who created the branch. US-09',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_branch        PRIMARY KEY (id_branch),
    CONSTRAINT uq_branch_code   UNIQUE (code),
    CONSTRAINT fk_branch_creator FOREIGN KEY (created_by)
        REFERENCES user (id_user)
        ON UPDATE CASCADE
        ON DELETE RESTRICT

) ENGINE=InnoDB
  COMMENT='Origin Beer franchise branches/locations. US-09, US-10, US-12';


-- -----------------------------------------------------------------------------
-- Table: user_branch
-- Purpose: Associates users with the branches they can operate in.
-- System role: Controls branch-level access based on user role.
--              An ADMIN has implicit access to all branches.
-- Relationships: Junction table between `user` and `branch`.
-- US-11 — Associate users to branches
-- -----------------------------------------------------------------------------
CREATE TABLE user_branch (
    id_user_branch  INT      NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    id_user         INT      NOT NULL                COMMENT 'FK → user',
    id_branch       INT      NOT NULL                COMMENT 'FK → branch',
    assigned_by     INT      NOT NULL                COMMENT 'FK → user. Admin who made the assignment',
    assigned_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_user_branch      PRIMARY KEY (id_user_branch),
    CONSTRAINT uq_user_branch      UNIQUE (id_user, id_branch),
    CONSTRAINT fk_ub_user          FOREIGN KEY (id_user)    REFERENCES user   (id_user)   ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ub_branch        FOREIGN KEY (id_branch)  REFERENCES branch (id_branch) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ub_assigned_by   FOREIGN KEY (assigned_by) REFERENCES user  (id_user)   ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB
  COMMENT='N:M relationship between user and branch. Controls per-branch access. US-11';


-- =============================================================================
-- SPRINT 3 — PRODUCT MASTER
-- US-13, US-14, US-15, US-17
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: category
-- Purpose: Catalog of categories for classifying products.
-- System role: Allows products to be organized and filtered by type.
-- Relationships: Referenced by `product`.
-- US-14 — Product categorization
-- -----------------------------------------------------------------------------
CREATE TABLE category (
    id_category INT          NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the category',
    name        VARCHAR(60)  NOT NULL                COMMENT 'Category name. e.g. Craft Beers',
    description VARCHAR(160) NULL                    COMMENT 'Category description',
    active      TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '1 = active, 0 = inactive',

    CONSTRAINT pk_category      PRIMARY KEY (id_category),
    CONSTRAINT uq_category_name UNIQUE (name)

) ENGINE=InnoDB
  COMMENT='Product category catalog. Referenced by product. US-14';

-- Initial category data
INSERT INTO category (name, description) VALUES
    ('Craft Beers',       'Origin Beer in-house craft beers'),
    ('Imported Beers',    'Imported beers from external brands'),
    ('Non-Alcoholic',     'Sodas, juices and water'),
    ('Snacks & Food',     'Side dishes and kitchen plates'),
    ('Merchandise',       'Origin Beer clothing, accessories and souvenirs');


-- -----------------------------------------------------------------------------
-- Table: product
-- Purpose: Master product catalog defined by the Administrator.
-- System role: Defines which products exist in the system.
--              Actual per-branch inventory is managed in `product_branch`.
-- Relationships: Depends on `category` and `user`. Referenced by
--                `product_branch` and `order_detail`.
-- US-13 — Product creation
-- US-14 — Product categorization
-- -----------------------------------------------------------------------------
CREATE TABLE product (
    id_product   INT            NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the product',
    id_category  INT            NOT NULL                COMMENT 'FK → category. Product classification',
    code         VARCHAR(20)    NOT NULL                COMMENT 'Unique product code. e.g. BEV-001',
    name         VARCHAR(120)   NOT NULL                COMMENT 'Product name',
    description  VARCHAR(300)   NULL                    COMMENT 'Optional product description',
    unit         VARCHAR(20)    NOT NULL DEFAULT 'unit' COMMENT 'Unit of measure: unit, ml, g',
    purchase_cost  DECIMAL(12,2)  NOT NULL DEFAULT 0.00 COMMENT 'Product acquisition cost. US-27',
    sale_price     DECIMAL(12,2)  NOT NULL              COMMENT 'Selling price to the customer',
    active       TINYINT(1)     NOT NULL DEFAULT 1      COMMENT '1 = active, 0 = inactive',
    created_by   INT            NOT NULL                COMMENT 'FK → user. Admin who created the product',
    created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_product             PRIMARY KEY (id_product),
    CONSTRAINT uq_product_code        UNIQUE (code),
    CONSTRAINT fk_product_category    FOREIGN KEY (id_category) REFERENCES category (id_category) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_product_creator     FOREIGN KEY (created_by)  REFERENCES user     (id_user)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_sale_price         CHECK (sale_price    >= 0),
    CONSTRAINT chk_purchase_cost      CHECK (purchase_cost >= 0)

) ENGINE=InnoDB
  COMMENT='Master product catalog. Per-branch inventory is in product_branch. US-13, US-14';


-- -----------------------------------------------------------------------------
-- Table: product_branch
-- Purpose: Inventory of each product at each branch.
-- System role: Controls real-time available stock per branch.
--              Automatically decremented when an order is closed.
-- Relationships: Junction table between `product` and `branch`.
--                Related to `inventory_movement` for auditing.
-- US-15 — Per-branch inventory management
-- US-17 — Check available stock per branch
-- US-21 — Automatic inventory deduction on order close
-- -----------------------------------------------------------------------------
CREATE TABLE product_branch (
    id_product_branch INT       NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    id_product        INT       NOT NULL                COMMENT 'FK → product',
    id_branch         INT       NOT NULL                COMMENT 'FK → branch',
    quantity          INT       NOT NULL DEFAULT 0      COMMENT 'Units available at this branch. US-17',
    min_stock         INT       NOT NULL DEFAULT 5      COMMENT 'Alert threshold when quantity reaches this value',
    updated_by        INT       NULL                    COMMENT 'FK → user. Last user who updated the stock',
    updated_at        DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_product_branch    PRIMARY KEY (id_product_branch),
    CONSTRAINT uq_product_branch    UNIQUE (id_product, id_branch),
    CONSTRAINT fk_pb_product        FOREIGN KEY (id_product)  REFERENCES product (id_product) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pb_branch         FOREIGN KEY (id_branch)   REFERENCES branch  (id_branch)  ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pb_updated_by     FOREIGN KEY (updated_by)  REFERENCES user    (id_user)    ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_pb_quantity      CHECK (quantity >= 0)

) ENGINE=InnoDB
  COMMENT='Per-branch product inventory. Auto-updated when order is closed. US-15, US-17, US-21';


-- -----------------------------------------------------------------------------
-- Table: inventory_movement
-- Purpose: Records every inventory entry or exit per branch.
-- System role: Full audit trail of stock movements.
--              Tracks every change with its origin (sale or adjustment).
-- Relationships: Depends on `product`, `branch` and `user`.
-- US-15 — Per-branch inventory management
-- US-21 — Automatic inventory deduction on order close
-- -----------------------------------------------------------------------------
CREATE TABLE inventory_movement (
    id_movement      BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the movement',
    id_product       INT          NOT NULL                COMMENT 'FK → product',
    id_branch        INT          NOT NULL                COMMENT 'FK → branch',
    movement_type    ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL COMMENT 'Type of inventory movement',
    quantity         INT          NOT NULL                COMMENT 'Quantity affected (positive = in, negative = out)',
    quantity_before  INT          NOT NULL                COMMENT 'Stock before the movement',
    quantity_after   INT          NOT NULL                COMMENT 'Stock after the movement',
    origin           VARCHAR(30)  NULL                    COMMENT 'Origin: ORDER, MANUAL, ADJUSTMENT',
    reference_id     BIGINT       NULL                    COMMENT 'ID of the order or operation that generated the movement',
    notes            VARCHAR(200) NULL                    COMMENT 'Descriptive note about the movement',
    recorded_by      INT          NOT NULL                COMMENT 'FK → user. Who generated the movement',
    moved_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_inventory_movement PRIMARY KEY (id_movement),
    CONSTRAINT fk_im_product   FOREIGN KEY (id_product)  REFERENCES product (id_product) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_im_branch    FOREIGN KEY (id_branch)   REFERENCES branch  (id_branch)  ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_im_user      FOREIGN KEY (recorded_by) REFERENCES user    (id_user)    ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB
  COMMENT='Inventory movement audit per branch and product. US-15, US-21';


-- =============================================================================
-- SPRINT 4 — ORDER MANAGEMENT
-- US-18, US-19, US-20, US-21
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: table_seat
-- Purpose: Represents the physical tables at each branch.
-- System role: Each order is associated with a table at a branch.
-- Relationships: Depends on `branch`. Referenced by `order`.
-- US-18 — Create order by table
-- -----------------------------------------------------------------------------
CREATE TABLE table_seat (
    id_table    INT         NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the table',
    id_branch   INT         NOT NULL                COMMENT 'FK → branch. Table belongs to a branch',
    table_number VARCHAR(10) NOT NULL               COMMENT 'Table number or code. e.g. 1, A-2, BAR',
    capacity    TINYINT     NOT NULL DEFAULT 4      COMMENT 'Maximum seating capacity',
    active      TINYINT(1)  NOT NULL DEFAULT 1      COMMENT '1 = active, 0 = inactive',

    CONSTRAINT pk_table_seat      PRIMARY KEY (id_table),
    CONSTRAINT uq_table_branch    UNIQUE (id_branch, table_number),
    CONSTRAINT fk_table_branch    FOREIGN KEY (id_branch) REFERENCES branch (id_branch) ON UPDATE CASCADE ON DELETE CASCADE

) ENGINE=InnoDB
  COMMENT='Physical tables per branch. Each order is linked to a table. US-18';


-- -----------------------------------------------------------------------------
-- Table: order_ticket
-- Purpose: Represents an open order at a table in a branch.
-- System role: Central entity of the sales operation.
--              An order moves from OPEN to PAID when the sale is closed.
-- Relationships: Depends on `branch`, `table_seat` and `user` (waiter).
--                Referenced by `order_detail` and `invoice`.
-- US-18 — Create order by table
-- US-20 — Order status control
-- US-21 — Automatic inventory deduction on order close
-- -----------------------------------------------------------------------------
CREATE TABLE order_ticket (
    id_order     BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the order',
    id_branch    INT          NOT NULL                COMMENT 'FK → branch. Branch where the order was created',
    id_table     INT          NOT NULL                COMMENT 'FK → table_seat. Table linked to the order',
    id_waiter    INT          NOT NULL                COMMENT 'FK → user. Waiter who created the order',
    status       ENUM('OPEN', 'PAID') NOT NULL DEFAULT 'OPEN' COMMENT 'Order status. US-20',
    notes        VARCHAR(300) NULL                    COMMENT 'Notes or observations for the order',
    opened_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date and time the order was opened',
    closed_at    DATETIME     NULL                    COMMENT 'Date and time of closing. Set when paid. US-23',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_order_ticket      PRIMARY KEY (id_order),
    CONSTRAINT fk_order_branch      FOREIGN KEY (id_branch) REFERENCES branch     (id_branch) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_order_table       FOREIGN KEY (id_table)  REFERENCES table_seat (id_table)  ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_order_waiter      FOREIGN KEY (id_waiter) REFERENCES user       (id_user)   ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB
  COMMENT='Orders per table. Status OPEN → PAID when sale is closed. US-18, US-20, US-21';


-- -----------------------------------------------------------------------------
-- Table: order_detail
-- Purpose: Product lines within an order.
-- System role: Records which products and quantities each order contains.
--              Stores price and cost at the time of sale to preserve
--              historical integrity for reports.
-- Relationships: Depends on `order_ticket` and `product`.
-- US-19 — Add products to an order
-- US-27 — Sales report (uses historical price and cost)
-- -----------------------------------------------------------------------------
CREATE TABLE order_detail (
    id_detail      BIGINT         NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the detail line',
    id_order       BIGINT         NOT NULL                COMMENT 'FK → order_ticket',
    id_product     INT            NOT NULL                COMMENT 'FK → product',
    quantity       INT            NOT NULL                COMMENT 'Number of units requested',
    sale_price     DECIMAL(12,2)  NOT NULL                COMMENT 'Sale price at the time of order (historical)',
    purchase_cost  DECIMAL(12,2)  NOT NULL                COMMENT 'Purchase cost at the time of order (historical)',
    subtotal       DECIMAL(14,2)  GENERATED ALWAYS AS (quantity * sale_price) STORED COMMENT 'Automatically calculated subtotal',
    note           VARCHAR(150)   NULL                    COMMENT 'Waiter note about this item',
    added_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_order_detail      PRIMARY KEY (id_detail),
    CONSTRAINT fk_od_order          FOREIGN KEY (id_order)   REFERENCES order_ticket (id_order)   ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_od_product        FOREIGN KEY (id_product) REFERENCES product       (id_product) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_od_quantity      CHECK (quantity   > 0),
    CONSTRAINT chk_od_sale_price    CHECK (sale_price >= 0)

) ENGINE=InnoDB
  COMMENT='Order product lines. Historical price and cost for reports. US-19, US-27';


-- =============================================================================
-- SPRINT 5 — BILLING AND PAYMENTS
-- US-23, US-24, US-25, US-26
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: payment_method
-- Purpose: Catalog of accepted payment methods.
-- System role: Defines the payment options available when closing an order.
-- Relationships: Referenced by `invoice`.
-- US-24 — Register payment method
-- -----------------------------------------------------------------------------
CREATE TABLE payment_method (
    id_payment_method INT         NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the payment method',
    name              VARCHAR(30) NOT NULL                COMMENT 'Name: CASH, DEBIT, CREDIT',
    active            TINYINT(1)  NOT NULL DEFAULT 1      COMMENT '1 = active, 0 = inactive',

    CONSTRAINT pk_payment_method      PRIMARY KEY (id_payment_method),
    CONSTRAINT uq_payment_method_name UNIQUE (name)

) ENGINE=InnoDB
  COMMENT='Payment method catalog. Referenced by invoice. US-24';

-- Initial payment method data
INSERT INTO payment_method (name) VALUES
    ('CASH'),
    ('DEBIT'),
    ('CREDIT');


-- -----------------------------------------------------------------------------
-- Table: invoice
-- Purpose: Internal invoice generated when an order is closed.
-- System role: Records the completed sale with its payment method,
--              the responsible cashier and the branch where it occurred.
--              One order generates exactly one invoice.
-- Relationships: Depends on `order_ticket`, `branch`, `user` (cashier)
--                and `payment_method`.
-- US-23 — Close order and register payment
-- US-25 — Generate internal invoice
-- US-26 — Register branch on each sale
-- -----------------------------------------------------------------------------
CREATE TABLE invoice (
    id_invoice        BIGINT        NOT NULL AUTO_INCREMENT COMMENT 'Primary key of the invoice',
    id_order          BIGINT        NOT NULL                COMMENT 'FK → order_ticket. 1:1 relationship with the order',
    id_branch         INT           NOT NULL                COMMENT 'FK → branch. Branch where the sale occurred. US-26',
    id_cashier        INT           NOT NULL                COMMENT 'FK → user. Cashier who closed the order. US-23',
    id_payment_method INT           NOT NULL                COMMENT 'FK → payment_method. Payment form used. US-24',
    invoice_number    VARCHAR(40)   NOT NULL                COMMENT 'Internal invoice number. e.g. INV-001-20260310-000001',
    subtotal          DECIMAL(14,2) NOT NULL                COMMENT 'Sum of all order subtotals',
    total             DECIMAL(14,2) NOT NULL                COMMENT 'Total charged (equals subtotal in this system)',
    amount_received   DECIMAL(14,2) NOT NULL                COMMENT 'Amount given by the customer',
    change_given      DECIMAL(14,2) GENERATED ALWAYS AS (amount_received - total) STORED COMMENT 'Change returned to customer',
    notes             VARCHAR(200)  NULL                    COMMENT 'Additional invoice notes',
    issued_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Invoice issue date and time',

    CONSTRAINT pk_invoice             PRIMARY KEY (id_invoice),
    CONSTRAINT uq_invoice_order       UNIQUE (id_order)         COMMENT 'One order generates exactly one invoice',
    CONSTRAINT uq_invoice_number      UNIQUE (invoice_number),
    CONSTRAINT fk_invoice_order       FOREIGN KEY (id_order)          REFERENCES order_ticket   (id_order)          ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_branch      FOREIGN KEY (id_branch)         REFERENCES branch          (id_branch)         ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_cashier     FOREIGN KEY (id_cashier)        REFERENCES user            (id_user)           ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_payment     FOREIGN KEY (id_payment_method) REFERENCES payment_method  (id_payment_method) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_invoice_total      CHECK (total           >= 0),
    CONSTRAINT chk_invoice_received   CHECK (amount_received >= 0)

) ENGINE=InnoDB
  COMMENT='Internal invoice per sale. 1 order = 1 invoice. US-23, US-24, US-25, US-26';


-- =============================================================================
-- SPRINT 6 — REPORTS AND DASHBOARD
-- US-27, US-28
-- Views that support reports without additional tables.
-- Data comes from invoice, order_detail, product and branch.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- View: report_sales_cashier
-- Purpose: Sales report filterable by branch and date range.
-- Usage: Cashier queries their branch only. Admin can filter by any branch.
-- US-27 — Cashier sales report by date range
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_sales_cashier AS
SELECT
    DATE(i.issued_at)                               AS sale_date,
    b.id_branch                                     AS id_branch,
    b.name                                          AS branch,
    p.code                                          AS product_code,
    p.name                                          AS product,
    c.name                                          AS category,
    od.quantity                                     AS quantity_sold,
    od.purchase_cost                                AS purchase_cost,
    od.sale_price                                   AS sale_price,
    od.subtotal                                     AS total_sale,
    (od.purchase_cost * od.quantity)                AS total_cost,
    (od.subtotal - od.purchase_cost * od.quantity)  AS profit,
    pm.name                                         AS payment_method,
    i.invoice_number,
    CONCAT(u.first_name, ' ', u.last_name)          AS cashier
FROM invoice        i
JOIN order_ticket   ot ON ot.id_order    = i.id_order
JOIN order_detail   od ON od.id_order    = ot.id_order
JOIN product        p  ON p.id_product   = od.id_product
JOIN category       c  ON c.id_category  = p.id_category
JOIN branch         b  ON b.id_branch    = i.id_branch
JOIN payment_method pm ON pm.id_payment_method = i.id_payment_method
JOIN user           u  ON u.id_user      = i.id_cashier;


-- -----------------------------------------------------------------------------
-- View: report_consolidated_admin
-- Purpose: Multi-branch report with profitability by product and branch.
-- Usage: Admin only. Shows all branches consolidated.
-- US-28 — Admin consolidated multi-branch report
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW report_consolidated_admin AS
SELECT
    b.id_branch                                         AS id_branch,
    b.code                                              AS branch_code,
    b.name                                              AS branch,
    p.code                                              AS product_code,
    p.name                                              AS product,
    c.name                                              AS category,
    SUM(od.quantity)                                    AS total_units_sold,
    SUM(od.subtotal)                                    AS total_revenue,
    SUM(od.purchase_cost * od.quantity)                 AS total_costs,
    SUM(od.subtotal - od.purchase_cost * od.quantity)   AS gross_profit,
    COUNT(DISTINCT i.id_invoice)                        AS total_invoices
FROM invoice        i
JOIN order_ticket   ot ON ot.id_order    = i.id_order
JOIN order_detail   od ON od.id_order    = ot.id_order
JOIN product        p  ON p.id_product   = od.id_product
JOIN category       c  ON c.id_category  = p.id_category
JOIN branch         b  ON b.id_branch    = i.id_branch
GROUP BY b.id_branch, b.code, b.name, p.code, p.name, c.name;


-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Independent tables (no FK):
--   role, category, payment_method
--
-- Level 1 dependent tables (FK to independent tables):
--   user → role
--   product → category, user
--
-- Level 2 dependent tables:
--   branch → user
--   user_branch → user, branch
--   product_branch → product, branch, user
--   inventory_movement → product, branch, user
--   table_seat → branch
--
-- Level 3 dependent tables:
--   order_ticket → branch, table_seat, user
--
-- Level 4 dependent tables:
--   order_detail → order_ticket, product
--   invoice → order_ticket, branch, user, payment_method
--
-- Total tables: 13
-- Total views:  2
-- Total FK relationships: 21
-- =============================================================================