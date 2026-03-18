INSERT INTO usuario (id_rol, nombre, apellido, correo, contrasena, telefono, activo, fecha_creacion, fecha_actualizacion) 
VALUES (1, 'Andres', 'Santos', 'admin@lacatrina.com', '$2a$12$JbA3lyXVvg1Cb68/QU3qs.laEx2qqYqnhiSBq4t3H5/ezi0bdobgK', '3001234567', 1, NOW(), NOW());

UPDATE usuario 
SET contrasena = '$2a$12$JbA3lyXVvg1Cb68/QU3qs.laEx2qqYqnhiSBq4t3H5/ezi0bdobgK'
WHERE correo = 'admin@originbeer.com';


INSERT INTO sede (
    codigo, nombre, direccion, ciudad, telefono, correo, 
    activo, creado_por, fecha_creacion, fecha_actualizacion
) VALUES 
(
    'BOG-03', 'Origin Beer Modelia', 
    'Cra 78 #35-20, Engativa', 'Bogotá', 
    '3101234567', 'Engativa@originbeer.com',
    1, 1, NOW(), NOW()
),
(
    'BOG-02', 'Origin Beer Fontibón', 
    'Cl 17 #103-45, Fontibón', 'Bogotá', 
    '3107654321', 'fontibon@originbeer.com',
    1, 1, NOW(), NOW()
);

INSERT INTO producto (
    id_categoria, codigo, nombre, descripcion, 
    unidad, costo_compra, precio_venta, activo, 
    creado_por, fecha_creacion, fecha_actualizacion
) VALUES 
(1, 'CRV-001', 'Origin Lager', 'Cerveza artesanal tipo Lager, 330ml', 'unidad', 4500.00, 9000.00, 1, 1, NOW(), NOW()),
(1, 'CRV-002', 'Origin IPA', 'Cerveza artesanal tipo IPA, 330ml', 'unidad', 5000.00, 10500.00, 1, 1, NOW(), NOW()),
(1, 'CRV-003', 'Origin Stout', 'Cerveza artesanal tipo Stout, 330ml', 'unidad', 5200.00, 11000.00, 1, 1, NOW(), NOW()),
(2, 'CRV-004', 'Corona Extra', 'Cerveza importada Corona 355ml', 'unidad', 3800.00, 8000.00, 1, 1, NOW(), NOW()),
(3, 'BEB-001', 'Agua Cristal 600ml', 'Agua purificada sin gas', 'unidad', 800.00, 2500.00, 1, 1, NOW(), NOW()),
(4, 'SNK-001', 'Tabla de Quesos', 'Tabla de quesos y carnes frías', 'unidad', 12000.00, 28000.00, 1, 1, NOW(), NOW()),
(5, 'MRC-001', 'Camiseta Origin Beer', 'Camiseta oficial Origin Beer talla M', 'unidad', 15000.00, 35000.00, 1, 1, NOW(), NOW());


-- Activar Sede
UPDATE sede 
SET activo = 0, fecha_actualizacion = NOW()
WHERE id_sede = 1;

-- desactivar sede

UPDATE sede 
SET activo = 1, fecha_actualizacion = NOW()
WHERE id_sede = 1;

-- Consulta
SELECT id_sede, codigo, nombre, ciudad, activo 
FROM sede 
ORDER BY id_sede;

-- =============================================================================
-- ORIGIN BEER — Consultas Básicas del Sistema
-- Base de datos: origin_beer
-- Versión: 1.0
-- Fecha: 2026-03-10
-- Organizadas por módulo según Historias de Usuario
-- =============================================================================

USE origin_beer;


-- =============================================================================
-- MÓDULO 1 — USUARIOS Y ROLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Obtener todos los usuarios activos con su rol
-- -----------------------------------------------------------------------------
SELECT
    u.id_usuario,
    u.nombre,
    u.apellido,
    u.correo,
    r.nombre       AS rol,
    u.ultimo_acceso,
    u.activo
FROM usuario u
JOIN rol r ON r.id_rol = u.id_rol
WHERE u.activo = 1
ORDER BY r.nombre, u.apellido;


-- -----------------------------------------------------------------------------
-- Buscar un usuario por correo (login)
-- -----------------------------------------------------------------------------
SELECT
    u.id_usuario,
    u.nombre,
    u.apellido,
    u.correo,
    u.contrasena,
    r.nombre AS rol,
    u.activo
FROM usuario u
JOIN rol r ON r.id_rol = u.id_rol
WHERE u.correo = 'correo@ejemplo.com'
  AND u.activo = 1;


-- -----------------------------------------------------------------------------
-- Obtener todos los usuarios de una sede específica
-- -----------------------------------------------------------------------------
SELECT
    u.id_usuario,
    u.nombre,
    u.apellido,
    u.correo,
    r.nombre  AS rol,
    s.nombre  AS sede
FROM usuario_sede us
JOIN usuario u ON u.id_usuario = us.id_usuario
JOIN rol     r ON r.id_rol     = u.id_rol
JOIN sede    s ON s.id_sede    = us.id_sede
WHERE us.id_sede = 1
  AND u.activo   = 1
ORDER BY r.nombre, u.apellido;


-- -----------------------------------------------------------------------------
-- Verificar si un usuario tiene acceso a una sede
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS tiene_acceso
FROM usuario_sede
WHERE id_usuario = 1
  AND id_sede    = 1;


-- -----------------------------------------------------------------------------
-- Desactivar un usuario (HU-08)
-- -----------------------------------------------------------------------------
UPDATE usuario
SET activo = 0
WHERE id_usuario = 1;


-- -----------------------------------------------------------------------------
-- Cambiar contraseña de un usuario (HU-06)
-- Nota: el hash BCrypt se genera en el backend antes de ejecutar esta query
-- -----------------------------------------------------------------------------
UPDATE usuario
SET contrasena = '$2a$10$hash_generado_por_backend'
WHERE id_usuario = 1;


-- -----------------------------------------------------------------------------
-- Actualizar último acceso al iniciar sesión (HU-05)
-- -----------------------------------------------------------------------------
UPDATE usuario
SET ultimo_acceso = NOW()
WHERE id_usuario = 1;


-- =============================================================================
-- MÓDULO 2 — SEDES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Obtener todas las sedes activas
-- -----------------------------------------------------------------------------
SELECT
    s.id_sede,
    s.codigo,
    s.nombre,
    s.ciudad,
    s.direccion,
    s.telefono,
    s.correo,
    s.activo
FROM sede s
WHERE s.activo = 1
ORDER BY s.nombre;


-- -----------------------------------------------------------------------------
-- Obtener el detalle de una sede específica
-- -----------------------------------------------------------------------------
SELECT
    s.id_sede,
    s.codigo,
    s.nombre,
    s.ciudad,
    s.direccion,
    s.telefono,
    s.correo,
    CONCAT(u.nombre, ' ', u.apellido) AS creado_por,
    s.fecha_creacion
FROM sede s
JOIN usuario u ON u.id_usuario = s.creado_por
WHERE s.id_sede = 1;


-- -----------------------------------------------------------------------------
-- Contar cuántos usuarios tiene cada sede
-- -----------------------------------------------------------------------------
SELECT
    s.id_sede,
    s.nombre   AS sede,
    COUNT(us.id_usuario) AS total_usuarios
FROM sede s
LEFT JOIN usuario_sede us ON us.id_sede = s.id_sede
WHERE s.activo = 1
GROUP BY s.id_sede, s.nombre
ORDER BY s.nombre;


-- =============================================================================
-- MÓDULO 3 — PRODUCTOS E INVENTARIO
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Obtener todos los productos activos con su categoría
-- -----------------------------------------------------------------------------
SELECT
    p.id_producto,
    p.codigo,
    p.nombre,
    c.nombre       AS categoria,
    p.unidad,
    p.costo_compra,
    p.precio_venta,
    p.activo
FROM producto p
JOIN categoria c ON c.id_categoria = p.id_categoria
WHERE p.activo = 1
ORDER BY c.nombre, p.nombre;


-- -----------------------------------------------------------------------------
-- Obtener el inventario completo de una sede
-- -----------------------------------------------------------------------------
SELECT
    p.codigo         AS codigo_producto,
    p.nombre         AS producto,
    c.nombre         AS categoria,
    ps.cantidad      AS stock_actual,
    ps.stock_minimo,
    p.precio_venta,
    CASE
        WHEN ps.cantidad = 0             THEN 'SIN STOCK'
        WHEN ps.cantidad <= ps.stock_minimo THEN 'STOCK BAJO'
        ELSE 'OK'
    END              AS estado_stock
FROM producto_sede ps
JOIN producto  p ON p.id_producto  = ps.id_producto
JOIN categoria c ON c.id_categoria = p.id_categoria
WHERE ps.id_sede = 1
  AND p.activo   = 1
ORDER BY estado_stock, c.nombre, p.nombre;


-- -----------------------------------------------------------------------------
-- Obtener productos con stock bajo en todas las sedes
-- -----------------------------------------------------------------------------
SELECT
    s.nombre   AS sede,
    p.codigo   AS codigo_producto,
    p.nombre   AS producto,
    ps.cantidad AS stock_actual,
    ps.stock_minimo
FROM producto_sede ps
JOIN producto p ON p.id_producto = ps.id_producto
JOIN sede     s ON s.id_sede     = ps.id_sede
WHERE ps.cantidad <= ps.stock_minimo
  AND p.activo    = 1
  AND s.activo    = 1
ORDER BY s.nombre, ps.cantidad;


-- -----------------------------------------------------------------------------
-- Consultar stock de un producto específico en todas las sedes
-- -----------------------------------------------------------------------------
SELECT
    s.nombre    AS sede,
    ps.cantidad AS stock_disponible,
    ps.stock_minimo
FROM producto_sede ps
JOIN sede s ON s.id_sede = ps.id_sede
WHERE ps.id_producto = 1
  AND s.activo       = 1
ORDER BY s.nombre;


-- -----------------------------------------------------------------------------
-- Actualizar stock manualmente (entrada de inventario)
-- -----------------------------------------------------------------------------
UPDATE producto_sede
SET    cantidad        = cantidad + 50,
       actualizado_por = 1
WHERE  id_producto = 1
  AND  id_sede     = 1;


-- =============================================================================
-- MÓDULO 4 — PEDIDOS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Crear un nuevo pedido
-- -----------------------------------------------------------------------------
INSERT INTO pedido (id_sede, id_mesa, id_mesero, estado, observaciones)
VALUES (1, 3, 5, 'ABIERTO', 'Mesa para 4 personas');


-- -----------------------------------------------------------------------------
-- Agregar un producto a un pedido (HU-19)
-- Nota: precio_venta y costo_compra se toman del producto en ese momento
-- -----------------------------------------------------------------------------
INSERT INTO pedido_detalle (id_pedido, id_producto, cantidad, precio_venta, costo_compra, observacion)
SELECT
    1               AS id_pedido,
    p.id_producto,
    2               AS cantidad,
    p.precio_venta,
    p.costo_compra,
    NULL            AS observacion
FROM producto p
WHERE p.id_producto = 3;


-- -----------------------------------------------------------------------------
-- Ver el detalle completo de un pedido abierto
-- -----------------------------------------------------------------------------
SELECT
    pe.id_pedido,
    s.nombre       AS sede,
    m.numero_mesa  AS mesa,
    CONCAT(u.nombre, ' ', u.apellido) AS mesero,
    pe.estado,
    pe.fecha_apertura,
    p.codigo       AS codigo_producto,
    p.nombre       AS producto,
    pd.cantidad,
    pd.precio_venta,
    pd.subtotal,
    pd.observacion
FROM pedido        pe
JOIN sede          s  ON s.id_sede      = pe.id_sede
JOIN mesa          m  ON m.id_mesa      = pe.id_mesa
JOIN usuario       u  ON u.id_usuario   = pe.id_mesero
JOIN pedido_detalle pd ON pd.id_pedido  = pe.id_pedido
JOIN producto      p  ON p.id_producto  = pd.id_producto
WHERE pe.id_pedido = 1;


-- -----------------------------------------------------------------------------
-- Obtener el total de un pedido
-- -----------------------------------------------------------------------------
SELECT
    pe.id_pedido,
    pe.estado,
    COUNT(pd.id_detalle)  AS total_items,
    SUM(pd.subtotal)      AS total_pedido
FROM pedido         pe
JOIN pedido_detalle pd ON pd.id_pedido = pe.id_pedido
WHERE pe.id_pedido = 1
GROUP BY pe.id_pedido, pe.estado;


-- -----------------------------------------------------------------------------
-- Ver todos los pedidos abiertos de una sede
-- -----------------------------------------------------------------------------
SELECT
    pe.id_pedido,
    m.numero_mesa                       AS mesa,
    CONCAT(u.nombre, ' ', u.apellido)   AS mesero,
    pe.fecha_apertura,
    TIMESTAMPDIFF(MINUTE, pe.fecha_apertura, NOW()) AS minutos_abierto,
    COALESCE(SUM(pd.subtotal), 0)       AS total_acumulado
FROM pedido         pe
JOIN mesa           m  ON m.id_mesa    = pe.id_mesa
JOIN usuario        u  ON u.id_usuario = pe.id_mesero
LEFT JOIN pedido_detalle pd ON pd.id_pedido = pe.id_pedido
WHERE pe.id_sede = 1
  AND pe.estado  = 'ABIERTO'
GROUP BY pe.id_pedido, m.numero_mesa, u.nombre, u.apellido, pe.fecha_apertura
ORDER BY pe.fecha_apertura;


-- -----------------------------------------------------------------------------
-- Cerrar un pedido (cambiar estado a PAGADO) — parte del SP en el backend
-- -----------------------------------------------------------------------------
UPDATE pedido
SET    estado       = 'PAGADO',
       fecha_cierre = NOW()
WHERE  id_pedido = 1
  AND  estado    = 'ABIERTO';


-- =============================================================================
-- MÓDULO 5 — FACTURACIÓN
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registrar una factura al cerrar un pedido (HU-25)
-- -----------------------------------------------------------------------------
INSERT INTO factura (
    id_pedido, id_sede, id_cajero, id_metodo_pago,
    numero_factura, subtotal, total, monto_recibido, observaciones
)
VALUES (
    1, 1, 4, 1,
    'INV-001-20260310-000001', 45000.00, 45000.00, 50000.00, NULL
);


-- -----------------------------------------------------------------------------
-- Consultar el historial de facturas de una sede por fecha
-- -----------------------------------------------------------------------------
SELECT
    f.numero_factura,
    f.fecha_emision,
    s.nombre                            AS sede,
    m.numero_mesa                       AS mesa,
    mp.nombre                           AS metodo_pago,
    f.subtotal,
    f.total,
    f.monto_recibido,
    f.cambio,
    CONCAT(u.nombre, ' ', u.apellido)   AS cajero
FROM factura     f
JOIN pedido      pe ON pe.id_pedido       = f.id_pedido
JOIN mesa        m  ON m.id_mesa          = pe.id_mesa
JOIN sede        s  ON s.id_sede          = f.id_sede
JOIN metodo_pago mp ON mp.id_metodo_pago  = f.id_metodo_pago
JOIN usuario     u  ON u.id_usuario       = f.id_cajero
WHERE f.id_sede          = 1
  AND DATE(f.fecha_emision) BETWEEN '2026-03-01' AND '2026-03-31'
ORDER BY f.fecha_emision DESC;


-- =============================================================================
-- MÓDULO 6 — REPORTES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- HU-27 — Reporte del Cajero: ventas de su sede por rango de fechas
-- -----------------------------------------------------------------------------
SELECT *
FROM reporte_ventas_cajero
WHERE id_sede = 1
  AND fecha BETWEEN '2026-03-01' AND '2026-03-31'
ORDER BY fecha, producto;


-- -----------------------------------------------------------------------------
-- HU-27 — Resumen de ventas del Cajero por producto en el mes
-- -----------------------------------------------------------------------------
SELECT
    codigo_producto,
    producto,
    categoria,
    SUM(cantidad_vendida)   AS unidades_vendidas,
    SUM(total_venta)        AS total_ventas,
    SUM(total_costo)        AS total_costos,
    SUM(ganancia)           AS ganancia_total
FROM reporte_ventas_cajero
WHERE id_sede = 1
  AND fecha BETWEEN '2026-03-01' AND '2026-03-31'
GROUP BY codigo_producto, producto, categoria
ORDER BY ganancia_total DESC;


-- -----------------------------------------------------------------------------
-- HU-28 — Reporte del Admin: consolidado multi-sede
-- -----------------------------------------------------------------------------
SELECT *
FROM reporte_consolidado_admin
ORDER BY sede, ganancia_bruta DESC;


-- -----------------------------------------------------------------------------
-- HU-28 — Top 10 productos más rentables en todas las sedes
-- -----------------------------------------------------------------------------
SELECT
    producto,
    categoria,
    SUM(total_unidades_vendidas) AS unidades_totales,
    SUM(total_ventas)            AS ventas_totales,
    SUM(ganancia_bruta)          AS ganancia_total
FROM reporte_consolidado_admin
GROUP BY producto, categoria
ORDER BY ganancia_total DESC
LIMIT 10;


-- -----------------------------------------------------------------------------
-- HU-28 — Comparativo de ventas entre sedes
-- -----------------------------------------------------------------------------
SELECT
    sede,
    SUM(total_ventas)            AS ventas_totales,
    SUM(total_costos)            AS costos_totales,
    SUM(ganancia_bruta)          AS ganancia_bruta,
    SUM(total_facturas)          AS facturas_emitidas
FROM reporte_consolidado_admin
GROUP BY sede
ORDER BY ganancia_bruta DESC;


-- =============================================================================
-- CONSULTAS DE APOYO (útiles para el backend)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Verificar si una mesa tiene un pedido abierto
-- -----------------------------------------------------------------------------
SELECT id_pedido
FROM pedido
WHERE id_mesa = 3
  AND estado  = 'ABIERTO'
LIMIT 1;


-- -----------------------------------------------------------------------------
-- Obtener todos los métodos de pago activos
-- -----------------------------------------------------------------------------
SELECT id_metodo_pago, nombre
FROM metodo_pago
WHERE activo = 1;


-- -----------------------------------------------------------------------------
-- Obtener todas las categorías activas
-- -----------------------------------------------------------------------------
SELECT id_categoria, nombre
FROM categoria
WHERE activo = 1
ORDER BY nombre;


-- -----------------------------------------------------------------------------
-- Historial de movimientos de inventario de un producto en una sede
-- -----------------------------------------------------------------------------
SELECT
    im.tipo_movimiento,
    im.cantidad,
    im.cantidad_antes,
    im.cantidad_despues,
    im.origen,
    im.observacion,
    CONCAT(u.nombre, ' ', u.apellido) AS registrado_por,
    im.fecha_movimiento
FROM inventario_movimiento im
JOIN usuario u ON u.id_usuario = im.registrado_por
WHERE im.id_producto = 1
  AND im.id_sede     = 1
ORDER BY im.fecha_movimiento DESC;

-- =============================================================================
-- FIN DEL SCRIPT DE CONSULTAS
-- =============================================================================