import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentUserGuard } from './current-user.guard';
import { AuthController } from './auth.controller';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AuthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CurrentUserGuard,
    },
  ],
})
export class AuthModule {}
