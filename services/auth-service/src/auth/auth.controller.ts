import { Body, Controller, Get, Post, Put, Delete, Patch, UseGuards, Request, Param, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, SendOtpDto, ResetPasswordDto, GoogleAuthDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Put('shops/:id/onboarding')
  async updateOnboarding(
    @Param('id') id: string,
    @Body() dto: { email: string; phoneNumber: string; pickupAddress: string; shippingSettings: string }
  ) {
    return this.authService.updateShopOnboarding(id, dto);
  }

  @Put('shops/:id/shipping-settings')
  async updateShippingSettings(
    @Param('id') id: string,
    @Body() body: { shippingSettings: string }
  ) {
    return this.authService.updateShopShippingSettings(id, body.shippingSettings);
  }

  @Put('shops/:id/approve')
  async approveShop(
    @Param('id') id: string,
    @Body()
    body: {
      status: string;
      blockedUntil?: string | null;
      blockReason?: string | null;
      operatorEmail?: string;
      operatorRole?: string;
      ipAddress?: string;
    },
    @Request() req,
  ) {
    const clientIp = body.ipAddress || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    return this.authService.approveShop(
      id,
      body.status,
      body.blockedUntil,
      body.blockReason,
      body.operatorEmail,
      body.operatorRole,
      clientIp,
    );
  }

  @Put('shops/:id/reset-storefront')
  async resetStorefront(
    @Param('id') id: string,
    @Body()
    body: {
      operatorEmail?: string;
      operatorRole?: string;
      reason?: string;
      ipAddress?: string;
    },
    @Request() req,
  ) {
    const clientIp = body.ipAddress || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    return this.authService.resetStorefront(
      id,
      body.operatorEmail || 'admin@zeromall.com',
      body.operatorRole || 'ADMIN',
      clientIp,
      body.reason,
    );
  }

  @Post('admin/impersonate-shop/:id')
  async impersonateShop(
    @Param('id') id: string,
    @Body()
    body: {
      operatorEmail?: string;
      operatorRole?: string;
      ipAddress?: string;
    },
    @Request() req,
  ) {
    const clientIp = body.ipAddress || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    return this.authService.impersonateShop(
      id,
      body.operatorEmail || 'admin@zeromall.com',
      body.operatorRole || 'ADMIN',
      clientIp,
    );
  }

  @Delete('shops/:id')
  async deleteShop(@Param('id') id: string) {
    return this.authService.deleteShop(id);
  }

  @Get('shops')
  async getShops(@Query('status') status?: string) {
    return this.authService.getShops(status);
  }

  @Post('send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Request() req) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    return this.authService.login(dto, String(clientIp));
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('google')
  async loginWithGoogle(@Body() dto: GoogleAuthDto, @Request() req) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    return this.authService.loginWithGoogle(dto, String(clientIp));
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req) {
    return req.user;
  }

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getAdminOnlyData() {
    return {
      message: 'Chào mừng Admin! Đây là dữ liệu bảo mật của hệ thống ZeroMall.',
    };
  }

  @Get('shop-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_OWNER', 'SHOP_STAFF')
  getShopData(@Request() req) {
    return {
      message: 'Chào mừng thành viên cửa hàng! Quyền truy cập hợp lệ.',
      user: req.user,
    };
  }

  @Get('shops/:id')
  async getShop(@Param('id') id: string) {
    return this.authService.getShopById(id);
  }

  @Get('shops/:id/follow-status')
  async getShopFollowStatus(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.authService.getShopFollowStatus(id, userId);
  }

  @Post('shops/:id/follow')
  async toggleFollowShop(@Param('id') id: string, @Body('userId') userId: string) {
    return this.authService.toggleFollowShop(id, userId);
  }

  @Put('users/:id')
  async updateUserProfile(
    @Param('id') id: string,
    @Body() dto: { name?: string; email?: string; phoneNumber?: string; gender?: string; birthday?: string; avatar?: string }
  ) {
    return this.authService.updateUserProfile(id, dto);
  }

  @Put('users/:id/password')
  async changePassword(
    @Param('id') id: string,
    @Body() dto: { currentPassword?: string; newPassword: string }
  ) {
    return this.authService.changeUserPassword(id, dto);
  }

  @Get('users')
  async getAllUsers(
    @Query('scope') scope?: string,
    @Query('role') role?: string,
  ) {
    return this.authService.getAllUsers(scope, role);
  }

  @Put('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() body: { status: string; blockedUntil?: string | null; blockReason?: string | null }
  ) {
    return this.authService.updateUserStatus(id, body.status, body.blockedUntil, body.blockReason);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }

  @Get('cs-staff')
  async getCsStaff() {
    return this.authService.getCsStaff();
  }

  @Post('cs-staff')
  async createCsStaff(@Body() dto: any) {
    return this.authService.createCsStaff(dto);
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('module') module?: string,
    @Query('search') search?: string,
  ) {
    return this.authService.getAuditLogs(module, search);
  }

  @Post('audit-logs')
  async createAuditLog(@Body() dto: {
    user: string;
    action: string;
    module?: string;
    actionType?: string;
    targetId?: string;
    targetName?: string;
    ipAddress?: string;
    metadata?: any;
  }) {
    const metaStr = typeof dto.metadata === 'object' ? JSON.stringify(dto.metadata) : dto.metadata;
    return this.authService.createAuditLog(
      dto.user,
      dto.action,
      dto.module,
      dto.actionType,
      dto.targetId,
      dto.targetName,
      dto.ipAddress,
      metaStr,
    );
  }

  // Quản lý địa chỉ giao hàng của người dùng (User Addresses)
  @Get('users/:userId/addresses')
  async getUserAddresses(@Param('userId') userId: string) {
    return this.authService.getUserAddresses(userId);
  }

  @Post('users/:userId/addresses')
  async createUserAddress(@Param('userId') userId: string, @Body() dto: any) {
    return this.authService.createUserAddress(userId, dto);
  }

  @Put('users/:userId/addresses/:addressId')
  async updateUserAddress(
    @Param('userId') userId: string,
    @Param('addressId') addressId: string,
    @Body() dto: any,
  ) {
    return this.authService.updateUserAddress(userId, addressId, dto);
  }

  @Delete('users/:userId/addresses/:addressId')
  async deleteUserAddress(
    @Param('userId') userId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.authService.deleteUserAddress(userId, addressId);
  }

  @Patch('users/:userId/addresses/:addressId/default')
  async setDefaultUserAddress(
    @Param('userId') userId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.authService.setDefaultUserAddress(userId, addressId);
  }

  // ==========================================
  // SHOP PROFILE UPDATE REQUEST & APPROVAL (CSKH Xét Duyệt)
  // ==========================================
  @Post('shops/:id/profile-update-request')
  async createShopUpdateRequest(
    @Param('id') id: string,
    @Body() body: { newData: any; reason?: string },
  ) {
    return this.authService.createShopUpdateRequest(id, body.newData, body.reason);
  }

  @Get('shops/:id/profile-update-request')
  async getShopLatestUpdateRequest(@Param('id') id: string) {
    return this.authService.getShopLatestUpdateRequest(id);
  }

  @Get('shops/:id/profile-update-history')
  async getShopUpdateHistory(@Param('id') id: string) {
    return this.authService.getShopUpdateHistory(id);
  }

  @Delete('shops/:id/profile-update-request')
  async cancelShopUpdateRequest(@Param('id') id: string) {
    return this.authService.cancelShopUpdateRequest(id);
  }

  @Get('shop-update-requests')
  async getShopUpdateRequests(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.authService.getShopUpdateRequests(status, search);
  }

  @Put('shop-update-requests/:id/review')
  async reviewShopUpdateRequest(
    @Param('id') id: string,
    @Body()
    body: {
      action: 'APPROVE' | 'REJECT';
      rejectionReason?: string;
      operatorEmail?: string;
      operatorRole?: string;
      ipAddress?: string;
    },
    @Request() req,
  ) {
    const clientIp = body.ipAddress || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    return this.authService.reviewShopUpdateRequest(
      id,
      body.action,
      body.rejectionReason,
      body.operatorEmail,
      body.operatorRole,
      clientIp,
    );
  }

  @Post('hub-operators/upsert')
  async upsertHubOperator(
    @Body()
    dto: {
      email: string;
      password?: string;
      name: string;
      hubId: string;
      role?: string;
    },
  ) {
    return this.authService.upsertHubOperator(dto);
  }

  @Post('drivers/upsert')
  async upsertDriverUser(
    @Body()
    dto: {
      email: string;
      password?: string;
      name: string;
      phoneNumber?: string;
      hubId?: string;
    },
  ) {
    return this.authService.upsertDriverUser(dto);
  }
}

