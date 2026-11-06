---
name: nest-modulo
description: Crea un módulo de funcionalidad NestJS (module, controller, service, DTO, entidad y pruebas unitarias y e2e) siguiendo las convenciones de Taquillera-Backend, un proyecto ESM con Vitest. Úsala cuando se pida agregar un recurso, endpoint o módulo nuevo a la API (por ejemplo películas, funciones, salas o compras).
license: MIT
metadata:
  author: Abilson Rivera Garcia y Bredman Estiven Velez Cortez
  version: "1.0.1"
  based-on: anthropics/skills template-skill
---

# Módulo NestJS para Taquillera-Backend

Guía para crear un módulo de funcionalidad completo. Trabaja solo dentro de `src/` y `test/`; no instala dependencias ni ejecuta nada fuera de los scripts de `package.json`.

## 1. Archivos que se crean

Para un recurso `<nombre>` en plural y en español (ej. `peliculas`):

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
   `import { PeliculasService } from './peliculas.service.js';`
2. **Vitest, no Jest**: `describe/it/expect` son globales; para mocks usa `vi.fn()`.
3. El controlador solo traduce HTTP ↔ servicio. La lógica y los datos viven en el servicio.
4. Parámetros numéricos con `ParseIntPipe`; recurso inexistente → `throw new NotFoundException(\`... ${id} no existe\`)`.
5. Mientras no haya base de datos, los datos son un arreglo `private readonly` en el servicio, y los métodos devuelven copias o elementos, nunca el arreglo mutable.
6. **Las interfaces y tipos se importan con `import type`** (`import type { Pelicula } from ...`). Con `isolatedModules` + `emitDecoratorMetadata`, un tipo usado en la firma de un método decorado (`@Get`, `@Param`) con import normal rompe `npm run build` (error TS1272), aunque lint y pruebas pasen.

## 3. Plantillas

### Entidad

```ts
export interface Pelicula {
  id: number;
  titulo: string;
  // ...campos del dominio
}
```

### Servicio

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Pelicula } from './entities/pelicula.entity.js';

@Injectable()
export class PeliculasService {
  private readonly peliculas: Pelicula[] = [
    /* datos de ejemplo */
  ];

  findAll(): Pelicula[] {
    return [...this.peliculas];
  }

  findOne(id: number): Pelicula {
    const pelicula = this.peliculas.find((p) => p.id === id);
    if (!pelicula) {
      throw new NotFoundException(`La película ${id} no existe`);
    }
    return pelicula;
  }
}
```

### Controlador

```ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { PeliculasService } from './peliculas.service.js';
import type { Pelicula } from './entities/pelicula.entity.js';

@Controller('peliculas')
export class PeliculasController {
  constructor(private readonly peliculasService: PeliculasService) {}

  @Get()
  findAll(): Pelicula[] {
    return this.peliculasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Pelicula {
    return this.peliculasService.findOne(id);
  }
}
```

### Módulo

```ts
import { Module } from '@nestjs/common';
import { PeliculasController } from './peliculas.controller.js';
import { PeliculasService } from './peliculas.service.js';

@Module({
  controllers: [PeliculasController],
  providers: [PeliculasService],
  exports: [PeliculasService], // solo si otro módulo lo necesita
})
export class PeliculasModule {}
```

### Prueba unitaria del servicio

```ts
import { NotFoundException } from '@nestjs/common';
import { PeliculasService } from './peliculas.service.js';

describe('PeliculasService', () => {
  let service: PeliculasService;

  beforeEach(() => {
    service = new PeliculasService();
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

describe('Peliculas (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /peliculas responde 200 con un arreglo', async () => {
    const res = await request(app.getHttpServer()).get('/peliculas').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /peliculas/9999 responde 404', () => {
    return request(app.getHttpServer()).get('/peliculas/9999').expect(404);
  });

  it('GET /peliculas/abc responde 400', () => {
    return request(app.getHttpServer()).get('/peliculas/abc').expect(400);
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
