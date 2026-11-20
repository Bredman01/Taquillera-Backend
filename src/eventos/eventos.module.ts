import { Module } from '@nestjs/common';
import { FuncionesModule } from '../funciones/funciones.module.js';
import { EventosController } from './eventos.controller.js';
import { EventosService } from './eventos.service.js';

@Module({
  imports: [FuncionesModule],
  controllers: [EventosController],
  providers: [EventosService],
  exports: [EventosService],
})
export class EventosModule {}
