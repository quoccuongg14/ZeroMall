import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { RouteAccountsService } from './route-accounts.service';

@Controller('delivery/route-accounts')
export class RouteAccountsController {
  constructor(private readonly routeAccountsService: RouteAccountsService) {}

  @Get('orders')
  async listOrders(
    @Headers('x-demo-pin') pin?: string,
    @Query('search') search?: string,
  ) {
    this.routeAccountsService.verifyPin(pin);
    return this.routeAccountsService.listRecentOrders(search);
  }

  @Get('trace/:identifier')
  async traceOrder(
    @Param('identifier') identifier: string,
    @Headers('x-demo-pin') pin?: string,
  ) {
    this.routeAccountsService.verifyPin(pin);
    return this.routeAccountsService.traceRouteAccounts(identifier);
  }
}
