# Taquillera · Backend

API REST de **Taquillera**, una cartelera de eventos pequeños (cine, teatro, conciertos y charlas) con venta de boletas de asiento numerado.

Proyecto integrador del Diplomado en Ingeniería de Software con IA y Sistemas Agénticos (FET). **Grupo 11:** Abilson Rivera Garcia y Bredman Estiven Velez Cortez.

| Repositorio | Qué tiene |
|---|---|
| Este | La API, en NestJS 12 |
| [TaquilleraFrontend](https://github.com/Bredman01/TaquilleraFrontend) | La interfaz, en Next.js 16 |
| [Taquillera-Arnes](https://github.com/AbilsonRivera/Taquillera-Arnes) | El arnés de Claude Code: agentes, hook, reglas, skills y specs |

## Cómo ejecutarlo

Necesita Node.js 24.

```powershell
npm ci
npm run start:dev    # API en http://localhost:3001
```

No usa base de datos: los datos viven en memoria y se reinician al arrancar.

## API

| Ruta | Qué devuelve |
|---|---|
| `GET /eventos` | Los eventos. Se filtra con `?categoria=` (`cine`, `teatro`, `concierto`, `charla`), `?ciudad=` y `?fecha=AAAA-MM-DD` |
| `GET /eventos/ciudades` | Las ciudades que tienen eventos, en orden alfabético |
| `GET /eventos/:id` | Un evento; 404 si no existe |
| `GET /eventos/:id/funciones` | Las funciones de un evento, de la más próxima a la más lejana |
| `GET /funciones/:id` | Una función, con el título, la ciudad y el lugar de su evento; 404 si no existe |
| `GET /funciones/:id/asientos` | Los 40 asientos de la función, cada uno «disponible» u «ocupado» |
| `POST /funciones/:id/compras` | Compra de 1 a 6 asientos con el nombre y el correo del comprador. Responde 201 con el código, los asientos, el total y la fecha; 409 si algún asiento ya está ocupado (y no ocupa ninguno); 400 si los datos no son válidos |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run lint` | oxlint con reglas que usan tipos |
| `npm test` | Pruebas unitarias con Vitest |
| `npm run test:e2e` | Pruebas e2e con Supertest |
| `npm run test:cov` | Cobertura de todo `src/`; falla por debajo del 80 % de líneas |
| `npm run test:mutation` | Mutación con StrykerJS; informe en `reports/mutation/` |
| `npm run build` | Compila a `dist/` |

## El arnés en este repositorio

Un solo sistema de agentes coordina este repositorio y el del frontend, porque casi todas las funcionalidades cruzan los dos. Por eso los agentes, el hook de rutas, las reglas y las specs viven en [Taquillera-Arnes](https://github.com/AbilsonRivera/Taquillera-Arnes), y este repositorio se clona dentro como `backend/`. Aquí están las piezas propias del backend:

| Pieza | Dónde | Qué es |
|---|---|---|
| Memoria | [`AGENTS.md`](AGENTS.md); [`CLAUDE.md`](CLAUDE.md) lo importa | Stack, comandos, organización, convenciones y lo que el agente no debe hacer |
| Skill `nest-modulo` | [`.claude/skills/nest-modulo/`](.claude/skills/nest-modulo/SKILL.md) | Cómo crear un módulo completo en este proyecto |
| CI | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Lint, pruebas con cobertura, e2e y build en cada pull request |
| Umbral de cobertura | [`vitest.config.ts`](vitest.config.ts) | Mínimo del 80 % de líneas sobre todo `src/` |
| Mutación | [`stryker.config.json`](stryker.config.json) | StrykerJS con el runner de Vitest |

### Para qué usamos la skill `nest-modulo`

El proyecto es ESM con Vitest, y un módulo generado «como siempre» no compila: los imports relativos necesitan la extensión `.js` y los tipos deben importarse con `import type`. La skill trae las plantillas ya corregidas. La usan el probador y el desarrollador del backend cada vez que una spec crea un recurso nuevo.

### Cómo se usa

1. Se clona el arnés y, dentro, este repositorio como `backend/` (lo hace `scripts/preparar.ps1` del arnés).
2. Se escribe la spec y se crea la rama `feat/NNN-nombre`.
3. Desde la raíz del arnés: `claude --agent taquilla-orquestador` y se le pide ejecutar la spec.
4. En este repositorio trabajan dos agentes, en este orden: `probador-back` escribe las pruebas en rojo (commit `test:`) y `desarrollador-back` las pone en verde (commit `feat:`). Después pasan el guardián del contrato y el revisor.
5. Una persona revisa, sube la rama, abre el pull request y fusiona con el CI en verde. Ningún agente puede hacer `git push` ni fusionar.

El orden completo, los permisos de cada agente y lo que cambió respecto del diseño del taller están en el [README del arnés](https://github.com/AbilsonRivera/Taquillera-Arnes#readme).

## Calidad y evidencia

| Mecanismo | Dónde se ve |
|---|---|
| CI con cobertura mínima del 80 % | Checks de cada pull request de este repositorio |
| TDD: pruebas antes que código | Historial de cada rama: el commit `test:` va antes del `feat:` |
| Revisión independiente | `specs/NNN-nombre/evidencia/revision.md` en el arnés, y las decisiones en cada pull request |
| Mutación | Sección de mutación de `evidencia/revision.md`, con los sobrevivientes clasificados |
| Contrato con el frontend | `specs/NNN-nombre/evidencia/contrato.md` en el arnés |

## Specs que tocaron este repositorio

| Spec | Pull request |
|---|---|
| [002 · Eventos y filtros de la cartelera](https://github.com/AbilsonRivera/Taquillera-Arnes/blob/main/specs/002-eventos-y-filtros/spec.md) | [#5](https://github.com/Bredman01/Taquillera-Backend/pull/5) |
| [003 · Funciones por evento](https://github.com/AbilsonRivera/Taquillera-Arnes/blob/main/specs/003-funciones-por-evento/spec.md) | [#6](https://github.com/Bredman01/Taquillera-Backend/pull/6) |
| [004 · Mapa de asientos](https://github.com/AbilsonRivera/Taquillera-Arnes/blob/main/specs/004-mapa-de-asientos/spec.md) | [#7](https://github.com/Bredman01/Taquillera-Backend/pull/7) |
| [005 · Compra con pago simulado](https://github.com/AbilsonRivera/Taquillera-Arnes/blob/main/specs/005-compra-pago-simulado/spec.md) | [#8](https://github.com/Bredman01/Taquillera-Backend/pull/8) |
