import { Module } from '@nestjs/common';
import { FuncionesService } from './funciones.service.js';

@Module({
  providers: [FuncionesService],
  exports: [FuncionesService],
})
export class FuncionesModule {}
