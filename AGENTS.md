# AGENTS.md — Taquillera Backend

API REST del proyecto integrador **Cartelera y venta de boletas** (diplomado FET). Expone la cartelera de eventos pequeños (cine, teatro, conciertos y charlas), sus funciones y la venta de boletas al frontend `TaquilleraFrontend` (Next.js, `http://localhost:3000`).

- **Stack:** Node.js 24 · TypeScript 6 (`strict`) · NestJS 12 sobre Express · Vitest 4 + Supertest · oxlint · Prettier.
- **Base de datos:** todavía no hay. Mientras no se decida, los datos viven en memoria dentro del servicio de cada módulo. No instalar un ORM ni una base de datos sin que el equipo lo pida.

## Comandos (PowerShell, desde la raíz del repositorio)

```powershell
npm install              # instalar dependencias
npm run start:dev        # API en modo watch -> http://localhost:3001
npm run build            # compilar a dist/
npm run start:prod       # ejecutar dist/main.js
npm test                 # pruebas unitarias (*.spec.ts en src/)
npm run test:e2e         # pruebas e2e (test/*.e2e-spec.ts)
npm run test:cov         # cobertura de todo src/; falla por debajo del 80 % de líneas
npm run test:mutation    # mutación con StrykerJS; informe en reports/mutation/
npm run lint             # oxlint con reglas que usan tipos
npm run format           # Prettier sobre src/ y test/
```

Antes de dar una tarea por terminada: `npm run lint`, `npm test`, `npm run test:e2e` y `npm run build` deben pasar. El CI (`.github/workflows/ci.yml`) ejecuta lo mismo, más la cobertura, en cada pull request.

La mutación es informativa y no bloquea. Para una sola funcionalidad: `npx stryker run --mutate "src/<modulo>/**/*.ts,!src/**/*.spec.ts"`.

Variables de entorno (opcionales): `PORT` (por defecto `3001`) y `FRONTEND_URL` (origen permitido por CORS, por defecto `http://localhost:3000`). Ver `src/main.ts`.

## Lo que el agente no deduciría solo

- **El proyecto es ESM** (`"type": "module"`, `module: nodenext`). Todo import relativo lleva extensión `.js` aunque el archivo sea `.ts`: `import { EventosService } from './eventos.service.js';`. Sin la extensión, la compilación falla.
- `src/main.ts` usa `await bootstrap()` en el nivel superior; no lo cambies a `bootstrap();` (la regla `no-floating-promises` está en `error`).
- El linter es **oxlint**, no ESLint. No agregues configuración de ESLint.
- Vitest corre con `globals: true`: `describe`, `it`, `expect`, `beforeEach` no se importan. Para dobles de prueba usa `vi.fn()`, no `jest.fn()`.
- El puerto es **3001** porque el frontend ocupa el 3000.
- **Los asientos ocupados tienen una sola fuente de verdad:** el servicio del módulo `asientos`, que los guarda en memoria por función. Todos los lugares tienen 5 filas (A a E) de 8 asientos. Cualquier módulo que venda o libere asientos pasa por ese servicio; ninguno lleva su propia lista.
- **Las fechas van en hora de Colombia.** Cada función guarda su inicio como texto ISO con `-05:00`, y el día se calcula con `Intl` y `America/Bogota`, nunca con la hora local del servidor. Las pruebas fuerzan otra zona (`Asia/Tokyo`) antes de importar el código, con `vi.hoisted`: si la zona se fuerza después, los formateadores ya están creados y la prueba no protege nada.

## Organización del código

```
src/
  main.ts                 arranque, CORS y puerto
  app.module.ts           módulo raíz: importa los módulos de funcionalidad
  <funcionalidad>/        un módulo por concepto del dominio (eventos, funciones, compras...)
    <x>.module.ts
    <x>.controller.ts     rutas HTTP; sin lógica de negocio
    <x>.service.ts        lógica de negocio y datos
    <x>.controller.spec.ts / <x>.service.spec.ts
    dto/                  clases de entrada y salida
    entities/             tipos del dominio
test/                     pruebas e2e con Supertest contra AppModule
```

Dependencias permitidas: `controller -> service -> entities`. Un controlador nunca accede a datos directamente. Un módulo usa el servicio de otro solo si ese módulo lo exporta (`exports: [...]`) y lo importa en `imports`. Registra cada módulo nuevo en `app.module.ts`.

Para crear un módulo nuevo sigue la skill `nest-modulo` (`.claude/skills/nest-modulo/`).

## Convenciones

- **Idioma del dominio:** español para entidades, rutas y mensajes (`/eventos`, `Evento`, `EventosService`); el código de framework queda en inglés.
- **Nombres de archivo:** kebab-case con sufijo de rol (`eventos.controller.ts`). Clases en PascalCase, métodos en camelCase.
- **Rutas REST:** sustantivo en plural (`GET /eventos`, `GET /eventos/:id`). Usa `ParseIntPipe` en parámetros numéricos y `NotFoundException` cuando un recurso no existe (responde 404).
- **Estilo:** Prettier con comillas simples y coma final (`.prettierrc`). No desactives reglas del linter para que pase.
- **Pruebas:** cada servicio y controlador nuevo trae su `*.spec.ts`; cada endpoint nuevo trae al menos un caso en `test/` (e2e), incluido el caso de error.
- **Ramas:** se trabaja en ramas desde `main` (`feat/...`, `fix/...`, `chore/...`) y se llega a `main` solo por pull request.
- **Commits:** Conventional Commits en español: `feat: listar eventos de la cartelera`, `fix: ...`, `chore: ...`, `test: ...`, `docs: ...`.

## Lo que el agente no debe hacer

- No hacer commit ni push directo a `main`, ni fusionar pull requests.
- No crear, leer ni modificar archivos `.env` ni subir secretos.
- No editar `dist/`, `package-lock.json` a mano ni archivos de `node_modules/`.
- No cambiar `tsconfig*.json`, `nest-cli.json`, `.oxlintrc.json` ni los scripts de `package.json` sin que se pida.
- No agregar dependencias sin explicar por qué en el plan.
- No registrar `ObserveModule` ni ejecutar `npx @nestjs/observe link` (ver la sección siguiente) sin autorización del equipo.

## Production data: NestJS Observe

This app's production telemetry - traces, errors, logs and metrics - goes to [NestJS Observe](https://observe.nestjs.com). Until `ObserveModule` is registered in `src/app.module.ts`, nothing is sent: `npx @nestjs/observe link` sets it up in one step - it installs `@nestjs/observe`, wires it into the app, and writes the key pair (`OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`) to `.env`.

When a task depends on how the app behaves in production - an error users hit, a slow endpoint, a failing job, whether a release made things worse - work from that data, not from the code alone:

- The Observe MCP server answers those questions directly: errors with their traces and logs, slow operations, jobs, and what a release changed (`find_regressions`, `diff_release`). It is included on the Pro plan and above. In Claude Code: `claude mcp add observe --transport http https://observe-api.nestjs.com/mcp`, and the client opens a browser to approve. Other clients: https://www.observe.nestjs.com/documentation/mcp
- Without it, the user can open the request or error in the Observe dashboard and click **Copy agent prompt**, which hands over that page's trace, stack and logs as text.
