import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LocalAiService } from './local-ai.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  products?: any[];
  timestamp?: number;
}

export class AssistantChatDto {
  message: string;
  history?: ChatMessage[];
  userId?: string;
  userGender?: string;
}

export interface AssistantChatResponse {
  reply: string;
  suggestedProducts: any[];
  quickReplies?: string[];
  detectedIntent?: {
    mode?: string;
    category?: string;
    targetGender?: string;
    priceRange?: { min?: number; max?: number };
    keywords?: string[];
  };
}

type ChatMode = 'CHITCHAT' | 'VOUCHER' | 'SIZE_ADVICE' | 'SUPPORT' | 'PRODUCT_SEARCH';

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly localAiService: LocalAiService,
  ) {}

  /**
   * Xử lý tin nhắn hội thoại bằng Ollama (mặc định qwen2.5:14b) + RAG dữ liệu thật từ Postgres
   */
  async processChat(dto: AssistantChatDto): Promise<AssistantChatResponse> {
    const rawMsg = (dto.message || '').trim();
    if (!rawMsg) {
      return {
        reply: 'Chào bạn! Mình là ZeroAI - Trợ lý mua sắm của ZeroMall. Bạn đang muốn tìm sản phẩm, xem voucher hay cần mình tư vấn chọn size hôm nay?',
        suggestedProducts: [],
        quickReplies: [
          '🎫 Săn mã giảm giá hôm nay',
          '📏 Cao 1m72 nặng 65kg mặc size gì?',
          '🧥 Tìm áo khoác nam dưới 400k',
        ],
      };
    }

    // Chuẩn hóa lịch sử chat trước lượt hiện tại (kèm tóm tắt sản phẩm từng gợi ý để giữ trí nhớ đa lượt)
    const rawHistory = Array.isArray(dto.history) ? dto.history : [];
    const lastHist = rawHistory[rawHistory.length - 1];
    const priorHistory = (
      lastHist && lastHist.role === 'user' && (lastHist.content || '').trim() === rawMsg
        ? rawHistory.slice(0, -1)
        : rawHistory
    ).map((m) => {
      let content = (m.content || '').trim();
      if (m.role === 'assistant' && Array.isArray(m.products) && m.products.length > 0 && !content.includes('[Sản phẩm đã gợi ý:')) {
        const prodsSummary = m.products
          .slice(0, 6)
          .map((p: any) => `${p.name} (${Number(p.price || 0).toLocaleString('vi-VN')}đ)`)
          .join('; ');
        content += `\n[Sản phẩm đã gợi ý: ${prodsSummary}]`;
      }
      return { role: m.role, content };
    });

    // 1. Phân tích nhanh ý định bằng Rule 0ms + AI Router cho các câu phức tạp/hỏi tiếp theo ngữ cảnh
    let intent = this.extractIntent(rawMsg, dto.userGender);
    let mode = this.detectFastMode(rawMsg, intent);
    let effectiveSearchQuery = rawMsg;

    const hasSuggestedProductsInHistory = priorHistory.some(
      (m) => m.role === 'assistant' && m.content.includes('[Sản phẩm đã gợi ý:'),
    );
    const isFollowUpCompare =
      hasSuggestedProductsInHistory &&
      /(cái nào|mẫu nào|sản phẩm nào|trong số|vừa rồi|trên kia|mấy mẫu)/i.test(rawMsg) &&
      /(rẻ nhất|đắt nhất|tốt nhất|bán chạy|nên mua|phù hợp nhất)/i.test(rawMsg);

    if (isFollowUpCompare) {
      mode = 'CHITCHAT';
    } else if (mode === 'AMBIGUOUS') {
      const routed = await this.localAiService.analyzeChatIntentWithOllama(rawMsg, priorHistory);
      if (routed) {
        mode = routed.mode;
        effectiveSearchQuery = routed.searchQuery || rawMsg;
        if (routed.keywords.length > 0 && intent.keywords.length === 0) {
          intent.keywords = routed.keywords;
        }
        if (routed.minPrice && !intent.minPrice) intent.minPrice = routed.minPrice;
        if (routed.maxPrice && !intent.maxPrice) intent.maxPrice = routed.maxPrice;
        if (routed.targetGender && !intent.targetGender) intent.targetGender = routed.targetGender;
      } else {
        // Nếu không có manh mối sản phẩm nào -> ưu tiên trả lời trò chuyện/tư vấn tự nhiên, không ép ném bừa sản phẩm
        mode = this.hasProductClues(rawMsg, intent) ? 'PRODUCT_SEARCH' : 'CHITCHAT';
      }
    }

    // 2. Truy xuất dữ liệu thật theo đúng mode
    let formattedProducts: any[] = [];
    if (mode === 'PRODUCT_SEARCH') {
      const products = await this.queryRelevantProducts(intent, effectiveSearchQuery);
      formattedProducts = products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        originalPrice: p.originalPrice,
        image: (Array.isArray(p.images) && p.images[0]) || p.image || '',
        category: p.category,
        sales: p.sales || 0,
        stock: p.stock ?? 100,
        rating: 4.9,
        brand: p.brand || 'No Brand',
        shopId: p.shopId,
        variationsText: p.variationsText || undefined,
        recommendationReason: this.generateReasonForProduct(p, intent),
      }));
    }

    const activeVouchers =
      mode === 'VOUCHER' || mode === 'SUPPORT' ? await this.fetchPlatformVouchers() : [];

    const sizeGuidance =
      mode === 'SIZE_ADVICE' ? this.computeSizeGuidance(rawMsg, dto.userGender) : '';

    // 3. Sinh câu trả lời tự nhiên bằng Ollama (qwen2.5:14b) kèm trí nhớ lịch sử chat
    const contextParts = [
      `Ý định: ${mode}`,
      intent.category ? `Ngành hàng: ${intent.category}` : '',
      intent.maxPrice ? `Ngân sách tối đa: ${intent.maxPrice.toLocaleString('vi-VN')}đ` : '',
      intent.targetGender ? `Đối tượng: ${intent.targetGender}` : '',
    ].filter(Boolean);

    const ollamaReply = await this.localAiService.generateShoppingChatWithOllama({
      userMessage: rawMsg,
      mode,
      history: priorHistory.map((m) => ({ role: m.role, content: m.content })),
      retrievedProducts: formattedProducts,
      activeVouchers,
      sizeGuidance,
      contextSummary: contextParts.join(' • '),
    });

    const allowProducts = mode === 'PRODUCT_SEARCH' && formattedProducts.length > 0;

    if (ollamaReply?.reply) {
      return {
        reply: ollamaReply.reply,
        suggestedProducts: allowProducts ? formattedProducts : [],
        quickReplies:
          ollamaReply.quickReplies.length > 0
            ? ollamaReply.quickReplies
            : this.getDefaultQuickReplies(mode, intent),
        detectedIntent: {
          mode,
          category: intent.category,
          targetGender: intent.targetGender,
          priceRange:
            intent.minPrice || intent.maxPrice
              ? { min: intent.minPrice, max: intent.maxPrice }
              : undefined,
          keywords: intent.keywords,
        },
      };
    }

    // 4. Fallback thông minh cục bộ khi Ollama chưa phản hồi kịp
    const fallbackReply = this.generateLocalFallbackReply(
      rawMsg,
      mode,
      intent,
      formattedProducts,
      activeVouchers,
      sizeGuidance,
    );

    return {
      reply: fallbackReply,
      suggestedProducts: mode === 'PRODUCT_SEARCH' ? formattedProducts : [],
      quickReplies: this.getDefaultQuickReplies(mode, intent),
      detectedIntent: {
        mode,
        category: intent.category,
        targetGender: intent.targetGender,
        priceRange:
          intent.minPrice || intent.maxPrice
            ? { min: intent.minPrice, max: intent.maxPrice }
            : undefined,
        keywords: intent.keywords,
      },
    };
  }

  /**
   * Bộ định tuyến nhanh 0ms cho các mẫu câu rõ ràng; câu mơ hồ/hỏi nối tiếp sẽ chuyển qua Ollama phân tích
   */
  private detectFastMode(msg: string, intent: any): ChatMode | 'AMBIGUOUS' {
    const lower = msg.toLowerCase().trim();

    // Lời chào / cảm ơn / tạm biệt / tán gẫu đơn thuần (không có từ khóa mua đồ & không chứa số đo/giá)
    const pureChitchatRe =
      /^(xin\s*chào|chào(\s+bạn|\s+ad|\s+shop|\s+zeroai)?|hello|hi+|hey+|cảm\s*ơn|thank(\s*you|s)?|tạm\s*biệt|bye+|ok+|oki+|oke|hay\s*quá|tuyệt\s*vời|bạn\s+là\s+ai|bạn\s+tên\s+gì|có\s+ai\s+ở\s+đó\s+không|test)[!.,?\s]*$/i;
    if (pureChitchatRe.test(lower)) {
      return 'CHITCHAT';
    }

    // Hỏi đáp về Voucher / Mã giảm giá / Freeship / Khung giờ vàng
    if (/(voucher|mã giảm|khuyến mãi|giờ vàng|khung giờ|săn deal|ưu đãi|freeship|miễn phí vận chuyển)/i.test(lower)) {
      return 'VOUCHER';
    }

    // Hỏi tư vấn Size theo chiều cao / cân nặng
    const hasBodyStats = /(\d{2,3}\s*kg|\b1[.,m]\d{1,2}|cao\s+\d|nặng\s+\d|size\s*(gì|nào|bao nhiêu)|bảng size|chọn size|tư vấn size)/i.test(lower);
    if (hasBodyStats && !/(mua|tìm|gợi ý|xem|giá|dưới|từ)\s+(áo|quần|váy|giày)/i.test(lower)) {
      return 'SIZE_ADVICE';
    }

    // Hỏi chính sách sàn / vận hành / tính năng thử đồ AI
    if (/(đổi trả|hoàn tiền|bảo hành|khiếu nại|cskh|hỗ trợ|thanh toán|sepay|zeropay|cod\b|thử đồ|try[\s-]?on|phòng thử|vận chuyển|zmx|zeroexpress|mở shop|bán hàng)/i.test(lower) && !intent.itemNoun) {
      return 'SUPPORT';
    }

    // Yêu cầu tìm kiếm / gợi ý sản phẩm rõ ràng
    if (
      intent.itemNoun ||
      intent.maxPrice ||
      intent.minPrice ||
      /(sản phẩm bán chạy|đồ hot|món hot|gợi ý đồ|tìm\s+|mua\s+)/i.test(lower)
    ) {
      // Nếu là câu hỏi nối tiếp mơ hồ kiểu "còn cái nào rẻ hơn", đưa sang Ollama để giữ mạch lịch sử
      if (/(cái nào|mẫu nào|còn\s+nào|rẻ hơn|đắt hơn|khác không|vừa nói)/i.test(lower) && !intent.itemNoun) {
        return 'AMBIGUOUS';
      }
      return 'PRODUCT_SEARCH';
    }

    return 'AMBIGUOUS';
  }

  private hasProductClues(msg: string, intent: any): boolean {
    if (intent.itemNoun || intent.keywords?.length > 0 || intent.maxPrice || intent.minPrice) return true;
    return /(mua|tìm|giá|bao nhiêu|bán chạy|quà|tặng|shop|sản phẩm)/i.test(msg);
  }

  /**
   * Tính nhanh gợi ý số đo & size chuẩn khi khách hỏi theo chiều cao/cân nặng
   */
  private computeSizeGuidance(msg: string, defaultGender?: string): string {
    const lower = msg.toLowerCase();
    let heightCm = 170;
    let weightKg = 62;

    const mMatch = lower.match(/\b1\s*[m.,]\s*(\d{1,2})\b/);
    const cmMatch = lower.match(/\b(1[4-9]\d|2[0-1]\d)\s*cm\b/);
    if (mMatch) {
      const dec = mMatch[1].length === 1 ? `${mMatch[1]}0` : mMatch[1];
      heightCm = Number(`1${dec}`);
    } else if (cmMatch) {
      heightCm = Number(cmMatch[1]);
    }

    const kgMatch = lower.match(/\b(\d{2,3})\s*(?:kg|ký|cân)\b/);
    if (kgMatch) {
      weightKg = Number(kgMatch[1]);
    }

    let gender: 'NAM' | 'NU' = 'NAM';
    if (/(nữ|chị|em gái|bạn gái|vợ)/i.test(lower)) gender = 'NU';
    else if (/(nam|anh|bạn trai|chồng)/i.test(lower)) gender = 'NAM';
    else if ((defaultGender || '').toUpperCase() === 'FEMALE' || (defaultGender || '').toUpperCase() === 'NU') {
      gender = 'NU';
    }

    const chest = gender === 'NU' ? 0.48 * heightCm + 0.18 * weightKg : 0.53 * heightCm + 0.1 * weightKg;
    const waist = gender === 'NU' ? 0.33 * heightCm + 0.25 * weightKg : 0.38 * heightCm + 0.22 * weightKg;

    let topSize = 'M';
    if (gender === 'NU') {
      if (chest < 83 && weightKg < 47) topSize = 'S';
      else if (chest < 88 && weightKg < 53) topSize = 'M';
      else if (chest < 94 && weightKg < 60) topSize = 'L';
      else topSize = 'XL';
    } else {
      if (chest < 92 && weightKg < 57) topSize = 'S';
      else if (chest < 97 && weightKg < 65) topSize = 'M';
      else if (chest < 103 && weightKg < 74) topSize = 'L';
      else if (chest < 109 && weightKg < 84) topSize = 'XL';
      else topSize = 'XXL';
    }

    const outerSizes = ['S', 'M', 'L', 'XL', 'XXL'];
    const outerIdx = Math.min(outerSizes.length - 1, outerSizes.indexOf(topSize) + 1);
    const outerSize = outerSizes[outerIdx];

    let pantSize = '30';
    if (gender === 'NU') {
      pantSize = waist < 65 ? '26' : waist < 69 ? '27' : waist < 74 ? '28' : waist < 79 ? '29' : '30';
    } else {
      pantSize = waist < 74 ? '29' : waist < 79 ? '30' : waist < 84 ? '31' : waist < 89 ? '32' : '34';
    }

    return [
      `Thông số khách: ${heightCm}cm, ${weightKg}kg, giới tính ${gender === 'NU' ? 'Nữ' : 'Nam'}.`,
      `Ước tính vòng ngực ~${chest.toFixed(1)}cm, vòng eo ~${waist.toFixed(1)}cm.`,
      `Áo thun/sơ mi vừa vặn: Size ${topSize}. Áo khoác/Blazer mặc ngoài thoải mái: Size ${outerSize}.`,
      `Quần tây/jean: Size ${pantSize}. (Giày dép cần chọn theo chiều dài bàn chân cm thực tế).`,
    ].join(' ');
  }

  private async fetchPlatformVouchers(): Promise<any[]> {
    try {
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT code, name, type, value, "minSpend", "maxDiscount", "usageLimit", "usedCount"
        FROM discount."Voucher"
        WHERE "shopId" = 'PLATFORM'
          AND "startDate" <= NOW()
          AND "endDate" >= NOW()
          AND "usedCount" < "usageLimit"
        ORDER BY "minSpend" ASC
        LIMIT 8
      `;
      return rows || [];
    } catch (e: any) {
      this.logger.warn(`Could not read platform vouchers: ${e.message}`);
      return [];
    }
  }

  /**
   * Trích xuất thông số: Giá, Danh mục, Đối tượng từ câu chat
   */
  private extractIntent(msg: string, defaultGender?: string) {
    const lower = msg.toLowerCase();

    let minPrice: number | undefined;
    let maxPrice: number | undefined;

    // A. Bóc tách giá tiền: "dưới 300k", "< 500.000", "tầm 200k", "từ 100k đến 300k"
    const rangeMatch = lower.match(/từ\s*(\d+)\s*(k|nghìn|ngàn|tr|triệu)?\s*(?:đến|tới|-)\s*(\d+)\s*(k|nghìn|ngàn|tr|triệu)?/i);
    if (rangeMatch) {
      minPrice = this.parseMoneyUnit(rangeMatch[1], rangeMatch[2]);
      maxPrice = this.parseMoneyUnit(rangeMatch[3], rangeMatch[4]);
    } else {
      const underMatch = lower.match(/(?:dưới|<|không quá|tầm|khoảng)\s*(\d+)\s*(k|nghìn|ngàn|tr|triệu|đ|vnd)?/i);
      if (underMatch) {
        maxPrice = this.parseMoneyUnit(underMatch[1], underMatch[2]);
        if (lower.includes('tầm') || lower.includes('khoảng')) {
          minPrice = Math.max(0, Math.round(maxPrice * 0.7));
          maxPrice = Math.round(maxPrice * 1.3);
        }
      }
    }

    // B. Bóc tách đối tượng & giới tính & quà tặng
    let targetGender: string | undefined;
    let recipientNoun: string | undefined;
    let isGift = false;
    let isAmbiguousRecipient = false;

    const normUserGender = (defaultGender || '').toUpperCase();
    const isUserMale = normUserGender === 'MALE' || normUserGender === 'NAM';
    const isUserFemale = normUserGender === 'FEMALE' || normUserGender === 'NU';

    if (lower.includes('áo đôi') || lower.includes('áo cặp') || lower.includes('đồ đôi') || lower.includes('unisex')) {
      targetGender = 'UNISEX';
      recipientNoun = 'cặp đôi';
      isGift = true;
    } else if (
      lower.includes('chồng') ||
      lower.includes('ông xã') ||
      lower.includes('anh xã') ||
      lower.includes('bạn trai') ||
      lower.includes('cho nam') ||
      lower.includes('bạn nam') ||
      lower.includes('cho anh') ||
      lower.includes('anh ấy') ||
      lower.includes('bố') ||
      lower.includes('cho ba') ||
      lower.includes('tặng bạn trai') ||
      /(?:^|[\s,])nam(?:$|[\s,.!?])/i.test(lower.replace(/việt\s+nam/gi, ''))
    ) {
      targetGender = 'NAM';
      if (lower.includes('chồng') || lower.includes('ông xã') || lower.includes('anh xã')) recipientNoun = 'chồng';
      else if (lower.includes('bạn trai')) recipientNoun = 'bạn trai';
      else if (lower.includes('bố') || lower.includes('cho ba')) recipientNoun = 'bố';
      else recipientNoun = 'nam';
    } else if (
      lower.includes('vợ') ||
      lower.includes('bà xã') ||
      lower.includes('bạn gái') ||
      lower.includes('bạn nữ') ||
      lower.includes('cho nữ') ||
      lower.includes('chị em') ||
      lower.includes('cho chị') ||
      lower.includes('cho mẹ') ||
      lower.includes('mẹ tôi') ||
      lower.includes('tặng bạn gái') ||
      /(?:^|[\s,])nữ(?:$|[\s,.!?])/i.test(lower)
    ) {
      targetGender = 'NU';
      if (lower.includes('vợ') || lower.includes('bà xã')) recipientNoun = 'vợ';
      else if (lower.includes('bạn gái')) recipientNoun = 'bạn gái';
      else if (lower.includes('cho mẹ') || lower.includes('mẹ tôi')) recipientNoun = 'mẹ';
      else recipientNoun = 'nữ';
    } else if (lower.includes('người yêu') || lower.includes('crush') || lower.includes('người thương') || lower.includes('bồ')) {
      recipientNoun = 'người yêu';
      isGift = true;

      if (isUserMale) {
        targetGender = 'NU';
        recipientNoun = 'bạn gái';
      } else if (isUserFemale) {
        targetGender = 'NAM';
        recipientNoun = 'bạn trai';
      } else {
        isAmbiguousRecipient = true;
      }
    }

    if (lower.includes('tặng') || lower.includes('quà') || lower.includes('sinh nhật') || lower.includes('kỷ niệm') || !!recipientNoun) {
      isGift = true;
    }

    // C. Bóc tách loại đồ vật (itemNoun) & ngành hàng & từ khóa tìm kiếm
    let itemNoun: string | undefined;
    let category: string | undefined;
    const relatedCategories: string[] = [];
    const keywords: string[] = [];

    if (/balo|ba lô|cặp/i.test(lower)) {
      itemNoun = 'balo';
      keywords.push('balo', 'ba lô');
      category = 'Túi Ví Nữ';
      relatedCategories.push('Túi Ví Nữ', 'Thời Trang Nam');
    } else if (/túi|túi xách|túi đeo chéo|clutch/i.test(lower)) {
      itemNoun = 'túi xách';
      keywords.push('túi');
      category = 'Túi Ví Nữ';
      relatedCategories.push('Túi Ví Nữ', 'Phụ Kiện Nữ');
    } else if (/ví|bóp|thắt lưng|dây nịt/i.test(lower)) {
      itemNoun = /thắt lưng|dây nịt/i.test(lower) ? 'thắt lưng' : 'ví';
      keywords.push(/thắt lưng|dây nịt/i.test(lower) ? 'thắt lưng' : 'ví');
      category = 'Túi Ví Nữ';
      relatedCategories.push('Túi Ví Nữ', 'Thời Trang Nam', 'Phụ Kiện Nữ');
    } else if (/kính|mắt kính/i.test(lower)) {
      itemNoun = 'kính mát';
      keywords.push('kính');
      category = 'Phụ Kiện Nữ';
      relatedCategories.push('Phụ Kiện Nữ', 'Thời Trang Nam', 'Thời Trang Nữ');
    } else if (/đồng hồ/i.test(lower)) {
      itemNoun = 'đồng hồ';
      keywords.push('đồng hồ');
      category = 'Đồng Hồ';
      relatedCategories.push('Đồng Hồ', 'Phụ Kiện Nữ', 'Thời Trang Nam');
    } else if (/tai nghe|bluetooth|airpods/i.test(lower)) {
      itemNoun = 'tai nghe';
      category = 'Thiết Bị Điện Tử';
      keywords.push('tai nghe');
    } else if (/ốp lưng|ốp|case|kính cường lực/i.test(lower)) {
      itemNoun = 'ốp lưng';
      category = 'Điện Thoại & Phụ Kiện';
      keywords.push('ốp lưng', 'case');
    } else if (/quần|jogger|kaki|jean/i.test(lower)) {
      itemNoun = 'quần';
      keywords.push('quần');
      category = targetGender === 'NU' ? 'Thời Trang Nữ' : 'Thời Trang Nam';
      relatedCategories.push('Thời Trang Nam', 'Thời Trang Nữ');
    } else if (/áo|bomber|hoodie|áo thun|áo khoác|blazer|sơ mi|polo|cardigan/i.test(lower)) {
      const specificWord = lower.match(/(blazer|bomber|hoodie|cardigan|polo|sơ mi|áo khoác|áo thun)/i)?.[1];
      itemNoun = specificWord || 'áo';
      if (targetGender === 'NAM') {
        category = 'Thời Trang Nam';
        relatedCategories.push('Thời Trang Nam');
        keywords.push(specificWord || 'áo');
      } else if (targetGender === 'NU') {
        category = 'Thời Trang Nữ';
        relatedCategories.push('Thời Trang Nữ', 'Phụ Kiện Nữ');
        keywords.push(specificWord || 'áo', 'váy');
      } else {
        category = 'Thời Trang Nam';
        relatedCategories.push('Thời Trang Nam', 'Thời Trang Nữ');
        keywords.push(specificWord || 'áo');
      }
    } else if (/váy|đầm|chân váy/i.test(lower)) {
      itemNoun = 'váy đầm';
      category = 'Thời Trang Nữ';
      keywords.push('váy', 'đầm');
    } else if (/nồi|chảo|bát đĩa|bình giữ nhiệt|đồ gia dụng|cốc/i.test(lower)) {
      itemNoun = 'đồ gia dụng';
      category = 'Nhà Cửa';
      keywords.push('bình giữ nhiệt', 'bát đĩa');
    } else if (/mũ|nón/i.test(lower)) {
      itemNoun = 'mũ nón';
      category = 'Phụ Kiện Nữ';
      keywords.push('nón', 'mũ');
    } else if (/giày|dép|sneaker|boots/i.test(lower)) {
      itemNoun = 'giày dép';
      category = targetGender === 'NAM' ? 'Giày Dép Nam' : 'Giày Dép Nữ';
      relatedCategories.push('Giày Dép Nam', 'Giày Dép Nữ', 'Thời Trang Nữ');
      keywords.push('giày', 'sneaker', 'boots');
    }

    return {
      itemNoun,
      recipientNoun,
      category,
      relatedCategories,
      targetGender,
      minPrice,
      maxPrice,
      keywords: Array.from(new Set(keywords)),
      isGift,
      isAmbiguousRecipient,
    };
  }

  private parseMoneyUnit(numStr: string, unitStr?: string): number {
    const num = parseInt(numStr, 10);
    if (!num) return 0;
    const unit = (unitStr || '').toLowerCase();
    if (unit.startsWith('tr')) return num * 1000000;
    if (unit.startsWith('k') || unit.startsWith('ngh') || unit.startsWith('ngà')) return num * 1000;
    if (num < 1000) return num * 1000;
    return num;
  }

  /**
   * Truy vấn sản phẩm thực tế từ Database (chỉ trả bán chạy nhất khi người dùng chủ động hỏi gợi ý/bán chạy)
   */
  private async queryRelevantProducts(intent: any, rawQuery: string) {
    try {
      const priceFilter: any = {};
      if (intent.minPrice) priceFilter.gte = intent.minPrice;
      if (intent.maxPrice) priceFilter.lte = intent.maxPrice;

      const genderExclusion: any =
        intent.targetGender === 'NAM'
          ? {
              NOT: {
                AND: [
                  { name: { contains: 'nữ', mode: 'insensitive' as const } },
                  { NOT: { name: { contains: 'nam', mode: 'insensitive' as const } } },
                ],
              },
            }
          : intent.targetGender === 'NU'
          ? {
              NOT: {
                AND: [
                  { name: { contains: 'nam', mode: 'insensitive' as const } },
                  { NOT: { name: { contains: 'nữ', mode: 'insensitive' as const } } },
                ],
              },
            }
          : {};

      const baseWhere: any = {
        status: 'active',
        stock: { gt: 0 },
        name: { notIn: ['test', 'cuong', '2'] },
        ...genderExclusion,
      };
      if (Object.keys(priceFilter).length > 0) {
        baseWhere.price = priceFilter;
      }

      if (intent.keywords && intent.keywords.length > 0) {
        const keywordOrConditions = intent.keywords.map((kw: string) => ({
          name: { contains: kw, mode: 'insensitive' },
        }));

        let catFilter: any = undefined;
        if (intent.category) {
          catFilter = { in: Array.from(new Set([intent.category, ...(intent.relatedCategories || [])])) };
        }

        let keywordList = await this.prisma.product.findMany({
          where: {
            ...baseWhere,
            ...(catFilter ? { category: catFilter } : {}),
            OR: keywordOrConditions,
          },
          take: 6,
          orderBy: [{ sales: 'desc' }, { createdAt: 'desc' }],
        });

        if (keywordList.length === 0) {
          keywordList = await this.prisma.product.findMany({
            where: {
              ...baseWhere,
              OR: keywordOrConditions,
            },
            take: 6,
            orderBy: [{ sales: 'desc' }, { createdAt: 'desc' }],
          });
        }

        if (keywordList.length === 0 && Object.keys(priceFilter).length > 0) {
          // Nới lỏng mức giá nhưng vẫn giữ bộ lọc giới tính & ưu tiên ngành hàng đúng
          keywordList = await this.prisma.product.findMany({
            where: {
              status: 'active',
              stock: { gt: 0 },
              name: { notIn: ['test', 'cuong', '2'] },
              ...genderExclusion,
              ...(catFilter ? { category: catFilter } : {}),
              OR: keywordOrConditions,
            },
            take: 6,
            orderBy: [{ price: 'asc' }, { sales: 'desc' }],
          });
        }

        if (keywordList.length > 0) {
          return keywordList;
        }
      }

      const catList = Array.from(
        new Set([...(intent.category ? [intent.category] : []), ...(intent.relatedCategories || [])])
      );

      if (catList.length > 0) {
        const catListProducts = await this.prisma.product.findMany({
          where: {
            ...baseWhere,
            category: { in: catList },
          },
          take: 6,
          orderBy: [{ sales: 'desc' }, { createdAt: 'desc' }],
        });
        if (catListProducts.length > 0) {
          return catListProducts;
        }
      }

      const stopWords = new Set([
        'tôi', 'muốn', 'tìm', '1', 'cái', 'để', 'tặng', 'cho', 'ở', 'với', 'các',
        'những', 'một', 'mình', 'em', 'nhé', 'giúp', 'ạ', 'nào', 'rẻ', 'hơn',
        'có', 'không', 'dưới', 'trên', 'tầm', 'khoảng', 'gợi', 'ý', 'xem', 'mua',
      ]);
      const words = rawQuery
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !stopWords.has(w.toLowerCase()));
      if (words.length > 0) {
        const freeTextList = await this.prisma.product.findMany({
          where: {
            ...baseWhere,
            OR: words.slice(0, 4).map((w) => ({
              name: { contains: w, mode: 'insensitive' },
            })),
          },
          take: 6,
          orderBy: [{ sales: 'desc' }, { createdAt: 'desc' }],
        });
        if (freeTextList.length > 0) {
          return freeTextList;
        }
      }

      // Chỉ lấy sản phẩm bán chạy/theo giá khi khách chủ động hỏi gợi ý hoặc lọc theo giá
      if (
        /(bán chạy|hot|nổi bật|gợi ý|phổ biến|đồ gì|món gì|quà tặng)/i.test(rawQuery) ||
        Object.keys(priceFilter).length > 0
      ) {
        return await this.prisma.product.findMany({
          where: baseWhere,
          take: 6,
          orderBy: [{ sales: 'desc' }, { createdAt: 'desc' }],
        });
      }

      return [];
    } catch (e: any) {
      this.logger.error(`Error querying database for assistant: ${e.message}`);
      return [];
    }
  }

  private generateReasonForProduct(product: any, intent: any): string {
    const pName = (product.name || '').toLowerCase();
    const pCat = product.category || '';

    if (pName.includes('unisex') || pName.includes('bomber') || intent.targetGender === 'UNISEX') {
      return '👫 Phong cách Unisex dễ phối đồ';
    }
    if (intent.recipientNoun === 'người yêu' || intent.isAmbiguousRecipient) {
      if (pCat === 'Thời Trang Nam' || pName.includes('nam')) return '👨 Quà tặng bạn trai lịch lãm';
      if (pCat === 'Thời Trang Nữ' || pName.includes('váy') || pName.includes('nữ')) return '👩 Quà tặng bạn gái tinh tế';
      return '🎁 Quà tặng ý nghĩa';
    }
    if (intent.maxPrice && product.price <= intent.maxPrice) {
      return `💰 Phù hợp ngân sách ≤ ${intent.maxPrice.toLocaleString('vi-VN')}đ`;
    }
    if (product.sales && product.sales > 10) {
      return `🔥 Đã bán ${product.sales} lượt`;
    }
    return '✨ ZeroAI tuyển chọn';
  }

  private generateLocalFallbackReply(
    rawMsg: string,
    mode: ChatMode,
    intent: any,
    products: any[],
    activeVouchers: any[],
    sizeGuidance: string,
  ): string {
    if (mode === 'CHITCHAT') {
      return 'Chào bạn! Mình là ZeroAI Copilot của ZeroMall nè 😊 Bạn đang muốn tìm sản phẩm theo tầm giá, hỏi cách chọn size hay săn mã giảm giá hôm nay?';
    }
    if (mode === 'VOUCHER') {
      if (activeVouchers.length > 0) {
        const list = activeVouchers
          .slice(0, 4)
          .map((v) => `• ${v.code}: ${v.name} (đơn từ ${Number(v.minSpend || 0).toLocaleString('vi-VN')}đ)`)
          .join('\n');
        return `Hiện ZeroMall đang mở các mã giảm giá toàn sàn trong Khung Giờ Vàng nè:\n${list}\nBạn nhớ bấm "Lưu Vào Ví Ngay" ở trang chủ để giữ chỗ trước khi thanh toán nhé!`;
      }
      return 'Bạn có thể vào mục Khung Giờ Vàng Săn Voucher ngay trên trang chủ (các ca 00:00, 09:00, 12:00, 18:00, 21:00) để lưu mã giảm giá vào ví nhé!';
    }
    if (mode === 'SIZE_ADVICE') {
      return `${sizeGuidance}\nMẹo nhỏ: Bạn có thể vào trang chi tiết sản phẩm bất kỳ hoặc mở Phòng Thử Đồ AI để hệ thống tự chọn sẵn size chuẩn nhất nhé!`;
    }
    if (mode === 'SUPPORT') {
      return 'ZeroMall hỗ trợ giao hàng toàn quốc qua ZeroExpress (ZMX), thanh toán COD / Ví ZeroPay / QR SePay và đổi trả miễn phí trong 15 ngày (có Escrow bảo vệ). Ngoài ra bạn có thể dùng Phòng Thử Đồ AI để ướm thử và gợi ý size theo chiều cao, cân nặng nhé!';
    }

    if (products.length === 0) {
      return `Mình chưa tìm thấy sản phẩm nào khớp với "${rawMsg}" trong kho hiện tại. Bạn thử mô tả rõ hơn tên món đồ (ví dụ: áo khoác nam, quần tây, kính mát, đồng hồ...) để mình lọc giúp nhé!`;
    }

    const priceText = intent.maxPrice ? ` trong tầm giá dưới ${intent.maxPrice.toLocaleString('vi-VN')}đ` : '';
    return `Mình tìm thấy ${products.length} sản phẩm phù hợp${priceText} đang có sẵn trên ZeroMall nè. Bạn bấm vào từng thẻ bên dưới để xem chi tiết và thử đồ AI nhé! ✨`;
  }

  private getDefaultQuickReplies(mode: ChatMode, intent: any): string[] {
    if (mode === 'CHITCHAT') {
      return ['🎫 Xem mã giảm giá', '📏 Tư vấn chọn size', '🧥 Tìm áo khoác đẹp'];
    }
    if (mode === 'VOUCHER') {
      return ['🧥 Tìm đồ áp dụng mã', '⚡ Cách săn giờ vàng', '🚚 Phí ship ZeroExpress'];
    }
    if (mode === 'SIZE_ADVICE') {
      return ['👔 Tìm áo sơ mi nam', '👖 Tìm quần tây công sở', '🧥 Tìm áo blazer'];
    }
    if (mode === 'SUPPORT') {
      return ['🎫 Săn voucher hôm nay', '✨ Thử đồ AI ở đâu?', '🔥 Sản phẩm bán chạy'];
    }
    if (intent.targetGender === 'NAM') {
      return ['Áo khoác nam dưới 400k', 'Quần tây công sở nam', 'Đồng hồ hoặc thắt lưng'];
    }
    if (intent.targetGender === 'NU') {
      return ['Váy đầm đi chơi', 'Túi xách nữ thanh lịch', 'Kính mát thời trang'];
    }
    return ['Cái nào rẻ hơn?', '📏 Tư vấn chọn size', '🎫 Săn mã giảm giá'];
  }
}
