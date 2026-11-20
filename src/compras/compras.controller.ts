import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ComprasService } from './compras.service.js';
import type { CompraCreada } from './entities/compra.entity.js';

@Controller('funciones')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  // Responde 201, el código por defecto de @Post. El cuerpo llega sin validar:
  // el servicio lo valida.
  @Post(':id/compras')
  crear(
    @Param('id', ParseIntPipe) id: number,
    @Body() cuerpo: unknown,
  ): CompraCreada {
    return this.comprasService.crear(id, cuerpo);
  }
}
