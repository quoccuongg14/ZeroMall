import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface RouteAccountInfo {
  name: string;
  email: string;
  role: string;
  status?: string;
  phone?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  operatingArea?: string;
  isAssigned?: boolean;
}

export interface RouteStageSummary {
  stageKey:
    | 'SELLER'
    | 'PICKUP_DRIVER'
    | 'ORIGIN_HUB'
    | 'ORIGIN_SOC'
    | 'DEST_SOC'
    | 'DEST_HUB'
    | 'DELIVERY_DRIVER';
  step: number;
  title: string;
  subtitle: string;
  locationLabel: string;
  hubCode?: string;
  hubName?: string;
  hubType?: string;
  portal: 'seller' | 'delivery';
  note?: string;
  accounts: RouteAccountInfo[];
}

@Injectable()
export class RouteAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  verifyPin(pin?: string) {
    const expected = (process.env.DEMO_HELPER_PIN || 'zm2026').trim();
    if (!pin || pin.trim() !== expected) {
      throw new ForbiddenException('Mã PIN truy cập không hợp lệ.');
    }
  }

  private normalizeText(val?: string | null): string {
    return (val || '')
      .toLowerCase()
      .replace(/[đĐ]/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9.\s]/g, ' ')
      // Chỉ bỏ tiền tố hành chính khi KHÔNG đứng trước số (giữ "quan 1", "phuong 4" để tránh "1" khớp nhầm "12")
      .replace(/\b(tp\.?|thanh pho|tinh|thi tran)\b/g, ' ')
      .replace(/\b(quan|huyen|thi xa|phuong|xa)\b(?!\s*\d+)/g, ' ')
      .replace(/\./g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private containsPhrase(haystackNorm: string, needleNorm: string): boolean {
    if (!haystackNorm || !needleNorm || needleNorm.length < 2) return false;
    // Không bao giờ cho phép chuỗi chỉ toàn chữ số đứng đơn độc (ví dụ "1" hoặc "4") khớp tự do
    if (/^\d+$/.test(needleNorm)) return false;
    const escaped = needleNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`).test(haystackNorm);
  }

  private matchesAddress(addressNorm: string, candidate?: string | null): boolean {
    const c = this.normalizeText(candidate);
    if (!c || c.length < 2 || !addressNorm) return false;
    return this.containsPhrase(addressNorm, c) || this.containsPhrase(c, addressNorm);
  }

  private pickBestHub(
    hubs: any[],
    addressText: string,
    preferredType: 'ORIGIN_HUB' | 'DESTINATION_HUB' | 'SORTING_CENTER',
    districtHint?: string,
    provinceHint?: string,
  ): any | null {
    const addrNorm = this.normalizeText(addressText);
    const distNorm = this.normalizeText(districtHint);
    const provNorm = this.normalizeText(provinceHint);

    const scoreHub = (hub: any): number => {
      let score = 0;
      if (hub.type === preferredType) score += 25;
      else if (preferredType !== 'SORTING_CENTER' && hub.type !== 'SORTING_CENTER') score += 10;
      else if (preferredType === 'SORTING_CENTER' && hub.type !== 'SORTING_CENTER') return -1;

      const hubDist = this.normalizeText(hub.district);
      const hubProv = this.normalizeText(hub.province);
      const hubName = this.normalizeText(hub.name);

      if (
        hubDist &&
        ((distNorm && (this.containsPhrase(distNorm, hubDist) || this.containsPhrase(hubDist, distNorm))) ||
          this.containsPhrase(addrNorm, hubDist))
      ) {
        score += 100;
      }
      if (
        hubProv &&
        ((provNorm && (this.containsPhrase(provNorm, hubProv) || this.containsPhrase(hubProv, provNorm))) ||
          this.containsPhrase(addrNorm, hubProv))
      ) {
        score += 45;
      }
      if (hubName && this.containsPhrase(addrNorm, hubName)) {
        score += 30;
      }
      return score;
    };

    const ranked = hubs
      .map((h) => ({ hub: h, score: scoreHub(h) }))
      .filter((x) => x.score >= 30)
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.hub || null;
  }

  private extractLatestLinehaulTarget(
    trackingLogs: Array<{ status?: string | null; description?: string | null; hubId?: string | null }> | undefined,
    allHubs: any[],
  ): { originHub: any | null; destHub: any | null; sealNumber: string | null } | null {
    if (!trackingLogs || trackingLogs.length === 0) return null;

    const linehaulLog = trackingLogs.find((l) => {
      const desc = l.description || '';
      return l.status === 'IN_TRANSIT' || /Seal:\s*\[?[A-Z0-9-]+\]?/i.test(desc) || desc.includes('Xe tải');
    });
    if (!linehaulLog) return null;

    const desc = linehaulLog.description || '';
    const sealMatch = desc.match(/Seal:\s*\[?([A-Z0-9-]+)\]?/i);
    const sealNumber = sealMatch ? sealMatch[1].toUpperCase() : null;

    let originHub: any | null = linehaulLog.hubId
      ? allHubs.find((h) => h.id === linehaulLog.hubId) || null
      : null;
    let destHub: any | null = null;

    if (sealNumber) {
      const parts = sealNumber.split('-');
      // Định dạng chuẩn: SEAL-<ORIGIN_CODE>-<DEST_CODE>-<RAND>
      if (parts.length >= 4 && parts[0] === 'SEAL') {
        const originCode = parts[1];
        const destCode = parts[2];
        if (!originHub && originCode) {
          originHub = allHubs.find((h) => (h.code || '').toUpperCase() === originCode) || null;
        }
        if (destCode) {
          destHub = allHubs.find((h) => (h.code || '').toUpperCase() === destCode) || null;
        }
      }
    }

    if (!destHub && desc) {
      const descLower = desc.toLowerCase();
      destHub =
        allHubs.find(
          (h) =>
            h.name &&
            (descLower.includes(`đến ${h.name.toLowerCase()}`) ||
              descLower.includes(`về [${h.name.toLowerCase()}]`) ||
              descLower.includes(`về ${h.name.toLowerCase()}`)),
        ) || null;
    }

    if (!originHub && !destHub && !sealNumber) return null;
    return { originHub, destHub, sealNumber };
  }

  private rankLocalDrivers(
    drivers: any[],
    userById: Map<string, any>,
    targetHubId: string | undefined,
    addressText: string,
    districtHint?: string,
    provinceHint?: string,
  ): RouteAccountInfo[] {
    const addrNorm = this.normalizeText(addressText);
    const distNorm = this.normalizeText(districtHint);
    const provNorm = this.normalizeText(provinceHint);

    const scored = drivers
      .filter((d) => d.vehicleType !== 'TRUCK' && Boolean(d.userId && userById.get(d.userId)?.email))
      .map((d) => {
        let score = 0;
        if (targetHubId && d.hubId === targetHubId) score += 80;
        if (d.status === 'AVAILABLE' || d.status === 'ONLINE') score += 50;

        if (d.assignedDistrict) {
          if (this.matchesAddress(distNorm || addrNorm, d.assignedDistrict) || this.matchesAddress(addrNorm, d.assignedDistrict)) {
            score += 90;
          }
        }
        if (d.operatingArea) {
          const areas = d.operatingArea.split(',').map((a: string) => a.trim()).filter(Boolean);
          if (areas.some((a: string) => this.matchesAddress(distNorm || addrNorm, a) || this.matchesAddress(addrNorm, a))) {
            score += 70;
          }
        }
        if (d.assignedProvince && (this.matchesAddress(provNorm || addrNorm, d.assignedProvince) || this.matchesAddress(addrNorm, d.assignedProvince))) {
          score += 40;
        }
        return { d, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 1);

    return scored.map(({ d }) => this.toDriverAccount(d, userById, false));
  }

  private toDriverAccount(driver: any, userById: Map<string, any>, isAssigned: boolean): RouteAccountInfo {
    const authUser = driver.userId ? userById.get(driver.userId) : null;
    return {
      name: driver.name,
      email: authUser?.email || '(Tài xế chưa liên kết email đăng nhập)',
      role: driver.vehicleType === 'TRUCK' ? 'TRUCK_DRIVER' : 'DRIVER',
      status: driver.status,
      phone: driver.phone,
      vehicleType: driver.vehicleType,
      vehicleNumber: driver.vehicleNumber,
      operatingArea: driver.operatingArea || [driver.assignedDistrict, driver.assignedProvince].filter(Boolean).join(', '),
      isAssigned,
    };
  }

  private getHubOperatorAccounts(hub: any | null, hubUsersMap: Map<string, any[]>): RouteAccountInfo[] {
    if (!hub) return [];
    const results: RouteAccountInfo[] = [];
    const seenEmails = new Set<string>();

    const linkedUsers = hubUsersMap.get(hub.id) || [];
    for (const u of linkedUsers) {
      if (u.role === 'DRIVER') continue;
      if (u.email && !seenEmails.has(u.email)) {
        seenEmails.add(u.email);
        results.push({
          name: u.name,
          email: u.email,
          role: u.role || 'HUB_OPERATOR',
          status: u.status,
        });
      }
    }

    if (hub.email && !seenEmails.has(hub.email)) {
      results.push({
        name: hub.type === 'SORTING_CENTER' ? `Điều Phối ${hub.name}` : `Trưởng Bưu Cục (${hub.name})`,
        email: hub.email,
        role: 'HUB_OPERATOR',
        status: hub.status,
      });
    }

    return results;
  }

  /**
   * Liệt kê 15 đơn hàng mới nhất kèm thông tin shop và vận đơn để chọn nhanh khi demo
   */
  async listRecentOrders(search?: string) {
    const q = (search || '').trim();
    const likePattern = `%${q}%`;

    const rows: any[] = q
      ? await this.prisma.$queryRaw`
          SELECT
            o.id,
            o."invoiceNo",
            o."buyerName",
            o."buyerEmail",
            o."shippingAddress",
            o."totalAmount",
            o."paymentMethod",
            o.status AS "orderStatus",
            o."shopId",
            o."createdAt",
            sh.name AS "shopName",
            sp."trackingNumber",
            sp.status AS "shipmentStatus"
          FROM "order"."Order" o
          LEFT JOIN auth."Shop" sh ON sh.id = o."shopId"
          LEFT JOIN delivery."Shipment" sp ON sp."orderId" = o.id
          WHERE o.id ILIKE ${likePattern}
             OR COALESCE(o."invoiceNo", '') ILIKE ${likePattern}
             OR o."buyerName" ILIKE ${likePattern}
             OR o."buyerEmail" ILIKE ${likePattern}
             OR COALESCE(sh.name, '') ILIKE ${likePattern}
             OR COALESCE(sp."trackingNumber", '') ILIKE ${likePattern}
          ORDER BY o."createdAt" DESC
          LIMIT 15
        `
      : await this.prisma.$queryRaw`
          SELECT
            o.id,
            o."invoiceNo",
            o."buyerName",
            o."buyerEmail",
            o."shippingAddress",
            o."totalAmount",
            o."paymentMethod",
            o.status AS "orderStatus",
            o."shopId",
            o."createdAt",
            sh.name AS "shopName",
            sp."trackingNumber",
            sp.status AS "shipmentStatus"
          FROM "order"."Order" o
          LEFT JOIN auth."Shop" sh ON sh.id = o."shopId"
          LEFT JOIN delivery."Shipment" sp ON sp."orderId" = o.id
          ORDER BY o."createdAt" DESC
          LIMIT 15
        `;

    return rows;
  }

  /**
   * Truy vết đủ 7 chặng tài khoản từ Order / Invoice / TrackingNumber
   */
  async traceRouteAccounts(identifier: string) {
    const { trace } = await this.buildRouteTrace(identifier);
    return trace;
  }

  private async buildRouteTrace(identifier: string) {
    const id = (identifier || '').trim();
    if (!id) throw new NotFoundException('Vui lòng cung cấp mã đơn hàng hoặc mã vận đơn.');

    const orderRows: any[] = await this.prisma.$queryRaw`
      SELECT
        o.id,
        o."invoiceNo",
        o."buyerId",
        o."buyerName",
        o."buyerEmail",
        o."buyerPhone",
        o."shippingAddress",
        o."totalAmount",
        o."paymentMethod",
        o.status AS "orderStatus",
        o."shopId",
        o."createdAt"
      FROM "order"."Order" o
      LEFT JOIN delivery."Shipment" sp ON sp."orderId" = o.id
      WHERE o.id = ${id}
         OR o."invoiceNo" = ${id}
         OR sp."trackingNumber" = ${id}
         OR sp.id = ${id}
      LIMIT 1
    `;

    const order = orderRows[0];
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng hoặc vận đơn "${id}".`);
    }

    const shipment = await this.prisma.shipment.findUnique({
      where: { orderId: order.id },
      include: {
        pickupAddress: true,
        currentHub: { include: { parentSoc: true } },
        assignments: {
          include: { driver: true },
          orderBy: { assignedAt: 'desc' },
        },
        trackingLogs: {
          orderBy: { timestamp: 'desc' },
          take: 15,
        },
      },
    });

    let effectiveShopId: string | null = order.shopId || shipment?.sellerId || null;
    if (!effectiveShopId) {
      const itemShopRows: any[] = await this.prisma.$queryRaw`
        SELECT "shopId" FROM "order"."OrderItem" WHERE "orderId" = ${order.id} LIMIT 1
      `;
      effectiveShopId = itemShopRows[0]?.shopId || null;
    }

    const shopRows: any[] = effectiveShopId
      ? await this.prisma.$queryRaw`
          SELECT
            sh.id,
            sh.name,
            sh."pickupAddress",
            sh.email AS "shopEmail",
            owner.id AS "ownerId",
            owner.name AS "ownerName",
            owner.email AS "ownerEmail",
            owner.status AS "ownerStatus"
          FROM auth."Shop" sh
          LEFT JOIN auth."User" owner ON owner.id = sh."ownerId"
          WHERE sh.id = ${effectiveShopId}
          LIMIT 1
        `
      : [];
    const shop = shopRows[0] || null;

    const shopStaffRows: any[] = effectiveShopId
      ? await this.prisma.$queryRaw`
          SELECT id, name, email, role, status
          FROM auth."User"
          WHERE "shopId" = ${effectiveShopId}
            AND role IN ('SHOP_OWNER', 'SHOP_STAFF')
          ORDER BY role ASC
        `
      : [];

    // Lấy toàn bộ Hub, Driver và tài khoản auth liên quan bằng truy vấn gộp
    const [allHubs, allDrivers, deliveryUsers] = await Promise.all([
      this.prisma.hub.findMany({
        where: { status: 'ACTIVE' },
        include: { parentSoc: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.driver.findMany({
        include: { hub: true },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.$queryRaw<any[]>`
        SELECT id, name, email, role, status, "hubId"
        FROM auth."User"
        WHERE role IN ('DRIVER', 'HUB_OPERATOR', 'LOGISTICS_OPERATOR', 'ADMIN')
           OR "hubId" IS NOT NULL
      `,
    ]);

    const userById = new Map<string, any>();
    const hubUsersMap = new Map<string, any[]>();
    for (const u of deliveryUsers) {
      userById.set(u.id, u);
      if (u.hubId) {
        const list = hubUsersMap.get(u.hubId) || [];
        list.push(u);
        hubUsersMap.set(u.hubId, list);
      }
    }

    // Phân tích địa chỉ lấy hàng từ SellerAddress hoặc Shop.pickupAddress
    const sellerAddr = shipment?.pickupAddress
      || (effectiveShopId
        ? await this.prisma.sellerAddress.findFirst({
            where: { sellerId: effectiveShopId },
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
          })
        : null);

    let pickupAddressText = '';
    let pickupDistrict = '';
    let pickupProvince = '';

    if (sellerAddr) {
      pickupDistrict = sellerAddr.district || '';
      pickupProvince = sellerAddr.province || '';
      pickupAddressText = [sellerAddr.address, sellerAddr.ward, sellerAddr.district, sellerAddr.province]
        .filter(Boolean)
        .join(', ');
    } else if (shop?.pickupAddress) {
      try {
        const parsed = JSON.parse(shop.pickupAddress);
        pickupDistrict = parsed.district || '';
        pickupProvince = parsed.province || '';
        pickupAddressText = [parsed.detailAddress || parsed.address, parsed.ward, parsed.district, parsed.province]
          .filter(Boolean)
          .join(', ');
      } catch {
        pickupAddressText = shop.pickupAddress;
      }
    }

    const assignedPickup = shipment?.assignments?.find(
      (a) => a.type === 'PICKUP' && a.status !== 'CANCELLED',
    );
    const assignedDelivery = shipment?.assignments?.find(
      (a) => a.type === 'DELIVERY' && a.status !== 'CANCELLED',
    );

    // 1. Origin Hub (chỉ dùng currentHub nếu đơn chưa sang chặng giao cuối)
    const earlyOriginHubFromCurrent =
      shipment?.currentHub &&
      shipment.currentHub.type !== 'SORTING_CENTER' &&
      ['PICKED_UP', 'AT_ORIGIN_HUB'].includes((shipment.status || '').toUpperCase())
        ? shipment.currentHub
        : null;
    const originHub =
      (assignedPickup?.driver?.hubId && allHubs.find((h) => h.id === assignedPickup.driver.hubId)) ||
      earlyOriginHubFromCurrent ||
      this.pickBestHub(allHubs, pickupAddressText, 'ORIGIN_HUB', pickupDistrict, pickupProvince) ||
      allHubs.find((h) => h.type === 'ORIGIN_HUB') ||
      null;

    // 2. Pickup Drivers (nếu đã gán Shipper thì chỉ hiện đúng Shipper đang giữ đơn)
    const pickupAccounts: RouteAccountInfo[] = assignedPickup?.driver
      ? [this.toDriverAccount(assignedPickup.driver, userById, true)]
      : this.rankLocalDrivers(
          allDrivers,
          userById,
          originHub?.id,
          pickupAddressText,
          pickupDistrict,
          pickupProvince,
        );

    // 3. Origin SOC
    const socHubs = allHubs.filter((h) => h.type === 'SORTING_CENTER');
    const originSoc =
      (originHub?.parentSocId && allHubs.find((h) => h.id === originHub.parentSocId)) ||
      this.pickBestHub(socHubs, pickupAddressText, 'SORTING_CENTER', pickupDistrict, pickupProvince) ||
      socHubs[0] ||
      null;

    const originSocTrucks = originSoc
      ? allDrivers
          .filter((d) => d.hubId === originSoc.id && d.vehicleType === 'TRUCK')
          .map((d) => this.toDriverAccount(d, userById, false))
      : [];

    // 4. Destination Hub (khớp theo địa chỉ người nhận)
    const deliveryAddrText = shipment?.deliveryAddress || order.shippingAddress || '';
    const destHub =
      (assignedDelivery?.driver?.hubId && allHubs.find((h) => h.id === assignedDelivery.driver.hubId)) ||
      this.pickBestHub(allHubs, deliveryAddrText, 'DESTINATION_HUB') ||
      allHubs.find((h) => h.type === 'DESTINATION_HUB') ||
      null;

    // 5. Destination SOC
    const destSoc =
      (destHub?.parentSocId && allHubs.find((h) => h.id === destHub.parentSocId)) ||
      this.pickBestHub(socHubs, deliveryAddrText, 'SORTING_CENTER') ||
      originSoc;

    const isCrossSoc = Boolean(originSoc && destSoc && originSoc.id !== destSoc.id);

    // 6. Delivery Drivers (nếu đã gán Shipper thì chỉ hiện đúng Shipper đang giữ đơn)
    const deliveryAccounts: RouteAccountInfo[] = assignedDelivery?.driver
      ? [this.toDriverAccount(assignedDelivery.driver, userById, true)]
      : this.rankLocalDrivers(
          allDrivers,
          userById,
          destHub?.id,
          deliveryAddrText,
        );

    // 7. Seller Accounts
    const sellerAccounts: RouteAccountInfo[] = [];
    const seenSellerEmails = new Set<string>();
    if (shop?.ownerEmail) {
      seenSellerEmails.add(shop.ownerEmail);
      sellerAccounts.push({
        name: shop.ownerName || shop.name,
        email: shop.ownerEmail,
        role: 'SHOP_OWNER',
        status: shop.ownerStatus,
      });
    }
    for (const st of shopStaffRows) {
      if (st.email && !seenSellerEmails.has(st.email)) {
        seenSellerEmails.add(st.email);
        sellerAccounts.push({
          name: st.name,
          email: st.email,
          role: st.role,
          status: st.status,
        });
      }
    }

    const stages: RouteStageSummary[] = [
      {
        stageKey: 'SELLER',
        step: 1,
        title: 'Shop / Người Bán (Xác nhận đơn)',
        subtitle: shop ? shop.name : 'Shop chưa xác định',
        locationLabel: pickupAddressText || 'Chưa có địa chỉ lấy hàng',
        portal: 'seller',
        accounts: sellerAccounts,
      },
      {
        stageKey: 'PICKUP_DRIVER',
        step: 2,
        title: 'Shipper Lấy Hàng (Pickup)',
        subtitle: assignedPickup
          ? `Đã phân công: ${assignedPickup.driver.name}`
          : 'Dự kiến theo khu vực lấy hàng',
        locationLabel: pickupAddressText || originHub?.name || 'Theo địa chỉ Shop',
        portal: 'delivery',
        note:
          !assignedPickup && pickupAccounts.length > 0 && pickupAccounts.every((a) => a.status === 'OFFLINE')
            ? 'Lưu ý: Shipper khu vực này đang OFFLINE, cần đăng nhập Shipper bật Trực tuyến trước hoặc nhận tay.'
            : undefined,
        accounts: pickupAccounts,
      },
      {
        stageKey: 'ORIGIN_HUB',
        step: 3,
        title: 'Bưu Cục Lấy Hàng (Origin Hub)',
        subtitle: originHub ? `${originHub.name} (${originHub.code})` : 'Chưa khớp Hub lấy hàng',
        locationLabel: originHub ? `${originHub.district}, ${originHub.province}` : '',
        hubCode: originHub?.code,
        hubName: originHub?.name,
        hubType: originHub?.type,
        portal: 'delivery',
        accounts: this.getHubOperatorAccounts(originHub, hubUsersMap),
      },
      {
        stageKey: 'ORIGIN_SOC',
        step: 4,
        title: 'Trung Tâm Phân Loại Xuất Phát (Origin SOC)',
        subtitle: originSoc ? `${originSoc.name} (${originSoc.code})` : 'Chưa có SOC chủ quản',
        locationLabel: originSoc ? `${originSoc.district}, ${originSoc.province}` : '',
        hubCode: originSoc?.code,
        hubName: originSoc?.name,
        hubType: originSoc?.type,
        portal: 'delivery',
        note: isCrossSoc
          ? `Tuyến liên vùng: Xuất chuyến xe tải từ ${originSoc?.code} đi ${destSoc?.code}.`
          : 'Đơn nội vùng SOC: Phân luồng thẳng về Bưu cục giao.',
        accounts: [...this.getHubOperatorAccounts(originSoc, hubUsersMap), ...originSocTrucks],
      },
      {
        stageKey: 'DEST_SOC',
        step: 5,
        title: 'Trung Tâm Phân Loại Đích (Destination SOC)',
        subtitle: destSoc
          ? isCrossSoc
            ? `${destSoc.name} (${destSoc.code})`
            : `Cùng SOC ${destSoc.name} (${destSoc.code})`
          : 'Chưa có SOC đích',
        locationLabel: destSoc ? `${destSoc.district}, ${destSoc.province}` : '',
        hubCode: destSoc?.code,
        hubName: destSoc?.name,
        hubType: destSoc?.type,
        portal: 'delivery',
        note: isCrossSoc
          ? 'Nhập kho SOC Đích rồi chia tuyến xuống Hub Giao Hàng.'
          : 'Trùng SOC xuất phát nên không cần đăng nhập thêm SOC thứ 2.',
        accounts: this.getHubOperatorAccounts(destSoc, hubUsersMap),
      },
      {
        stageKey: 'DEST_HUB',
        step: 6,
        title: 'Bưu Cục Giao Hàng (Destination Hub)',
        subtitle: destHub ? `${destHub.name} (${destHub.code})` : 'Chưa khớp Hub giao hàng',
        locationLabel: destHub ? `${destHub.district}, ${destHub.province}` : deliveryAddrText,
        hubCode: destHub?.code,
        hubName: destHub?.name,
        hubType: destHub?.type,
        portal: 'delivery',
        accounts: this.getHubOperatorAccounts(destHub, hubUsersMap),
      },
      {
        stageKey: 'DELIVERY_DRIVER',
        step: 7,
        title: 'Shipper Giao Hàng (Delivery)',
        subtitle: assignedDelivery
          ? `Đã phân công: ${assignedDelivery.driver.name}`
          : 'Dự kiến theo địa chỉ người nhận',
        locationLabel: deliveryAddrText || 'Địa chỉ khách nhận',
        portal: 'delivery',
        note:
          !assignedDelivery && deliveryAccounts.length > 0 && deliveryAccounts.every((a) => a.status === 'OFFLINE')
            ? 'Lưu ý: Shipper khu vực giao đang OFFLINE, nhớ bật trạng thái Trực tuyến khi demo giao hàng.'
            : undefined,
        accounts: deliveryAccounts,
      },
    ];

    const linehaulTarget = this.extractLatestLinehaulTarget(shipment?.trackingLogs, allHubs);

    return {
      linehaulTarget,
      hubUsersMap,
      trace: {
        order: {
          id: order.id,
          invoiceNo: order.invoiceNo,
          orderStatus: order.orderStatus,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          shippingAddress: order.shippingAddress,
          createdAt: order.createdAt,
          shopName: shop?.name || null,
        },
        shipment: shipment
          ? {
              id: shipment.id,
              trackingNumber: shipment.trackingNumber,
              status: shipment.status,
              currentHubCode: shipment.currentHub?.code || null,
              currentHubName: shipment.currentHub?.name || null,
            }
          : null,
        isCrossSoc,
        stages,
      },
    };
  }

  /**
   * Trả về DUY NHẤT 1 bước tiếp theo cần thao tác dựa trên trạng thái hiện tại của đơn hàng
   */
  async getNextStepHint(identifier: string, contextHubId?: string, portal?: string) {
    const { trace, linehaulTarget, hubUsersMap } = await this.buildRouteTrace(identifier);
    const byKey = new Map(trace.stages.map((s) => [s.stageKey, s]));

    const orderStatus = (trace.order.orderStatus || '').toUpperCase();
    const sp = trace.shipment;
    const spStatus = (sp?.status || '').toUpperCase();
    const currentHub = trace.stages.find((s) => s.stageKey === 'ORIGIN_HUB');
    const originSoc = trace.stages.find((s) => s.stageKey === 'ORIGIN_SOC');
    const destSoc = trace.stages.find((s) => s.stageKey === 'DEST_SOC');
    const destHub = trace.stages.find((s) => s.stageKey === 'DEST_HUB');

    const pick = (
      stageKey: RouteStageSummary['stageKey'],
      actionGuide: string,
      completed = false,
    ) => ({
      completed,
      actionGuide,
      stage: byKey.get(stageKey)!,
      order: trace.order,
      shipment: trace.shipment,
      isCrossSoc: trace.isCrossSoc,
    });

    const pickTargetHub = (targetHub: any, actionGuide: string) => {
      const code = (targetHub.code || '').toUpperCase();
      if (originSoc?.hubCode && code === originSoc.hubCode.toUpperCase()) {
        return pick('ORIGIN_SOC', actionGuide);
      }
      if (destSoc?.hubCode && code === destSoc.hubCode.toUpperCase()) {
        return pick('DEST_SOC', actionGuide);
      }
      if (destHub?.hubCode && code === destHub.hubCode.toUpperCase()) {
        return pick('DEST_HUB', actionGuide);
      }
      if (currentHub?.hubCode && code === currentHub.hubCode.toUpperCase()) {
        return pick('ORIGIN_HUB', actionGuide);
      }
      const isSocHub = targetHub.type === 'SORTING_CENTER';
      const dynamicStage: RouteStageSummary = {
        stageKey: isSocHub ? 'DEST_SOC' : 'DEST_HUB',
        step: isSocHub ? 5 : 6,
        title: isSocHub
          ? 'Trung Tâm Phân Loại Tiếp Nhận (SOC)'
          : 'Bưu Cục Giao Hàng Tiếp Nhận (Hub)',
        subtitle: `${targetHub.name} (${targetHub.code})`,
        locationLabel: [targetHub.district, targetHub.province].filter(Boolean).join(', '),
        hubCode: targetHub.code,
        hubName: targetHub.name,
        hubType: targetHub.type,
        portal: 'delivery',
        accounts: this.getHubOperatorAccounts(targetHub, hubUsersMap),
      };
      return {
        completed: false,
        actionGuide,
        stage: dynamicStage,
        order: trace.order,
        shipment: trace.shipment,
        isCrossSoc: trace.isCrossSoc,
      };
    };

    if (orderStatus === 'CANCELLED' || spStatus === 'CANCELLED') {
      return pick('SELLER', 'Đơn hàng này đã bị hủy, không còn bước tiếp theo.', true);
    }

    if (orderStatus === 'COMPLETED' || spStatus === 'DELIVERED') {
      return pick('DELIVERY_DRIVER', 'Đơn hàng đã giao thành công! Không còn bước tiếp theo.', true);
    }

    // 1. Chưa có vận đơn hoặc mới CREATED -> Seller xác nhận & chuẩn bị hàng
    if (!sp || spStatus === 'CREATED') {
      if (portal === 'seller') {
        const isPendingConfirm = ['PENDING', 'PENDING_PAYMENT', 'UNPAID'].includes(orderStatus);
        const guide = isPendingConfirm
          ? 'Bước hiện tại: Bấm "Xác nhận đơn hàng" -> "Chuẩn bị hàng" ngay tại đây. Tài khoản Shipper Lấy Hàng tiếp theo:'
          : 'Bước hiện tại: Bấm "Chuẩn bị hàng" ngay tại đây để gọi Shipper. Tài khoản Shipper Lấy Hàng tiếp theo:';
        return pick('PICKUP_DRIVER', guide);
      }
      return pick(
        'SELLER',
        `Đăng nhập Seller (${trace.order.shopName || 'Shop'}) để bấm Xác nhận đơn & Chuẩn bị hàng.`,
      );
    }

    // 2. Chờ lấy / đã gán shipper lấy
    if (['WAITING_PICKUP', 'PICKUP_ASSIGNED', 'PICKING_UP'].includes(spStatus)) {
      return pick(
        'PICKUP_DRIVER',
        'Đăng nhập App Shipper Lấy Hàng để nhận đơn & bấm "Xác nhận đã lấy hàng".',
      );
    }

    // 3. Shipper đã lấy xong -> Bưu cục lấy hàng quét nhập kho
    if (spStatus === 'PICKED_UP') {
      return pick(
        'ORIGIN_HUB',
        `Đăng nhập Bưu Cục Lấy Hàng (${currentHub?.hubName || 'Origin Hub'}) -> Tab Nhập Hàng từ Shipper để quét nhập kho.`,
      );
    }

    // 4. Đang ở Origin Hub -> Kiểm tra xem đang ở Hub lấy, Origin SOC, hay Dest SOC
    if (spStatus === 'AT_ORIGIN_HUB') {
      const destSocId = await this.findHubIdByCode(destSoc?.hubCode);
      const isAtDestSoc =
        trace.isCrossSoc &&
        ((contextHubId && destSocId && contextHubId === destSocId) ||
          (sp.currentHubCode && destSoc?.hubCode && sp.currentHubCode === destSoc.hubCode));

      if (isAtDestSoc) {
        return pick(
          'DEST_HUB',
          `Bấm "Chuyển về ${destHub?.hubCode || 'Hub giao'}", sau đó đăng nhập Bưu Cục Giao Hàng (${destHub?.hubName || 'Dest Hub'}).`,
        );
      }

      const originSocId = await this.findHubIdByCode(originSoc?.hubCode);
      const isAtOriginSoc =
        (contextHubId && originSocId && contextHubId === originSocId) ||
        (sp.currentHubCode && originSoc?.hubCode && sp.currentHubCode === originSoc.hubCode);

      if (isAtOriginSoc) {
        if (trace.isCrossSoc) {
          return pick(
            'DEST_SOC',
            `Đóng xe tải liên vùng gửi đi, sau đó đăng nhập SOC Đích (${destSoc?.hubName || 'Dest SOC'}) để nhận chuyến.`,
          );
        }
        return pick(
          'DEST_HUB',
          `Bấm "Chuyển về ${destHub?.hubCode || 'Hub giao'}", sau đó đăng nhập Bưu Cục Giao Hàng (${destHub?.hubName || 'Dest Hub'}).`,
        );
      }

      return pick(
        'ORIGIN_SOC',
        `Tại ${currentHub?.hubName || 'Origin Hub'} bấm "Bàn Giao Về SOC", sau đó đăng nhập ${originSoc?.hubName || 'SOC Xuất Phát'} để tiếp nhận.`,
      );
    }

    // 5. Đang trung chuyển (Hub -> Origin SOC | Origin SOC -> Dest SOC | Dest SOC -> Dest Hub)
    if (spStatus === 'IN_TRANSIT') {
      if (linehaulTarget?.destHub) {
        const dest = linehaulTarget.destHub;
        const sealNote = linehaulTarget.sealNumber ? ` (${linehaulTarget.sealNumber})` : '';
        const guide =
          dest.type === 'SORTING_CENTER'
            ? `Đăng nhập ${dest.name} (${dest.code}) -> Tab 3. Tiếp Nhận Xe Tải Đến để đối soát & nhập kho SOC${sealNote}.`
            : `Đăng nhập ${dest.name} (${dest.code}) -> Tab 3. Tiếp Nhận Xe Từ SOC để đối soát & nhập kho phát hàng${sealNote}.`;
        return pickTargetHub(dest, guide);
      }

      if (sp.currentHubCode && destSoc?.hubCode && sp.currentHubCode === destSoc.hubCode) {
        return pick(
          'DEST_HUB',
          `Đăng nhập Bưu Cục Giao Hàng (${destHub?.hubName || 'Dest Hub'}) -> Tab 3. Tiếp Nhận Xe Từ SOC để nhập kho phát hàng.`,
        );
      }

      const isFromOriginSoc =
        sp.currentHubCode && originSoc?.hubCode && sp.currentHubCode === originSoc.hubCode;
      if (isFromOriginSoc) {
        if (trace.isCrossSoc) {
          return pick(
            'DEST_SOC',
            `Đăng nhập SOC Đích (${destSoc?.hubName || 'Dest SOC'}) -> Tab 3. Tiếp Nhận Xe Tải Đến để nhận chuyến.`,
          );
        }
        return pick(
          'DEST_HUB',
          `Đăng nhập Bưu Cục Giao Hàng (${destHub?.hubName || 'Dest Hub'}) -> Tab 3. Tiếp Nhận Xe Từ SOC để nhập kho phát hàng.`,
        );
      }

      return pick(
        'ORIGIN_SOC',
        `Đăng nhập SOC Xuất Phát (${originSoc?.hubName || 'Origin SOC'}) -> Tab 3. Tiếp Nhận Xe Tải Đến để nhận kiện từ Hub.`,
      );
    }

    // 6. Đang phân loại tại SOC
    if (spStatus === 'SORTING') {
      const isAtDestSoc =
        trace.isCrossSoc &&
        sp.currentHubCode &&
        destSoc?.hubCode &&
        sp.currentHubCode === destSoc.hubCode;
      if (trace.isCrossSoc && !isAtDestSoc) {
        return pick(
          'DEST_SOC',
          `Tại ${originSoc?.hubName || 'Origin SOC'} bấm "Đóng Xe" tuyến liên vùng, sau đó đăng nhập SOC Đích (${destSoc?.hubName || 'Dest SOC'}).`,
        );
      }
      return pick(
        'DEST_HUB',
        `Tại SOC bấm "Chuyển Về ${destHub?.hubCode || 'Hub Giao'}", sau đó đăng nhập Bưu Cục Giao Hàng (${destHub?.hubName || 'Dest Hub'}).`,
      );
    }

    // 7. Đã đến Hub phát hoặc đã gán / đang đi giao
    if (['AT_DESTINATION_HUB', 'DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY'].includes(spStatus)) {
      const guide =
        spStatus === 'AT_DESTINATION_HUB'
          ? `Tại ${destHub?.hubName || 'Bưu Cục Giao'} bấm "Phân Tuyến Giao", sau đó đăng nhập Shipper Giao Hàng để nhận đơn & giao khách.`
          : 'Đăng nhập App Shipper Giao Hàng để quét nhận đơn & xác nhận giao hàng thành công cho khách.';
      return pick('DELIVERY_DRIVER', guide);
    }

    return pick(
      'DELIVERY_DRIVER',
      'Mở cổng Giao Vận để kiểm tra và xử lý chặng tiếp theo của đơn hàng.',
    );
  }

  private async findHubIdByCode(code?: string): Promise<string | null> {
    if (!code) return null;
    const h = await this.prisma.hub.findUnique({ where: { code }, select: { id: true } });
    return h?.id || null;
  }
}
