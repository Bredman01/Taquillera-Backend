---
name: nest-modulo
description: Crea un módulo de funcionalidad NestJS (module, controller, service, DTO, entidad y pruebas unitarias y e2e) siguiendo las convenciones de Taquillera-Backend, un proyecto ESM con Vitest. Úsala cuando se pida agregar un recurso, endpoint o módulo nuevo a la API (por ejemplo eventos, funciones o compras).
license: MIT
metadata:
  author: Abilson Rivera Garcia y Bredman Estiven Velez Cortez
  version: "1.1.0"
  based-on: anthropics/skills template-skill
---

# Módulo NestJS para Taquillera-Backend

Guía para crear un módulo de funcionalidad completo. Trabaja solo dentro de `src/` y `test/`; no instala dependencias ni ejecuta nada fuera de los scripts de `package.json`.

## 1. Archivos que se crean

Para un recurso `<nombre>` en plural y en español (ej. `eventos`):

```
src/<nombre>/
  <nombre>.module.ts
  <nombre>.controller.ts
  <nombre>.service.ts
  <nombre>.controller.spec.ts
  <nombre>.service.spec.ts
  entities/<singular>.entity.ts
  dto/                     solo si el endpoint recibe un cuerpo (POST/PATCH)
test/<nombre>.e2e-spec.ts
```

Y se modifica `src/app.module.ts` para agregar el módulo en `imports`.

## 2. Reglas que no se pueden olvidar

1. **Imports relativos con `.js`** (el proyecto es ESM con `module: nodenext`):
   `import { EventosService } from './eventos.service.js';`
2. **Vitest, no Jest**: `describe/it/expect` son globales; para mocks usa `vi.fn()`.
3. El controlador solo traduce HTTP ↔ servicio. La lógica y los datos viven en el servicio.
4. Parámetros numéricos con `ParseIntPipe`; recurso inexistente → `throw new NotFoundException(\`... ${id} no existe\`)`.
5. Mientras no haya base de datos, los datos son un arreglo `private readonly` en el servicio, y los métodos devuelven copias o elementos, nunca el arreglo mutable.
6. **Las interfaces y tipos se importan con `import type`** (`import type { Evento } from ...`). Con `isolatedModules` + `emitDecoratorMetadata`, un tipo usado en la firma de un método decorado (`@Get`, `@Param`) con import normal rompe `npm run build` (error TS1272), aunque lint y pruebas pasen.

## 3. Plantillas

### Entidad

```ts
export interface Evento {
  id: number;
  titulo: string;
  // ...campos del dominio
}
```

### Servicio

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Evento } from './entities/evento.entity.js';

@Injectable()
export class EventosService {
  private readonly eventos: Evento[] = [
    /* datos de ejemplo */
  ];

  findAll(): Evento[] {
    return [...this.eventos];
  }

  findOne(id: number): Evento {
    const evento = this.eventos.find((p) => p.id === id);
    if (!evento) {
      throw new NotFoundException(`El evento ${id} no existe`);
    }
    return evento;
  }
}
```

### Controlador

```ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { EventosService } from './eventos.service.js';
import type { Evento } from './entities/evento.entity.js';

@Controller('eventos')
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  @Get()
  findAll(): Evento[] {
    return this.eventosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Evento {
    return this.eventosService.findOne(id);
  }
}
```

### Módulo

```ts
import { Module } from '@nestjs/common';
import { EventosController } from './eventos.controller.js';
import { EventosService } from './eventos.service.js';

@Module({
  controllers: [EventosController],
  providers: [EventosService],
  exports: [EventosService], // solo si otro módulo lo necesita
})
export class EventosModule {}
```

### Prueba unitaria del servicio

```ts
import { NotFoundException } from '@nestjs/common';
import { EventosService } from './eventos.service.js';

describe('EventosService', () => {
  let service: EventosService;

  beforeEach(() => {
    service = new EventosService();
  });

  it('findAll devuelve la cartelera', () => {
    expect(service.findAll().length).toBeGreaterThan(0);
  });

  it('findOne lanza NotFoundException si el id no existe', () => {
    expect(() => service.findOne(9999)).toThrow(NotFoundException);
  });
});
```

### Prueba e2e

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Eventos (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /eventos responde 200 con un arreglo', async () => {
    const res = await request(app.getHttpServer()).get('/eventos').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /eventos/9999 responde 404', () => {
    return request(app.getHttpServer()).get('/eventos/9999').expect(404);
  });

  it('GET /eventos/abc responde 400', () => {
    return request(app.getHttpServer()).get('/eventos/abc').expect(400);
  });
});
```

## 4. Verificación final

Ejecuta en PowerShell, desde la raíz del repositorio, y corrige hasta que todo pase:

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
```

Al terminar, resume los endpoints creados con un ejemplo de respuesta.
