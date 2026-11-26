import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageHubModule } from '../message-hub/message-hub.module';
import { MobileDiagnosticsModule } from '../mobile-diagnostics/mobile-diagnostics.module';
import { MobileBridgeController } from './mobile-bridge.controller';
import { MobileBridgeService } from './mobile-bridge.service';
import { MobileSmsEvent } from './entities/mobile-sms-event.entity';
import { MobilePublicController } from './mobile-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MobileSmsEvent]),
    MessageHubModule,
    MobileDiagnosticsModule,
  ],
  controllers: [MobileBridgeController, MobilePublicController],
  providers: [MobileBridgeService],
  exports: [MobileBridgeService],
})
export class MobileBridgeModule {}
