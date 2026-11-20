import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { AsientosService } from './asientos.service.js';
import type { Asiento } from './entities/asiento.entity.js';
import type { FuncionConEvento } from './entities/funcion-con-evento.entity.js';

@Controller('funciones')
export class AsientosController {
  constructor(private readonly asientosService: AsientosService) {}

  @Get(':id')
  findFuncion(@Param('id', ParseIntPipe) id: number): FuncionConEvento {
    return this.asientosService.findFuncion(id);
  }

  @Get(':id/asientos')
  findAsientos(@Param('id', ParseIntPipe) id: number): Asiento[] {
    return this.asientosService.findAsientos(id);
  }
}
