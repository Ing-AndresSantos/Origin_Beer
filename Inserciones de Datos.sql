-- Inserciones de Datos

USE origin_beer;

-- =============================================================================
-- SEED DATA: Origin Beer
-- Test data for development and demo environment
-- Version: 2.1
-- Date: 2026-03-25
-- NOTE: Admin password = Admin1234! (BCrypt hashed)
-- =============================================================================

USE origin_beer;

-- -----------------------------------------------------------------------------
-- Test admin user
-- Password: Admin1234!
-- BCrypt hash generated with strength 10
-- -----------------------------------------------------------------------------
INSERT INTO user (id_role, first_name, last_name, email, password, phone, active) VALUES
    (1, 'System', 'Admin', 'admin@originbeer.com',
     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWq',
     '+57 300 000 0001', 1);
     
UPDATE user
SET password = '$2a$12$K58yH4I2WSu6KKr5oTLBT.g595jGfZos/eJd9ob3wtS32lIq17kxu'
WHERE email = 'admin@originbeer.com';


-- -----------------------------------------------------------------------------
-- Sample branches (created by the admin user above, id_user = 1)
-- -----------------------------------------------------------------------------
INSERT INTO branch (code, name, address, city, phone, email, active, created_by) VALUES
    ('BOG-01', 'Bogotá Chapinero',   'Cra 13 # 63-40',     'Bogotá',   '+57 601 000 0001', 'bog01@originbeer.com', 1, 1),
    ('BOG-02', 'Bogotá Usaquén',     'Cll 119 # 6-22',     'Bogotá',   '+57 601 000 0002', 'bog02@originbeer.com', 1, 1),
    ('MED-01', 'Medellín El Poblado','El Poblado, Cll 10',  'Medellín', '+57 604 000 0001', 'med01@originbeer.com', 1, 1);

-- -----------------------------------------------------------------------------
-- Sample staff users (cashiers and waiters assigned to branches)
-- Password for all: Staff1234! (same BCrypt hash for demo simplicity)
-- -----------------------------------------------------------------------------
INSERT INTO user (id_role, first_name, last_name, email, password, phone, active) VALUES
    (2, 'Laura',  'Martínez', 'laura@originbeer.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWq', '+57 300 000 0002', 1),
    (3, 'Carlos', 'Gómez',    'carlos@originbeer.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWq', '+57 300 000 0003', 1),
    (2, 'Sofía',  'Rincón',   'sofia@originbeer.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWq', '+57 300 000 0004', 1),
    (3, 'Andrés', 'Torres',   'andres@originbeer.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWq', '+57 300 000 0005', 1);

-- -----------------------------------------------------------------------------
-- Assign users to branches
-- assigned_by = 1 (admin)
-- Laura (id 2) → BOG-01 / Carlos (id 3) → BOG-01
-- Sofía (id 4) → BOG-02 / Andrés (id 5) → MED-01
-- -----------------------------------------------------------------------------
INSERT INTO user_branch (id_user, id_branch, assigned_by) VALUES
    (2, 1, 1),
    (3, 1, 1),
    (4, 2, 1),
    (5, 3, 1);

-- -----------------------------------------------------------------------------
-- Sample products (created_by = 1, admin)
-- -----------------------------------------------------------------------------
INSERT INTO product (id_category, code, name, description, unit, purchase_cost, sale_price, active, created_by) VALUES
    (1, 'BEV-001', 'Origin Lager 330ml',      'Classic Origin Beer lager in a 330ml bottle',       'unit', 4500.00,  9000.00,  1, 1),
    (1, 'BEV-002', 'Origin IPA 330ml',         'India Pale Ale with tropical hop notes',            'unit', 5500.00,  11000.00, 1, 1),
    (1, 'BEV-003', 'Origin Stout 500ml',        'Dark creamy stout in a 500ml can',                 'unit', 7000.00,  14000.00, 1, 1),
    (2, 'BEV-004', 'Corona Extra 355ml',        'Imported Mexican lager',                           'unit', 4000.00,  8500.00,  1, 1),
    (2, 'BEV-005', 'Heineken 330ml',            'Classic Dutch imported lager',                     'unit', 3800.00,  8000.00,  1, 1),
    (3, 'NAL-001', 'Sparkling Water 500ml',     'Natural sparkling mineral water',                  'unit', 900.00,   3000.00,  1, 1),
    (3, 'NAL-002', 'Cola Drink 350ml',          'Classic cola soft drink',                          'unit', 1200.00,  3500.00,  1, 1),
    (4, 'SNK-001', 'Cheese Fries',              'Crispy fries topped with melted cheese sauce',     'unit', 5000.00,  15000.00, 1, 1),
    (4, 'SNK-002', 'Nachos & Guacamole',        'Tortilla chips served with fresh guacamole',       'unit', 6000.00,  16000.00, 1, 1),
    (5, 'MRC-001', 'Origin Beer T-Shirt',       'Origin Beer branded cotton t-shirt',               'unit', 18000.00, 45000.00, 1, 1);

-- -----------------------------------------------------------------------------
-- Initial stock per branch (product_branch)
-- updated_by = 1 (admin)
-- -----------------------------------------------------------------------------
-- BOG-01 (id_branch = 1)
INSERT INTO product_branch (id_product, id_branch, quantity, min_stock, updated_by) VALUES
    (1, 1, 120, 20, 1),
    (2, 1, 80,  15, 1),
    (3, 1, 60,  10, 1),
    (4, 1, 100, 20, 1),
    (5, 1, 90,  20, 1),
    (6, 1, 50,  10, 1),
    (7, 1, 50,  10, 1),
    (8, 1, 30,  5,  1),
    (9, 1, 25,  5,  1),
    (10,1, 15,  3,  1);

-- BOG-02 (id_branch = 2)
INSERT INTO product_branch (id_product, id_branch, quantity, min_stock, updated_by) VALUES
    (1, 2, 90,  20, 1),
    (2, 2, 60,  15, 1),
    (3, 2, 40,  10, 1),
    (4, 2, 70,  20, 1),
    (5, 2, 65,  20, 1),
    (6, 2, 40,  10, 1),
    (7, 2, 40,  10, 1),
    (8, 2, 20,  5,  1),
    (9, 2, 18,  5,  1),
    (10,2, 10,  3,  1);

-- MED-01 (id_branch = 3)
INSERT INTO product_branch (id_product, id_branch, quantity, min_stock, updated_by) VALUES
    (1, 3, 75,  20, 1),
    (2, 3, 50,  15, 1),
    (3, 3, 35,  10, 1),
    (4, 3, 55,  20, 1),
    (5, 3, 50,  20, 1),
    (6, 3, 30,  10, 1),
    (7, 3, 30,  10, 1),
    (8, 3, 15,  5,  1),
    (9, 3, 12,  5,  1),
    (10,3, 8,   3,  1);

-- -----------------------------------------------------------------------------
-- Sample tables per branch
-- -----------------------------------------------------------------------------
-- BOG-01: 8 tables
INSERT INTO table_seat (id_branch, table_number, capacity, active) VALUES
    (1, '1',   4, 1), (1, '2',   4, 1), (1, '3',   6, 1), (1, '4',   6, 1),
    (1, '5',   4, 1), (1, '6',   4, 1), (1, '7',   2, 1), (1, 'BAR', 6, 1);

-- BOG-02: 6 tables
INSERT INTO table_seat (id_branch, table_number, capacity, active) VALUES
    (2, '1', 4, 1), (2, '2', 4, 1), (2, '3', 6, 1),
    (2, '4', 4, 1), (2, '5', 4, 1), (2, 'BAR', 8, 1);

-- MED-01: 6 tables
INSERT INTO table_seat (id_branch, table_number, capacity, active) VALUES
    (3, '1', 4, 1), (3, '2', 4, 1), (3, '3', 6, 1),
    (3, '4', 4, 1), (3, '5', 2, 1), (3, 'BAR', 6, 1);