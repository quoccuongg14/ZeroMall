import { ConflictException, Injectable, UnauthorizedException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email đã tồn tại trong hệ thống');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // Create user and auto-create shop if the user is SHOP_OWNER
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: passwordHash,
          name: dto.name,
          role: dto.role,
          gender: dto.gender,
        },
      });

      if (dto.role === 'SHOP_OWNER' && dto.shopName) {
        const shop = await tx.shop.create({
          data: {
            name: dto.shopName,
            ownerId: user.id,
          },
        });
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { shopId: shop.id },
        });
        return {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            shopId: updatedUser.shopId,
          },
          shop,
        };
      }

      if (dto.role === 'SHOP_STAFF' && dto.shopId) {
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { shopId: dto.shopId },
        });
        return {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            shopId: updatedUser.shopId,
            avatar: updatedUser.avatar,
            gender: updatedUser.gender,
            birthday: updatedUser.birthday,
            phoneNumber: updatedUser.phoneNumber,
          },
        };
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          gender: user.gender,
          birthday: user.birthday,
          phoneNumber: user.phoneNumber,
        },
      };
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        ownedShop: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      shopId: user.shopId || user.ownedShop?.id || null,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        shopId: payload.shopId,
        avatar: user.avatar,
        gender: user.gender,
        birthday: user.birthday,
        phoneNumber: user.phoneNumber,
      },
    };
  }

  async getShopById(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        logo: true,
        description: true,
        responseRate: true,
        responseTime: true,
        status: true,
        blockedUntil: true,
        blockReason: true,
        email: true,
        phoneNumber: true,
        pickupAddress: true,
        shippingSettings: true,
        createdAt: true,
      },
    });
    if (!shop) {
      throw new NotFoundException(`Cửa hàng với ID ${id} không tồn tại`);
    }
    const followersCount = await this.prisma.shopFollow.count({
      where: { shopId: id },
    });
    return {
      ...shop,
      followers: followersCount,
    };
  }

  async getShopFollowStatus(shopId: string, userId?: string) {
    const count = await this.prisma.shopFollow.count({
      where: { shopId },
    });
    let isFollowing = false;
    if (userId) {
      const follow = await this.prisma.shopFollow.findUnique({
        where: {
          userId_shopId: { userId, shopId },
        },
      });
      isFollowing = !!follow;
    }
    return {
      count,
      isFollowing,
    };
  }

  async toggleFollowShop(shopId: string, userId: string) {
    const existingFollow = await this.prisma.shopFollow.findUnique({
      where: {
        userId_shopId: { userId, shopId },
      },
    });

    if (existingFollow) {
      await this.prisma.shopFollow.delete({
        where: {
          userId_shopId: { userId, shopId },
        },
      });
    } else {
      await this.prisma.shopFollow.create({
        data: {
          userId,
          shopId,
        },
      });

      // Tạo thông báo cho Shop khi có người dùng nhấn Theo dõi
      try {
        const follower = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        });
        const followerName = follower?.name || follower?.email || 'Một khách hàng';

        // Lấy thông tin Shop để gửi thông báo vào ID của Shop và ID Chủ Shop
        const shop = await this.prisma.shop.findUnique({
          where: { id: shopId },
          select: { ownerId: true, name: true },
        });

        const notifServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006';
        const targetIds = [shopId];
        if (shop?.ownerId && shop.ownerId !== shopId) {
          targetIds.push(shop.ownerId);
        }

        for (const targetId of targetIds) {
          fetch(`${notifServiceUrl}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: targetId,
              title: 'Người theo dõi mới 🎉',
              content: `Người dùng ${followerName} vừa nhấn Theo dõi shop của bạn. Hãy đăng thêm sản phẩm mới để tiếp cận khách hàng!`,
              type: 'SYSTEM',
              metadata: { action: 'VIEW_SHOP', shopId },
            }),
          }).catch((err) => console.error('Error sending follow notification:', err));
        }
      } catch (notifErr) {
        console.error('Failed to trigger follow notification:', notifErr);
      }
    }

    return this.getShopFollowStatus(shopId, userId);
  }

  async updateShopOnboarding(id: string, dto: { email: string; phoneNumber: string; pickupAddress: string; shippingSettings: string }) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
    });
    if (!shop) {
      throw new NotFoundException(`Cửa hàng với ID ${id} không tồn tại`);
    }

    return this.prisma.shop.update({
      where: { id },
      data: {
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        pickupAddress: dto.pickupAddress,
        shippingSettings: dto.shippingSettings,
        status: 'PENDING_APPROVAL',
      },
    });
  }

  async updateShopShippingSettings(id: string, shippingSettings: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
    });
    if (!shop) {
      throw new NotFoundException(`Cửa hàng với ID ${id} không tồn tại`);
    }

    return this.prisma.shop.update({
      where: { id },
      data: {
        shippingSettings,
      },
    });
  }

  async resetStorefront(
    id: string,
    operatorEmail: string,
    operatorRole: string,
    ipAddress?: string,
    reason?: string,
  ) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: { owner: true },
    });
    if (!shop) {
      throw new NotFoundException(`Cửa hàng với ID ${id} không tồn tại`);
    }

    const oldLogo = shop.logo;
    const updatedShop = await this.prisma.shop.update({
      where: { id },
      data: {
        logo: null,
      },
    });

    // Gửi thông báo đến chủ shop
    try {
      const notifServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006';
      const targetIds = [shop.id];
      if (shop.ownerId && shop.ownerId !== shop.id) {
        targetIds.push(shop.ownerId);
      }

      for (const targetId of targetIds) {
        fetch(`${notifServiceUrl}/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetId,
            title: 'Cảnh báo vi phạm giao diện Shop ⚠️',
            content: reason
              ? `Giao diện / banner của Shop đã bị gỡ bỏ do vi phạm quy định sàn: "${reason}". Vui lòng cập nhật hình ảnh đúng chuẩn.`
              : 'Giao diện / banner trang trí của Shop đã bị Ban Quản Trị cưỡng chế gỡ bỏ do vi phạm tiêu chuẩn cộng đồng. Vui lòng cập nhật hình ảnh đúng quy định.',
            type: 'SYSTEM',
            metadata: { action: 'RESET_STOREFRONT', shopId: id },
          }),
        }).catch((err) => console.error('Error sending reset storefront notification:', err));
      }
    } catch (err) {
      console.error('Notification trigger error:', err);
    }

    // Ghi vết vào AuditLog
    const roleLabel = operatorRole === 'PLATFORM_SUPPORT' ? 'CSKH' : 'Admin';
    await this.createAuditLog(
      operatorEmail || 'admin@zeromall.com',
      `[CƯỠNG CHẾ GỠ BANNER SHOP] ${roleLabel} đã cưỡng chế gỡ giao diện & banner vi phạm của Shop "${shop.name}" (Mã: ${shop.id})${reason ? `. Lý do: ${reason}` : ''}`,
      'MARKETING',
      'DELETE',
      shop.id,
      shop.name,
      ipAddress || '127.0.0.1',
      JSON.stringify({
        action: 'RESET_STOREFRONT',
        previousLogo: oldLogo,
        operatorRole,
        reason,
      }),
    );

    return updatedShop;
  }

  async impersonateShop(
    shopId: string,
    operatorEmail: string,
    operatorRole: string,
    ipAddress?: string,
  ) {
    if (operatorRole !== 'ADMIN' && operatorRole !== 'PLATFORM_SUPPORT') {
      throw new UnauthorizedException('Bạn không có quyền truy cập đại diện Shop');
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: { owner: true },
    });

    if (!shop) {
      throw new NotFoundException(`Cửa hàng với ID ${shopId} không tồn tại`);
    }

    const isReadOnly = operatorRole === 'PLATFORM_SUPPORT';
    const roleLabel = isReadOnly ? 'CSKH' : 'Admin';

    // Ghi vết vào AuditLog
    await this.createAuditLog(
      operatorEmail || 'admin@zeromall.com',
      `[ĐĂNG NHẬP ĐẠI DIỆN SHOP] ${roleLabel} đã truy cập Kênh Người Bán của Shop "${shop.name}" (Chế độ: ${isReadOnly ? 'Chỉ Xem' : 'Toàn Quyền'})`,
      'SECURITY',
      'IMPERSONATE',
      shop.id,
      shop.name,
      ipAddress || '127.0.0.1',
      JSON.stringify({
        impersonatedShopId: shop.id,
        shopOwnerEmail: shop.owner?.email,
        isReadOnly,
        operatorRole,
      }),
    );

    // Tạo JWT token với thông tin đại diện
    const payload = {
      sub: shop.owner?.id || shop.id,
      email: shop.owner?.email || shop.email || 'seller@zeromall.com',
      name: shop.owner?.name || shop.name,
      role: 'SHOP_OWNER',
      shopId: shop.id,
      isImpersonated: true,
      impersonatedBy: operatorEmail,
      impersonatedByRole: operatorRole,
      isReadOnly,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: shop.owner?.id || shop.id,
        email: shop.owner?.email || shop.email || 'seller@zeromall.com',
        name: shop.owner?.name || shop.name,
        role: 'SHOP_OWNER',
        shopId: shop.id,
        isImpersonated: true,
        impersonatedBy: operatorEmail,
        impersonatedByRole: operatorRole,
        isReadOnly,
      },
      shop: {
        id: shop.id,
        name: shop.name,
        status: shop.status,
      },
    };
  }

  async approveShop(
    id: string,
    status: string,
    blockedUntil?: string | null,
    blockReason?: string | null,
    operatorEmail?: string,
    operatorRole?: string,
    ipAddress?: string,
  ) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
    });
    if (!shop) {
      throw new NotFoundException(`Cửa hàng với ID ${id} không tồn tại`);
    }

    const validStatuses = ['APPROVED', 'REJECTED', 'BLOCKED', 'PENDING_APPROVAL'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Trạng thái phê duyệt không hợp lệ');
    }

    let finalBlockedUntil = blockedUntil ? new Date(blockedUntil) : null;
    if (operatorRole === 'PLATFORM_SUPPORT' && status === 'BLOCKED') {
      const max24h = new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 1000);
      if (!finalBlockedUntil || finalBlockedUntil.getTime() > max24h.getTime()) {
        finalBlockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      if (!blockReason || blockReason.trim().length < 10) {
        throw new BadRequestException('CSKH bắt buộc nhập biên bản lý do tạm khóa khẩn cấp');
      }
    }

    const dataToUpdate: any = { status };
    if (status === 'BLOCKED') {
      dataToUpdate.blockedUntil = finalBlockedUntil;
      dataToUpdate.blockReason = blockReason || 'Vi phạm điều khoản hoạt động ZeroMall';
    } else if (status === 'APPROVED') {
      dataToUpdate.blockedUntil = null;
      dataToUpdate.blockReason = null;
    }

    const updatedShop = await this.prisma.shop.update({
      where: { id },
      data: dataToUpdate,
    });

    if (status === 'APPROVED') {
      await this.prisma.user.updateMany({
        where: { id: shop.ownerId },
        data: { shopId: shop.id },
      });
    }

    // Ghi vết vào AuditLog nếu có thông tin người thao tác
    if (operatorEmail) {
      const roleName = operatorRole === 'PLATFORM_SUPPORT' ? 'CSKH' : 'Admin';
      let actionLog = '';
      let actType = 'UPDATE';
      if (status === 'BLOCKED') {
        actType = 'SUSPEND';
        const durationText = finalBlockedUntil
          ? `Thời hạn: ${Math.round((finalBlockedUntil.getTime() - Date.now()) / (1000 * 60 * 60))} giờ`
          : 'Khóa vĩnh viễn';
        actionLog = `[KHÓA SHOP] ${roleName} ${operatorEmail} đã khóa cửa hàng "${shop.name}" (Mã: ${shop.id}, ${durationText}, Lý do: ${blockReason || 'Vi phạm tiêu chuẩn sàn'})`;
      } else if (status === 'APPROVED') {
        actType = 'APPROVE';
        actionLog = `[MỞ KHÓA SHOP] ${roleName} ${operatorEmail} đã kích hoạt mở khóa hoạt động cho cửa hàng "${shop.name}" (Mã: ${shop.id})`;
      } else {
        actionLog = `[CẬP NHẬT TRẠNG THÁI SHOP] ${roleName} ${operatorEmail} đã đổi trạng thái shop "${shop.name}" thành ${status}`;
      }

      await this.createAuditLog(
        operatorEmail,
        actionLog,
        'SHOPS',
        actType,
        shop.id,
        shop.name,
        ipAddress || '127.0.0.1',
        JSON.stringify({
          status,
          blockedUntil: finalBlockedUntil,
          blockReason,
          operatorRole,
        }),
      );
    }

    return updatedShop;
  }

  async deleteShop(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
    });
    if (!shop) {
      throw new NotFoundException(`Cửa hàng với ID ${id} không tồn tại`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Unlink shopId from all users (staff & owner)
      await tx.user.updateMany({
        where: { shopId: id },
        data: { shopId: null },
      });

      // 2. Delete shop followers
      await tx.shopFollow.deleteMany({
        where: { shopId: id },
      });

      // 3. Delete the shop record
      await tx.shop.delete({
        where: { id },
      });

      return { success: true, message: `Đã xóa thành công cửa hàng "${shop.name}"` };
    });
  }

  async getShops(status?: string) {
    const where = status ? { status } : {};
    return this.prisma.shop.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUserProfile(
    id: string,
    dto: { name?: string; email?: string; phoneNumber?: string; gender?: string; birthday?: string; avatar?: string }
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Người dùng với ID ${id} không tồn tại`);
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        gender: true,
        birthday: true,
        phoneNumber: true,
      }
    });
  }

  async changeUserPassword(id: string, dto: { currentPassword?: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (dto.currentPassword) {
      const isValid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isValid) {
        throw new BadRequestException('Mật khẩu hiện tại không chính xác!');
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id },
      data: { password: passwordHash },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }

  async getAllUsers(scope?: string, role?: string) {
    const where: any = {};
    if (scope === 'marketplace') {
      where.role = { in: ['BUYER', 'SHOP_OWNER', 'SELLER'] };
    } else if (scope === 'logistics') {
      where.role = { in: ['DRIVER', 'HUB_OPERATOR', 'LOGISTICS_OPERATOR'] };
    } else if (role) {
      where.role = role;
    }

    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateUserStatus(id: string, status: string, blockedUntil?: string | null, blockReason?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`Người dùng với ID ${id} không tồn tại`);
    }

    if (user.role === 'ADMIN' && status === 'BLOCKED') {
      throw new BadRequestException('Không thể khóa tài khoản Quản trị viên (ADMIN)');
    }

    if (['DRIVER', 'HUB_OPERATOR', 'LOGISTICS_OPERATOR'].includes(user.role) && status === 'BLOCKED') {
      throw new ForbiddenException('Tài khoản Vận chuyển/Bưu cục không thuộc thẩm quyền xử lý của CSKH Sàn. Vui lòng xử lý tại Cổng Điều Hành Logistics.');
    }

    const dataToUpdate: any = { status };
    if (status === 'BLOCKED') {
      dataToUpdate.blockedUntil = blockedUntil ? new Date(blockedUntil) : null;
      dataToUpdate.blockReason = blockReason || 'Vi phạm điều khoản cộng đồng ZeroMall';
    } else if (status === 'ACTIVE') {
      dataToUpdate.blockedUntil = null;
      dataToUpdate.blockReason = null;
    }

    return this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ownedShop: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`Người dùng với ID ${id} không tồn tại`);
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('Không thể xóa tài khoản Quản trị viên (ADMIN)');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. If user owns a shop, unlink staff and delete follows & shop
      if (user.ownedShop) {
        await tx.user.updateMany({
          where: { shopId: user.ownedShop.id },
          data: { shopId: null },
        });
        await tx.shopFollow.deleteMany({
          where: { shopId: user.ownedShop.id },
        });
        await tx.shop.delete({
          where: { id: user.ownedShop.id },
        });
      }

      // 2. Delete user follows
      await tx.shopFollow.deleteMany({
        where: { userId: id },
      });

      // 3. Delete addresses
      await tx.userAddress.deleteMany({
        where: { userId: id },
      });

      // 4. Delete user
      await tx.user.delete({
        where: { id },
      });

      return { success: true, message: `Đã xóa thành công tài khoản "${user.email}"` };
    });
  }

  async getCsStaff() {
    return this.prisma.user.findMany({
      where: { role: 'PLATFORM_SUPPORT' },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createCsStaff(dto: any) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });
    if (existingUser) {
      throw new ConflictException('Email đã tồn tại trong hệ thống');
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        password: passwordHash,
        name: dto.name,
        role: 'PLATFORM_SUPPORT',
        status: 'ACTIVE'
      }
    });
  }

  async getAuditLogs(module?: string, search?: string) {
    const where: any = {};
    if (module && module !== 'ALL') {
      where.module = module;
    }
    if (search && search.trim()) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { user: { contains: search, mode: 'insensitive' } },
        { targetId: { contains: search, mode: 'insensitive' } },
        { targetName: { contains: search, mode: 'insensitive' } },
      ];
    }

    return (this.prisma as any).auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }

  async createAuditLog(
    user: string,
    action: string,
    module?: string,
    actionType?: string,
    targetId?: string,
    targetName?: string,
    ipAddress?: string,
    metadata?: string,
  ) {
    let effectiveModule = module || 'SYSTEM';
    let effectiveType = actionType || 'UPDATE';

    if (!module) {
      const actLower = (action || '').toLowerCase();
      if (actLower.includes('đơn hàng') || actLower.includes('giao hàng') || actLower.includes('bưu cục') || actLower.includes('tài xế')) {
        effectiveModule = 'ORDERS';
      } else if (actLower.includes('rút tiền') || actLower.includes('chiết khấu') || actLower.includes('ví') || actLower.includes('hoàn tiền')) {
        effectiveModule = 'FINANCE';
      } else if (actLower.includes('sản phẩm') || actLower.includes('ngành hàng') || actLower.includes('vi phạm')) {
        effectiveModule = 'PRODUCTS';
      } else if (actLower.includes('cửa hàng') || actLower.includes('shop')) {
        effectiveModule = 'SHOPS';
      } else if (actLower.includes('tài khoản') || actLower.includes('người dùng') || actLower.includes('user')) {
        effectiveModule = 'USERS';
      } else if (actLower.includes('banner') || actLower.includes('voucher') || actLower.includes('flash sale')) {
        effectiveModule = 'MARKETING';
      } else if (actLower.includes('cskh') || actLower.includes('bảo mật') || actLower.includes('xuất báo cáo') || actLower.includes('phân quyền')) {
        effectiveModule = 'SECURITY';
      }
    }

    if (!actionType) {
      const actLower = (action || '').toLowerCase();
      if (actLower.includes('tạo') || actLower.includes('thêm') || actLower.includes('đăng ký')) {
        effectiveType = 'CREATE';
      } else if (actLower.includes('phê duyệt') || actLower.includes('kích hoạt') || actLower.includes('chấp nhận')) {
        effectiveType = 'APPROVE';
      } else if (actLower.includes('mở khóa')) {
        effectiveType = 'UNLOCK';
      } else if (actLower.includes('khóa') || actLower.includes('tạm ngưng')) {
        effectiveType = 'LOCK';
      } else if (actLower.includes('xóa')) {
        effectiveType = 'DELETE';
      } else if (actLower.includes('từ chối')) {
        effectiveType = 'REJECT';
      } else if (actLower.includes('xuất')) {
        effectiveType = 'SECURITY';
      }
    }

    return (this.prisma as any).auditLog.create({
      data: {
        user,
        action,
        module: effectiveModule,
        actionType: effectiveType,
        targetId: targetId || null,
        targetName: targetName || null,
        ipAddress: ipAddress || '127.0.0.1',
        metadata: metadata || null,
      },
    });
  }

  // Quản lý địa chỉ giao hàng của người dùng (User Addresses)
  async getUserAddresses(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createUserAddress(userId: string, dto: {
    name: string;
    phone: string;
    region: string;
    details: string;
    isDefault?: boolean;
    lat?: number;
    lng?: number;
    ghnDistrictId?: number;
    ghnWardCode?: string;
  }) {
    const count = await this.prisma.userAddress.count({ where: { userId } });
    const shouldBeDefault = dto.isDefault ?? (count === 0);

    return this.prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.userAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.create({
        data: {
          userId,
          name: dto.name,
          phone: dto.phone,
          region: dto.region,
          details: dto.details,
          isDefault: shouldBeDefault,
          lat: dto.lat,
          lng: dto.lng,
          ghnDistrictId: dto.ghnDistrictId,
          ghnWardCode: dto.ghnWardCode,
        },
      });
    });
  }

  async updateUserAddress(userId: string, addressId: string, dto: {
    name?: string;
    phone?: string;
    region?: string;
    details?: string;
    isDefault?: boolean;
    lat?: number;
    lng?: number;
    ghnDistrictId?: number;
    ghnWardCode?: string;
  }) {
    const existing = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy địa chỉ');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.update({
        where: { id: addressId },
        data: {
          ...dto,
        },
      });
    });
  }

  async deleteUserAddress(userId: string, addressId: string) {
    const existing = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy địa chỉ');

    await this.prisma.userAddress.delete({ where: { id: addressId } });

    // Nếu xóa địa chỉ mặc định, tự động gán địa chỉ mới nhất làm mặc định
    if (existing.isDefault) {
      const next = await this.prisma.userAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await this.prisma.userAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return { success: true };
  }

  async setDefaultUserAddress(userId: string, addressId: string) {
    const existing = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy địa chỉ');

    await this.prisma.$transaction([
      this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prisma.userAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      }),
    ]);

    return { success: true };
  }

  // ==========================================
  // SHOP PROFILE UPDATE REQUEST & APPROVAL (CSKH Xét Duyệt)
  // ==========================================
  async createShopUpdateRequest(shopId: string, newData: any, reason?: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
    });
    if (!shop) {
      throw new NotFoundException(`Cửa hàng với ID ${shopId} không tồn tại`);
    }

    const oldData = {
      name: shop.name,
      logo: shop.logo || '',
      description: shop.description || '',
      phoneNumber: shop.phoneNumber || '',
      email: shop.email || '',
      pickupAddress: shop.pickupAddress || '',
    };

    // Kiểm tra xem shop đã có request đang chờ duyệt (PENDING) chưa
    const existingPending = await this.prisma.shopUpdateRequest.findFirst({
      where: { shopId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPending) {
      // Cập nhật lại yêu cầu đang chờ
      return this.prisma.shopUpdateRequest.update({
        where: { id: existingPending.id },
        data: {
          newData: newData || {},
          reason: reason || existingPending.reason,
          updatedAt: new Date(),
        },
      });
    }

    // Tạo yêu cầu mới
    return this.prisma.shopUpdateRequest.create({
      data: {
        shopId,
        oldData,
        newData: newData || {},
        reason: reason || 'Cập nhật thông tin cửa hàng',
        status: 'PENDING',
      },
    });
  }

  async getShopLatestUpdateRequest(shopId: string) {
    return this.prisma.shopUpdateRequest.findFirst({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getShopUpdateHistory(shopId: string) {
    return this.prisma.shopUpdateRequest.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async cancelShopUpdateRequest(shopId: string) {
    const pendingReq = await this.prisma.shopUpdateRequest.findFirst({
      where: { shopId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!pendingReq) {
      throw new NotFoundException('Không có yêu cầu cập nhật nào đang chờ duyệt để hủy');
    }

    return this.prisma.shopUpdateRequest.update({
      where: { id: pendingReq.id },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  async getShopUpdateRequests(status?: string, search?: string) {
    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search && search.trim()) {
      where.shop = {
        name: { contains: search.trim(), mode: 'insensitive' },
      };
    }

    return this.prisma.shopUpdateRequest.findMany({
      where,
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
            status: true,
            email: true,
            phoneNumber: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewShopUpdateRequest(
    requestId: string,
    action: 'APPROVE' | 'REJECT',
    rejectionReason?: string,
    operatorEmail?: string,
    operatorRole?: string,
    clientIp?: string,
  ) {
    const req = await this.prisma.shopUpdateRequest.findUnique({
      where: { id: requestId },
      include: { shop: true },
    });
    if (!req) {
      throw new NotFoundException(`Không tìm thấy yêu cầu cập nhật với ID ${requestId}`);
    }

    if (req.status !== 'PENDING') {
      throw new BadRequestException(`Yêu cầu này đã được xử lý trước đó với trạng thái ${req.status}`);
    }

    const reviewedAt = new Date();
    const reviewer = operatorEmail || 'CSKH ZeroMall';

    if (action === 'APPROVE') {
      const newData: any = req.newData || {};
      const updateData: any = {};

      if (newData.name && typeof newData.name === 'string' && newData.name.trim()) {
        updateData.name = newData.name.trim();
      }
      if (newData.logo !== undefined) {
        updateData.logo = newData.logo;
      }
      if (newData.description !== undefined) {
        updateData.description = newData.description;
      }
      if (newData.phoneNumber !== undefined) {
        updateData.phoneNumber = newData.phoneNumber;
      }
      if (newData.email !== undefined) {
        updateData.email = newData.email;
      }
      if (newData.pickupAddress !== undefined) {
        updateData.pickupAddress = typeof newData.pickupAddress === 'string' 
          ? newData.pickupAddress 
          : JSON.stringify(newData.pickupAddress);
      }

      // Cập nhật thông tin vào bảng Shop
      const updatedShop = await this.prisma.shop.update({
        where: { id: req.shopId },
        data: updateData,
      });

      // Cập nhật trạng thái Request
      const updatedReq = await this.prisma.shopUpdateRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewer,
          reviewedAt,
        },
      });

      // Ghi AuditLog
      try {
        await this.prisma.auditLog.create({
          data: {
            user: reviewer,
            action: `CSKH đã phê duyệt thay đổi thông tin cửa hàng: ${req.shop.name} -> ${updatedShop.name}`,
            module: 'SHOP_MANAGEMENT',
            actionType: 'APPROVE_PROFILE_UPDATE',
            targetId: req.shopId,
            targetName: updatedShop.name,
            ipAddress: clientIp || '127.0.0.1',
            metadata: JSON.stringify({
              requestId,
              oldData: req.oldData,
              newData: req.newData,
              operatorRole: operatorRole || 'PLATFORM_SUPPORT',
            }),
          },
        });
      } catch (logErr) {
        console.error('Failed to log audit review shop profile:', logErr);
      }

      return { success: true, status: 'APPROVED', shop: updatedShop, request: updatedReq };
    } else {
      // Từ chối (REJECT)
      const reason = rejectionReason || 'Thông tin thay đổi chưa đáp ứng tiêu chuẩn của sàn ZeroMall';
      const updatedReq = await this.prisma.shopUpdateRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedBy: reviewer,
          reviewedAt,
        },
      });

      // Ghi AuditLog
      try {
        await this.prisma.auditLog.create({
          data: {
            user: reviewer,
            action: `CSKH từ chối yêu cầu thay đổi thông tin cửa hàng: ${req.shop.name}. Lý do: ${reason}`,
            module: 'SHOP_MANAGEMENT',
            actionType: 'REJECT_PROFILE_UPDATE',
            targetId: req.shopId,
            targetName: req.shop.name,
            ipAddress: clientIp || '127.0.0.1',
            metadata: JSON.stringify({
              requestId,
              reason,
              operatorRole: operatorRole || 'PLATFORM_SUPPORT',
            }),
          },
        });
      } catch (logErr) {
        console.error('Failed to log audit reject shop profile:', logErr);
      }

      return { success: true, status: 'REJECTED', request: updatedReq };
    }
  }

  // ==========================================
  // LOGISTICS HUBS & DRIVERS ACCOUNT PROVISIONING
  // ==========================================
  async upsertHubOperator(dto: {
    email: string;
    password?: string;
    name: string;
    hubId: string;
    role?: string;
  }) {
    const cleanEmail = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    let passwordHash: string | undefined;
    if (dto.password && dto.password.trim()) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(dto.password.trim(), salt);
    }

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          role: dto.role || 'HUB_OPERATOR',
          hubId: dto.hubId,
          status: 'ACTIVE',
          ...(passwordHash && { password: passwordHash }),
        },
      });
    }

    const salt = await bcrypt.genSalt(10);
    const pwd = passwordHash || (await bcrypt.hash('123456', salt));

    return this.prisma.user.create({
      data: {
        email: cleanEmail,
        password: pwd,
        name: dto.name,
        role: dto.role || 'HUB_OPERATOR',
        hubId: dto.hubId,
        status: 'ACTIVE',
      },
    });
  }

  async upsertDriverUser(dto: {
    email: string;
    password?: string;
    name: string;
    phoneNumber?: string;
    hubId?: string;
  }) {
    const cleanEmail = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    let passwordHash: string | undefined;
    if (dto.password && dto.password.trim()) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(dto.password.trim(), salt);
    }

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          role: 'DRIVER',
          phoneNumber: dto.phoneNumber,
          hubId: dto.hubId,
          status: 'ACTIVE',
          ...(passwordHash && { password: passwordHash }),
        },
      });
    }

    const salt = await bcrypt.genSalt(10);
    const pwd = passwordHash || (await bcrypt.hash('123456', salt));

    return this.prisma.user.create({
      data: {
        email: cleanEmail,
        password: pwd,
        name: dto.name,
        role: 'DRIVER',
        phoneNumber: dto.phoneNumber,
        hubId: dto.hubId,
        status: 'ACTIVE',
      },
    });
  }
}
