import { Module } from '@nestjs/common';
import { AsientosModule } from '../asientos/asientos.module.js';
import { FuncionesModule } from '../funciones/funciones.module.js';
import { ComprasController } from './compras.controller.js';
import { ComprasService } from './compras.service.js';
import { GeneradorCodigo } from './generador-codigo.js';
import { Reloj } from './reloj.js';

@Module({
  imports: [FuncionesModule, AsientosModule],
  controllers: [ComprasController],
  providers: [ComprasService, GeneradorCodigo, Reloj],
  exports: [ComprasService, Reloj],
})
export class ComprasModule {}
