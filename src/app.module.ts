import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PeliculasModule } from './peliculas/peliculas.module.js';

@Module({
  imports: [PeliculasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
