import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateVoucherDto } from './discount.dto';

@Injectable()
export class DiscountService {
  constructor(private prisma: PrismaService) {}

  async createVoucher(shopId: string, dto: CreateVoucherDto) {
    const code = dto.code.toUpperCase().trim();

    // Validations
    if (!dto.name.trim()) {
      throw new BadRequestException('Tên chương trình không được để trống!');
    }
    if (!code || code.length < 3 || code.length > 8 || !/^[A-Z0-9]+$/.test(code)) {
      throw new BadRequestException('Mã giảm giá phải từ 3-8 ký tự viết hoa và số!');
    }
    if (dto.value <= 0) {
      throw new BadRequestException('Mức giảm giá phải lớn hơn 0!');
    }
    if (dto.type === 'percentage' && dto.value > 100) {
      throw new BadRequestException('Phần trăm giảm giá không được lớn hơn 100%!');
    }
    if (dto.minSpend < 0) {
      throw new BadRequestException('Giá trị đơn tối thiểu không được âm!');
    }
    if (dto.usageLimit <= 0) {
      throw new BadRequestException('Lượt sử dụng tối đa phải lớn hơn 0!');
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start >= end) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu!');
    }

    // Check duplicate code for this shop
    const existing = await this.prisma.voucher.findUnique({
      where: {
        shopId_code: {
          shopId,
          code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Mã giảm giá ${code} đã tồn tại trong cửa hàng của bạn!`);
    }

    return this.prisma.voucher.create({
      data: {
        shopId,
        name: dto.name.trim(),
        code,
        type: dto.type,
        value: Number(dto.value),
        minSpend: Number(dto.minSpend),
        maxDiscount: dto.type === 'percentage' && dto.maxDiscount ? Number(dto.maxDiscount) : null,
        usageLimit: Number(dto.usageLimit),
        targetUserId: dto.targetUserId ? dto.targetUserId.trim() : null,
        isClaimable: Boolean(dto.isClaimable),
        startDate: start,
        endDate: end,
      },
    });
  }

  async getShopVouchers(shopId: string) {
    if (!shopId) return [];
    return this.prisma.voucher.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveShopVouchers(shopId: string, userId?: string) {
    if (!shopId) return [];
    const now = new Date();
    const whereCondition: any = {
      shopId,
      startDate: { lte: now },
      endDate: { gte: now },
      usedCount: { lt: this.prisma.voucher.fields.usageLimit },
    };

    if (userId) {
      whereCondition.OR = [
        { targetUserId: null },
        { targetUserId: userId },
      ];
    } else {
      whereCondition.targetUserId = null;
    }

    return this.prisma.voucher.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteVoucher(id: string) {
    try {
      return await this.prisma.voucher.delete({
        where: { id },
      });
    } catch (e) {
      throw new BadRequestException('Không tìm thấy mã giảm giá để xóa.');
    }
  }

  async useVouchers(voucherIds: string[], userId?: string, orderId?: string) {
    if (!voucherIds || voucherIds.length === 0) return { success: true };

    // 1. Sắp xếp danh sách voucher ID tăng dần để triệt tiêu Deadlock (lock-deadlock-prevention.md)
    const uniqueIds = Array.from(new Set(voucherIds.filter(Boolean))).sort();
    if (uniqueIds.length === 0) return { success: true };

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      for (const id of uniqueIds) {
        // 2. Khóa dòng cấp CSDL (Pessimistic Row Lock: FOR UPDATE)
        const lockedRows: any[] = await tx.$queryRaw`
          SELECT id, name, code, "usageLimit", "usedCount", "startDate", "endDate", "targetUserId", "isClaimable"
          FROM discount."Voucher"
          WHERE id = ${id}
          FOR UPDATE
        `;

        if (!lockedRows || lockedRows.length === 0) {
          throw new BadRequestException(`Mã giảm giá không tồn tại (ID: ${id})`);
        }

        const voucher = lockedRows[0];

        // 3. Kiểm tra thời hạn hiệu lực
        if (new Date(voucher.startDate) > now) {
          throw new BadRequestException(`Mã giảm giá "${voucher.code}" chưa đến thời gian áp dụng!`);
        }
        if (new Date(voucher.endDate) < now) {
          throw new BadRequestException(`Mã giảm giá "${voucher.code}" đã hết hạn sử dụng!`);
        }

        // 4. Kiểm tra giới hạn số lượt sử dụng
        if (voucher.usedCount >= voucher.usageLimit) {
          throw new BadRequestException(
            `Mã giảm giá "${voucher.code}" đã đạt giới hạn tối đa (${voucher.usageLimit} lượt) và không thể áp dụng thêm!`
          );
        }

        // 5. Kiểm tra người dùng đích (nếu là voucher cấp riêng)
        if (voucher.targetUserId && userId && voucher.targetUserId !== userId) {
          throw new BadRequestException(`Mã giảm giá "${voucher.code}" không áp dụng cho tài khoản của bạn!`);
        }

        // 5.1 Kiểm tra voucher giờ vàng (isClaimable): Bắt buộc người dùng phải bấm Lưu vào Ví trước
        if (voucher.isClaimable && userId) {
          const claimed = await tx.userVoucherWallet.findUnique({
            where: {
              userId_voucherId: {
                userId,
                voucherId: id,
              },
            },
          });
          if (!claimed) {
            throw new BadRequestException(
              `Mã giảm giá "${voucher.code}" là mã Khung Giờ Vàng FCFS. Bạn cần bấm "Lưu Vào Ví" trước khi thanh toán!`
            );
          }
        }

        // 6. Kiểm tra xem người dùng đã từng sử dụng voucher này chưa (nếu có userId)
        if (userId) {
          const prevUsage = await tx.voucherUsage.findFirst({
            where: { voucherId: id, userId },
          });
          if (prevUsage) {
            throw new BadRequestException(`Bạn đã sử dụng mã giảm giá "${voucher.code}" trước đó!`);
          }
        }

        // 7. Cập nhật số lượt sử dụng nguyên tử
        await tx.$executeRaw`
          UPDATE discount."Voucher"
          SET "usedCount" = "usedCount" + 1,
              "updatedAt" = NOW()
          WHERE id = ${id}
        `;

        // 8. Ghi nhận sổ kiểm toán VoucherUsage (Ledger Audit Record)
        if (userId) {
          await tx.voucherUsage.create({
            data: {
              voucherId: id,
              userId: userId,
              orderId: orderId || null,
            },
          });
        }
      }

      return { success: true };
    });
  }

  async rollbackVouchers(voucherIds: string[], userId?: string, orderId?: string) {
    if (!voucherIds || voucherIds.length === 0) return { success: true };

    const uniqueIds = Array.from(new Set(voucherIds.filter(Boolean))).sort();
    if (uniqueIds.length === 0) return { success: true };

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const id of uniqueIds) {
          await tx.$executeRaw`
            UPDATE discount."Voucher"
            SET "usedCount" = GREATEST(0, "usedCount" - 1),
                "updatedAt" = NOW()
            WHERE id = ${id}
          `;

          if (orderId) {
            await tx.voucherUsage.deleteMany({
              where: { voucherId: id, orderId },
            });
          } else if (userId) {
            const lastUsage = await tx.voucherUsage.findFirst({
              where: { voucherId: id, userId },
              orderBy: { usedAt: 'desc' },
            });
            if (lastUsage) {
              await tx.voucherUsage.delete({ where: { id: lastUsage.id } });
            }
          }
        }
      });
      return { success: true };
    } catch (e) {
      console.error('[DiscountService] Error rolling back vouchers:', e);
      return { success: false };
    }
  }

  async claimVoucher(userId: string, voucherId: string) {
    if (!userId || !voucherId) {
      throw new BadRequestException('userId và voucherId không được để trống!');
    }

    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
    });

    if (!voucher) {
      throw new NotFoundException('Không tìm thấy mã giảm giá!');
    }

    const now = new Date();
    if (new Date(voucher.endDate) < now) {
      throw new BadRequestException('Mã giảm giá này đã hết hạn hiệu lực!');
    }
    if (voucher.usedCount >= voucher.usageLimit) {
      throw new BadRequestException('Mã giảm giá này đã hết lượt sử dụng!');
    }

    // Check if user already claimed
    const existingClaim = await this.prisma.userVoucherWallet.findUnique({
      where: {
        userId_voucherId: {
          userId,
          voucherId,
        },
      },
    });

    if (existingClaim) {
      return {
        success: true,
        message: 'Voucher này đã có trong ví của bạn!',
        alreadyClaimed: true,
        voucher,
      };
    }

    const claim = await this.prisma.userVoucherWallet.create({
      data: {
        userId,
        voucherId,
      },
      include: {
        voucher: true,
      },
    });

    return {
      success: true,
      message: 'Đã lưu voucher vào ví thành công!',
      alreadyClaimed: false,
      voucher: claim.voucher,
    };
  }

  async getMyWallet(userId: string) {
    if (!userId) return [];

    const now = new Date();
    const claims = await this.prisma.userVoucherWallet.findMany({
      where: { userId },
      include: {
        voucher: true,
      },
      orderBy: { claimedAt: 'desc' },
    });

    return claims.map((c) => {
      const v = c.voucher;
      const isExpired = new Date(v.endDate) < now;
      const isExhausted = v.usedCount >= v.usageLimit;
      return {
        id: v.id,
        claimId: c.id,
        claimedAt: c.claimedAt,
        code: v.code,
        name: v.name,
        shopId: v.shopId,
        type: v.type,
        value: v.value,
        minSpend: v.minSpend,
        maxDiscount: v.maxDiscount,
        usageLimit: v.usageLimit,
        usedCount: v.usedCount,
        isClaimable: v.isClaimable,
        startDate: v.startDate,
        endDate: v.endDate,
        isExpired,
        isExhausted,
        isAvailable: !isExpired && !isExhausted,
      };
    });
  }

  async getAllActiveVouchers(userId?: string) {
    const now = new Date();
    const whereCondition: any = {
      startDate: { lte: now },
      endDate: { gte: now },
      usedCount: { lt: this.prisma.voucher.fields.usageLimit },
    };

    if (userId) {
      whereCondition.OR = [
        { targetUserId: null },
        { targetUserId: userId },
      ];
    } else {
      whereCondition.targetUserId = null;
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { claims: true },
        },
      },
    });

    if (!userId || vouchers.length === 0) {
      return vouchers.map((v: any) => ({
        ...v,
        claimedCount: v._count?.claims || 0,
        isClaimed: false,
      }));
    }

    const claimedList = await this.prisma.userVoucherWallet.findMany({
      where: {
        userId,
        voucherId: { in: vouchers.map((v: any) => v.id) },
      },
      select: { voucherId: true },
    });

    const claimedSet = new Set(claimedList.map((c) => c.voucherId));

    return vouchers.map((v: any) => ({
      ...v,
      claimedCount: v._count?.claims || 0,
      isClaimed: claimedSet.has(v.id),
    }));
  }
}
