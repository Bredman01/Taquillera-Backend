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
