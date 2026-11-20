import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AsientosModule } from './asientos/asientos.module.js';
import { ComprasModule } from './compras/compras.module.js';
import { EventosModule } from './eventos/eventos.module.js';
import { FuncionesModule } from './funciones/funciones.module.js';

@Module({
  imports: [EventosModule, FuncionesModule, AsientosModule, ComprasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
