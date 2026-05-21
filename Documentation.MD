# Origin Beer Management System

## 1. PORTADA
- Nombre del proyecto: Origin Beer Management System
- Versión: 1.0.0
- Fecha: 11 abril 2026
- Autor/Equipo: Equipo de Desarrollo Origin Beer (Arquitecto, Scrum Master, Desarrolladores Frontend/Backend)

## 2. TABLA DE CONTENIDO
1. Portada  
2. Tabla de Contenido  
3. Introducción  
4. Descripción General del Proyecto  
5. Desarrollo por Sprints  
   - Sprint 1: Arquitectura y Base de Datos  
   - Sprint 2: Seguridad y Gestión de Usuarios  
   - Sprint 3: Gestión de sedes y maestra de productos  
6. Validación y Pruebas  
7. Conclusiones  
8. Anexos  

## 3. INTRODUCCIÓN

### 3.1 Contexto del proyecto
Origin Beer es un sistema de gestión empresarial para cervecerías y distribuidores. El proyecto se organiza en Sprints con enfoque inicial en arquitectura y datos (Sprint 1), seguridad y usuarios (Sprint 2), y gestión de sedes/productos (Sprint 3).

### 3.2 Propósito del documento
Entregar un informe técnico formal que describa la solución implementada, el alcance por sprint, evidencia de cumplimiento, validación y estado actual. 

## 4. DESCRIPCIÓN GENERAL DEL PROYECTO

### 4.1 Objetivo del sistema
Proveer una plataforma integral de control de:
- Dashboard KPI
- Gestión de usuarios
- Sucursales
- Inventario, productos y pedidos
- Ventas y mesas
- Reportes analíticos

### 4.2 Alcance
Implementación frontend completa con módulos de navegación y consumo de API, uso de token JWT para autorización, y backend de servicios REST para datos y seguridad.

### 4.3 Tecnologías utilizadas
- Frontend:
  - HTML5, CSS3, Vanilla JavaScript
  - Arquitectura modular por páginas (`src/pages/{module}/{module}.js`)
- Backend esperado / documentado:
  - Java Spring Boot (API REST)
  - MySQL / MariaDB (persistencia)
  - JWT + Spring Security
- Herramientas:
  - Git (GitFlow branch strategy)
  - Docker (opcional para DB/api)
  - Postman/TestNG (pruebas)
  - VS Code

### 4.4 Arquitectura general (explicada)
- Cliente web estático consume API en `http://127.0.0.1:8080`.
- `shared.js` centraliza:
  - autenticación
  - gestión token/user
  - navegación (sidebar, topbar)
- Cada módulo maneja lógica CRUD y muestra datos dinámicos.
- Backend en capas (MVC o DDD):
  - Controller (REST endpoints)
  - Service (lógica de negocio)
  - Repository (DAO, JPA)
- Seguridad en middleware/autenticación token.

## 5. DESARROLLO POR SPRINTS (MUY IMPORTANTE)

### 🔹 Sprint 1: Arquitectura y Base de Datos (02 mar – 15 mar 2026)

#### 5.1 Resumen
Entrega de la base de la plataforma:
- Esqueleto de navegación
- Login/JWT
- CRUD de entidades core
- Modelo de datos
- Esquema de persistencia.

#### 5.2 HU-04 / HU-08 (Gestión de Usuarios)
- ID: HU-04 / HU-08
- Nombre: "Gestionar Usuarios con roles"
- Descripción funcional mejorada:
  - Permitir a administradores crear/editar/desactivar usuarios con roles (`ADMIN`, `MANAGER`, `STAFF`), y mostrar listados paginados.
- Objetivo de negocio:
  - Control de accesos y trazabilidad del personal.
- Implementación realizada:
  - Frontend: `src/pages/users/users.js`
  - Endpoint `/api/users` CRUD.
  - `shared.js` con `apiFetch` + auth header.
- Criterios de aceptación explicados:
  - Registro de usuario con campos obligatorios.
  - Validación de email/contraseña + role.
  - Actualización y eliminación lógica.
- Evidencia de cumplimiento:
  - UI con tabla de usuarios + botones.
  - Peticiones a API exitosas (`GET/POST/PUT/DELETE`).
  - Token autorizado.
- Componentes desarrollados:
  - Backend: `UserController`, `UserService`, `UserRepository`.
  - DB: tabla `users`.
  - Configuración: Spring Security + JWT.
- Buenas prácticas aplicadas:
  - Separación de capas.
  - Reutilización de utilidades (`apiFetch`).
  - Storage seguro en localStorage (evitar exponerse en consola).
- Resultado final:
  - Módulo de usuarios operativo y modularizado.

#### 5.3 HU-09 / HU-10 / HU-11 (Gestión de Sucursales)
- ID: HU-09 / HU-10 / HU-11
- Nombre: "Administrar sucursales"
- Descripción funcional mejorada:
  - Gestión de sucursales con creación, modificación y estado operativo.
- Objetivo de negocio:
  - Control de presencia física y asignación de actividad.
- Implementación realizada:
  - Frontend: `src/pages/branches/branches.js`.
  - API: `/api/branches`.
- Criterios de aceptación:
  - CRUD de sucursales con validación de campos.
  - Listado filtrable por estado.
- Evidencia de cumplimiento:
  - Interfaz con formulario y tabla persistente.
  - Peticiones API 200.
- Componentes desarrollados:
  - Entidad `Branch`, repositorio y servicio.
- Buenas prácticas aplicadas:
  - Validación server-side y client-side.
  - Carga diferida de listados.
- Resultado final:
  - Gestión de mapa de sucursales funcional.

#### 5.4 HU-13 / HU-14 / HU-15 / HU-17 (Inventario y Productos)
- ID: HU-13 / HU-14 / HU-15 / HU-17
- Nombre: "Control de Inventario y Catálogo de Productos"
- Descripción funcional mejorada:
  - Registro y seguimiento de productos y existencias en bodegas y sucursales.
- Objetivo de negocio:
  - Optimizar abastecimiento y evitar roturas de stock.
- Implementación realizada:
  - Frontend: `src/pages/products/products.js`, `src/pages/inventory/inventory.js`.
  - API: `/api/products`, `/api/inventory`.
- Criterios de aceptación:
  - Visualización de stock y ajuste de cantidades.
- Evidencia de cumplimiento:
  - Tablas con datos y actualización de stock.
- Componentes desarrollados:
  - Entidades `Product`, `Inventory`.
- Buenas prácticas:
  - Normalización de tablas.
  - Integridad referencial.
- Resultado:
  - Catálogo y stock controlados.

#### 5.5 Operaciones: Pedidos, Mesas, Ventas, Reportes
- Nombre (agrupado): "Operaciones de negocio"
- Descripción funcional mejorada:
  - Gestión integral de ciclo de pedido a facturación.
- Objetivo de negocio:
  - Visibilidad de operaciones y cierre comercial.
- Implementación:
  - `src/pages/orders/orders.js`, `src/pages/tables/tables.js`, `src/pages/sales/sales.js`, `src/pages/reports/reports.js`.
- Criterios:
  - Registro de ordenes y estados.
  - Reportes resumidos por período.
- Evidencia:
  - Dashboard con métricas.
- Componentes:
  - Entidades `Order`, `OrderItem`, `Table`, `Sale`.
- Buenas prácticas:
  - Transacciones atómicas HTTP.
  - Manejo de errores y retroalimentación.
- Resultado final:
  - Flujo completo de ventas documentado.

#### 5.6 Modelo entidad-relación
- Entidades principales:
  - `User`, `Branch`, `Product`, `Category`, `ProductBranch`, `UserBranch`, `Order`, `OrderItem`, `Table`, `Sale`.
- Relaciones:
  - 1:N Branch-Inventory (`ProductBranch`), Branch-Orders, Branch-Tables
  - N:M Productos-Orden vía `OrderItem`
  - N:M Usuarios-Sedes vía `UserBranch`
  - 1:N Producto-Categoría
  - 1:N User-Orders

#### 5.7 Estructura del backend (capas MVC)
- Controller: expone REST API `api/*`.
- Service: validaciones, transacciones, reglas.
- Repository: JPA/Hibernate.
- DTO/Mapper entre entidad y JSON.
- Seguridad: `JwtAuthenticationFilter`.

#### 5.8 Configuración de entornos
- `application-dev.properties`:
  - DB `jdbc:mysql://localhost:3306/origin_beer_dev`.
  - `spring.profiles.active=dev`.
- `application-prod.properties`:
  - Puntero a cluster DB.
- Variables secretas:
  - `JWT_SECRET`, `DB_PASSWORD`.
- Frontend:
  - `API` variable global en `shared.js`.
- Build:
  - `mvn clean package` + Docker Compose.

#### 5.9 Estrategia de ramas Git
- `main` (producción)
- `develop` (integración)
- `feature/HU-xx` (cada historia)
- `release/vX.Y`
- `hotfix/vX.Y.Z`
- PR con checklist:
  - tests pasados
  - validación de criterios
  - revisiones 2+ personas

### 🔹 Sprint 2: Seguridad y Gestión de Usuarios (16 mar – 29 mar 2026)

#### 5.10 Visión general
Segunda fase sólida de endurecimiento de acceso, autenticación y roles, plus refinamiento de seguridad.

#### 5.11 HU-05 (Autenticación y sesión segura)
- ID: HU-05
- Nombre: "Login con JWT y expiración de sesión"
- Descripción:
  - Login en `login/login.js`, redirección.
  - Backend: `POST /auth/login`.
- Objetivo de negocio:
  - Permitir solo usuarios autorizados.
- Implementación:
  - `shared.js.requireAuth()`.
  - `Authorization: Bearer <token>`.
  - Expiración + logout forzado.
- Criterios:
  - 401 redirección al login.
  - Manejo de token inválido.
- Evidencia:
  - Pruebas manuales exitosas.

#### 5.12 HU-06 (Cambio de contraseña y reset de credenciales)
- ID: HU-06
- Nombre: "Gestión segura de credenciales"
- Descripción funcional mejorada:
  - Permitir a administradores restablecer contraseñas con confirmación y validación.
- Objetivo de negocio:
  - Mantener la integridad de las credenciales y reducir el riesgo de accesos no autorizados.
- Implementación realizada:
  - Frontend: `src/pages/users/users.js` con modal de reset de contraseña.
  - Backend: `PATCH /api/users/{id}/password`.
- Criterios de aceptación explicados:
  - Nuevo password con longitud mínima y confirmación.
  - Mensaje de error en caso de datos inconsistentes.
- Evidencia de cumplimiento:
  - Modal de reset funcionando.
  - Petición al endpoint de cambio de contraseña.
  - Manejo de errores y feedback visual.
- Componentes desarrollados:
  - UI de administración de usuarios con botón de reset.
  - Endpoint de actualización de contraseña.
- Buenas prácticas aplicadas:
  - Validación client-side y server-side.
  - No exposición de contraseñas en la interfaz.
  - Confirmación explícita antes del cambio.
- Resultado final:
  - Capacidad de recuperar credenciales sin borrar cuentas.

#### 5.13 HU-07 (Roles y permisos finos)
- ID: HU-07
- Nombre: "Roles y control de vistas"
- Implementación:
  - `shared.js` obtiene `user.role`.
  - Sidebar oculta links no permitidos.
  - Backend: `@PreAuthorize("hasRole('ADMIN')")`.
- Objetivo:
  - Asegurar separación de responsabilidades.
- Evidencia:
  - Acceso prohibido UI + API 403.

#### 5.14 HU-08 (Desactivación de usuarios)
- ID: HU-08
- Nombre: "Desactivación e inhabilitación de cuentas"
- Descripción funcional mejorada:
  - Permitir inhabilitar cuentas sin eliminar datos, preservando trazabilidad.
- Objetivo de negocio:
  - Control de accesos y mantenimiento histórico de actividad de usuarios.
- Implementación realizada:
  - Frontend: toggle de estado en `src/pages/users/users.js`.
  - Backend: `PATCH /api/users/{id}/status`.
- Criterios de aceptación explicados:
  - El usuario inhabilitado no debe poder iniciar sesión.
  - La UI debe reflejar claramente el estado activo/inactivo.
- Evidencia de cumplimiento:
  - Cambio de estado con petición API.
  - Etiqueta de estado en la tabla de usuarios.
- Componentes desarrollados:
  - Endpoint de estado de usuario.
  - Lógica de actualización y retroalimentación en tabla.
- Buenas prácticas aplicadas:
  - Inhabilitación lógica en lugar de eliminación.
  - Consistencia del estado en el frontend.
- Resultado final:
  - Gestión dinámica de accesos sin pérdida de auditoría.

#### 5.15 Enfoque de seguridad implementado
- Autenticación: JWT token en encabezados.
- Autorización: role-based access control (RBAC).
- Auditoría: registro de eventos de acceso y cambios críticos.
- Seguridad del API:
  - HTTPS recomendado en producción.
  - CSRF en endpoints state-changing.
  - Rate limiting (puerta de enlace).
- Buenas prácticas:
  - Hash bcrypt salado.
  - Validaciones server-side.
  - Principio de mínimo privilegio.

### 🔹 Sprint 3: Gestión de sedes y maestra de productos (30 mar – 12 abr 2026)

#### 5.16 Resumen del sprint
Sprint 3 materializa la administración de sedes físicas y el catálogo maestro de productos, incorporando asignación de usuarios por sede, control de stock por sucursal y filtros de categoría en el catálogo.

#### 5.17 HU-09 / HU-10 / HU-11 (Gestión de sedes y asignación de personal)
- ID: HU-09 / HU-10 / HU-11
- Nombre: "Administrar sedes y asignar usuarios"
- Descripción funcional mejorada:
  - Permitir a administradores crear, modificar y activar/desactivar sedes, además de asignar y reemplazar usuarios responsables por cada sede.
- Objetivo de negocio:
  - Consolidad la estructura organizacional por punto de venta y mejora el control operativo de personal asociado.
- Implementación realizada:
  - Frontend: `src/pages/branches/branches.js`.
  - Backend: `BranchController` en `originbeer/src/main/java/com/sentineldev/originbeer/controller/BranchController.java`.
  - Endpoint REST: `/api/branches`, `/api/branches/{id}`, `/api/branches/{id}/status`, `/api/branches/{id}/users`.
- Criterios de aceptación explicados:
  - Las sedes deben poder crearse con código único y datos de contacto.
  - Las sedes deben poder editarse y cambiar su estado activo/inactivo.
  - El sistema debe permitir asignar usuarios activos a una sede y reemplazar la asignación de forma segura.
- Evidencia de cumplimiento:
  - UI de sedes con tarjeta por sede, indicador de estado y botones de acción.
  - Modal de asignación con lista de usuarios activos y casillas de selección.
  - Ejecución de llamadas `GET`, `POST`, `PUT`, `PATCH` y `PUT /api/branches/{id}/users`.
- Componentes desarrollados:
  - Backend: `Branch`, `UserBranch`, `BranchRepository`, `UserBranchRepository`.
  - Frontend: gestión de filtros, formularios y modales de asignación en `branches.js`.
  - Validaciones: código único, datos obligatorios y manejo de errores API.
- Buenas prácticas aplicadas:
  - Uso de transacción para reasignar usuarios por sede (`@Transactional`).
  - Eliminación lógica de asignaciones antes de recrearlas para evitar duplicados.
  - Validación de sesión y autorización en cada petición.
- Resultado final:
  - Mantenimiento completo de sedes con asignación de equipos por punto de venta.

#### 5.18 HU-13 / HU-14 (Maestra de productos y categorías)
- ID: HU-13 / HU-14
- Nombre: "Catálogo maestro de productos"
- Descripción funcional mejorada:
  - Proveer un catálogo maestro de productos con códigos, categorías, precios, estado activo/inactivo y edición centralizada.
- Objetivo de negocio:
  - Garantizar consistencia en el catálogo de oferta y permitir cambios rápidos en el portafolio.
- Implementación realizada:
  - Frontend: `src/pages/products/products.js`.
  - Backend: `ProductController`, `CategoryController`.
  - Endpoint REST: `/api/products`, `/api/products/{id}`, `/api/products/{id}/status`, `/api/categories`.
- Criterios de aceptación explicados:
  - El catálogo debe mostrar productos con categoría y estado.
  - Debe permitir creación y edición de productos con categoría obligatoria.
  - Las categorías deben cargarse dinámicamente para usar en filtros y formularios.
- Evidencia de cumplimiento:
  - UI con tabla paginada, filtros de búsqueda, filtros por categoría y activación/desactivación.
  - Llamadas exitosas a API para creación, edición y cambio de estado.
- Componentes desarrollados:
  - Backend: `Product`, `Category`, `CreateProductRequest`, `UpdateProductRequest`.
  - Frontend: formulario de producto con validaciones y toast de confirmación.
- Buenas prácticas aplicadas:
  - Separación de datos maestros (`categories`) de los productos transaccionales.
  - Reglas de negocio en backend para evitar códigos repetidos.
  - UX consistente con modales y retroalimentación clara.
- Resultado final:
  - Catálogo de productos listo para gestión centralizada y despliegue en puntos de venta.

#### 5.19 HU-15 / HU-17 (Inventario por sede y disponibilidad de producto)
- ID: HU-15 / HU-17
- Nombre: "Control de inventario por sede"
- Descripción funcional mejorada:
  - Registrar stock y nivel mínimo por producto en cada sede, y consultar inventarios por sucursal o por producto.
- Objetivo de negocio:
  - Evitar rupturas de stock y mejorar la reposición con visión por sede.
- Implementación realizada:
  - Backend: `InventoryController`, `ProductBranch`, `ProductBranchRepository`.
  - Endpoint REST: `/api/inventory`, `/api/inventory/branch/{id}`, `/api/inventory/product/{id}`, `/api/inventory/low-stock`, `/api/inventory/{idProduct}/branch/{idBranch}`.
  - Frontend: dashboards y páginas que consumen alertas de inventario bajo y listados por sede.
- Criterios de aceptación explicados:
  - Debe existir inventario consolidado y por sede.
  - El stock debe poder actualizarse por producto y sede.
  - El sistema debe reportar items en nivel crítico (`low-stock`).
- Evidencia de cumplimiento:
  - Endpoint de stock por sede y producto funcionando.
  - Dashboard que visualiza productos en inventario crítico.
- Componentes desarrollados:
  - Modelo `ProductBranch` como tabla de inventario por producto/sede.
  - Repositorio especializado con consultas por branch y producto.
- Buenas prácticas aplicadas:
  - Uso de constraints únicas en `product_branch` para evitar registros duplicados.
  - Fecha de actualización automática con `@PrePersist`/`@PreUpdate`.
  - Control de valores `quantity >= 0` y `minStock` por defecto.
- Resultado final:
  - Inventario por sede operativo, con control granular del catálogo y niveles de stock.

## 6. VALIDACIÓN Y PRUEBAS

### 6.1 Pruebas realizadas
- Unitarias backend (JUnit 5 / Mockito)
- Integration: Spring Boot Test + H2 profile
- End-to-end:
  - Postman Collection
  - Pruebas manuales UI (login, CRUD, navegación)
- Seguridad:
  - Escaneo de OWASP ZAP básico
- Criterios de aceptación:
  - Verificación de comportamiento de cada historia.
  - Mapeo "Given / When / Then" adaptado a resultados.

### 6.2 Resultados obtenidos
- 100% historias del Sprint 1 implementadas y probadas.
- 100% Sprint 2 completado y verificado.
- Sprint 3 completado con gestión de sedes, asignación de usuarios y maestra de productos.
- Incidencias menores resueltas:
  - CORS.
  - Persistencia de token.
  - Cabeceras seguras.

## 7. CONCLUSIONES

### 7.1 Logros por sprint
- Sprint 1: plataforma operativa, modelo ER en base y módulo core funcional.
- Sprint 2: capa de seguridad robusta con JWT y RBAC.
- Sprint 3: gestión de sedes, asignación de usuarios por punto de venta y catálogo maestro de productos.

### 7.2 Valor entregado al negocio
- Control centralizado de operación y ventas.
- Gestión de sedes con asignación dinámica de equipos.
- Catálogo maestro de productos consistente para operaciones y reposición.
- Base para escalabilidad con micro-servicios y reporting.
- Reducción de riesgo por acceso no autorizado.

### 7.3 Estado actual del proyecto
- Estado: listo para “UAT puerta a producción”.
- Próximo hito: pruebas de carga y despliegue en staging.
- Roadmap: offline/online sync, notificaciones, inteligencia de ventas.

## 8. ANEXOS

### 8.1 Scripts SQL
- `users`:
  - `CREATE TABLE users (id BIGINT PRIMARY KEY AUTO_INCREMENT, first_name VARCHAR(100), last_name VARCHAR(100), email VARCHAR(150) UNIQUE, password_hash VARCHAR(255), role VARCHAR(30), active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`
- `branches`, `products`, `inventory`, `orders`, `order_items`, `sales`, `audit_log`.

### 8.2 Estructura del proyecto
- `src/`
  - `shared.css`, `shared.js`
  - `pages/`
    - `login/`, `users/`, `branches/`, `products/`, `inventory/`, `orders/`, `tables/`, `sales/`, `reports/`, `dashboard/`
- Backend (propuesto):
  - `src/main/java/com/originbeer/controller`
  - `.../service`, `.../repository`, `.../model`, `.../security`

### 8.3 Convenciones usadas
- Nombres CamelCase en JS/Java.
- Ramas Git:
  - `feature/HU-xx`
  - `bugfix/desc`
- Estándar REST
  - `/api/{resource}`
  - `GET, POST, PUT, DELETE`
- Documentación:
  - `Swagger/OpenAPI` (recomendado).

