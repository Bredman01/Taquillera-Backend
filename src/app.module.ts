import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { EventosModule } from './eventos/eventos.module.js';
import { FuncionesModule } from './funciones/funciones.module.js';

@Module({
  imports: [EventosModule, FuncionesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
