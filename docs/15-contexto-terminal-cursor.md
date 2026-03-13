## 15. Contexto para abrir el proyecto en otra máquina (Cursor + terminal)

Este documento sirve como guía rápida para abrir este proyecto en otra computadora (por ejemplo, en una nueva instalación de Cursor) y dejar **backend, frontend y base de datos** listos para trabajar y probar los bloques del plan MVP.

---

### 1. Requisitos previos en la nueva máquina

- **Node.js** 18+ instalado (LTS recomendado).
- **npm** (incluido con Node).
- Permisos para instalar dependencias en la carpeta del proyecto.
- Acceso a este repositorio/clon sincronizado (por ejemplo vía OneDrive, git u otro medio).

No se requiere instalar globalmente Prisma, Vite ni otros CLIs; todo se ejecuta vía `npx` o scripts de `package.json`.

---

### 2. Abrir el proyecto en Cursor

1. Copia/sincroniza la carpeta `Captura Partidos` a la nueva máquina (misma estructura que en esta instalación).
2. En Cursor:
   - `File > Open Folder...`
   - Selecciona la carpeta raíz del proyecto:  
     `.../Captura Partidos`
3. Una vez abierto, puedes usar la paleta de comandos (`Ctrl+Shift+P`) y escribir **"Open New Terminal"** para abrir una terminal integrada en esa carpeta.

---

### 3. Preparar el backend (API + Prisma)

1. En la terminal de Cursor, ir a la carpeta `backend` si no es ya el directorio actual:

```bash
cd "backend"
```

2. Instalar dependencias del backend (solo la primera vez en esa máquina):

```bash
npm install
```

3. Aplicar el schema de Prisma a la base de datos SQLite y generar clientes:

```bash
npx prisma db push
npx prisma generate
```

4. Sembrar datos demo (liga y usuarios):

```bash
npx prisma db seed
```

Esto crea al menos:

- Liga demo `Liga Amateur Demo` con ID: `00000000-0000-0000-0000-000000000001`
- Usuario **Anotador Demo** con PIN `1234` y rol `anotador_partido`
- Usuario **Consulta Demo** con PIN `5678` y rol `consulta`

5. Levantar el backend en modo desarrollo:

```bash
npm run dev
```

El backend se expone en `http://localhost:5173/api/v1` (proxyado por Vite desde el frontend) según la configuración actual.

> Si quieres ver logs del backend con claridad, mantén esta terminal dedicada sólo al servidor.

---

### 4. Preparar el frontend (app de captura)

1. Abre una **segunda terminal** en Cursor (misma carpeta raíz del proyecto) y entra a `frontend`:

```bash
cd "frontend"
```

2. Instala dependencias del frontend (solo la primera vez):

```bash
npm install
```

3. Levanta el servidor de desarrollo de Vite:

```bash
npm run dev
```

4. Abre la URL que indica Vite (normalmente):

- `http://localhost:5173/`

Desde ahí tendrás acceso a la pantalla de login, lista de partidos, captura, etc.

---

### 5. Login demo y pruebas básicas

Con backend y frontend corriendo:

1. Ve a `http://localhost:5173/login`.
2. Usa estos datos demo:
   - **ID de Liga**: `00000000-0000-0000-0000-000000000001`
   - **PIN Anotador**: `1234`
3. Tras login, se sincronizan liga, equipos, jugadores y canchas a IndexedDB de esa máquina.
4. Desde la pantalla **"Partidos del día"** puedes:
   - Crear nuevos partidos con “+ Nuevo partido”.
   - Entrar a `config`, `captura` y `resumen` como anotador (Bloque 1).

Si quieres probar el rol de consulta:

- Usa el mismo ID de liga y **PIN `5678`** (Consulta Demo).  
- Deberías ver solo acceso de lectura según lo definido en el Bloque 1.

---

### 6. Notas de coherencia con los docs

- `docs/11-propuesta-mvp-android.md` describe la arquitectura técnica general y se alinea con este flujo backend/frontend.
- `docs/13-plan-ejecucion-mvp.md` contiene el detalle de los bloques (1–7) y el orden recomendado de implementación:  
  **1 → 2 → 3 → 5 → 7 → 4 → 6**.
- `docs/14-ejecucion-bloque-1.md` documenta lo que ya se ejecutó del Bloque 1 en código.

Si abres este proyecto en otra máquina con Cursor, seguir estos pasos te dejará en el mismo contexto funcional para continuar implementando y probando los bloques siguientes.

