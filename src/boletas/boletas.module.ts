import { Module } from '@nestjs/common';
import { AsientosModule } from '../asientos/asientos.module.js';
import { ComprasModule } from '../compras/compras.module.js';
import { BoletasController } from './boletas.controller.js';
import { BoletasService } from './boletas.service.js';

// ComprasModule exporta ComprasService y el Reloj: la hora de uso sale de la
// misma instancia que la de la compra.
@Module({
  imports: [ComprasModule, AsientosModule],
  controllers: [BoletasController],
  providers: [BoletasService],
})
export class BoletasModule {}
