-- =============================================================================
-- BASE DE DATOS: Origin Beer
-- Sistema de Gestión de Inventario y Ventas Multi-Sede
-- Herramienta: MySQL Workbench 8.0
-- Versión: 2.0
-- Fecha: 2026-03-10
-- Basado en: Historias de Usuario Sprint 2, 3, 4, 5 y 6
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CREACIÓN Y SELECCIÓN DE LA BASE DE DATOS
-- -----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS origin_beer
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE origin_beer;

-- =============================================================================
-- SPRINT 2 — SEGURIDAD Y GESTIÓN DE USUARIOS
-- HU-04, HU-05, HU-06, HU-07, HU-08
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla: rol
-- Propósito: Catálogo de roles del sistema.
-- Rol en el sistema: Define qué tipo de usuario es cada persona
--                    (ADMIN, CAJERO, MESERO).
-- Relaciones: Es referenciada por la tabla `usuario`.
-- HU-07 — Gestión de roles y control de acceso RBAC
-- -----------------------------------------------------------------------------
CREATE TABLE rol (
    id_rol      INT          NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria del rol',
    nombre      VARCHAR(30)  NOT NULL                COMMENT 'Nombre del rol: ADMIN, CAJERO, MESERO',
    descripcion VARCHAR(150) NULL                    COMMENT 'Descripción del rol y sus permisos',
    activo      TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '1 = activo, 0 = inactivo',

    CONSTRAINT pk_rol       PRIMARY KEY (id_rol),
    CONSTRAINT uq_rol_nombre UNIQUE (nombre)

) ENGINE=InnoDB
  COMMENT='Catálogo de roles del sistema. Referenciado por usuario. HU-07';

-- Datos iniciales de roles
INSERT INTO rol (nombre, descripcion) VALUES
    ('ADMIN',   'Acceso total al sistema. Gestiona sedes, productos, usuarios y reportes de todas las sedes.'),
    ('CAJERO',  'Cierra pedidos, registra pagos y consulta reportes únicamente de su sede asignada.'),
    ('MESERO',  'Crea pedidos por mesa y consulta el stock disponible de su sede asignada.');


-- -----------------------------------------------------------------------------
-- Tabla: usuario
-- Propósito: Almacena los usuarios del sistema con sus credenciales.
-- Rol en el sistema: Representa a cada persona que accede al sistema.
--                    Su rol determina los permisos de acceso.
-- Relaciones: Depende de `rol`. Es referenciada por `usuario_sede`,
--             `pedido`, `factura` e `inventario_movimiento`.
-- HU-04 — Registro de usuarios
-- HU-05 — Autenticación e inicio de sesión
-- HU-06 — Cambio de contraseña
-- HU-08 — Desactivación de usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario     INT          NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria del usuario',
    id_rol         INT          NOT NULL                COMMENT 'FK → rol. Define los permisos del usuario',
    nombre         VARCHAR(80)  NOT NULL                COMMENT 'Nombre del usuario',
    apellido       VARCHAR(80)  NOT NULL                COMMENT 'Apellido del usuario',
    correo         VARCHAR(120) NOT NULL                COMMENT 'Correo electrónico usado para iniciar sesión',
    contrasena     VARCHAR(255) NOT NULL                COMMENT 'Contraseña cifrada con BCrypt. HU-05, HU-06',
    telefono       VARCHAR(20)  NULL                    COMMENT 'Teléfono de contacto opcional',
    activo         TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '1 = activo, 0 = desactivado. HU-08',
    ultimo_acceso  DATETIME     NULL                    COMMENT 'Fecha y hora del último inicio de sesión. HU-05',
    fecha_creacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_usuario        PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_correo UNIQUE (correo),
    CONSTRAINT fk_usuario_rol    FOREIGN KEY (id_rol)
        REFERENCES rol (id_rol)
        ON UPDATE CASCADE
        ON DELETE RESTRICT

) ENGINE=InnoDB
  COMMENT='Usuarios del sistema. Relacionado con rol, sede y pedido. HU-04, HU-05, HU-06, HU-08';


-- =============================================================================
-- SPRINT 3 — GESTIÓN DE SEDES
-- HU-09, HU-10, HU-11, HU-12
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla: sede
-- Propósito: Representa cada local o franquicia de Origin Beer.
-- Rol en el sistema: Es la unidad operativa central del sistema.
--                    Inventario, pedidos y reportes están asociados a una sede.
-- Relaciones: Referenciada por `usuario_sede`, `producto_sede`,
--             `pedido`, `factura` e `inventario_movimiento`.
-- HU-09 — Creación de sedes
-- HU-10 — Parametrización y edición de sedes
-- HU-12 — Vista consolidada de todas las sedes
-- -----------------------------------------------------------------------------
CREATE TABLE sede (
    id_sede        INT          NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria de la sede',
    codigo         VARCHAR(10)  NOT NULL                COMMENT 'Código único de la sede. Ej: BOG-01',
    nombre         VARCHAR(100) NOT NULL                COMMENT 'Nombre descriptivo de la sede',
    direccion      VARCHAR(200) NULL                    COMMENT 'Dirección física de la sede',
    ciudad         VARCHAR(80)  NULL                    COMMENT 'Ciudad donde opera la sede',
    telefono       VARCHAR(20)  NULL                    COMMENT 'Teléfono de contacto de la sede',
    correo         VARCHAR(120) NULL                    COMMENT 'Correo de la sede',
    activo         TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '1 = activa, 0 = inactiva',
    creado_por     INT          NOT NULL                COMMENT 'FK → usuario. Admin que creó la sede. HU-09',
    fecha_creacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_sede        PRIMARY KEY (id_sede),
    CONSTRAINT uq_sede_codigo UNIQUE (codigo),
    CONSTRAINT fk_sede_creador FOREIGN KEY (creado_por)
        REFERENCES usuario (id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT

) ENGINE=InnoDB
  COMMENT='Sedes o locales de la franquicia Origin Beer. HU-09, HU-10, HU-12';


-- -----------------------------------------------------------------------------
-- Tabla: usuario_sede
-- Propósito: Asocia usuarios a las sedes en las que pueden operar.
-- Rol en el sistema: Controla el acceso por sede según el rol del usuario.
--                    Un ADMIN tiene acceso implícito a todas las sedes.
-- Relaciones: Tabla intermedia entre `usuario` y `sede`.
-- HU-11 — Asociación de usuarios a sedes
-- -----------------------------------------------------------------------------
CREATE TABLE usuario_sede (
    id_usuario_sede INT      NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria',
    id_usuario      INT      NOT NULL                COMMENT 'FK → usuario',
    id_sede         INT      NOT NULL                COMMENT 'FK → sede',
    asignado_por    INT      NOT NULL                COMMENT 'FK → usuario. Admin que realizó la asignación',
    fecha_asignacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_usuario_sede     PRIMARY KEY (id_usuario_sede),
    CONSTRAINT uq_usuario_sede     UNIQUE (id_usuario, id_sede),
    CONSTRAINT fk_us_usuario       FOREIGN KEY (id_usuario)  REFERENCES usuario (id_usuario) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_us_sede          FOREIGN KEY (id_sede)     REFERENCES sede    (id_sede)    ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_us_asignado_por  FOREIGN KEY (asignado_por) REFERENCES usuario (id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB
  COMMENT='Relación N:M entre usuario y sede. Controla el acceso por sede. HU-11';


-- =============================================================================
-- SPRINT 3 — MAESTRA DE PRODUCTOS
-- HU-13, HU-14, HU-15, HU-17
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla: categoria
-- Propósito: Catálogo de categorías para clasificar los productos.
-- Rol en el sistema: Permite organizar y filtrar productos por tipo.
-- Relaciones: Referenciada por `producto`.
-- HU-14 — Categorización de productos
-- -----------------------------------------------------------------------------
CREATE TABLE categoria (
    id_categoria INT          NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria de la categoría',
    nombre       VARCHAR(60)  NOT NULL                COMMENT 'Nombre de la categoría. Ej: Cervezas Artesanales',
    descripcion  VARCHAR(160) NULL                    COMMENT 'Descripción de la categoría',
    activo       TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '1 = activa, 0 = inactiva',

    CONSTRAINT pk_categoria       PRIMARY KEY (id_categoria),
    CONSTRAINT uq_categoria_nombre UNIQUE (nombre)

) ENGINE=InnoDB
  COMMENT='Catálogo de categorías de producto. Referenciada por producto. HU-14';

-- Datos iniciales de categorías
INSERT INTO categoria (nombre, descripcion) VALUES
    ('Cervezas Artesanales',  'Cervezas de producción propia Origin Beer'),
    ('Cervezas Importadas',   'Cervezas importadas de marcas externas'),
    ('Bebidas No Alcohólicas','Gaseosas, jugos y agua'),
    ('Snacks y Comidas',      'Acompañamientos y platos de cocina'),
    ('Mercancía',             'Ropa, accesorios y souvenirs Origin Beer');


-- -----------------------------------------------------------------------------
-- Tabla: producto
-- Propósito: Catálogo maestro de productos definido por el Administrador.
-- Rol en el sistema: Define qué productos existen en el sistema.
--                    El inventario real por sede se maneja en `producto_sede`.
-- Relaciones: Depende de `categoria` y `usuario`. Es referenciada por
--             `producto_sede` y `pedido_detalle`.
-- HU-13 — Creación de productos
-- HU-14 — Categorización de productos
-- -----------------------------------------------------------------------------
CREATE TABLE producto (
    id_producto    INT            NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria del producto',
    id_categoria   INT            NOT NULL                COMMENT 'FK → categoria. Clasificación del producto',
    codigo         VARCHAR(20)    NOT NULL                COMMENT 'Código único del producto. Ej: CRV-001',
    nombre         VARCHAR(120)   NOT NULL                COMMENT 'Nombre del producto',
    descripcion    VARCHAR(300)   NULL                    COMMENT 'Descripción opcional del producto',
    unidad         VARCHAR(20)    NOT NULL DEFAULT 'unidad' COMMENT 'Unidad de medida: unidad, ml, g',
    costo_compra   DECIMAL(12,2)  NOT NULL DEFAULT 0.00   COMMENT 'Costo de adquisición del producto. HU-27',
    precio_venta   DECIMAL(12,2)  NOT NULL                COMMENT 'Precio de venta al cliente',
    activo         TINYINT(1)     NOT NULL DEFAULT 1      COMMENT '1 = activo, 0 = inactivo',
    creado_por     INT            NOT NULL                COMMENT 'FK → usuario. Admin que creó el producto',
    fecha_creacion DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_producto          PRIMARY KEY (id_producto),
    CONSTRAINT uq_producto_codigo   UNIQUE (codigo),
    CONSTRAINT fk_producto_categoria FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_producto_creador   FOREIGN KEY (creado_por)   REFERENCES usuario   (id_usuario)   ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_precio_venta  CHECK (precio_venta >= 0),
    CONSTRAINT chk_costo_compra  CHECK (costo_compra >= 0)

) ENGINE=InnoDB
  COMMENT='Catálogo maestro de productos. El inventario por sede está en producto_sede. HU-13, HU-14';


-- -----------------------------------------------------------------------------
-- Tabla: producto_sede
-- Propósito: Inventario de cada producto en cada sede.
-- Rol en el sistema: Controla el stock disponible por sede en tiempo real.
--                    Se descuenta automáticamente al cerrar un pedido.
-- Relaciones: Tabla intermedia entre `producto` y `sede`.
--             Relacionada con `inventario_movimiento` para auditoría.
-- HU-15 — Gestión de inventario por sede
-- HU-17 — Consulta de stock disponible por sede
-- HU-21 — Descuento automático de inventario al cerrar pedido
-- -----------------------------------------------------------------------------
CREATE TABLE producto_sede (
    id_producto_sede INT       NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria',
    id_producto      INT       NOT NULL                COMMENT 'FK → producto',
    id_sede          INT       NOT NULL                COMMENT 'FK → sede',
    cantidad         INT       NOT NULL DEFAULT 0      COMMENT 'Unidades disponibles en esta sede. HU-17',
    stock_minimo     INT       NOT NULL DEFAULT 5      COMMENT 'Alerta cuando la cantidad llegue a este valor',
    actualizado_por  INT       NULL                    COMMENT 'FK → usuario. Último usuario que actualizó el stock',
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_producto_sede    PRIMARY KEY (id_producto_sede),
    CONSTRAINT uq_producto_sede    UNIQUE (id_producto, id_sede),
    CONSTRAINT fk_ps_producto      FOREIGN KEY (id_producto)     REFERENCES producto (id_producto) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ps_sede          FOREIGN KEY (id_sede)         REFERENCES sede     (id_sede)     ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ps_actualizado   FOREIGN KEY (actualizado_por) REFERENCES usuario  (id_usuario)  ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_ps_cantidad     CHECK (cantidad >= 0)

) ENGINE=InnoDB
  COMMENT='Inventario de productos por sede. Actualizado automáticamente al cerrar pedido. HU-15, HU-17, HU-21';


-- -----------------------------------------------------------------------------
-- Tabla: inventario_movimiento
-- Propósito: Registra cada entrada o salida de inventario por sede.
-- Rol en el sistema: Auditoría completa de los movimientos de stock.
--                    Permite rastrear cada cambio con su origen (venta o ajuste).
-- Relaciones: Depende de `producto`, `sede` y `usuario`.
-- HU-15 — Gestión de inventario por sede
-- HU-21 — Descuento automático de inventario al cerrar pedido
-- -----------------------------------------------------------------------------
CREATE TABLE inventario_movimiento (
    id_movimiento   BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria del movimiento',
    id_producto     INT          NOT NULL                COMMENT 'FK → producto',
    id_sede         INT          NOT NULL                COMMENT 'FK → sede',
    tipo_movimiento ENUM('ENTRADA', 'SALIDA', 'AJUSTE') NOT NULL COMMENT 'Tipo de movimiento de inventario',
    cantidad        INT          NOT NULL                COMMENT 'Cantidad afectada (positivo entrada, negativo salida)',
    cantidad_antes  INT          NOT NULL                COMMENT 'Stock antes del movimiento',
    cantidad_despues INT         NOT NULL                COMMENT 'Stock después del movimiento',
    origen          VARCHAR(30)  NULL                    COMMENT 'Origen: PEDIDO, MANUAL, AJUSTE',
    id_referencia   BIGINT       NULL                    COMMENT 'ID del pedido u operación que generó el movimiento',
    observacion     VARCHAR(200) NULL                    COMMENT 'Nota descriptiva del movimiento',
    registrado_por  INT          NOT NULL                COMMENT 'FK → usuario. Quien generó el movimiento',
    fecha_movimiento DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_inventario_movimiento PRIMARY KEY (id_movimiento),
    CONSTRAINT fk_im_producto  FOREIGN KEY (id_producto)    REFERENCES producto (id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_im_sede      FOREIGN KEY (id_sede)        REFERENCES sede     (id_sede)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_im_usuario   FOREIGN KEY (registrado_por) REFERENCES usuario  (id_usuario)  ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB
  COMMENT='Auditoría de movimientos de inventario por sede y producto. HU-15, HU-21';


-- =============================================================================
-- SPRINT 4 — GESTIÓN DE PEDIDOS
-- HU-18, HU-19, HU-20, HU-21
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla: mesa
-- Propósito: Representa las mesas físicas de cada sede.
-- Rol en el sistema: Cada pedido queda asociado a una mesa de una sede.
-- Relaciones: Depende de `sede`. Referenciada por `pedido`.
-- HU-18 — Creación de pedido por mesa
-- -----------------------------------------------------------------------------
CREATE TABLE mesa (
    id_mesa       INT         NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria de la mesa',
    id_sede       INT         NOT NULL                COMMENT 'FK → sede. Mesa pertenece a una sede',
    numero_mesa   VARCHAR(10) NOT NULL                COMMENT 'Número o código de la mesa. Ej: 1, A-2, BAR',
    capacidad     TINYINT     NOT NULL DEFAULT 4      COMMENT 'Capacidad máxima de personas',
    activo        TINYINT(1)  NOT NULL DEFAULT 1      COMMENT '1 = activa, 0 = inactiva',

    CONSTRAINT pk_mesa       PRIMARY KEY (id_mesa),
    CONSTRAINT uq_mesa_sede  UNIQUE (id_sede, numero_mesa),
    CONSTRAINT fk_mesa_sede  FOREIGN KEY (id_sede) REFERENCES sede (id_sede) ON UPDATE CASCADE ON DELETE CASCADE

) ENGINE=InnoDB
  COMMENT='Mesas físicas por sede. Cada pedido se asocia a una mesa. HU-18';


-- -----------------------------------------------------------------------------
-- Tabla: pedido
-- Propósito: Representa un pedido abierto en una mesa de una sede.
-- Rol en el sistema: Es la entidad central de la operación de venta.
--                    Un pedido pasa de ABIERTO a PAGADO al cerrar la venta.
-- Relaciones: Depende de `sede`, `mesa` y `usuario` (mesero).
--             Referenciada por `pedido_detalle` y `factura`.
-- HU-18 — Creación de pedido por mesa
-- HU-20 — Control de estados del pedido
-- HU-21 — Descuento automático de inventario al cerrar pedido
-- -----------------------------------------------------------------------------
CREATE TABLE pedido (
    id_pedido      BIGINT      NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria del pedido',
    id_sede        INT         NOT NULL                COMMENT 'FK → sede. Sede donde se generó el pedido',
    id_mesa        INT         NOT NULL                COMMENT 'FK → mesa. Mesa asociada al pedido',
    id_mesero      INT         NOT NULL                COMMENT 'FK → usuario. Mesero que creó el pedido',
    estado         ENUM('ABIERTO', 'PAGADO') NOT NULL DEFAULT 'ABIERTO' COMMENT 'Estado del pedido. HU-20',
    observaciones  VARCHAR(300) NULL                   COMMENT 'Notas u observaciones del pedido',
    fecha_apertura DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de apertura del pedido',
    fecha_cierre   DATETIME    NULL                    COMMENT 'Fecha y hora de cierre. Se rellena al pagar. HU-23',
    fecha_creacion DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_pedido       PRIMARY KEY (id_pedido),
    CONSTRAINT fk_pedido_sede  FOREIGN KEY (id_sede)   REFERENCES sede    (id_sede)    ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pedido_mesa  FOREIGN KEY (id_mesa)   REFERENCES mesa    (id_mesa)    ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pedido_mesero FOREIGN KEY (id_mesero) REFERENCES usuario (id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB
  COMMENT='Pedidos por mesa. Estado ABIERTO → PAGADO al cerrar la venta. HU-18, HU-20, HU-21';


-- -----------------------------------------------------------------------------
-- Tabla: pedido_detalle
-- Propósito: Líneas de producto dentro de un pedido.
-- Rol en el sistema: Registra qué productos y cantidades tiene cada pedido.
--                    Guarda el precio y costo al momento de la venta para
--                    mantener la integridad histórica de los reportes.
-- Relaciones: Depende de `pedido` y `producto`.
-- HU-19 — Agregar productos a un pedido
-- HU-27 — Reporte de ventas (usa precio y costo histórico)
-- -----------------------------------------------------------------------------
CREATE TABLE pedido_detalle (
    id_detalle    BIGINT         NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria del detalle',
    id_pedido     BIGINT         NOT NULL                COMMENT 'FK → pedido',
    id_producto   INT            NOT NULL                COMMENT 'FK → producto',
    cantidad      INT            NOT NULL                COMMENT 'Cantidad de unidades solicitadas',
    precio_venta  DECIMAL(12,2)  NOT NULL                COMMENT 'Precio de venta al momento del pedido (histórico)',
    costo_compra  DECIMAL(12,2)  NOT NULL                COMMENT 'Costo de compra al momento del pedido (histórico)',
    subtotal      DECIMAL(14,2)  GENERATED ALWAYS AS (cantidad * precio_venta) STORED COMMENT 'Subtotal calculado automáticamente',
    observacion   VARCHAR(150)   NULL                    COMMENT 'Nota del mesero sobre este ítem',
    fecha_agregado DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_pedido_detalle   PRIMARY KEY (id_detalle),
    CONSTRAINT fk_pd_pedido        FOREIGN KEY (id_pedido)   REFERENCES pedido   (id_pedido)   ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pd_producto      FOREIGN KEY (id_producto) REFERENCES producto (id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_pd_cantidad     CHECK (cantidad    > 0),
    CONSTRAINT chk_pd_precio       CHECK (precio_venta >= 0)

) ENGINE=InnoDB
  COMMENT='Detalle de productos por pedido. Precio y costo históricos para reportes. HU-19, HU-27';


-- =============================================================================
-- SPRINT 5 — FACTURACIÓN Y PAGOS
-- HU-23, HU-24, HU-25, HU-26
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla: metodo_pago
-- Propósito: Catálogo de métodos de pago aceptados.
-- Rol en el sistema: Define las opciones de pago disponibles al cerrar un pedido.
-- Relaciones: Referenciada por `factura`.
-- HU-24 — Registro de método de pago
-- -----------------------------------------------------------------------------
CREATE TABLE metodo_pago (
    id_metodo_pago INT         NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria del método de pago',
    nombre         VARCHAR(30) NOT NULL                COMMENT 'Nombre: EFECTIVO, DEBITO, CREDITO',
    activo         TINYINT(1)  NOT NULL DEFAULT 1      COMMENT '1 = activo, 0 = inactivo',

    CONSTRAINT pk_metodo_pago       PRIMARY KEY (id_metodo_pago),
    CONSTRAINT uq_metodo_pago_nombre UNIQUE (nombre)

) ENGINE=InnoDB
  COMMENT='Catálogo de métodos de pago. Referenciado por factura. HU-24';

-- Datos iniciales de métodos de pago
INSERT INTO metodo_pago (nombre) VALUES
    ('EFECTIVO'),
    ('DEBITO'),
    ('CREDITO');


-- -----------------------------------------------------------------------------
-- Tabla: factura
-- Propósito: Factura interna generada al cerrar un pedido.
-- Rol en el sistema: Registra la venta completada con su método de pago,
--                    el cajero responsable y la sede donde ocurrió.
--                    Un pedido genera exactamente una factura.
-- Relaciones: Depende de `pedido`, `sede`, `usuario` (cajero) y `metodo_pago`.
-- HU-23 — Cierre de pedido y registro de pago
-- HU-25 — Generación de factura interna
-- HU-26 — Registro de sede en cada venta
-- -----------------------------------------------------------------------------
CREATE TABLE factura (
    id_factura       BIGINT        NOT NULL AUTO_INCREMENT COMMENT 'Llave primaria de la factura',
    id_pedido        BIGINT        NOT NULL                COMMENT 'FK → pedido. Relación 1:1 con el pedido',
    id_sede          INT           NOT NULL                COMMENT 'FK → sede. Sede donde se realizó la venta. HU-26',
    id_cajero        INT           NOT NULL                COMMENT 'FK → usuario. Cajero que cerró el pedido. HU-23',
    id_metodo_pago   INT           NOT NULL                COMMENT 'FK → metodo_pago. Forma de pago usada. HU-24',
    numero_factura   VARCHAR(40)   NOT NULL                COMMENT 'Número interno de la factura. Ej: INV-001-20260310-000001',
    subtotal         DECIMAL(14,2) NOT NULL                COMMENT 'Suma de todos los subtotales del pedido',
    total            DECIMAL(14,2) NOT NULL                COMMENT 'Total a cobrar (igual a subtotal en este sistema)',
    monto_recibido   DECIMAL(14,2) NOT NULL                COMMENT 'Monto entregado por el cliente',
    cambio           DECIMAL(14,2) GENERATED ALWAYS AS (monto_recibido - total) STORED COMMENT 'Cambio devuelto al cliente',
    observaciones    VARCHAR(200)  NULL                    COMMENT 'Notas adicionales de la factura',
    fecha_emision    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de emisión de la factura',

    CONSTRAINT pk_factura           PRIMARY KEY (id_factura),
    CONSTRAINT uq_factura_pedido    UNIQUE (id_pedido)        COMMENT 'Un pedido genera exactamente una factura',
    CONSTRAINT uq_factura_numero    UNIQUE (numero_factura),
    CONSTRAINT fk_factura_pedido    FOREIGN KEY (id_pedido)      REFERENCES pedido      (id_pedido)      ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_factura_sede      FOREIGN KEY (id_sede)        REFERENCES sede        (id_sede)        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_factura_cajero    FOREIGN KEY (id_cajero)      REFERENCES usuario     (id_usuario)     ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_factura_metodo    FOREIGN KEY (id_metodo_pago) REFERENCES metodo_pago (id_metodo_pago) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_factura_total    CHECK (total >= 0),
    CONSTRAINT chk_factura_recibido CHECK (monto_recibido >= 0)

) ENGINE=InnoDB
  COMMENT='Factura interna por venta. 1 pedido = 1 factura. HU-23, HU-24, HU-25, HU-26';


-- =============================================================================
-- SPRINT 6 — REPORTES Y DASHBOARD
-- HU-27, HU-28
-- Vistas que soportan los reportes sin tablas adicionales.
-- Los datos provienen de factura, pedido_detalle, producto y sede.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Vista: reporte_ventas_cajero
-- Propósito: Reporte de ventas filtrable por sede y rango de fechas.
-- Uso: Cajero consulta solo su sede. Admin puede filtrar por cualquier sede.
-- HU-27 — Reporte de ventas del Cajero por rango de fechas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW reporte_ventas_cajero AS
SELECT
    DATE(f.fecha_emision)                       AS fecha,
    s.id_sede                                   AS id_sede,
    s.nombre                                    AS sede,
    p.codigo                                    AS codigo_producto,
    p.nombre                                    AS producto,
    c.nombre                                    AS categoria,
    pd.cantidad                                 AS cantidad_vendida,
    pd.costo_compra                             AS costo_compra,
    pd.precio_venta                             AS precio_venta,
    pd.subtotal                                 AS total_venta,
    (pd.costo_compra * pd.cantidad)             AS total_costo,
    (pd.subtotal - pd.costo_compra * pd.cantidad) AS ganancia,
    mp.nombre                                   AS metodo_pago,
    f.numero_factura,
    CONCAT(u.nombre, ' ', u.apellido)           AS cajero
FROM factura        f
JOIN pedido         pe ON pe.id_pedido    = f.id_pedido
JOIN pedido_detalle pd ON pd.id_pedido    = pe.id_pedido
JOIN producto       p  ON p.id_producto   = pd.id_producto
JOIN categoria      c  ON c.id_categoria  = p.id_categoria
JOIN sede           s  ON s.id_sede       = f.id_sede
JOIN metodo_pago    mp ON mp.id_metodo_pago = f.id_metodo_pago
JOIN usuario        u  ON u.id_usuario    = f.id_cajero;


-- -----------------------------------------------------------------------------
-- Vista: reporte_consolidado_admin
-- Propósito: Reporte multi-sede con rentabilidad por producto y sede.
-- Uso: Exclusivo del Administrador. Muestra todas las sedes consolidadas.
-- HU-28 — Reporte consolidado multi-sede del Administrador
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW reporte_consolidado_admin AS
SELECT
    s.id_sede                                       AS id_sede,
    s.codigo                                        AS codigo_sede,
    s.nombre                                        AS sede,
    p.codigo                                        AS codigo_producto,
    p.nombre                                        AS producto,
    c.nombre                                        AS categoria,
    SUM(pd.cantidad)                                AS total_unidades_vendidas,
    SUM(pd.subtotal)                                AS total_ventas,
    SUM(pd.costo_compra * pd.cantidad)              AS total_costos,
    SUM(pd.subtotal - pd.costo_compra * pd.cantidad) AS ganancia_bruta,
    COUNT(DISTINCT f.id_factura)                    AS total_facturas
FROM factura        f
JOIN pedido         pe ON pe.id_pedido    = f.id_pedido
JOIN pedido_detalle pd ON pd.id_pedido    = pe.id_pedido
JOIN producto       p  ON p.id_producto   = pd.id_producto
JOIN categoria      c  ON c.id_categoria  = p.id_categoria
JOIN sede           s  ON s.id_sede       = f.id_sede
GROUP BY s.id_sede, s.codigo, s.nombre, p.codigo, p.nombre, c.nombre;


-- =============================================================================
-- RESUMEN DEL MODELO
-- =============================================================================
-- Tablas independientes (sin FK):
--   rol, categoria, metodo_pago
--
-- Tablas dependientes nivel 1 (FK a tablas independientes):
--   usuario → rol
--   producto → categoria, usuario
--
-- Tablas dependientes nivel 2:
--   sede → usuario
--   usuario_sede → usuario, sede
--   producto_sede → producto, sede, usuario
--   inventario_movimiento → producto, sede, usuario
--   mesa → sede
--
-- Tablas dependientes nivel 3:
--   pedido → sede, mesa, usuario
--
-- Tablas dependientes nivel 4:
--   pedido_detalle → pedido, producto
--   factura → pedido, sede, usuario, metodo_pago
--
-- Total tablas: 13
-- Total vistas: 2
-- Total relaciones FK: 21
-- =============================================================================