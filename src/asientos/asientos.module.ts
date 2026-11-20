import { Module } from '@nestjs/common';
import { EventosModule } from '../eventos/eventos.module.js';
import { FuncionesModule } from '../funciones/funciones.module.js';
import { AsientosController } from './asientos.controller.js';
import { AsientosService } from './asientos.service.js';

@Module({
  imports: [EventosModule, FuncionesModule],
  controllers: [AsientosController],
  providers: [AsientosService],
  exports: [AsientosService],
})
export class AsientosModule {}
