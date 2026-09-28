-- =============================================================================
-- CoffeeFast — Setup completo para desarrollo de la APP MOVIL
-- =============================================================================
-- Crea las tablas/columnas que faltan y carga los datos de prueba.
-- Reemplaza la ejecucion manual de:
--    seed_datos_basicos.sql
--    habilitar_realtime.sql
--    crear_wallet_tables.sql   (version corregida, ver nota [W1])
--    bloquear_anon_sensibles.sql (version corregida, ver seccion 5)
--
-- CÓMO CORRERLO
--   1. Supabase Dashboard -> SQL Editor -> New query
--   2. Pegar TODO este archivo
--   3. Botón "Run"  (puedes correrlo las veces que quieras, es idempotente)
--
-- IDEMPOTENCIA
--   Todo el script se puede re-ejecutar sin error y sin duplicar datos.
--
-- QUE HACE ESTE SCRIPT QUE NO HACIA `bloquear_anon_sensibles.sql`
--   Ese script borra las politicas de `usuarios` y deja RLS habilitado, por
--   lo que la app movil (que usa la publishable key) recibe 0 filas siempre y
--   nunca logra obtener su `usuario_id` interno -> la Wallet queda en $0 y los
--   pedidos se crean sin dueno. Aqui se crea una politica que SI deja leer su
--   propia fila a un usuario autenticado, sin recursion (error 42P17).
-- =============================================================================


-- =============================================================================
-- 1) ROLES  (ids 1, 2, 3 fijos — el backend los tiene hardcodeados)
-- =============================================================================
-- `usuarios.service.js:8-12` define:
--     ROLES_FALLBACK = [ {id:1,'estudiante'}, {id:2,'empleado'}, {id:3,'dueño'} ]
-- Si los ids no coinciden, el backend no resuelve el rol de nadie.
--
-- IMPORTANTE SOBRE LA CODIFICACION
-- El caracter 'ñ' depende de que psql lea este archivo como UTF-8. Si corre
-- sin `PGCLIENTENCODING=UTF8` (típico en Windows), 'dueño' entra como 'due?o',
-- se crea un ROL DUPLICADO y las consultas por nombre afterward no lo
-- encuentran. Por eso acá se compara de forma tolerante: se ignoran tildes y
-- el signo de interrogacion. Si se detecta un rol duplicado, se borra y se
-- reapunta todo lo que lo usaba.
DO $$
DECLARE
  v_seq  TEXT;
  v_dup  BIGINT;
  v_ok   BIGINT;
BEGIN
  -- 1) Si hay un rol con 'ñ' roto (due?o), se elimina y se corrige su uso
  SELECT id INTO v_dup FROM public.roles
   WHERE nombre ILIKE 'due%o' AND nombre <> 'dueño'
   ORDER BY id LIMIT 1;

  IF v_dup IS NOT NULL THEN
    SELECT id INTO v_ok FROM public.roles WHERE nombre = 'dueño';
    IF v_ok IS NULL THEN
      UPDATE public.roles SET nombre = 'dueño' WHERE id = v_dup;
    ELSE
      UPDATE public.usuarios SET rol_id = v_ok WHERE rol_id = v_dup;
      DELETE FROM public.roles WHERE id = v_dup;
      RAISE NOTICE 'Rol duplicado (id=%) eliminado; usuarios reapuntados a %', v_dup, v_ok;
    END IF;
  END IF;

  -- 2) Roles que falten
  IF (SELECT count(*) FROM public.roles) = 0 THEN
    INSERT INTO public.roles (id, nombre) VALUES (1, 'estudiante'), (2, 'empleado'), (3, 'dueño');
    v_seq := pg_get_serial_sequence('public.roles', 'id');
    IF v_seq IS NOT NULL THEN
      PERFORM setval(v_seq, 3, true);
    END IF;
  ELSE
    INSERT INTO public.roles (nombre)
    SELECT v.nombre
    FROM (VALUES ('estudiante'), ('empleado'), ('dueño')) AS v(nombre)
    WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.nombre = v.nombre);
  END IF;
END $$;


-- =============================================================================
-- 2) COLUMNAS QUE FALTAN
-- =============================================================================
-- Verificadas una por una contra la base real: estas NO existen.
-- Las que se necesitan para el flujo de pedido de la app movil estan marcadas.

-- --- pedidos: campos que la app movil envia al crear el pedido ---
--     (docs/flujo_integracion_conexion_apps.md, seccion "Datos que Genera")
--     OJO: estas columnas NO estan en el esquema oficial
--     (db_CoffeeFaster/0001_create_tables.sql:129-148), que solo tiene `nota`
--     y `pago_estado`. Se agregan porque el doc de flujo las exige; si el
--     responsable de la BD (Diego) prefiere no agregarlas, se borra este bloque.
ALTER TABLE public.pedidos          ADD COLUMN IF NOT EXISTS metodo_pago       TEXT;
ALTER TABLE public.pedidos          ADD COLUMN IF NOT EXISTS ubicacion_entrega  TEXT;
ALTER TABLE public.pedidos          ADD COLUMN IF NOT EXISTS notas_estudiante  TEXT;
-- El KDS marca este campo al validar la entrega.
-- El esquema ya tiene `entregado_en` e `inicio_preparacion_en`; se agrega
-- `completado_en` porque el doc de flujo lo nombra.
ALTER TABLE public.pedidos          ADD COLUMN IF NOT EXISTS completado_en     TIMESTAMPTZ;

-- --- detalles_pedido: personalizaciones del producto ---
--     ej. "sin azucar, leche de soya"
ALTER TABLE public.detalles_pedido  ADD COLUMN IF NOT EXISTS modificaciones    TEXT;

-- --- usuarios: sede campus (la app lo pide en el registro) ---
ALTER TABLE public.usuarios         ADD COLUMN IF NOT EXISTS campus_sede_id    BIGINT;

-- --- productos: unidad de medida (la app desktop la escribe en el formulario
--     pero nunca se guardaba) ---
ALTER TABLE public.productos        ADD COLUMN IF NOT EXISTS unidad            TEXT NOT NULL DEFAULT 'un';

-- --- cafeterias: tiempo base de espera (lo configura el Dueño) ---
ALTER TABLE public.cafeterias       ADD COLUMN IF NOT EXISTS tiempo_base_min   INTEGER;

-- --- logs de validacion QR: NO se tocan, ya existen y con otros nombres ---
--     el esquema real (db_CoffeeFaster/0001_create_tables.sql:198) ya tiene
--     `qr_token_leido` y `motivo_rechazo`. Agregar `token_qr`/`mensaje` seria
--     crear columnas que nadie lee.

-- --- pagos: NO se tocan. El esquema real ya tiene `metodo_pago_id` como FK a
--     metodos_pago (0001_create_tables.sql:188). No hay `usuario_id` ni `metodo`.
--     El metodo de pago se registra en `pagos.metodo_pago_id`, no duplicado en
--     `pedidos`.

-- --- universidades ---
-- `activa` YA existe en el esquema real (0001_create_tables.sql:9): la linea
-- es no-op, se deja por si se corre en una base que no la tenga.
ALTER TABLE public.universidades    ADD COLUMN IF NOT EXISTS activa            BOOLEAN NOT NULL DEFAULT true;
-- `dominio` NO existe. Sirve para validar el correo institucional
-- (@alu.uct.cl) sin hardcodearlo en la app. Opcional.
ALTER TABLE public.universidades    ADD COLUMN IF NOT EXISTS dominio           TEXT;


-- =============================================================================
-- 3) TABLAS DE WALLET
-- =============================================================================
-- [W1] OJO: `crear_wallet_tables.sql` declara `usuario_id UUID` pero en esta
-- base TODOS los id son BIGINT (usuarios.id, pedidos.id, etc). Postgres no
-- puede crear esa FK ("bigint and uuid are of incompatible types") y el
-- script fallaba. Aqui se usa BIGINT, que es lo que corresponde.
CREATE TABLE IF NOT EXISTS public.wallets (
  id             BIGSERIAL   PRIMARY KEY,
  usuario_id     BIGINT      NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  saldo_actual   INTEGER     NOT NULL DEFAULT 0 CHECK (saldo_actual >= 0),
  moneda         TEXT        NOT NULL DEFAULT 'CLP',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id)
);

CREATE TABLE IF NOT EXISTS public.movimientos_wallet (
  id          BIGSERIAL   PRIMARY KEY,
  wallet_id   BIGINT      NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  pedido_id   BIGINT      REFERENCES public.pedidos(id) ON DELETE SET NULL,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('recarga', 'compra', 'reembolso')),
  monto       INTEGER     NOT NULL,
  descripcion TEXT        NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_wallet   ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wallets_usuario_id          ON public.wallets(usuario_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_wallet_id       ON public.movimientos_wallet(wallet_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_creado_en       ON public.movimientos_wallet(creado_en DESC);

-- Trigger: mantener actualizado_en al tocar la wallet
CREATE OR REPLACE FUNCTION public.handle_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_wallet_updated ON public.wallets;
CREATE TRIGGER on_wallet_updated
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.handle_wallet_updated_at();


-- =============================================================================
-- 4) RLS DE `usuarios` — QUE SI DEJA LEER TU PROPIA FILA
-- =============================================================================
-- El problema: una politica sobre `usuarios` que consulta `usuarios` se llama
-- a si misma -> error 42P17 "infinite recursion detected in policy".
-- La solucion: una funcion SECURITY DEFINER que resuelve el id con privilegios
-- de owner (sigue viendo `usuarios`, pero la politica ya no es recursiva).

CREATE OR REPLACE FUNCTION public.mi_usuario_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id FROM public.usuarios u WHERE u.auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.mi_wallet_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id FROM public.wallets w
  WHERE w.usuario_id = (SELECT public.mi_usuario_id())
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.mi_usuario_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mi_wallet_id()  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mi_usuario_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mi_wallet_id()  TO authenticated;

-- 4.1) Limpieza de las politicas problematicas (mismo criterio que Camilo,
--      pero SIN dejar la tabla en "RLS sin politicas" =todo bloqueado)
DROP POLICY IF EXISTS usuarios_select_own     ON public.usuarios;
DROP POLICY IF EXISTS usuarios_select_dueno   ON public.usuarios;
DROP POLICY IF EXISTS usuarios_insert_dueno   ON public.usuarios;
DROP POLICY IF EXISTS usuarios_delete_dueno   ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update_own     ON public.usuarios;
DROP POLICY IF EXISTS pagos_select_own        ON public.pagos;
DROP POLICY IF EXISTS pagos_select_dueno      ON public.pagos;
DROP POLICY IF EXISTS logs_validacion_qr_insert_empleado ON public.logs_validacion_qr;
DROP POLICY IF EXISTS logs_validacion_qr_select_dueno    ON public.logs_validacion_qr;

ALTER TABLE public.usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_validacion_qr ENABLE ROW LEVEL SECURITY;

-- 4.2) Politicas NO recursivas: cada usuario ve y edita solo lo suyo
CREATE POLICY usuarios_select_own ON public.usuarios
  FOR SELECT TO authenticated
  USING (id = public.mi_usuario_id());

CREATE POLICY usuarios_update_own ON public.usuarios
  FOR UPDATE TO authenticated
  USING      (id = public.mi_usuario_id())
  WITH CHECK (id = public.mi_usuario_id());

-- El anon queda bloqueado: no es el rol de esta politica.
-- El Dueño y el Empleado acceden a `usuarios` por el backend (service_role).

-- 4.3) Politicas de la wallet, tambien no recursivas
DROP POLICY IF EXISTS wallets_select_own       ON public.wallets;
DROP POLICY IF EXISTS wallets_update_own       ON public.wallets;
DROP POLICY IF EXISTS wallets_insert_own       ON public.wallets;
DROP POLICY IF EXISTS movimientos_select_own   ON public.movimientos_wallet;
DROP POLICY IF EXISTS movimientos_insert_own   ON public.movimientos_wallet;

CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (usuario_id = public.mi_usuario_id());

CREATE POLICY wallets_insert_own ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = public.mi_usuario_id());

CREATE POLICY wallets_update_own ON public.wallets
  FOR UPDATE TO authenticated
  USING      (usuario_id = public.mi_usuario_id())
  WITH CHECK (usuario_id = public.mi_usuario_id());

CREATE POLICY movimientos_select_own ON public.movimientos_wallet
  FOR SELECT TO authenticated
  USING (wallet_id = public.mi_wallet_id());

CREATE POLICY movimientos_insert_own ON public.movimientos_wallet
  FOR INSERT TO authenticated
  WITH CHECK (wallet_id = public.mi_wallet_id());


-- =============================================================================
-- 5) TRIGGER: cada registro en la app movil crea su fila en `usuarios`
-- =============================================================================
-- Sin esto, un usuario que se registra con Supabase Auth queda con una
-- cuenta valida pero SIN id interno -> no tiene wallet y sus pedidos salen
-- huerfanos. `RegisterScreen.tsx:74-85` manda
--   first_name, last_name, full_name, role='student'
--
-- OJO: `usuarios.password_hash` es NOT NULL porque el backend-node hace
-- bcrypt.compare contra esa columna (ver `auth.controller.js:130`). Un usuario
-- que entra por Supabase Auth NO tiene hash, asi que se guarda un centinela
-- que jamas podria coincidir con un bcrypt valido: ese usuario no puede entrar
-- por POST /auth/login, solo por la app.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_id  BIGINT;
  v_usuario BIGINT;
  v_nombre  TEXT;
  v_apellido TEXT;
BEGIN
  SELECT id INTO v_rol_id FROM public.roles WHERE lower(nombre) = 'estudiante';
  IF v_rol_id IS NULL THEN
    SELECT id INTO v_rol_id FROM public.roles ORDER BY id LIMIT 1;
  END IF;

  v_nombre   := COALESCE(new.raw_user_meta_data ->> 'first_name',
                          split_part(COALESCE(new.email, ''), '@', 1));
  v_apellido := COALESCE(new.raw_user_meta_data ->> 'last_name', '');

  INSERT INTO public.usuarios
    (auth_user_id, rol_id, nombre, apellido, email, password_hash, activo)
  SELECT new.id, v_rol_id, v_nombre, v_apellido, new.email, '!auth', true
  WHERE NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_user_id = new.id);

  SELECT id INTO v_usuario FROM public.usuarios WHERE auth_user_id = new.id;

  -- Wallet de arranque para que la pantalla no salga en $0
  IF v_usuario IS NOT NULL THEN
    INSERT INTO public.wallets (usuario_id, saldo_actual)
    VALUES (v_usuario, 10000)
    ON CONFLICT (usuario_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- =============================================================================
-- 6) POLITICAS DE PEDIDOS PARA LA APP MOVIL
-- =============================================================================
-- `bloquear_anon_sensibles.sql` no toca estas tablas a proposito, asi que
-- siguen como estaban. Se fijan aqui de forma explicita: el estudiante
-- autenticado crea sus pedidos, los lee y los cancela solo si siguen
-- `Pagado` (BR-04). La cocina (KDS) y el Dueño leen via el backend.
ALTER TABLE public.pedidos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalles_pedido   ENABLE ROW LEVEL SECURITY;

-- AVISO: las politicas de RLS se combinan con OR. Si en esta base quedo alguna
-- politica previa tipo "allow all" sobre `pedidos` o `detalles_pedido`, estas no
-- van a restringir nada. Para verificarlo despues de correr el script:
--   SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

DROP POLICY IF EXISTS pedidos_select_own    ON public.pedidos;
DROP POLICY IF EXISTS pedidos_insert_own    ON public.pedidos;
DROP POLICY IF EXISTS pedidos_update_cancelar ON public.pedidos;
DROP POLICY IF EXISTS pedidos_select_dueno  ON public.pedidos;
DROP POLICY IF EXISTS detalles_select_own   ON public.detalles_pedido;
DROP POLICY IF EXISTS detalles_insert_own   ON public.detalles_pedido;

CREATE POLICY pedidos_select_own ON public.pedidos
  FOR SELECT TO authenticated
  USING (usuario_id = public.mi_usuario_id());

CREATE POLICY pedidos_insert_own ON public.pedidos
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = public.mi_usuario_id());

-- Cancelacion: solo mientras el estado siga siendo 'Pagado'
CREATE POLICY pedidos_update_cancelar ON public.pedidos
  FOR UPDATE TO authenticated
  USING      (usuario_id = public.mi_usuario_id() AND estado = 'Pagado')
  WITH CHECK (usuario_id = public.mi_usuario_id() AND estado = 'Cancelado');

CREATE POLICY detalles_select_own ON public.detalles_pedido
  FOR SELECT TO authenticated
  USING (pedido_id IN (SELECT p.id FROM public.pedidos p
                       WHERE p.usuario_id = public.mi_usuario_id()));

CREATE POLICY detalles_insert_own ON public.detalles_pedido
  FOR INSERT TO authenticated
  WITH CHECK (pedido_id IN (SELECT p.id FROM public.pedidos p
                            WHERE p.usuario_id = public.mi_usuario_id()));


-- =============================================================================
-- 7) DATOS DE PRUEBA
-- =============================================================================
-- 7.1) Cafeterias
INSERT INTO public.cafeterias (nombre, descripcion, hora_apertura, hora_cierre, imagen_url, activa, tiempo_base_min)
SELECT c.nombre, c.descripcion, c.hora_apertura::time, c.hora_cierre::time, c.imagen_url, true, 10
FROM (VALUES
  ('Cafetería Central', 'Cafetería principal del campus universitario, ubicada en el edificio central. Ambiente amplio con WiFi y zona de estudio.', '07:00:00', '20:00:00', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400'),
  ('Café Ingeniería',  'Especializada en café de especialidad y snacks saludables. Ubicada en la facultad de Ingeniería.',                          '08:00:00', '18:00:00', 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400'),
  ('Biblioteca Café',   'Cafetería tranquila dentro de la biblioteca central. Ideal para sesiones de estudio largas.',                               '08:00:00', '22:00:00', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400')
) AS c(nombre, descripcion, hora_apertura, hora_cierre, imagen_url)
WHERE NOT EXISTS (SELECT 1 FROM public.cafeterias x WHERE x.nombre = c.nombre);

-- 7.2) Categorias
INSERT INTO public.categorias (nombre, descripcion)
SELECT c.nombre, c.descripcion
FROM (VALUES
  ('Bebidas Calientes', 'Cafés, tés y chocolate caliente.'),
  ('Bebidas Frías',     'Lattes fríos, jugos y smoothies.'),
  ('Reposteria',        'Dulces, galletas, muffins y brownies.'),
  ('Snacks',            'Sandwiches y bocadillos.')
) AS c(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM public.categorias x WHERE x.nombre = c.nombre);

-- 7.3) Productos (referencian cafeteria y categoria por NOMBRE, no por id)
INSERT INTO public.productos (cafeteria_id, categoria_id, nombre, descripcion, precio, stock, stock_minimo, imagen_url, activo, unidad)
SELECT
  (SELECT id FROM public.cafeterias WHERE nombre = p.cafeteria_nombre),
  (SELECT id FROM public.categorias  WHERE nombre = p.categoria_nombre),
  p.nombre, p.descripcion, p.precio, p.stock, p.stock_minimo, p.imagen_url, true, 'un'
FROM (VALUES
  ('Cafetería Central','Bebidas Calientes','Café Americano','Café negro clásico, preparado con granos 100% arábica de origen colombiano.',        2500, 50, 10,'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300'),
  ('Cafetería Central','Bebidas Calientes','Café Latte',    'Espresso suave con leche vaporizada y arte latte.',                                 3000, 40,  8,'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=300'),
  ('Cafetería Central','Reposteria',      'Croissant de Almendra','Croissant artesanal relleno de crema de almendra tostada.',                       3500, 20,  5,'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300'),
  ('Café Ingeniería','Bebidas Frías',    'Té Verde Matcha Latte','Latte de matcha ceremonial japonés con leche de avena.',                        3500, 25,  6,'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=300'),
  ('Biblioteca Café', 'Reposteria',      'Torta de Chocolate','Torta de chocolate semiamarga con ganache.',                                         3800, 12,  4,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300')
) AS p(cafeteria_nombre, categoria_nombre, nombre, descripcion, precio, stock, stock_minimo, imagen_url)
WHERE NOT EXISTS (SELECT 1 FROM public.productos x WHERE x.nombre = p.nombre);

-- 7.4) Dueño de prueba para el backend Node
--     usuario: maria.gonzalez@cafeteria.com   /   password123
INSERT INTO public.usuarios (rol_id, nombre, apellido, email, password_hash, activo)
SELECT (SELECT id FROM public.roles WHERE nombre = 'dueño'),
       'María', 'González', 'maria.gonzalez@cafeteria.com',
       '$2b$10$XenVhwjPCHfnhZmkPN4Jyevc7gDFxD2cWGKlL6ODsyql5lf2C9eNi',
       true
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.email = 'maria.gonzalez@cafeteria.com');

-- 7.5) La dueña es responsable de las tres cafeterias
INSERT INTO public.cafeteria_usuarios (cafeteria_id, usuario_id)
SELECT c.id, u.id
FROM public.cafeterias c, public.usuarios u
WHERE u.email = 'maria.gonzalez@cafeteria.com'
  AND NOT EXISTS (SELECT 1 FROM public.cafeteria_usuarios x
                  WHERE x.cafeteria_id = c.id AND x.usuario_id = u.id);

-- 7.6) Wallet de la dueña
INSERT INTO public.wallets (usuario_id, saldo_actual)
SELECT u.id, 50000
FROM public.usuarios u
WHERE u.email = 'maria.gonzalez@cafeteria.com'
ON CONFLICT (usuario_id) DO NOTHING;


-- =============================================================================
-- 8) REALTIME  (idempotente — `habilitar_realtime.sql` NO lo era)
-- =============================================================================
-- `ALTER PUBLICATION ... ADD TABLE` falla con
--   "table is already member of publication supabase_realtime"
-- si la tabla ya estaba. Este bloque no falla nunca.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pedidos', 'detalles_pedido', 'wallets', 'productos'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE '  + % agregado a supabase_realtime', t;
    ELSE
      RAISE NOTICE '  = % ya estaba en supabase_realtime', t;
    END IF;
  END LOOP;
END $$;


-- =============================================================================
-- 9) VERIFICACION  (mira el resultado en la pestana "Results")
-- =============================================================================
SELECT 'roles'            AS tabla, count(*) AS filas FROM public.roles
UNION ALL SELECT 'universidades',   count(*) FROM public.universidades
UNION ALL SELECT 'campus_sedes',    count(*) FROM public.campus_sedes
UNION ALL SELECT 'cafeterias',      count(*) FROM public.cafeterias
UNION ALL SELECT 'categorias',      count(*) FROM public.categorias
UNION ALL SELECT 'productos',       count(*) FROM public.productos
UNION ALL SELECT 'usuarios',        count(*) FROM public.usuarios
UNION ALL SELECT 'wallets',         count(*) FROM public.wallets
UNION ALL SELECT 'pedidos',         count(*) FROM public.pedidos
ORDER BY 1;

-- Debe salir 3
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
