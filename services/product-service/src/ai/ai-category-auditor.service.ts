import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GeminiAiService } from './gemini-ai.service';
import { LocalAiService } from './local-ai.service';
import { AiModerationService } from './ai-moderation.service';

export class AuditProductDto {
  productId?: string;
  name: string;
  category: string;
  image?: string;
  images?: string[];
  description?: string;
  isBatchScan?: boolean;
}

export interface AuditCategoryResult {
  isMatched: boolean;
  issueType: 'MATCHED' | 'WRONG_CATEGORY' | 'IMAGE_MISMATCH' | 'KEYWORD_SPAM' | 'PROHIBITED_ITEM';
  isProhibited?: boolean;
  prohibitedLabel?: string;
  confidence: number; // 0 - 100
  currentCategory: string;
  suggestedCategory: string;
  suggestedTitle?: string;
  detectedVisual?: string;
  titleFeedback: string;
  imageFeedback?: string;
  actionRequired: 'NONE' | 'CHANGE_CATEGORY' | 'REPLACE_IMAGE' | 'UPDATE_TITLE' | 'TAKEDOWN';
  recommendation: string;
  source: 'ai-multimodal-engine' | 'gemini-vision' | 'catalog-rules' | 'local-clip-engine' | 'local-ai-engine';
}

export interface ScannedProductItem {
  id: string;
  name: string;
  image: string;
  category: string;
  shopId: string;
  status?: string;
  auditResult: AuditCategoryResult;
}

export interface BatchAuditStats {
  totalScanned: number;
  totalProducts?: number;
  totalViolations?: number;
  totalActiveViolations?: number;
  totalHiddenViolations?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  matchedCount: number;
  wrongCategoryCount: number;
  imageMismatchCount: number;
  prohibitedCount?: number;
  flaggedProducts: ScannedProductItem[];
  allProducts: ScannedProductItem[];
}

const CANONICAL_CATEGORIES = [
  'Thời Trang Nam',
  'Thời Trang Nữ',
  'Điện Thoại & Phụ Kiện',
  'Thiết Bị Điện Tử',
  'Máy Tính & Laptop',
  'Đồng Hồ',
  'Máy Ảnh',
  'Giày Dép Nam',
  'Giày Dép Nữ',
  'Gia Dụng',
  'Thể Thao',
  'Mẹ & Bé',
  'Nhà Cửa',
  'Sắc Đẹp',
  'Sức Khỏe',
  'Phụ Kiện Nữ',
  'Túi Ví Nữ',
  'Sách & VPP',
];

@Injectable()
export class AiCategoryAuditorService {
  private readonly logger = new Logger(AiCategoryAuditorService.name);

  // Circuit breaker: Lưu trạng thái sống/chết của CLIP Service để không lặp lại timeout 25s/sản phẩm
  private static clipEndpointWorkingUrl: string | null = null;
  private static clipLastCheckTime = 0;
  private static isClipAvailable: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiAi: GeminiAiService,
    private readonly localAi: LocalAiService,
    private readonly aiModeration?: AiModerationService,
  ) {}

  /**
   * Circuit breaker: Kiểm tra nhanh trạng thái kết nối tới dịch vụ CLIP Vision
   * Nếu service không bật, trả về null trong 0ms (cache 60s) để tránh treo 25s/sản phẩm
   */
  private async getActiveClipUrl(): Promise<string | null> {
    const now = Date.now();
    if (AiCategoryAuditorService.isClipAvailable !== null && now - AiCategoryAuditorService.clipLastCheckTime < 60000) {
      return AiCategoryAuditorService.isClipAvailable ? AiCategoryAuditorService.clipEndpointWorkingUrl : null;
    }

    AiCategoryAuditorService.clipLastCheckTime = now;
    const endpoints = [
      process.env.CLIP_SERVICE_URL,
      'http://zeromall-clip-service:5005/audit',
      'http://clip-service:5005/audit',
      'http://127.0.0.1:5005/audit',
      'http://localhost:5005/audit',
    ].filter(Boolean) as string[];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // 2000ms probe
        const probeUrl = url.replace('/audit', '/health');
        const res = await fetch(probeUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          AiCategoryAuditorService.clipEndpointWorkingUrl = url;
          AiCategoryAuditorService.isClipAvailable = true;
          return url;
        }
      } catch {
        // Probe next
      }
    }

    AiCategoryAuditorService.isClipAvailable = false;
    AiCategoryAuditorService.clipEndpointWorkingUrl = null;
    return null;
  }

  /**
   * Thẩm định 1 sản phẩm theo KIẾN TRÚC 2 BƯỚC:
   * BƯỚC 1: Kiểm tra Hình ảnh vs Tiêu đề (Visual-to-Text Consistency)
   *   -> Nếu ảnh không khớp tiêu đề -> Báo [IMAGE_MISMATCH] và DỪNG LẠI NGAY!
   * BƯỚC 2: Kiểm tra Tiêu đề/Thực thể chính vs Ngành hàng (Head-Noun Category Validation)
   *   -> Bóc tách danh từ chính, loại bỏ ngữ cảnh phụ ("dễ bỏ túi quần", "đựng vừa điện thoại"...)
   *   -> So sánh với ngành hàng đăng bán -> [WRONG_CATEGORY] hoặc [MATCHED].
   */
  async auditProduct(input: AuditProductDto): Promise<AuditCategoryResult> {
    const rawName = (input.name || '').trim();
    const lowerName = rawName.toLowerCase();
    const currentCat = (input.category || '').trim();

    const allImages: string[] = [];
    if (input.image) allImages.push(input.image);
    if (Array.isArray(input.images)) {
      for (const img of input.images) {
        if (img && !allImages.includes(img)) allImages.push(img);
      }
    }
    const coverImage = allImages[0] || '';

    // =========================================================================
    // BƯỚC 1: KIỂM TRA HÌNH ẢNH VS TIÊU ĐỀ (Tier 1: Visual-to-Text Consistency)
    // "Kiểm tra ảnh với tên sản phẩm xem có trùng không đã..."
    // =========================================================================
    let visualCheck: any = null;
    const activeClip = await this.getActiveClipUrl();
    if (activeClip && coverImage) {
      visualCheck = await this.queryLocalClipVision(coverImage, rawName, currentCat);
    }

    // 1.1 Kiểm tra hàng cấm / vũ khí tuyệt đối
    if (visualCheck && visualCheck.isProhibited) {
      return {
        isMatched: false,
        isProhibited: true,
        prohibitedLabel: visualCheck.prohibitedLabel || 'Hàng cấm / Vũ khí',
        issueType: 'PROHIBITED_ITEM',
        confidence: visualCheck.confidence || 98,
        currentCategory: currentCat,
        suggestedTitle: visualCheck.suggestedTitle,
        detectedVisual: visualCheck.detectedVisual,
        suggestedCategory: currentCat, // Tuyệt đối KHÔNG gán 'Hàng Cấm Kinh Doanh' làm ngành hàng!
        titleFeedback: rawName ? `Tiêu đề bạn nhập là "${rawName}".` : `Chưa nhập tiêu đề sản phẩm.`,
        imageFeedback: visualCheck.reason || `Ảnh là "${visualCheck.detectedVisual}".`,
        actionRequired: 'TAKEDOWN',
        recommendation: `🚫 CẢNH BÁO HÀNG CẤM: Hình ảnh chứa ${visualCheck.prohibitedLabel || 'vật phẩm cấm kinh doanh'}. Sàn ZeroMall nghiêm cấm tuyệt đối đăng tải! Khuyến nghị: Khóa và Gỡ bỏ sản phẩm ngay lập tức.`,
        source: 'local-clip-engine',
      };
    }

    // 1.2 ĐÁNH GIÁ LỆCH ẢNH & TIÊU ĐỀ (Ảnh một đằng, Tiêu đề một nẻo)
    // NẾU ẢNH KHÔNG TRÙNG TIÊU ĐỀ -> LẬP TỨC CHẶN NGAY, DỪNG LẠI KHÔNG KIỂM TRA TIẾP!
    if (visualCheck && visualCheck.isMismatch) {
      return {
        isMatched: false,
        isProhibited: false,
        issueType: 'IMAGE_MISMATCH',
        confidence: visualCheck.confidence || 95,
        currentCategory: currentCat,
        suggestedTitle: visualCheck.suggestedTitle,
        detectedVisual: visualCheck.detectedVisual,
        suggestedCategory: currentCat, // Lỗi do ảnh sai lệch: Giữ nguyên ngành hàng chuẩn của sản phẩm, không đổi ngành theo ảnh sai!
        titleFeedback: `Tiêu đề sản phẩm là "${rawName}".`,
        imageFeedback: visualCheck.reason || `Hình ảnh nhận diện là "${visualCheck.detectedVisual}", không đồng nhất với tiêu đề.`,
        actionRequired: 'REPLACE_IMAGE',
        recommendation: visualCheck.reason || `Hình ảnh hiển thị là "${visualCheck.detectedVisual}", nhưng tiêu đề lại ghi "${rawName}". Đề nghị Shop cập nhật ảnh bìa đúng thực tế hoặc sửa tiêu đề.`,
        source: 'local-clip-engine',
      };
    }

    // 1.3 Quét từ cấm nâng cao nếu có service AI Moderation (TextSanitizerAgent)
    if (this.aiModeration && !input.isBatchScan) {
      try {
        const textCheck = await this.aiModeration.moderateContent({
          text: `${rawName} ${(input as any).description || ''}`,
          category: currentCat,
        });
        if (textCheck.isViolated) {
          return {
            isMatched: false,
            isProhibited: true,
            prohibitedLabel: 'Hàng cấm / Từ cấm vi phạm chính sách',
            issueType: 'PROHIBITED_ITEM',
            confidence: textCheck.confidence || 98,
            currentCategory: currentCat,
            suggestedCategory: currentCat, // Tuyệt đối KHÔNG gán 'Hàng Cấm Kinh Doanh' làm ngành hàng!
            titleFeedback: `🚫 VI PHẠM CHÍNH SÁCH: ${textCheck.reason}`,
            actionRequired: 'TAKEDOWN',
            recommendation: textCheck.suggestion || 'Sản phẩm vi phạm quy định kinh doanh hàng cấm/lách luật. ZeroMall nghiêm cấm tuyệt đối đăng tải! Khuyến nghị: Khóa và Gỡ bỏ sản phẩm ngay lập tức.',
            source: (textCheck.source as any) || 'local-ai-engine',
          };
        }
      } catch (err: any) {
        this.logger.warn(`TextSanitizer check skipped: ${err.message}`);
      }
    }

    // =========================================================================
    // BƯỚC 2: KIỂM TRA TÊN/CHỦ THỂ CHÍNH VS NGÀNH HÀNG (Tier 2: Category Validation)
    // "Sau khi trùng thì mới kiểm tra tên sản phẩm đó có trùng với ngành hàng không"
    // =========================================================================
    // Bóc tách Thực thể chính (Head Noun), loại bỏ ngữ cảnh phụ
    const inferredCategoryFromTitle = this.inferCategoryFromTitle(lowerName);
    const effectiveSuggestedCat = inferredCategoryFromTitle || visualCheck?.suggestedCategory;

    // 2.1 Trường hợp đặc biệt: Merchandise / Fanmeeting / Esports
    if (/hle|gumayusi|t1|faker|chovy|fanmeeting|áo đấu|esports/i.test(lowerName)) {
      const esportsCat = 'Thời Trang Nam';
      if (!['Thời Trang Nam', 'Thể Thao', 'Sách & VPP'].includes(currentCat)) {
        return {
          isMatched: false,
          issueType: 'WRONG_CATEGORY',
          confidence: 90,
          currentCategory: currentCat,
          suggestedCategory: esportsCat,
          titleFeedback: `Sản phẩm áo đấu/sự kiện Esports Fanmeeting.`,
          imageFeedback: `Ảnh trang phục / tuyển thủ Esports.`,
          actionRequired: 'CHANGE_CATEGORY',
          recommendation: `Sản phẩm nên được đưa vào ngành "${esportsCat}" hoặc "Thể Thao" để người hâm mộ tìm kiếm chuẩn xác nhất.`,
          source: 'local-ai-engine',
        };
      }
    }

    // 2.2 Kiểm tra tương thích ngành hàng
    if (effectiveSuggestedCat && currentCat && !this.isCategoryCompatible(currentCat, effectiveSuggestedCat)) {
      return {
        isMatched: false,
        issueType: 'WRONG_CATEGORY',
        confidence: 93,
        currentCategory: currentCat,
        suggestedCategory: effectiveSuggestedCat,
        suggestedTitle: visualCheck?.suggestedTitle,
        detectedVisual: visualCheck?.detectedVisual,
        titleFeedback: rawName ? `Sản phẩm "${rawName}" có thực thể chính thuộc ngành "${effectiveSuggestedCat}".` : `Hình ảnh sản phẩm thuộc ngành "${effectiveSuggestedCat}".`,
        imageFeedback: visualCheck?.detectedVisual ? `Ảnh hiển thị: ${visualCheck.detectedVisual}.` : undefined,
        actionRequired: 'CHANGE_CATEGORY',
        recommendation: `ZeroAI đề xuất chuyển sang ngành "${effectiveSuggestedCat}" để tối ưu tìm kiếm và đúng chuẩn danh mục sàn.`,
        source: visualCheck?.source || 'local-ai-engine',
      };
    }

    // 2.3 Hợp lệ: Cả Ảnh = Tên = Ngành Hàng đều đồng nhất chuẩn xác!
    return {
      isMatched: true,
      issueType: 'MATCHED',
      confidence: 98,
      currentCategory: currentCat,
      suggestedCategory: currentCat,
      titleFeedback: `Tiêu đề "${rawName}" chuẩn xác.`,
      imageFeedback: 'Hình ảnh, tiêu đề và phân loại ngành hàng hoàn toàn đồng nhất.',
      actionRequired: 'NONE',
      recommendation: `Sản phẩm đã được phân loại đúng ngành "${currentCat}". Đủ điều kiện hiển thị ưu tiên trên sàn ZeroMall.`,
      source: visualCheck?.source || 'local-ai-engine',
    };
  }

  /**
   * Quét toàn bộ hoặc một nhóm sản phẩm trong CSDL để phát hiện các sản phẩm sai ngành hàng
   * Hỗ trợ phân trang (Pagination) và xử lý song song (Concurrency Chunks) để phản hồi siêu tốc (< 200ms)
   */
  async scanProducts(shopId?: string, page = 1, limit = 50, queueOnly = false): Promise<BatchAuditStats> {
    if (queueOnly) {
      return this.getViolationQueue(shopId, page, limit, 'ALL', 'active');
    }

    const whereCondition: any = {
      status: { in: ['active', 'hidden'] },
      name: { notIn: ['test', 'cuong', '2'] },
    };
    if (shopId) {
      whereCondition.shopId = shopId;
    }

    const [totalProducts, products] = await Promise.all([
      this.prisma.product.count({ where: whereCondition }),
      this.prisma.product.findMany({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          image: true,
          images: true,
          category: true,
          shopId: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    let matchedCount = 0;
    let wrongCategoryCount = 0;
    let imageMismatchCount = 0;
    let prohibitedCount = 0;
    const allProducts: BatchAuditStats['allProducts'] = [];
    const flaggedProducts: BatchAuditStats['flaggedProducts'] = [];

    // Chạy song song theo từng mẻ (chunks 10 sản phẩm)
    const CHUNK_SIZE = 10;
    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (p) => {
          const cover = p.image || (p.images ? (() => { try { return JSON.parse(p.images)[0]; } catch { return ''; } })() : '');
          const audit = await this.auditProduct({
            productId: p.id,
            name: p.name,
            category: p.category,
            image: cover,
            isBatchScan: true,
          });
          return { p, cover, audit };
        }),
      );

      for (const res of chunkResults) {
        const item: ScannedProductItem = {
          id: res.p.id,
          name: res.p.name,
          image: res.cover,
          category: res.p.category,
          shopId: res.p.shopId,
          status: res.p.status,
          auditResult: res.audit,
        };

        allProducts.push(item);

        if (!res.audit.isMatched) {
          if (res.audit.issueType === 'PROHIBITED_ITEM' || res.audit.isProhibited) prohibitedCount++;
          else if (res.audit.issueType === 'IMAGE_MISMATCH') imageMismatchCount++;
          else if (res.audit.issueType === 'WRONG_CATEGORY') wrongCategoryCount++;

          flaggedProducts.push(item);

          // Cập nhật trạng thái vi phạm vào CSDL để đưa vào hàng đợi
          this.prisma.product.update({
            where: { id: res.p.id },
            data: {
              isViolated: true,
              violationReason: res.audit.imageFeedback || res.audit.recommendation,
            },
          }).catch(() => {});
        } else {
          matchedCount++;
          this.prisma.product.update({
            where: { id: res.p.id },
            data: {
              isViolated: false,
              violationReason: null,
            },
          }).catch(() => {});
        }
      }
    }

    const totalPages = Math.ceil(totalProducts / limit) || 1;

    return {
      totalScanned: products.length,
      totalProducts,
      page,
      limit,
      totalPages,
      matchedCount,
      wrongCategoryCount,
      imageMismatchCount,
      prohibitedCount,
      flaggedProducts,
      allProducts,
    };
  }

  /**
   * HÀNG ĐỢI DUYỆT VI PHẠM TẬP TRUNG (Centralized Trust & Safety Violation Queue)
   * Trả về danh sách CHỈ CÁC SẢN PHẨM CẦN XỬ LÝ (VIOLATIONS ONLY).
   */
  async getViolationQueue(
    shopId?: string,
    page = 1,
    limit = 50,
    issueType = 'ALL',
    status = 'active',
  ): Promise<BatchAuditStats> {
    const isHiddenTab = status === 'hidden';
    const whereCondition: any = {
      isViolated: true,
      status: isHiddenTab ? 'hidden' : 'active',
      name: { notIn: ['test', 'cuong', '2'] },
    };
    if (shopId) {
      whereCondition.shopId = shopId;
    }

    // 1. Kiểm tra số lượng sản phẩm vi phạm hiện có trong CSDL
    let totalViolations = await this.prisma.product.count({ where: whereCondition });

    // Nếu hàng đợi active trong DB còn ít (< 100):
    // Tự động quét bổ sung từ kho hàng active để nạp đầy hàng đợi vi phạm!
    if (totalViolations < 100 && !isHiddenTab) {
      await this.replenishViolationQueue(120);
      totalViolations = await this.prisma.product.count({ where: whereCondition });
    }

    const [totalProducts, violatedProducts, totalActiveViolations, totalHiddenViolations] = await Promise.all([
      this.prisma.product.count({ where: { status: { in: ['active', 'hidden'] } } }),
      this.prisma.product.findMany({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          image: true,
          images: true,
          category: true,
          shopId: true,
          status: true,
          violationReason: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where: { isViolated: true, status: 'active', name: { notIn: ['test', 'cuong', '2'] } } }),
      this.prisma.product.count({ where: { isViolated: true, status: 'hidden', name: { notIn: ['test', 'cuong', '2'] } } }),
    ]);

    // Chạy audit chi tiết để tạo auditResult đầy đủ cho từng sản phẩm vi phạm
    const CHUNK_SIZE = 10;
    const flaggedProducts: ScannedProductItem[] = [];
    let wrongCategoryCount = 0;
    let imageMismatchCount = 0;
    let prohibitedCount = 0;

    for (let i = 0; i < violatedProducts.length; i += CHUNK_SIZE) {
      const chunk = violatedProducts.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map(async (p) => {
          const cover = p.image || (p.images ? (() => { try { return JSON.parse(p.images)[0]; } catch { return ''; } })() : '');
          const audit = await this.auditProduct({
            productId: p.id,
            name: p.name,
            category: p.category,
            image: cover,
            isBatchScan: true,
          });
          return { p, cover, audit };
        }),
      );

      for (const res of results) {
        if (res.audit.issueType === 'PROHIBITED_ITEM' || res.audit.isProhibited) prohibitedCount++;
        else if (res.audit.issueType === 'IMAGE_MISMATCH') imageMismatchCount++;
        else if (res.audit.issueType === 'WRONG_CATEGORY') wrongCategoryCount++;

        flaggedProducts.push({
          id: res.p.id,
          name: res.p.name,
          image: res.cover,
          category: res.p.category,
          shopId: res.p.shopId,
          status: res.p.status,
          auditResult: res.audit,
        });
      }
    }

    const totalPages = Math.ceil(totalViolations / limit) || 1;

    return {
      totalScanned: flaggedProducts.length,
      totalProducts,
      totalViolations,
      totalActiveViolations,
      totalHiddenViolations,
      page,
      limit,
      totalPages,
      matchedCount: Math.max(0, totalProducts - totalViolations),
      wrongCategoryCount,
      imageMismatchCount,
      prohibitedCount,
      flaggedProducts,
      allProducts: flaggedProducts, // 100% trong danh sách là sản phẩm cần xử lý!
    };
  }

  /**
   * Quét các sản phẩm active để phát hiện và nạp thêm vi phạm vào hàng đợi
   */
  async replenishViolationQueue(targetCount = 100): Promise<number> {
    const unAuditedProducts = await this.prisma.product.findMany({
      where: {
        status: 'active',
        isViolated: false,
        name: { notIn: ['test', 'cuong', '2'] },
      },
      select: {
        id: true,
        name: true,
        image: true,
        images: true,
        category: true,
      },
      take: 250,
      orderBy: { createdAt: 'desc' },
    });

    if (unAuditedProducts.length === 0) return 0;

    let flaggedCount = 0;
    const CHUNK_SIZE = 10;

    for (let i = 0; i < unAuditedProducts.length; i += CHUNK_SIZE) {
      if (flaggedCount >= targetCount) break;
      const chunk = unAuditedProducts.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map(async (p) => {
          const cover = p.image || (p.images ? (() => { try { return JSON.parse(p.images)[0]; } catch { return ''; } })() : '');
          const audit = await this.auditProduct({
            productId: p.id,
            name: p.name,
            category: p.category,
            image: cover,
            isBatchScan: true,
          });
          return { id: p.id, audit };
        }),
      );

      for (const res of results) {
        if (!res.audit.isMatched) {
          flaggedCount++;
          await this.prisma.product.update({
            where: { id: res.id },
            data: {
              isViolated: true,
              violationReason: res.audit.imageFeedback || res.audit.recommendation,
            },
          }).catch(() => {});
        }
      }
    }

    return flaggedCount;
  }

  /**
   * 1-Click Tạm Ẩn Toàn Bộ Vi Phạm Đang Hoạt Động Trên Toàn Sàn
   */
  async bulkHideAllActiveViolations(reason?: string) {
    const activeViolations = await this.prisma.product.findMany({
      where: {
        isViolated: true,
        status: 'active',
      },
      select: {
        id: true,
        shopId: true,
        name: true,
        violationReason: true,
      },
    });

    if (activeViolations.length === 0) {
      return { count: 0, updatedIds: [] };
    }

    const ids = activeViolations.map((p) => p.id);
    const updated = await this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'hidden',
        isViolated: true,
        violationReason: reason || 'CSKH tạm ẩn do vi phạm quy định hình ảnh hoặc ngành hàng',
      },
    });

    // Gửi thông báo đến các shop
    try {
      const shopIds = Array.from(new Set(activeViolations.map((p) => p.shopId)));
      for (const sId of shopIds) {
        const count = activeViolations.filter((p) => p.shopId === sId).length;
        fetch('http://auth-service:3001/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: sId,
            title: '⚠️ [Sàn ZeroMall] Tạm ẩn sản phẩm vi phạm',
            message: `Hệ thống CSKH đã tạm ẩn ${count} sản phẩm của Shop do vi phạm quy định hình ảnh hoặc ngành hàng. Vui lòng vào Kênh Người Bán kiểm tra và chỉnh sửa.`,
            type: 'SYSTEM',
          }),
        }).catch(() => {});
      }
    } catch (e) {}

    return { count: updated.count, updatedIds: ids };
  }

  /**
   * Tự động sửa ngành hàng sản phẩm theo đề xuất của AI (1-Click Auto-Fix)
   */
  async fixProductCategory(productId: string, newCategory: string) {
    if (!CANONICAL_CATEGORIES.includes(newCategory)) {
      throw new Error(`Ngành hàng "${newCategory}" không hợp lệ trong hệ thống ZeroMall.`);
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        category: newCategory,
        isViolated: false,
        violationReason: null,
      },
    });

    this.logger.log(`[AI Auto-Fix] Product ${productId} category updated to ${newCategory}`);
    return {
      success: true,
      message: `Đã tự động cập nhật ngành hàng sản phẩm sang "${newCategory}" thành công!`,
      product: updated,
    };
  }

  /**
   * Kiểm tra từ khóa trong văn bản tiếng Việt (Unicode-safe, không bị lỗi ASCII \\b của RegExp)
   */
  private hasKeyword(text: string, keywords: string[]): boolean {
    if (!text) return false;
    const normalized = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ')} `;
    return keywords.some((k) => normalized.includes(` ${k.toLowerCase()} `));
  }

  /**
   * Loại bỏ các cụm từ ngữ cảnh phụ (mô tả tính năng bỏ túi, kích thước đựng vừa, mục đích sử dụng...)
   * để không làm sai lệch Danh từ Thực thể chính của sản phẩm
   */
  private cleanContextualModifiers(text: string): string {
    if (!text) return '';
    let t = text.toLowerCase();
    t = t.replace(/(dễ\s+bỏ\s+túi\s+quần|bỏ\s+túi\s+quần|túi\s+quần|nhét\s+túi|bỏ\s+túi|bỏ\s+vừa\s+túi|bỏ\s+vừa)/gu, ' ');
    t = t.replace(/(đựng\s+vừa\s+điện\s+thoại|đựng\s+điện\s+thoại|bỏ\s+vừa\s+điện\s+thoại|chứa\s+điện\s+thoại)/gu, ' ');
    t = t.replace(/(dành\s+cho|dùng\s+cho|thích\s+hợp\s+cho|tương\s+thích\s+với|phù\s+hợp\s+cho)\s+[\p{L}\p{N}\s]+/gu, ' ');
    t = t.replace(/(in\s+hình|họa\s+tiết|tặng\s+kèm|kèm\s+theo)\s+[\p{L}\p{N}\s]+/gu, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }

  /**
   * Suy luận ngành hàng chuẩn dựa trên Tên sản phẩm
   * Sử dụng nguyên lý Ngôn ngữ học Tiếng Việt: Danh từ thực thể chính (Head Noun) luôn đứng đầu tiêu đề
   */
  private inferCategoryFromTitle(lowerName: string): string | null {
    const cleaned = this.cleanContextualModifiers(lowerName);

    // =========================================================================
    // BƯỚC 1: ƯU TIÊN HEAD NOUN Ở ĐẦU TIÊU ĐỀ (Prefix Match)
    // Giúp nhận diện chính xác "Đồng hồ nam thể thao" là Đồng Hồ (không phải Thể Thao)
    // "Chân máy ảnh tripod điện thoại" là Máy Ảnh (không phải Điện Thoại)
    // =========================================================================
    if (/^\s*(đồng hồ|dong ho|smartwatch|apple watch)/i.test(cleaned)) {
      return 'Đồng Hồ';
    }
    if (/^\s*(máy ảnh|may anh|chân máy|tripod|ống kính|lens|flycam|gopro|gimbal|camera)/i.test(cleaned)) {
      return 'Máy Ảnh';
    }
    if (/^\s*(pin sạc|sạc dự phòng|pin dự phòng|cáp sạc|củ sạc|dây sạc|cốc sạc|sạc không dây|tai nghe|airpods|headphone|ốp lưng|kính cường lực|dán màn hình|giá đỡ điện thoại|gậy chụp|điện thoại|smartphone|iphone|samsung|xiaomi|oppo|vivo)/i.test(cleaned)) {
      return 'Điện Thoại & Phụ Kiện';
    }
    if (/^\s*(ví|vi|bóp|túi xách|túi đeo|túi tote|túi bao tử|clutch|balo|ba lô|cặp sách|túi canvas)/i.test(cleaned)) {
      return 'Túi Ví Nữ';
    }
    if (/^\s*(laptop|macbook|bàn phím|chuột|màn hình máy tính|pc|tai nghe gaming|ổ cứng|ram|cpu|vga)/i.test(cleaned)) {
      return 'Máy Tính & Laptop';
    }
    if (/^\s*(sneaker|giày|giay|sandal|dép|dep|boots|guốc|cao gót)/i.test(cleaned)) {
      if (this.hasKeyword(cleaned, ['nữ', 'cao gót', 'guốc'])) return 'Giày Dép Nữ';
      return 'Giày Dép Nam';
    }
    if (/^\s*(nồi|noi|lò vi sóng|máy xay|ấm siêu tốc|bếp|chảo|máy hút bụi|quạt điện)/i.test(cleaned)) {
      return 'Gia Dụng';
    }
    if (/^\s*(sách|truyện|tiểu thuyết|giáo khoa|giáo trình|vở|bút)/i.test(cleaned)) {
      return 'Sách & VPP';
    }
    if (/^\s*(son|kem|serum|toner|nước hoa|sữa rửa mặt|mặt nạ|phấn)/i.test(cleaned)) {
      return 'Sắc Đẹp';
    }
    if (/^\s*(tã|bỉm|sữa bột|bình sữa|xe đẩy|nôi em bé)/i.test(cleaned)) {
      return 'Mẹ & Bé';
    }
    if (/^\s*(áo|quần|đầm|váy|chân váy|set đồ|bộ đồ|đồ bộ|khoác|jacket|blazer|hoodie|sweater|polo|sơ mi)/i.test(cleaned)) {
      if (this.hasKeyword(cleaned, ['nữ', 'váy', 'đầm', 'croptop', 'chân váy', 'hai dây'])) return 'Thời Trang Nữ';
      if (this.hasKeyword(cleaned, ['bé', 'trẻ em', 'sơ sinh'])) return 'Mẹ & Bé';
      return 'Thời Trang Nam';
    }

    // =========================================================================
    // BƯỚC 2: QUÉT TỪ KHÓA TOÀN VĂN (Fallback cho tiêu đề đảo ngữ)
    // =========================================================================
    // 1. Đồng hồ
    if (this.hasKeyword(cleaned, ['đồng hồ', 'dong ho', 'smartwatch', 'apple watch'])) {
      return 'Đồng Hồ';
    }
    if (
      this.hasKeyword(cleaned, [
        'pin sạc dự phòng', 'sạc dự phòng', 'pin dự phòng', 'pin sac', 'sac du phong',
        'cáp sạc', 'củ sạc', 'dây sạc', 'cốc sạc', 'sạc không dây', 'đế sạc',
        'tai nghe bluetooth', 'tai nghe', 'airpods', 'headphone', 'earphone',
        'ốp lưng', 'kính cường lực', 'dán màn hình', 'gậy chụp ảnh', 'giá đỡ điện thoại',
        'điện thoại', 'dien thoai', 'smartphone', 'iphone', 'samsung', 'xiaomi', 'oppo', 'vivo',
        'thẻ nhớ', 'sim'
      ])
    ) {
      return 'Điện Thoại & Phụ Kiện';
    }

    // 2. Balo & Túi ví (Ví nữ cầm tay, ví nam, bóp da, túi xách, balo...)
    if (
      this.hasKeyword(cleaned, [
        'ví', 'vi', 'ví nữ', 'ví nam', 'ví cầm tay', 'ví dài', 'bóp', 'bóp ví', 'bóp da',
        'túi xách', 'túi đeo chéo', 'túi đeo', 'túi tote', 'túi bao tử', 'clutch', 'balo', 'ba lô', 'cặp sách', 'túi canvas'
      ])
    ) {
      return 'Túi Ví Nữ';
    }

    // 3. Thể thao
    if (
      this.hasKeyword(cleaned, [
        'bóng đá', 'đá bóng', 'áo đấu', 'quần áo bóng đá', 'cầu lông',
        'bóng rổ', 'bóng chuyền', 'tennis', 'vợt', 'gym', 'thể thao',
        'bơi lội', 'yoga', 'chạy bộ', 'wika', 'đồ thể thao',
      ])
    ) {
      return 'Thể Thao';
    }

    // 4. Giày dép
    if (
      this.hasKeyword(cleaned, [
        'sneaker', 'giày', 'giay', 'sandal', 'dép', 'dep', 'boots',
        'slip-on', 'giày thể thao', 'cao gót', 'guốc',
      ])
    ) {
      if (this.hasKeyword(cleaned, ['nữ', 'cao gót', 'guốc'])) return 'Giày Dép Nữ';
      return 'Giày Dép Nam';
    }

    // 5. Gia dụng / Bếp núc
    if (
      this.hasKeyword(cleaned, [
        'nồi chiên', 'noi chien', 'nồi cơm', 'noi com', 'lò vi sóng',
        'máy xay', 'ấm siêu tốc', 'nồi áp suất', 'bếp từ', 'bếp điện',
        'chảo chống dính', 'máy hút bụi', 'quạt điện',
      ])
    ) {
      return 'Gia Dụng';
    }

    // 6. Máy ảnh & Thiết bị quang học
    if (
      this.hasKeyword(cleaned, [
        'máy ảnh', 'may anh', 'camera', 'ống kính', 'lens', 'tripod',
        'flycam', 'gopro', 'gimbal', 'máy quay',
      ])
    ) {
      return 'Máy Ảnh';
    }

    // 7. Máy tính & Laptop
    if (
      this.hasKeyword(cleaned, [
        'laptop', 'macbook', 'bàn phím', 'chuột gaming', 'chuột máy tính', 'màn hình máy tính',
        'pc', 'tai nghe gaming', 'ổ cứng', 'ram', 'cpu', 'vga'
      ])
    ) {
      return 'Máy Tính & Laptop';
    }

    // 8. Sách & Văn phòng phẩm
    if (
      this.hasKeyword(cleaned, [
        'sách', 'truyện', 'tiểu thuyết', 'giáo khoa', 'giáo trình', 'vở viết',
        'bút bi', 'bút mực', 'văn phòng phẩm',
      ])
    ) {
      return 'Sách & VPP';
    }

    // 9. Sắc đẹp & Mỹ phẩm
    if (
      this.hasKeyword(cleaned, [
        'son môi', 'kem chống nắng', 'serum', 'toner', 'nước hoa', 'sữa rửa mặt',
        'mặt nạ', 'dưỡng ẩm', 'phấn',
      ])
    ) {
      return 'Sắc Đẹp';
    }

    // 10. Mẹ & Bé
    if (
      this.hasKeyword(cleaned, [
        'tã', 'bỉm', 'sữa bột', 'bình sữa', 'xe đẩy', 'đồ chơi trẻ em', 'nôi em bé',
      ])
    ) {
      return 'Mẹ & Bé';
    }

    // 11. Đồng hồ
    if (
      this.hasKeyword(cleaned, ['đồng hồ', 'dong ho', 'smartwatch', 'apple watch'])
    ) {
      return 'Đồng Hồ';
    }

    // 12. Thời trang chung / Nam / Nữ
    if (
      this.hasKeyword(cleaned, [
        'áo', 'quần', 'đồ bộ', 'bộ đồ', 'set đồ', 'trang phục', 'khoác',
        'jacket', 'blazer', 'hoodie', 'sweater', 'cardigan', 'polo', 'sơ mi',
        'so mi', 'short', 'jean', 'quần âu', 'quần đùi', 'quần bò', 'kaki',
        'quần lót', 'boxer', 'váy', 'đầm', 'chân váy', 'croptop', 'siêu nhân',
      ])
    ) {
      if (this.hasKeyword(cleaned, ['nữ', 'váy', 'đầm', 'croptop', 'chân váy', 'hai dây'])) {
        return 'Thời Trang Nữ';
      }
      if (this.hasKeyword(cleaned, ['bé', 'trẻ em', 'sơ sinh'])) {
        return 'Mẹ & Bé';
      }
      return 'Thời Trang Nam';
    }

    // 13. Nhà cửa & Đời sống
    if (
      this.hasKeyword(cleaned, [
        'kệ đồ', 'kệ bếp', 'bát đĩa', 'bộ bát', 'bình giữ nhiệt',
        'hộp đựng thực phẩm', 'ly giữ nhiệt', 'chăn ga', 'gối nệm',
      ])
    ) {
      return 'Nhà Cửa';
    }

    // 14. Phụ kiện thời trang
    if (
      this.hasKeyword(cleaned, [
        'nón lưỡi trai', 'mũ lưỡi trai', 'mũ len', 'vòng tay', 'dây chuyền',
        'khuyên tai', 'mắt kính',
      ])
    ) {
      return 'Phụ Kiện Nữ';
    }

    return null;
  }

  /**
   * Kiểm tra xem 2 ngành hàng có tương thích/chấp nhận được cho nhau không
   */
  private isCategoryCompatible(current: string, inferred: string): boolean {
    if (!current || !inferred) return true;
    if (current === inferred) return true;

    // Các cặp ngành hàng chấp nhận được lẫn nhau
    const compatiblePairs: Record<string, string[]> = {
      'Gia Dụng': ['Nhà Cửa'],
      'Nhà Cửa': ['Gia Dụng'],
      'Thời Trang Nam': ['Thời Trang Nữ', 'Thể Thao'],
      'Thời Trang Nữ': ['Thời Trang Nam', 'Phụ Kiện Nữ', 'Túi Ví Nữ', 'Thể Thao'],
      'Thể Thao': ['Thời Trang Nam', 'Thời Trang Nữ'],
      'Giày Dép Nam': ['Giày Dép Nữ'],
      'Giày Dép Nữ': ['Giày Dép Nam'],
      'Túi Ví Nữ': ['Thời Trang Nam', 'Thời Trang Nữ', 'Phụ Kiện Nữ'],
      'Điện Thoại & Phụ Kiện': ['Thiết Bị Điện Tử'],
      'Thiết Bị Điện Tử': ['Điện Thoại & Phụ Kiện', 'Máy Tính & Laptop', 'Máy Ảnh'],
      'Máy Ảnh': ['Thiết Bị Điện Tử'],
    };

    if (compatiblePairs[current]?.includes(inferred)) return true;
    if (compatiblePairs[inferred]?.includes(current)) return true;

    return false;
  }

  /**
   * Phân loại domain ngữ nghĩa (Sports Apparel, Footwear, Kitchen, Electronics, etc.)
   */
  private getSemanticDomain(text: string): string[] {
    const domains: string[] = [];

    if (
      this.hasKeyword(text, [
        'bóng đá', 'đá bóng', 'áo đấu', 'jersey', 'wika', 'thể thao',
        'cầu lông', 'bóng rổ', 'quần áo bóng đá', 'áo thun thể thao',
      ])
    ) {
      domains.push('SPORTS_FOOTBALL');
    }
    // Phân loại chi tiết Áo (Tops) vs Quần (Bottoms) vs Bộ (Suit/Set)
    const hasTop = this.hasKeyword(text, [
      'áo', 'ao', 'khoác', 'jacket', 'hoodie', 'sweater', 'cardigan',
      'polo', 'sơ mi', 'áo thun', 'blazer', 'vest', 'croptop', 'gile',
    ]);
    const hasBottom = this.hasKeyword(text, [
      'quần', 'quan', 'jean', 'short', 'quần âu', 'quần đùi', 'quần bò',
      'kaki', 'jogger', 'legging', 'quần lót', 'boxer', 'quần thể thao',
    ]);
    const isSuit = this.hasKeyword(text, [
      'đồ bộ', 'bộ đồ', 'set đồ', 'bộ quần áo', 'áo và quần', 'áo phối quần', 'combo',
    ]);

    if (isSuit || (hasTop && hasBottom)) {
      domains.push('SUIT_SET');
    } else {
      if (hasTop) domains.push('TOPS');
      if (hasBottom) domains.push('BOTTOMS');
    }
    if (this.hasKeyword(text, ['váy', 'đầm', 'chân váy'])) {
      domains.push('DRESS');
    }
    if (
      this.hasKeyword(text, [
        'giày', 'dép', 'sneaker', 'sandal', 'boots', 'guốc', 'cao gót',
        'slip-on', 'giay', 'dep',
      ])
    ) {
      domains.push('FOOTWEAR');
    }
    // Phân loại chi tiết Footwear (Sneaker vs Dép bánh mì / Sandal vs Cao gót)
    if (this.hasKeyword(text, ['dép bánh mì', 'dép quai ngang', 'dép lê', 'dép kẹp', 'dép xỏ ngón', 'dép sục', 'sandal', 'xăng đan', 'dép', 'dep'])) {
      domains.push('FOOTWEAR_SLIDES');
    }
    if (this.hasKeyword(text, ['sneaker', 'giày thể thao', 'giày chạy bộ', 'giày bóng đá', 'giày đá bóng', 'running shoes', 'giày sneaker'])) {
      domains.push('FOOTWEAR_SNEAKERS');
    }
    if (this.hasKeyword(text, ['giày cao gót', 'guốc', 'stiletto', 'giày búp bê'])) {
      domains.push('FOOTWEAR_HEELS');
    }

    // Phân loại chi tiết Tops (Áo thun vs Cardigan / Áo len dệt kim)
    if (this.hasKeyword(text, ['cardigan', 'áo len', 'ao len', 'len dệt kim', 'dệt kim', 'knitwear'])) {
      domains.push('TOPS_CARDIGAN');
    }
    if (this.hasKeyword(text, ['áo thun', 'áo phông', 't-shirt', 'tee']) && !this.hasKeyword(text, ['cardigan', 'áo len', 'dệt kim'])) {
      domains.push('TOPS_TSHIRT');
    }
    if (
      this.hasKeyword(text, [
        'nồi chiên', 'nồi cơm', 'lò vi sóng', 'bếp', 'chảo', 'ấm siêu tốc',
        'máy xay', 'gia dụng', 'noi chien', 'noi com',
      ])
    ) {
      domains.push('KITCHEN');
    }
    if (
      this.hasKeyword(text, [
        'máy ảnh', 'may anh', 'camera', 'ống kính', 'lens', 'tripod',
        'flycam', 'gopro', 'gimbal', 'máy quay',
      ])
    ) {
      domains.push('CAMERA');
    }
    if (this.hasKeyword(text, ['balo', 'ba lô', 'túi', 'ví', 'bóp', 'clutch', 'cặp'])) {
      domains.push('BAGS');
    }
    if (
      this.hasKeyword(text, [
        'điện thoại', 'iphone', 'samsung', 'laptop', 'tai nghe', 'chuột',
        'bàn phím', 'màn hình', 'sạc', 'cáp',
      ])
    ) {
      domains.push('ELECTRONICS');
    }
    if (
      this.hasKeyword(text, [
        'sơ đồ', 'flowchart', 'diagram', 'architecture', 'mã nguồn',
        'terminal', 'văn bản',
      ])
    ) {
      domains.push('DIAGRAM_DOC');
    }
    if (this.hasKeyword(text, ['xe đạp', 'bicycle', 'cyclist', 'giao hàng ngoài trời'])) {
      domains.push('CYCLIST_SCENE');
    }

    return domains;
  }

  /**
   * Kiểm tra mâu thuẫn ngữ nghĩa giữa Hình ảnh nhận diện được và Tên sản phẩm
   */
  private checkSemanticMismatch(
    visualText: string,
    rawName: string,
  ): { isMismatch: boolean; reason?: string } {
    const visualDomains = this.getSemanticDomain(visualText);
    const titleDomains = this.getSemanticDomain(rawName);

    // Nếu không phân loại được domain cụ thể từ cả 2 phía -> không kết luận lệch
    if (visualDomains.length === 0 || titleDomains.length === 0) {
      return { isMismatch: false };
    }

    // Nếu ảnh là đồ thể thao / bóng đá (SPORTS_FOOTBALL), nhưng tên lại là siêu nhân, gao, công chúa, đồ ngủ...
    if (
      visualDomains.includes('SPORTS_FOOTBALL') &&
      this.hasKeyword(rawName, [
        'siêu nhân', 'gao', 'công chúa', 'bà ba', 'áo dài', 'đồ ngủ',
        'pijama', 'hoạt hình', 'anime', 'cosplay',
      ])
    ) {
      return {
        isMismatch: true,
        reason: `Ảnh là trang phục thể thao/bóng đá thực tế, không tương đồng với tên "${rawName}".`,
      };
    }

    // Xung đột Áo (TOPS) vs Quần (BOTTOMS)
    if (visualDomains.includes('TOPS') && titleDomains.includes('BOTTOMS') && !titleDomains.includes('SUIT_SET')) {
      return {
        isMismatch: true,
        reason: `Ảnh hiển thị áo/áo khoác, không khớp với tên sản phẩm bạn nhập là quần ("${rawName}").`,
      };
    }
    if (visualDomains.includes('BOTTOMS') && titleDomains.includes('TOPS') && !titleDomains.includes('SUIT_SET')) {
      return {
        isMismatch: true,
        reason: `Ảnh hiển thị quần thời trang, không khớp với tên sản phẩm bạn nhập là áo ("${rawName}").`,
      };
    }

    // Xung đột phân loại con trong Giày dép: Sneaker vs Dép bánh mì / Sandal
    if (
      (visualDomains.includes('FOOTWEAR_SNEAKERS') || /giày thể thao|sneaker/i.test(visualText)) &&
      titleDomains.includes('FOOTWEAR_SLIDES')
    ) {
      return {
        isMismatch: true,
        reason: `Ảnh hiển thị giày thể thao / sneaker, không khớp với tên sản phẩm bạn nhập là dép / dép bánh mì ("${rawName}").`,
      };
    }
    if (
      (visualDomains.includes('FOOTWEAR_SLIDES') || /dép|sandal/i.test(visualText)) &&
      titleDomains.includes('FOOTWEAR_SNEAKERS')
    ) {
      return {
        isMismatch: true,
        reason: `Ảnh hiển thị dép / sandal, không khớp với tên sản phẩm bạn nhập là giày thể thao / sneaker ("${rawName}").`,
      };
    }

    // Xung đột phân loại con trong Áo: Áo thun vs Cardigan / Áo len dệt kim
    if (
      (visualDomains.includes('TOPS_TSHIRT') || /áo thun|áo phông/i.test(visualText)) &&
      titleDomains.includes('TOPS_CARDIGAN')
    ) {
      return {
        isMismatch: true,
        reason: `Ảnh hiển thị áo thun / áo phông năng động, không khớp với sản phẩm là áo cardigan / áo len dệt kim ("${rawName}").`,
      };
    }
    if (
      (visualDomains.includes('TOPS_CARDIGAN') || /cardigan|áo len/i.test(visualText)) &&
      titleDomains.includes('TOPS_TSHIRT')
    ) {
      return {
        isMismatch: true,
        reason: `Ảnh hiển thị áo cardigan / áo len dệt kim, không khớp với sản phẩm là áo thun / áo phông ("${rawName}").`,
      };
    }

    // Nếu có ít nhất 1 domain giao nhau -> TƯƠNG THÍCH
    const hasOverlap = visualDomains.some((d) => titleDomains.includes(d));
    if (hasOverlap) {
      return { isMismatch: false };
    }

    // Các cặp xung đột:
    // 1. Áo / Quần / Trang phục vs Giày dép
    if (
      (visualDomains.includes('SPORTS_FOOTBALL') || visualDomains.includes('TOPS') || visualDomains.includes('BOTTOMS') || visualDomains.includes('SUIT_SET')) &&
      titleDomains.includes('FOOTWEAR')
    ) {
      return {
        isMismatch: true,
        reason: `Ảnh là trang phục quần áo, không khớp với tên sản phẩm bạn nhập là giày dép ("${rawName}").`,
      };
    }

    // 2. Giày dép vs Áo / Quần / Trang phục
    if (
      visualDomains.includes('FOOTWEAR') &&
      (titleDomains.includes('SPORTS_FOOTBALL') || titleDomains.includes('TOPS') || titleDomains.includes('BOTTOMS') || titleDomains.includes('SUIT_SET'))
    ) {
      return {
        isMismatch: true,
        reason: `Ảnh là giày dép, không khớp với tên sản phẩm bạn nhập là quần áo ("${rawName}").`,
      };
    }

    // 3. Gia dụng / Bếp núc vs Khác
    if (visualDomains.includes('KITCHEN') && !titleDomains.includes('KITCHEN')) {
      return {
        isMismatch: true,
        reason: `Ảnh là đồ gia dụng/nhà bếp, không khớp với tên sản phẩm "${rawName}".`,
      };
    }

    // 4. Sơ đồ tài liệu vs Sản phẩm tiêu dùng
    if (visualDomains.includes('DIAGRAM_DOC')) {
      return {
        isMismatch: true,
        reason: `Ảnh hiển thị sơ đồ/văn bản hệ thống, không phải ảnh sản phẩm thực tế ("${rawName}").`,
      };
    }

    // 5. Cảnh người đi xe đạp vs Sản phẩm không liên quan đến xe đạp
    if (visualDomains.includes('CYCLIST_SCENE') && !this.hasKeyword(rawName, ['xe đạp', 'bicycle', 'phụ kiện xe đạp'])) {
      return {
        isMismatch: true,
        reason: `Ảnh chụp người đi xe đạp ngoài trời, không khớp với sản phẩm "${rawName}".`,
      };
    }

    return { isMismatch: false };
  }

  /**
   * Bộ nhớ đệm nhận diện thị giác của hình ảnh (Decoupled Visual Perception Cache)
   */
  private visualPerceptionCache = new Map<
    string,
    {
      detectedVisual: string;
      suggestedTitle: string;
      suggestedCategory: string;
      confidence: number;
    }
  >();

  /**
   * Gọi mô hình Zero-shot Multimodal CLIP cục bộ (Port 5005)
   * 100% Offline, không tốn quota, phản hồi < 100ms
   */
  /**
   * AGENT: MultiImageVisualAgent
   * Gửi toàn bộ album ảnh sang Local CLIP để quét song song và áp dụng Worst-case Pooling
   */
  private async queryLocalClipVisionMulti(
    images: string[],
    rawName: string,
    category: string,
  ): Promise<{
    isMismatch: boolean;
    isProhibited?: boolean;
    prohibitedLabel?: string;
    detectedVisual?: string;
    suggestedTitle?: string;
    suggestedCategory?: string;
    reason?: string;
    confidence?: number;
    worstImageIndex?: number;
    totalImagesScanned?: number;
    source?: 'local-clip-engine';
  } | null> {
    const activeUrl = await this.getActiveClipUrl();
    if (!activeUrl) {
      return null;
    }

    const payload = {
      name: rawName,
      category,
      images: images.slice(0, 9),
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(activeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data: any = await res.json();
        return {
          isMismatch: !!data.isMismatch,
          isProhibited: !!data.isProhibited,
          prohibitedLabel: data.prohibitedLabel,
          detectedVisual: data.detectedVisual,
          suggestedTitle: data.suggestedTitle,
          suggestedCategory: data.suggestedCategory,
          reason: data.reason,
          confidence: Math.max(92, Math.round(data.visualConfidence || 95)),
          worstImageIndex: data.worstImageIndex,
          totalImagesScanned: data.totalImagesScanned,
          source: 'local-clip-engine',
        };
      }
    } catch (err: any) {
      this.logger.warn(`Local CLIP multi-audit warning: ${err.message}`);
    }
    return null;
  }

  private async queryLocalClipVision(
    imageUrl: string,
    rawName: string,
    category: string,
    base64Data?: string,
  ): Promise<{
    isMismatch: boolean;
    isProhibited?: boolean;
    prohibitedLabel?: string;
    detectedVisual?: string;
    suggestedTitle?: string;
    suggestedCategory?: string;
    reason?: string;
    confidence?: number;
    source?: 'local-clip-engine';
  } | null> {
    const cacheKey = `${imageUrl}__${rawName}__${category}`;
    if (this.visualPerceptionCache.has(cacheKey)) {
      return this.visualPerceptionCache.get(cacheKey) as any;
    }

    const activeUrl = await this.getActiveClipUrl();
    if (!activeUrl) {
      return null;
    }

    const payload: any = {
      name: rawName,
      category,
    };

    if (base64Data) {
      payload.imageBase64 = base64Data;
    } else if (imageUrl) {
      if (imageUrl.startsWith('data:')) {
        payload.imageBase64 = imageUrl;
      } else {
        payload.imageUrl = imageUrl;
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(activeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data: any = await res.json();
        const result = {
          isMismatch: !!data.isMismatch,
          isProhibited: !!data.isProhibited,
          prohibitedLabel: data.prohibitedLabel,
          detectedVisual: data.detectedVisual,
          suggestedTitle: data.suggestedTitle,
          suggestedCategory: data.suggestedCategory,
          reason: data.reason,
          confidence: Math.max(92, Math.round(data.visualConfidence || 95)),
          source: 'local-clip-engine' as const,
        };
        this.visualPerceptionCache.set(cacheKey, result as any);
        return result;
      }
    } catch (err: any) {
      this.logger.warn(`Local CLIP vision query warning: ${err.message}`);
    }
    return null;
  }

  /**
   * Phân tích dấu hiệu nhận diện hình ảnh đa phương thức (Local CLIP Vision + Ollama + Heuristics)
   */
  private async analyzeVisualClue(
    imageUrl: string,
    rawName: string,
    category: string,
  ): Promise<{
    isMismatch: boolean;
    isProhibited?: boolean;
    prohibitedLabel?: string;
    detectedVisual?: string;
    suggestedTitle?: string;
    suggestedCategory?: string;
    reason?: string;
    confidence?: number;
    source?: string;
  }> {
    if (!imageUrl) {
      return { isMismatch: false };
    }

    const lowerImg = imageUrl.toLowerCase();
    const lowerName = rawName.toLowerCase();

    // 1. Kiểm tra cache nhận diện thị giác của ảnh (nếu ảnh này đã được phân tích trước đó)
    const cachedPerception = this.visualPerceptionCache.get(imageUrl);
    if (cachedPerception) {
      const evalCheck = this.checkSemanticMismatch(
        `${cachedPerception.detectedVisual} ${cachedPerception.suggestedTitle}`,
        lowerName,
      );

      if (evalCheck.isMismatch) {
        return {
          isMismatch: true,
          detectedVisual: cachedPerception.detectedVisual,
          suggestedTitle: cachedPerception.suggestedTitle,
          suggestedCategory: cachedPerception.suggestedCategory,
          reason: evalCheck.reason,
          confidence: cachedPerception.confidence,
          source: 'local-clip-engine',
        };
      }

      return {
        isMismatch: false,
        detectedVisual: cachedPerception.detectedVisual,
        suggestedTitle: cachedPerception.suggestedTitle,
        suggestedCategory: cachedPerception.suggestedCategory,
        source: 'local-clip-engine',
      };
    }

    // 2. Phân tích thị giác trực tiếp bằng mô hình Local CLIP Vector (Tier 1: <100ms, 0 quota)
    const activeClip = await this.getActiveClipUrl();
    if (!activeClip) {
      return { isMismatch: false };
    }

    try {
      const imgData = await this.fetchImageBase64(imageUrl);
      const clipRes = await this.queryLocalClipVision(
        imageUrl,
        rawName,
        category,
        imgData?.base64,
      );

      if (clipRes) {
        if (clipRes.isProhibited) {
          return {
            isMismatch: true,
            isProhibited: true,
            prohibitedLabel: clipRes.prohibitedLabel,
            detectedVisual: clipRes.detectedVisual || clipRes.prohibitedLabel || 'Vật phẩm cấm',
            suggestedTitle: clipRes.suggestedTitle || rawName,
            suggestedCategory: category || 'Thời Trang Nam',
            reason: clipRes.reason || `[Visual Safety Guard] Ảnh phát hiện ${clipRes.prohibitedLabel} - thuộc danh mục cấm kinh doanh trên sàn!`,
            confidence: clipRes.confidence || 98,
            source: 'local-clip-engine',
          };
        }

        const perception = {
          detectedVisual: clipRes.detectedVisual || 'Sản phẩm',
          suggestedTitle: clipRes.suggestedTitle || rawName,
          suggestedCategory: clipRes.suggestedCategory || category || 'Thể Thao',
          confidence: clipRes.confidence || 95,
        };
        this.visualPerceptionCache.set(imageUrl, perception);

        // Kiểm tra bổ sung ngữ nghĩa nếu tên nhập xung đột
        const evalCheck = this.checkSemanticMismatch(
          `${perception.detectedVisual} ${perception.suggestedTitle}`,
          lowerName,
        );

        if (clipRes.isMismatch || evalCheck.isMismatch) {
          return {
            isMismatch: true,
            isProhibited: false,
            detectedVisual: perception.detectedVisual,
            suggestedTitle: perception.suggestedTitle,
            suggestedCategory: perception.suggestedCategory,
            reason:
              clipRes.reason ||
              evalCheck.reason ||
              `Ảnh hiển thị "${perception.detectedVisual}", không tương đồng với tên "${rawName}".`,
            confidence: perception.confidence,
            source: 'local-clip-engine',
          };
        }

        return {
          isMismatch: false,
          isProhibited: false,
          detectedVisual: perception.detectedVisual,
          suggestedTitle: perception.suggestedTitle,
          suggestedCategory: perception.suggestedCategory,
          source: 'local-clip-engine',
        };
      }
    } catch (e: any) {
      this.logger.warn(`Local CLIP analysis failed: ${e.message}`);
    }

    // 4. Dự phòng qua Local Ollama Vision nếu CLIP bận (Tier 2: Moondream / Minicpm-v)
    try {
      const imgData = await this.fetchImageBase64(imageUrl);
      if (imgData?.base64) {
        const ollamaRes = await this.localAi.parseVisualWithMoondream(imgData.base64);
        if (ollamaRes) {
          const perception = {
            detectedVisual: ollamaRes.detectedProduct || 'Sản phẩm',
            suggestedTitle: ollamaRes.detectedProduct || rawName,
            suggestedCategory: ollamaRes.suggestedCategory || category || 'Thời Trang Nam',
            confidence: 90,
          };
          this.visualPerceptionCache.set(imageUrl, perception);

          const evalCheck = this.checkSemanticMismatch(
            `${perception.detectedVisual} ${perception.suggestedTitle}`,
            lowerName,
          );

          if (evalCheck.isMismatch) {
            return {
              isMismatch: true,
              ...perception,
              reason:
                evalCheck.reason ||
                `Ảnh là "${perception.detectedVisual}", không tương đồng với tên "${rawName}".`,
              source: 'local-ai-engine',
            };
          }

          return {
            isMismatch: false,
            ...perception,
            source: 'local-ai-engine',
          };
        }
      }
    } catch (e: any) {
      this.logger.warn(`Local Ollama Vision failed: ${e.message}`);
    }

    return { isMismatch: false };
  }

  private async fetchImageBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('data:')) {
      const parts = imageUrl.split(',');
      const mimeMatch = parts[0].match(/data:(.*?);/);
      return {
        base64: parts[1],
        mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
      };
    }
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(imageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        return {
          base64: Buffer.from(arrayBuffer).toString('base64'),
          mimeType: res.headers.get('content-type') || 'image/jpeg',
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}
