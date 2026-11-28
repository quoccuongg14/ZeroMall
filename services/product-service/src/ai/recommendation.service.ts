import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis/redis.service';
import { LocalAiService } from './local-ai.service';
import { randomUUID } from 'crypto';

export class TrackActionDto {
  userId: string;
  action: 'VIEW' | 'CART' | 'LIKE' | 'PURCHASE' | 'SEARCH';
  productId?: string;
  category?: string;
  metadata?: any;
}

export class MergeGuestDto {
  guestId: string;
  userId: string;
}

export class RecommendationQueryDto {
  userId?: string;
  gender?: string; // Optional fallback only when zero behavior exists
  limit?: number;
  page?: number;
}

interface WeightedEntry {
  score: number;
  updatedAt: number;
}

const ACTION_WEIGHTS: Record<string, number> = {
  VIEW: 1.5,
  SEARCH: 3.0,
  LIKE: 4.5,
  CART: 6.5,
  PURCHASE: 10.0,
};

// Danh sách từ khóa lõi giúp giữ đúng loại sản phẩm cụ thể (Tránh xem Quần Jean lại gợi ý Đầm)
const STOP_WORDS = new Set([
  'chính', 'hãng', 'cao', 'cấp', 'giá', 'rẻ', 'phong', 'cách', 'trẻ', 'trung',
  'thanh', 'lịch', 'sang', 'trọng', 'mới', 'nhất', 'hot', 'trend', 'hàn', 'quốc',
  'unisex', 'freesize', 'cực', 'xinh', 'đẹp', 'bền', 'tốt', 'tiện', 'lợi', 'thông',
  'minh', 'đa', 'năng', 'loại', 'dành', 'cho', 'với', 'hoặc', 'và', 'của', 'tại',
  'nhà', 'phối', 'đồ', 'mặc', 'dễ', 'chất', 'vải', 'siêu', 'mềm', 'mịn', 'thoáng',
  'mát', 'co', 'giãn', 'chống', 'nhăn', 'nước', 'bụi', 'mẫu', 'bản', 'phiên',
]);

const FEMALE_CATEGORIES = new Set(['Thời Trang Nữ', 'Giày Dép Nữ', 'Sắc Đẹp', 'Phụ Kiện Nữ', 'Túi Ví Nữ']);
const MALE_CATEGORIES = new Set(['Thời Trang Nam', 'Giày Dép Nam']);
const HALF_LIFE_HOURS = 48;

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly localAi: LocalAiService,
  ) {}

  private applyDecay(entry: WeightedEntry | number | undefined, now = Date.now()): number {
    if (entry === undefined || entry === null) return 0;
    if (typeof entry === 'number') return entry;
    const ageHours = Math.max(0, (now - (entry.updatedAt || now)) / 3600000);
    return (entry.score || 0) * Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
  }

  private extractKeywords(rawText?: string | null): string[] {
    if (!rawText) return [];
    const cleaned = rawText
      .toLowerCase()
      .replace(/(dễ\s+phối|phối\s+cùng|phối\s+với|mix\s+cùng|dành\s+cho|tặng\s+kèm)\s+[\p{L}\p{N}\s]+/gu, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return [];
    const words = cleaned
      .split(' ')
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

    const phrases: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!phrases.includes(bigram)) phrases.push(bigram);
    }
    for (const w of words) {
      if (w.length >= 3 && !phrases.includes(w)) phrases.push(w);
    }
    return phrases.slice(0, 8);
  }

  private parseMetadata(raw?: string | null): any {
    if (!raw) return null;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }

  private async upsertDecayedWeightMap(
    key: string,
    increments: Record<string, number>,
    maxEntries: number,
    ttlSeconds: number,
  ): Promise<void> {
    const entries = Object.entries(increments).filter(([k, v]) => k && v > 0);
    if (entries.length === 0) return;

    const now = Date.now();
    const existing = (await this.redis.get<Record<string, WeightedEntry | number>>(key)) || {};
    const next: Record<string, WeightedEntry> = {};

    for (const [k, rawVal] of Object.entries(existing)) {
      const decayed = this.applyDecay(rawVal, now);
      if (decayed >= 0.05) {
        next[k] = { score: Number(decayed.toFixed(3)), updatedAt: now };
      }
    }

    for (const [k, addScore] of entries) {
      const base = next[k]?.score || 0;
      next[k] = { score: Number((base + addScore).toFixed(3)), updatedAt: now };
    }

    const sorted = Object.entries(next)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, maxEntries);

    await this.redis.set(key, Object.fromEntries(sorted), ttlSeconds);
  }

  /**
   * 1. Ghi nhận hành vi tương tác người dùng theo thời gian thực (VIEW, SEARCH, LIKE, CART, PURCHASE)
   */
  async trackUserAction(dto: TrackActionDto): Promise<void> {
    if (!dto.userId) return;

    const action = (dto.action || 'VIEW').toUpperCase() as TrackActionDto['action'];
    let weight = ACTION_WEIGHTS[action] || 1.5;
    if (action === 'VIEW' && Number(dto.metadata?.dwellMs) >= 4000) {
      weight += 1.0;
    }

    try {
      let resolvedCategory = dto.category?.trim() || null;
      let resolvedTitle: string | null = dto.metadata?.title ? String(dto.metadata.title).trim() : null;
      let resolvedPrice: number | null =
        dto.metadata?.price !== undefined && !Number.isNaN(Number(dto.metadata.price))
          ? Number(dto.metadata.price)
          : null;
      const searchQuery = dto.metadata?.query ? String(dto.metadata.query).trim() : '';

      // Làm giàu dữ liệu từ DB nếu client thiếu category/title/price
      if (dto.productId && (!resolvedCategory || !resolvedTitle || resolvedPrice === null)) {
        const prod = await this.prisma.product.findUnique({
          where: { id: dto.productId },
          select: { name: true, category: true, price: true },
        });
        if (prod) {
          resolvedCategory = resolvedCategory || prod.category;
          resolvedTitle = resolvedTitle || prod.name;
          if (resolvedPrice === null && prod.price !== undefined && prod.price !== null) {
            resolvedPrice = Number(prod.price);
          }
        }
      }

      // Tự động phân tích ngữ nghĩa từ khóa SEARCH bằng LocalAiService
      const extraKeywords: string[] = [];
      if (searchQuery) {
        const parsed = this.localAi.parseQuery(searchQuery);
        if (!resolvedCategory && parsed.suggestedCategory && parsed.suggestedCategory !== 'Tất Cả') {
          resolvedCategory = parsed.suggestedCategory;
        }
        for (const kw of parsed.expandedKeywords || []) {
          extraKeywords.push(...this.extractKeywords(kw));
        }
      }

      const keywords = Array.from(
        new Set([
          ...this.extractKeywords(searchQuery || resolvedTitle),
          ...extraKeywords,
        ]),
      ).slice(0, 6);

      // 1. Lưu hành vi gần nhất vào Redis
      await this.redis.set(
        `user:rec:last_action:${dto.userId}`,
        {
          action,
          productId: dto.productId || null,
          category: resolvedCategory,
          title: resolvedTitle,
          query: searchQuery || null,
          price: resolvedPrice,
          keywords,
          timestamp: Date.now(),
        },
        86400 * 7,
      );

      // 2. Cập nhật trọng số danh mục (Time-decayed)
      if (resolvedCategory) {
        await this.upsertDecayedWeightMap(
          `user:rec:cat_weights:${dto.userId}`,
          { [resolvedCategory]: weight },
          10,
          86400 * 14,
        );
      }

      // 3. Cập nhật trọng số từ khóa quan tâm (giải quyết xem Quần Jean thì gợi ý Quần Jean)
      if (keywords.length > 0) {
        const kwIncrements: Record<string, number> = {};
        keywords.forEach((kw, idx) => {
          // Bigram đứng đầu có trọng số cao hơn
          kwIncrements[kw] = Number((weight * (idx < 2 ? 1.0 : 0.6)).toFixed(2));
        });
        await this.upsertDecayedWeightMap(
          `user:rec:kw_weights:${dto.userId}`,
          kwIncrements,
          20,
          86400 * 14,
        );
      }

      // 4. Lưu mẫu mức giá ưa thích (Price Affinity)
      if (resolvedPrice && resolvedPrice > 0) {
        const priceKey = `user:rec:price_samples:${dto.userId}`;
        const samples = (await this.redis.get<number[]>(priceKey)) || [];
        await this.redis.set(priceKey, [resolvedPrice, ...samples].slice(0, 15), 86400 * 14);
      }

      // 5. Lưu sản phẩm vừa tương tác / đã mua
      if (dto.productId) {
        const pidsKey = `user:rec:recent_pids:${dto.userId}`;
        const recentPids = (await this.redis.get<string[]>(pidsKey)) || [];
        await this.redis.set(
          pidsKey,
          [dto.productId, ...recentPids.filter((id) => id !== dto.productId)].slice(0, 20),
          86400 * 14,
        );

        if (action === 'PURCHASE') {
          const boughtKey = `user:rec:purchased_pids:${dto.userId}`;
          const bought = (await this.redis.get<string[]>(boughtKey)) || [];
          await this.redis.set(
            boughtKey,
            [dto.productId, ...bought.filter((id) => id !== dto.productId)].slice(0, 30),
            86400 * 30,
          );
        }
      }

      // 6. Xóa cache feed gợi ý của user này để phản ánh ngay lập tức
      await this.redis.delByPattern(`rec:feed:${dto.userId}:*`);

      // 7. Ghi log xuống PostgreSQL (non-blocking)
      this.prisma.userActivity
        .create({
          data: {
            id: randomUUID(),
            userId: dto.userId,
            action,
            productId: dto.productId || null,
            category: resolvedCategory,
            metadata: JSON.stringify({
              ...(dto.metadata || {}),
              title: resolvedTitle || dto.metadata?.title,
              query: searchQuery || dto.metadata?.query,
              price: resolvedPrice ?? dto.metadata?.price,
              keywords,
            }),
          },
        })
        .catch((e) => this.logger.warn(`Lỗi lưu UserActivity: ${e.message}`));
    } catch (err: any) {
      this.logger.warn(`Lỗi xử lý trackUserAction: ${err.message}`);
    }
  }

  /**
   * 1.1 Gộp toàn bộ lịch sử hành vi từ phiên Guest sang User sau khi Đăng nhập / Đăng ký
   */
  async mergeGuestProfile(guestId: string, userId: string): Promise<{ merged: boolean }> {
    if (!guestId || !userId || guestId === userId || !guestId.startsWith('guest_')) {
      return { merged: false };
    }

    try {
      const [gLast, gCats, gKws, gPrices, gPids, gBought] = await Promise.all([
        this.redis.get<any>(`user:rec:last_action:${guestId}`),
        this.redis.get<Record<string, WeightedEntry | number>>(`user:rec:cat_weights:${guestId}`),
        this.redis.get<Record<string, WeightedEntry | number>>(`user:rec:kw_weights:${guestId}`),
        this.redis.get<number[]>(`user:rec:price_samples:${guestId}`),
        this.redis.get<string[]>(`user:rec:recent_pids:${guestId}`),
        this.redis.get<string[]>(`user:rec:purchased_pids:${guestId}`),
      ]);

      const now = Date.now();
      if (gCats) {
        const inc: Record<string, number> = {};
        for (const [cat, val] of Object.entries(gCats)) {
          const score = this.applyDecay(val, now);
          if (score > 0.1) inc[cat] = score;
        }
        await this.upsertDecayedWeightMap(`user:rec:cat_weights:${userId}`, inc, 10, 86400 * 14);
      }

      if (gKws) {
        const inc: Record<string, number> = {};
        for (const [kw, val] of Object.entries(gKws)) {
          const score = this.applyDecay(val, now);
          if (score > 0.1) inc[kw] = score;
        }
        await this.upsertDecayedWeightMap(`user:rec:kw_weights:${userId}`, inc, 20, 86400 * 14);
      }

      if (gLast) {
        const uLast = await this.redis.get<any>(`user:rec:last_action:${userId}`);
        if (!uLast || (gLast.timestamp || 0) > (uLast.timestamp || 0)) {
          await this.redis.set(`user:rec:last_action:${userId}`, gLast, 86400 * 7);
        }
      }

      if (gPrices?.length) {
        const uPrices = (await this.redis.get<number[]>(`user:rec:price_samples:${userId}`)) || [];
        await this.redis.set(
          `user:rec:price_samples:${userId}`,
          [...gPrices, ...uPrices].slice(0, 15),
          86400 * 14,
        );
      }

      if (gPids?.length) {
        const uPids = (await this.redis.get<string[]>(`user:rec:recent_pids:${userId}`)) || [];
        const mergedPids = Array.from(new Set([...gPids, ...uPids])).slice(0, 20);
        await this.redis.set(`user:rec:recent_pids:${userId}`, mergedPids, 86400 * 14);
      }

      if (gBought?.length) {
        const uBought = (await this.redis.get<string[]>(`user:rec:purchased_pids:${userId}`)) || [];
        const mergedBought = Array.from(new Set([...gBought, ...uBought])).slice(0, 30);
        await this.redis.set(`user:rec:purchased_pids:${userId}`, mergedBought, 86400 * 30);
      }

      // Chuyển log PostgreSQL của Guest sang User
      await this.prisma.userActivity.updateMany({
        where: { userId: guestId },
        data: { userId },
      });

      await Promise.all([
        this.redis.delByPattern(`user:rec:*:${guestId}`),
        this.redis.delByPattern(`rec:feed:${guestId}:*`),
        this.redis.delByPattern(`rec:feed:${userId}:*`),
      ]);

      return { merged: true };
    } catch (err: any) {
      this.logger.warn(`Lỗi gộp hồ sơ Guest -> User (${guestId} -> ${userId}): ${err.message}`);
      return { merged: false };
    }
  }

  /**
   * 1.2 Khôi phục hồ sơ hành vi từ PostgreSQL khi Redis trống / mới khởi động lại
   */
  private async hydrateProfileFromDb(userId: string) {
    const logs = await this.prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    if (logs.length === 0) return null;

    const now = Date.now();
    const catScores: Record<string, WeightedEntry> = {};
    const kwScores: Record<string, WeightedEntry> = {};
    const recentPids: string[] = [];
    const purchasedPids: string[] = [];
    const priceSamples: number[] = [];

    for (const log of logs) {
      const ageHours = Math.max(0, (now - new Date(log.createdAt).getTime()) / 3600000);
      const decay = Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
      const w = (ACTION_WEIGHTS[log.action] || 1.5) * decay;
      const meta = this.parseMetadata(log.metadata);

      if (log.category) {
        catScores[log.category] = {
          score: (catScores[log.category]?.score || 0) + w,
          updatedAt: now,
        };
      }
      const kws: string[] = Array.isArray(meta?.keywords)
        ? meta.keywords
        : this.extractKeywords(meta?.query || meta?.title);
      for (const kw of kws) {
        kwScores[kw] = { score: (kwScores[kw]?.score || 0) + w, updatedAt: now };
      }
      if (meta?.price && Number(meta.price) > 0 && priceSamples.length < 15) {
        priceSamples.push(Number(meta.price));
      }
      if (log.productId && !recentPids.includes(log.productId) && recentPids.length < 20) {
        recentPids.push(log.productId);
      }
      if (log.action === 'PURCHASE' && log.productId && !purchasedPids.includes(log.productId)) {
        purchasedPids.push(log.productId);
      }
    }

    const latest = logs[0];
    const latestMeta = this.parseMetadata(latest.metadata);
    const lastAction = {
      action: latest.action,
      productId: latest.productId,
      category: latest.category,
      title: latestMeta?.title || null,
      query: latestMeta?.query || null,
      price: latestMeta?.price || null,
      keywords: latestMeta?.keywords || [],
      timestamp: new Date(latest.createdAt).getTime(),
    };

    await Promise.all([
      this.redis.set(`user:rec:last_action:${userId}`, lastAction, 86400 * 7),
      Object.keys(catScores).length > 0
        ? this.redis.set(`user:rec:cat_weights:${userId}`, catScores, 86400 * 14)
        : Promise.resolve(),
      Object.keys(kwScores).length > 0
        ? this.redis.set(`user:rec:kw_weights:${userId}`, kwScores, 86400 * 14)
        : Promise.resolve(),
      priceSamples.length > 0
        ? this.redis.set(`user:rec:price_samples:${userId}`, priceSamples, 86400 * 14)
        : Promise.resolve(),
      recentPids.length > 0
        ? this.redis.set(`user:rec:recent_pids:${userId}`, recentPids, 86400 * 14)
        : Promise.resolve(),
      purchasedPids.length > 0
        ? this.redis.set(`user:rec:purchased_pids:${userId}`, purchasedPids, 86400 * 30)
        : Promise.resolve(),
    ]);

    return { lastAction, catScores, kwScores, priceSamples, recentPids, purchasedPids };
  }

  private inferGenderFromBehavior(
    decayedCats: Array<[string, number]>,
    decayedKws: Array<[string, number]>,
    fallbackGender?: string,
  ): string | undefined {
    let femaleScore = 0;
    let maleScore = 0;

    for (const [cat, sc] of decayedCats) {
      if (FEMALE_CATEGORIES.has(cat)) femaleScore += sc;
      else if (MALE_CATEGORIES.has(cat)) maleScore += sc;
    }
    for (const [kw, sc] of decayedKws) {
      if (/\b(nữ|váy|đầm|son|phấn|túi xách|chân váy)\b/i.test(kw)) femaleScore += sc * 0.6;
      else if (/\b(nam|polo nam|quần tây nam|giày tây)\b/i.test(kw)) maleScore += sc * 0.6;
    }

    if (femaleScore > maleScore * 1.35 && femaleScore >= 2) return 'NU';
    if (maleScore > femaleScore * 1.35 && maleScore >= 2) return 'NAM';
    return fallbackGender || undefined;
  }

  private computeMedianPrice(samples: number[]): number {
    if (!samples || samples.length === 0) return 0;
    const sorted = [...samples].filter((n) => n > 0).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  /**
   * 2. Thuật toán "Gợi Ý Hôm Nay" (Daily Discover):
   * - Hybrid Multi-Signal Ranking (~35% cá nhân hóa: Top 3 ngành + Từ khóa + Mức giá ưa thích + Time-Decay)
   * - Round-Robin Exploration (~65% đa dạng ngành hàng bán chạy trên sàn, tránh dồn 1 loại cho người mới)
   */
  async getPersonalizedFeed(dto: RecommendationQueryDto): Promise<{
    products: any[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      totalPages: number;
      hasMore: boolean;
    };
    userProfile: {
      isPersonalized: boolean;
      detectedGender?: string;
      topInterests: string[];
      topKeywords?: string[];
      preferredPriceRange?: number;
      hasRecentInteractions: boolean;
      recentAction?: string;
    };
  }> {
    const page = Math.max(1, dto.page || 1);
    const limit = Math.min(Math.max(1, dto.limit || 30), 60);
    const userId = dto.userId || 'guest';
    const explicitGender = (dto.gender || '').toUpperCase();

    const cacheKey = `rec:feed:${userId}:${explicitGender}:${limit}:${page}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // 1. Đọc hồ sơ sở thích từ Redis (có fallback từ DB)
    const now = Date.now();
    let lastAction: any = null;
    let rawCatWeights: Record<string, WeightedEntry | number> = {};
    let rawKwWeights: Record<string, WeightedEntry | number> = {};
    let priceSamples: number[] = [];
    let recentPids: string[] = [];
    let purchasedPids: string[] = [];

    if (userId) {
      const [rLast, rCats, rKws, rPrices, rPids, rBought] = await Promise.all([
        this.redis.get<any>(`user:rec:last_action:${userId}`),
        this.redis.get<Record<string, WeightedEntry | number>>(`user:rec:cat_weights:${userId}`),
        this.redis.get<Record<string, WeightedEntry | number>>(`user:rec:kw_weights:${userId}`),
        this.redis.get<number[]>(`user:rec:price_samples:${userId}`),
        this.redis.get<string[]>(`user:rec:recent_pids:${userId}`),
        this.redis.get<string[]>(`user:rec:purchased_pids:${userId}`),
      ]);

      lastAction = rLast;
      rawCatWeights = rCats || {};
      rawKwWeights = rKws || {};
      priceSamples = rPrices || [];
      recentPids = rPids || [];
      purchasedPids = rBought || [];

      if (!lastAction && Object.keys(rawCatWeights).length === 0 && userId !== 'guest') {
        const hydrated = await this.hydrateProfileFromDb(userId);
        if (hydrated) {
          lastAction = hydrated.lastAction;
          rawCatWeights = hydrated.catScores;
          rawKwWeights = hydrated.kwScores;
          priceSamples = hydrated.priceSamples;
          recentPids = hydrated.recentPids;
          purchasedPids = hydrated.purchasedPids;
        }
      }
    }

    const decayedCats = Object.entries(rawCatWeights)
      .map(([cat, entry]) => [cat, this.applyDecay(entry, now)] as [string, number])
      .filter(([, sc]) => sc > 0.1)
      .sort((a, b) => b[1] - a[1]);

    const decayedKws = Object.entries(rawKwWeights)
      .map(([kw, entry]) => [kw, this.applyDecay(entry, now)] as [string, number])
      .filter(([, sc]) => sc > 0.1)
      .sort((a, b) => b[1] - a[1]);

    const topCategories = decayedCats.slice(0, 3).map(([cat]) => cat);
    const topKeywords = decayedKws.slice(0, 6).map(([kw]) => kw);
    const medianPrice = this.computeMedianPrice(priceSamples);
    const detectedGender = this.inferGenderFromBehavior(decayedCats, decayedKws, explicitGender);

    const hasInteractions = Boolean(
      lastAction || recentPids.length > 0 || topCategories.length > 0 || topKeywords.length > 0,
    );

    // Loại trừ món vừa click gần nhất & các món đã mua để gợi ý luôn tươi mới
    const excludeFromRecs = new Set<string>([
      ...purchasedPids,
      ...recentPids.slice(0, 3),
      ...(lastAction?.productId ? [lastAction.productId] : []),
    ]);

    // -------------------------------------------------------------------------
    // BƯỚC A: MULTI-SIGNAL PERSONALIZED CANDIDATES (EXPLOITATION ~35%)
    // -------------------------------------------------------------------------
    const personalizedProducts: any[] = [];
    const usedProductIds = new Set<string>();
    const desiredPersonalizedCount = hasInteractions && page <= 4
      ? Math.max(4, Math.min(12, Math.round(limit * 0.35)))
      : 0;

    if (desiredPersonalizedCount > 0) {
      try {
        const queryCategories = Array.from(
          new Set([...(lastAction?.category ? [lastAction.category] : []), ...topCategories]),
        ).slice(0, 3);

        const searchKws = Array.from(
          new Set([...(Array.isArray(lastAction?.keywords) ? lastAction.keywords : []), ...topKeywords]),
        ).slice(0, 4);

        const [catCandidates, kwCandidates] = await Promise.all([
          queryCategories.length > 0
            ? this.prisma.product.findMany({
                where: {
                  status: 'active',
                  isViolated: false,
                  stock: { gt: 0 },
                  id: { notIn: Array.from(excludeFromRecs) },
                  category: { in: queryCategories },
                },
                orderBy: [{ sales: 'desc' }, { createdAt: 'desc' }],
                take: 45,
              })
            : Promise.resolve([]),
          searchKws.length > 0
            ? this.prisma.product.findMany({
                where: {
                  status: 'active',
                  isViolated: false,
                  stock: { gt: 0 },
                  id: { notIn: Array.from(excludeFromRecs) },
                  OR: searchKws.map((kw) => ({ name: { contains: kw, mode: 'insensitive' } })),
                },
                orderBy: [{ sales: 'desc' }, { createdAt: 'desc' }],
                take: 30,
              })
            : Promise.resolve([]),
        ]);

        const candidateMap = new Map<string, any>();
        for (const p of [...kwCandidates, ...catCandidates]) {
          if (!candidateMap.has(p.id)) candidateMap.set(p.id, p);
        }

        const catRankBonus = new Map<string, number>();
        topCategories.forEach((cat, idx) => {
          catRankBonus.set(cat, idx === 0 ? 42 : idx === 1 ? 26 : 14);
        });

        const scored = Array.from(candidateMap.values()).map((p) => {
          const lowerTitle = (p.name || '').toLowerCase();
          const curPrice = Number(p.price || 0);
          const origPrice = p.originalPrice ? Number(p.originalPrice) : curPrice;
          const discountPct = origPrice > curPrice && origPrice > 0 ? Math.round((1 - curPrice / origPrice) * 100) : 0;

          let score = 0;
          if (lastAction?.category && p.category === lastAction.category) score += 16;
          score += catRankBonus.get(p.category) || 0;

          // Điểm khớp từ khóa (giúp xem Quần Jean gợi ý đúng Quần Jean thay vì ngẫu nhiên cùng ngành)
          let matchedKw = '';
          let bestKwScore = 0;
          for (const [kw, kwWeight] of decayedKws.slice(0, 8)) {
            if (lowerTitle.includes(kw.toLowerCase())) {
              const pts = Math.min(35, 16 + kwWeight * 2.5);
              score += pts;
              if (pts > bestKwScore) {
                bestKwScore = pts;
                matchedKw = kw;
              }
            }
          }

          // Điểm tương đồng tầm giá ưa thích
          if (medianPrice > 0 && curPrice > 0) {
            const ratio = curPrice / medianPrice;
            if (ratio >= 0.5 && ratio <= 1.8) score += 16;
            else if (ratio >= 0.3 && ratio <= 2.6) score += 8;
          }

          score += Math.min(18, Math.log10((Number(p.sales) || 0) + 1) * 6);
          if (discountPct >= 15) score += 5;

          return { p, score, matchedKw, discountPct };
        });

        scored.sort((a, b) => b.score - a.score);

        // Phân bổ đa dạng nhẹ (nếu có >=2 ngành yêu thích thì không lấy quá 6 món cùng 1 ngành)
        const perCatLimit = topCategories.length >= 2 ? Math.max(4, Math.ceil(desiredPersonalizedCount * 0.6)) : desiredPersonalizedCount;
        const perCatPicked: Record<string, number> = {};
        const pageOffset = (page - 1) * Math.min(4, Math.floor(desiredPersonalizedCount / 2));

        for (const item of scored.slice(pageOffset)) {
          if (personalizedProducts.length >= desiredPersonalizedCount) break;
          const catCount = perCatPicked[item.p.category] || 0;
          if (catCount >= perCatLimit) continue;

          perCatPicked[item.p.category] = catCount + 1;
          usedProductIds.add(item.p.id);

          let reason = `✨ Hợp gu ${item.p.category}`;
          if (item.matchedKw) {
            reason = lastAction?.action === 'SEARCH'
              ? `🔎 Khớp "${item.matchedKw}" bạn tìm`
              : `🎯 Gợi ý "${item.matchedKw}" hợp gu`;
          } else if (lastAction?.action === 'PURCHASE') {
            reason = '🛍️ Phù hợp với đơn bạn đã mua';
          } else if (lastAction?.action === 'CART') {
            reason = '🛒 Tương tự món trong giỏ';
          } else if (lastAction?.action === 'LIKE') {
            reason = '❤️ Giống sản phẩm bạn thích';
          } else if (lastAction?.action === 'VIEW') {
            reason = '🎯 Dựa trên món bạn vừa xem';
          }

          personalizedProducts.push({
            ...item.p,
            price: Number(item.p.price),
            originalPrice: item.p.originalPrice ? Number(item.p.originalPrice) : null,
            stock: Number(item.p.stock),
            sales: Number(item.p.sales),
            isPersonalized: true,
            recommendationReason: reason,
          });
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi tìm sản phẩm cá nhân hóa: ${err.message}`);
      }
    }

    // -------------------------------------------------------------------------
    // BƯỚC B: EXPLORATION ĐA DẠNG NGÀNH HÀNG (~65% - Giải quyết Cold-Start cho người mới)
    // -------------------------------------------------------------------------
    const totalActive = await this.prisma.product.count({
      where: {
        status: 'active',
        isViolated: false,
        stock: { gt: 0 },
      },
    });

    const neededExplorationCount = limit - personalizedProducts.length;
    const skipOffset = (page - 1) * limit;

    const rawExplore = await this.prisma.product.findMany({
      where: {
        status: 'active',
        isViolated: false,
        stock: { gt: 0 },
        id: { notIn: Array.from(usedProductIds) },
      },
      orderBy: [{ sales: 'desc' }, { createdAt: 'desc' }],
      skip: skipOffset,
      take: Math.max(neededExplorationCount * 2, 60),
    });

    // Sắp xếp Round-Robin xen kẽ các ngành khác nhau để người mới không thấy toàn 1 loại hàng
    const byCategory = new Map<string, any[]>();
    for (const p of rawExplore) {
      const cat = p.category || 'Khác';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(p);
    }

    // Nếu user chưa có lịch sử nhưng truyền gender rõ ràng, đưa ngành phù hợp lên đầu vòng round-robin
    const catEntries = Array.from(byCategory.entries());
    if (!hasInteractions && (detectedGender === 'NAM' || detectedGender === 'NU')) {
      const targetSet = detectedGender === 'NU' ? FEMALE_CATEGORIES : MALE_CATEGORIES;
      catEntries.sort((a, b) => Number(targetSet.has(b[0])) - Number(targetSet.has(a[0])));
    }

    const diversifiedExplore: any[] = [];
    let round = 0;
    while (diversifiedExplore.length < neededExplorationCount + 4) {
      let addedInRound = false;
      for (const [, list] of catEntries) {
        if (round < list.length) {
          diversifiedExplore.push(list[round]);
          addedInRound = true;
          if (diversifiedExplore.length >= neededExplorationCount + 4) break;
        }
      }
      if (!addedInRound) break;
      round++;
    }

    const formattedExplore = diversifiedExplore.map((p) => {
      const orig = p.originalPrice ? Number(p.originalPrice) : Number(p.price);
      const cur = Number(p.price);
      const discountPct = orig > cur && orig > 0 ? Math.round((1 - cur / orig) * 100) : 0;

      let reason = '🔥 Bán chạy hôm nay';
      if (discountPct >= 20) {
        reason = `🏷️ Giảm sâu ${discountPct}%`;
      } else if (p.sales && p.sales > 100) {
        reason = `⭐ Đã bán ${(p.sales / 1000).toFixed(1)}k+`;
      }

      return {
        ...p,
        price: cur,
        originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
        stock: Number(p.stock),
        sales: Number(p.sales),
        isPersonalized: false,
        recommendationReason: reason,
      };
    });

    // -------------------------------------------------------------------------
    // BƯỚC C: INTERLEAVING XEN KẼ THÔNG MINH (35% Cá nhân hóa / 65% Khám phá)
    // -------------------------------------------------------------------------
    const finalProducts: any[] = [];
    const personalizedSlots = new Set([1, 3, 5, 8, 10, 13, 16, 19, 22, 25, 27, 29]);
    let pIdx = 0;
    let eIdx = 0;

    for (let slot = 0; slot < limit; slot++) {
      if (finalProducts.length >= limit) break;
      if (personalizedSlots.has(slot) && pIdx < personalizedProducts.length) {
        finalProducts.push(personalizedProducts[pIdx++]);
      } else if (eIdx < formattedExplore.length) {
        finalProducts.push(formattedExplore[eIdx++]);
      } else if (pIdx < personalizedProducts.length) {
        finalProducts.push(personalizedProducts[pIdx++]);
      }
    }

    const totalPages = Math.ceil(totalActive / limit) || 1;
    const responsePayload = {
      products: finalProducts,
      total: totalActive,
      pagination: {
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
      userProfile: {
        isPersonalized: personalizedProducts.length > 0,
        detectedGender,
        topInterests: topCategories,
        topKeywords,
        preferredPriceRange: medianPrice || undefined,
        hasRecentInteractions: hasInteractions,
        recentAction: lastAction?.action,
      },
    };

    await this.redis.set(cacheKey, responsePayload, 60);
    return responsePayload;
  }
}
