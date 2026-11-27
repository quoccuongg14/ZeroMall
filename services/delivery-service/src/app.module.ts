import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { ReturnDeliveryService } from './return.service';
import { RouteAccountsController } from './route-accounts.controller';
import { RouteAccountsService } from './route-accounts.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [],
  controllers: [DeliveryController, RouteAccountsController],
  providers: [DeliveryService, ReturnDeliveryService, RouteAccountsService, PrismaService],
})
export class AppModule {}
