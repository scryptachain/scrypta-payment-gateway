import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LyraModule } from './routes/lyra/lyra.module';
import { GatewayModule } from './routes/gateway/gateway.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    LyraModule,
    GatewayModule,
    ConfigModule.forRoot()
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}