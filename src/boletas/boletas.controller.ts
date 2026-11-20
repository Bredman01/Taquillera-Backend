import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { BoletasService } from './boletas.service.js';
import type { Boleta } from './entities/boleta.entity.js';

@Controller('boletas')
export class BoletasController {
  constructor(private readonly boletasService: BoletasService) {}

  // El código llega tal como lo escribió quien llama: el servicio lo pasa a
  // mayúsculas. Un código con otro formato es un código que no existe (404).
  @Get(':codigo')
  findOne(@Param('codigo') codigo: string): Boleta {
    return this.boletasService.findByCodigo(codigo);
  }

  // Responde 200 y no el 201 por defecto de @Post: la validación devuelve una
  // boleta que ya existía, no crea un recurso nuevo.
  @Post(':codigo/ingreso')
  @HttpCode(200)
  validar(@Param('codigo') codigo: string): Boleta {
    return this.boletasService.validar(codigo);
  }
}
