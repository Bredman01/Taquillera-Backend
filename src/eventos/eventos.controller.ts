import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { EventosService } from './eventos.service.js';
import type { Evento } from './entities/evento.entity.js';
import type { Funcion } from '../funciones/entities/funcion.entity.js';

@Controller('eventos')
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  @Get()
  findAll(
    @Query('categoria') categoria?: string | string[],
    @Query('ciudad') ciudad?: string | string[],
    @Query('fecha') fecha?: string | string[],
  ): Evento[] {
    return this.eventosService.findAll({ categoria, ciudad, fecha });
  }

  // Se declara antes que ':id': si no, ParseIntPipe respondería 400 a «ciudades».
  @Get('ciudades')
  findCiudades(): string[] {
    return this.eventosService.findCiudades();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Evento {
    return this.eventosService.findOne(id);
  }

  @Get(':id/funciones')
  findFunciones(@Param('id', ParseIntPipe) id: number): Funcion[] {
    return this.eventosService.findFunciones(id);
  }
}
