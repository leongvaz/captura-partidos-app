# Lenguajes y formatos del proyecto

Resumen de **lenguajes y tecnologías de marcado/configuración** usados en *Captura Partidos* y **para qué sirven** en este repositorio.

| Lenguaje / formato | Propósito en este proyecto |
| --- | --- |
| **TypeScript** (`.ts`) | Lógica del **backend** (API Fastify, Prisma, auth, reglas de negocio), configuración **Vite/Capacitor**, scripts de utilidad y seeds. Tipado estático y código compartible en Node. |
| **TypeScript + JSX** (`.tsx`) | **Frontend web** con **React**: pantallas, componentes, rutas, estado (Zustand), llamadas a API y UI interactiva. |
| **JavaScript** (`.js`) | Configuración del toolchain del frontend que sigue convención JS: **Tailwind**, **PostCSS**, etc. |
| **SQL** | Migraciones generadas por **Prisma** (`backend/prisma/migrations/**/*.sql`): creación y evolución de tablas e índices en la base de datos (**PostgreSQL**). |
| **Lenguaje del esquema Prisma** (`schema.prisma`) | Declaración del **modelo de datos** (entidades, relaciones, tipos); Prisma genera el cliente y las migraciones a partir de aquí. |
| **HTML** (`index.html`) | Punto de entrada del **SPA**: contenedor donde React monta la aplicación en el navegador (y base para builds PWA/Capacitor). |
| **CSS** (`.css`) | Estilos base, variables y capa global; en la práctica se combina con **Tailwind** para casi todo el diseño. |
| **Tailwind CSS** (clases en TSX + `tailwind.config.js`) | **Estilos utility-first**: layout, colores, tipografía y responsive sin escribir hojas CSS grandes a mano. |
| **JSON** | **Dependencias y scripts** (`package.json`, `package-lock.json`), configuración de **Capacitor** y otros metadatos legibles por herramientas. |
| **Markdown** (`.md`) | Documentación del producto y del desarrollo (`README`, `docs/`, listas de pendientes, planes). |
| **Gradle (Groovy)** (`*.gradle`) | **Build de Android** generado por Capacitor: compila el contenedor nativo que empaqueta la app web. |
| **XML** (Android / recursos) | Recursos del proyecto **Android** (manifiesto, strings, íconos, layouts mínimos del WebView de Capacitor). |

## Notas

- **No hay un solo `package.json` en la raíz**: el código vive en **`frontend/`** y **`backend/`**, cada uno con su propio stack npm.
- El **cliente de base de datos** se usa desde TypeScript; la persistencia concreta la define Prisma (hoy `provider = "postgresql"` y `DATABASE_URL` en `backend/.env.example`).
