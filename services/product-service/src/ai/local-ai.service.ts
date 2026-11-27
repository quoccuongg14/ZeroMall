import { Injectable, Logger } from '@nestjs/common';

export interface LocalParsedIntent {
  normalizedQuery: string;
  expandedKeywords: string[];
  detectedIntent: string;
  suggestedCategory: string;
  priceRangeMin?: number;
  priceRangeMax?: number;
}

// Bảng viết tắt & thuật ngữ TMĐT tiếng Việt có sẵn (0ms)
const READY_MADE_ABBREVIATIONS: Record<string, { keywords: string[]; category: string; intent: string }> = {
  // Điện thoại & Công nghệ
  '15prm': { keywords: ['iPhone 15 Pro Max', 'apple iphone 15 pro max'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm iPhone 15 Pro Max' },
  '15pm': { keywords: ['iPhone 15 Pro Max', 'apple iphone 15 pro max'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm iPhone 15 Pro Max' },
  '15promax': { keywords: ['iPhone 15 Pro Max', 'apple iphone 15 pro max'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm iPhone 15 Pro Max' },
  '16prm': { keywords: ['iPhone 16 Pro Max', 'apple iphone 16 pro max'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm iPhone 16 Pro Max' },
  '16pm': { keywords: ['iPhone 16 Pro Max', 'apple iphone 16 pro max'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm iPhone 16 Pro Max' },
  '14prm': { keywords: ['iPhone 14 Pro Max', 'apple iphone 14 pro max'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm iPhone 14 Pro Max' },
  '14pm': { keywords: ['iPhone 14 Pro Max', 'apple iphone 14 pro max'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm iPhone 14 Pro Max' },
  '13prm': { keywords: ['iPhone 13 Pro Max', 'apple iphone 13 pro max'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm iPhone 13 Pro Max' },
  '12prm': { keywords: ['iPhone 12 Pro Max', 'apple iphone 12 pro max'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm iPhone 12 Pro Max' },
  'ip': { keywords: ['iPhone', 'điện thoại apple'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm điện thoại iPhone' },
  'iphone': { keywords: ['iPhone', 'điện thoại apple'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm điện thoại iPhone' },
  'ss': { keywords: ['Samsung Galaxy', 'điện thoại samsung'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm điện thoại Samsung' },
  's24u': { keywords: ['Samsung Galaxy S24 Ultra', 'samsung s24 ultra'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm Samsung Galaxy S24 Ultra' },
  's23u': { keywords: ['Samsung Galaxy S23 Ultra', 'samsung s23 ultra'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm Samsung Galaxy S23 Ultra' },
  'dt': { keywords: ['điện thoại', 'smartphone'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm điện thoại di động' },
  'đt': { keywords: ['điện thoại', 'smartphone'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm điện thoại di động' },
  'dtdd': { keywords: ['điện thoại di động', 'smartphone'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm điện thoại di động' },

  // Máy tính & Phụ kiện
  'mbp': { keywords: ['MacBook Pro', 'laptop apple macbook pro'], category: 'Laptop & Máy Tính', intent: 'Tìm kiếm MacBook Pro' },
  'mba': { keywords: ['MacBook Air', 'laptop apple macbook air'], category: 'Laptop & Máy Tính', intent: 'Tìm kiếm MacBook Air' },
  'macbook': { keywords: ['MacBook', 'laptop apple macbook'], category: 'Laptop & Máy Tính', intent: 'Tìm kiếm MacBook' },
  'lap': { keywords: ['laptop', 'máy tính xách tay'], category: 'Laptop & Máy Tính', intent: 'Tìm kiếm laptop' },
  'laptop': { keywords: ['laptop', 'máy tính xách tay'], category: 'Laptop & Máy Tính', intent: 'Tìm kiếm laptop' },
  'pc': { keywords: ['máy tính để bàn', 'PC desktop'], category: 'Laptop & Máy Tính', intent: 'Tìm kiếm máy tính để bàn' },
  'bpck': { keywords: ['bàn phím cơ', 'bàn phím gaming'], category: 'Thiết Bị Điện Tử', intent: 'Tìm kiếm bàn phím cơ' },
  'phim co': { keywords: ['bàn phím cơ', 'mechanical keyboard'], category: 'Thiết Bị Điện Tử', intent: 'Tìm kiếm bàn phím cơ' },
  'corsair': { keywords: ['Corsair', 'bàn phím corsair'], category: 'Thiết Bị Điện Tử', intent: 'Tìm kiếm sản phẩm Corsair' },

  // Âm thanh
  'tn': { keywords: ['tai nghe', 'headphone', 'earphone'], category: 'Thiết Bị Điện Tử', intent: 'Tìm kiếm tai nghe' },
  'tws': { keywords: ['tai nghe không dây', 'earbuds bluetooth'], category: 'Thiết Bị Điện Tử', intent: 'Tìm kiếm tai nghe true wireless' },
  'airpods': { keywords: ['AirPods', 'tai nghe apple airpods'], category: 'Thiết Bị Điện Tử', intent: 'Tìm kiếm AirPods' },

  // Giày dép & Thời trang & Esports
  'hle': { keywords: ['HLE', 'Hanwha Life Esports', 'Gumayusi'], category: 'Thể Thao', intent: 'Tìm kiếm vật phẩm Hanwha Life Esports' },
  'gumayusi': { keywords: ['Gumayusi', 'HLE Gumayusi Fanmeeting'], category: 'Thể Thao', intent: 'Tìm kiếm sản phẩm Gumayusi Fanmeeting' },
  'snk': { keywords: ['giày sneaker', 'giày thể thao', 'sneaker'], category: 'Giày Dép Nam', intent: 'Tìm kiếm giày sneaker thể thao' },
  'giay snk': { keywords: ['giày sneaker', 'giày thể thao', 'sneaker'], category: 'Giày Dép Nam', intent: 'Tìm kiếm giày sneaker thể thao' },
  'sneaker': { keywords: ['giày sneaker', 'giày thể thao'], category: 'Giày Dép Nam', intent: 'Tìm kiếm giày sneaker' },
  'mwc': { keywords: ['dép mwc', 'giày mwc', 'dép nam'], category: 'Thời Trang Nam', intent: 'Tìm kiếm sản phẩm MWC' },
  'dep': { keywords: ['dép', 'dép quai ngang', 'sandal'], category: 'Giày Dép Nam', intent: 'Tìm kiếm dép' },
  'hoodie': { keywords: ['áo hoodie', 'áo nỉ có mũ'], category: 'Thời Trang Nam', intent: 'Tìm kiếm áo hoodie' },
  'bomber': { keywords: ['áo bomber', 'áo khoác bomber'], category: 'Thời Trang Nam', intent: 'Tìm kiếm áo bomber' },
  'vay': { keywords: ['váy', 'chân váy', 'váy xòe'], category: 'Thời Trang Nữ', intent: 'Tìm kiếm váy nữ' },
  'dam': { keywords: ['đầm', 'váy đầm công chúa'], category: 'Thời Trang Nữ', intent: 'Tìm kiếm đầm nữ' },

  // Balo & Túi ví & Phụ kiện
  'balo': { keywords: ['balo', 'ba lô', 'cặp', 'balo học sinh', 'balo laptop', 'balo thời trang'], category: 'Túi Ví Nữ', intent: 'Tìm kiếm balo / cặp sách' },
  'ba lo': { keywords: ['balo', 'ba lô', 'cặp', 'balo học sinh', 'balo laptop', 'balo thời trang'], category: 'Túi Ví Nữ', intent: 'Tìm kiếm balo / cặp sách' },
  'cap': { keywords: ['cặp', 'balo', 'ba lô', 'cặp sách', 'cặp học sinh', 'túi xách'], category: 'Túi Ví Nữ', intent: 'Tìm kiếm cặp sách / balo' },
  'cặp': { keywords: ['cặp', 'balo', 'ba lô', 'cặp sách', 'cặp học sinh', 'túi xách'], category: 'Túi Ví Nữ', intent: 'Tìm kiếm cặp sách / balo' },
  'tui': { keywords: ['túi', 'túi xách', 'túi đeo chéo', 'túi ví'], category: 'Túi Ví Nữ', intent: 'Tìm kiếm túi xách' },
  'túi': { keywords: ['túi', 'túi xách', 'túi đeo chéo', 'túi ví'], category: 'Túi Ví Nữ', intent: 'Tìm kiếm túi xách' },
  'vi': { keywords: ['ví', 'bóp', 'ví tiền', 'ví nam', 'ví nữ'], category: 'Túi Ví Nữ', intent: 'Tìm kiếm ví tiền' },
  'non': { keywords: ['nón', 'mũ', 'nón lưỡi trai', 'mũ lưỡi trai'], category: 'Phụ Kiện Nữ', intent: 'Tìm kiếm nón mũ' },
  'nón': { keywords: ['nón', 'mũ', 'nón lưỡi trai', 'mũ lưỡi trai'], category: 'Phụ Kiện Nữ', intent: 'Tìm kiếm nón mũ' },
  'mu': { keywords: ['mũ', 'nón', 'nón lưỡi trai', 'mũ lưỡi trai'], category: 'Phụ Kiện Nữ', intent: 'Tìm kiếm nón mũ' },
  'mũ': { keywords: ['mũ', 'nón', 'nón lưỡi trai', 'mũ lưỡi trai'], category: 'Phụ Kiện Nữ', intent: 'Tìm kiếm nón mũ' },

  // Đồ gia dụng & Nhà cửa
  'nck': { keywords: ['nồi chiên không dầu', 'air fryer'], category: 'Gia Dụng', intent: 'Tìm kiếm nồi chiên không dầu' },
  'nckhd': { keywords: ['nồi chiên không dầu', 'air fryer'], category: 'Gia Dụng', intent: 'Tìm kiếm nồi chiên không dầu' },
  'noi chien': { keywords: ['nồi chiên không dầu', 'nồi chiên điện tử'], category: 'Gia Dụng', intent: 'Tìm kiếm nồi chiên không dầu' },
  'mxst': { keywords: ['máy xay sinh tố', 'máy xay đa năng'], category: 'Gia Dụng', intent: 'Tìm kiếm máy xay sinh tố' },
  'may xay': { keywords: ['máy xay sinh tố', 'máy xay cầm tay'], category: 'Gia Dụng', intent: 'Tìm kiếm máy xay' },
  'bgh': { keywords: ['bình giữ nhiệt', 'bình nước inox'], category: 'Nhà Cửa', intent: 'Tìm kiếm bình giữ nhiệt' },
  'binh nuoc': { keywords: ['bình nước', 'bình giữ nhiệt', 'ly giữ nhiệt'], category: 'Nhà Cửa', intent: 'Tìm kiếm bình nước' },
  'binh giu nhiet': { keywords: ['bình giữ nhiệt', 'bình nước inox', 'ly giữ nhiệt'], category: 'Nhà Cửa', intent: 'Tìm kiếm bình giữ nhiệt' },
  'bat dia': { keywords: ['bát đĩa', 'bộ bát đĩa sứ', 'chén dĩa'], category: 'Nhà Cửa', intent: 'Tìm kiếm bát đĩa' },
  'ke bep': { keywords: ['kệ đồ nhà bếp', 'kệ để đồ 3 tầng', 'kệ gia vị'], category: 'Nhà Cửa', intent: 'Tìm kiếm kệ nhà bếp' },
  'ghe': { keywords: ['ghế', 'ghế làm việc', 'ghế tựa'], category: 'Nhà Cửa', intent: 'Tìm kiếm ghế' },
  'sach': { keywords: ['sách', 'sách giáo khoa'], category: 'Nhà Cửa', intent: 'Tìm kiếm sách' },
  'op': { keywords: ['ốp lưng điện thoại', 'case điện thoại'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm ốp lưng' },
  'op lung': { keywords: ['ốp lưng điện thoại', 'case điện thoại'], category: 'Điện Thoại & Phụ Kiện', intent: 'Tìm kiếm ốp lưng' },
};

// Chuẩn hóa lỗi chính tả thông dụng
const COMMON_TYPOS: Record<string, string> = {
  'promax': 'pro max',
  'prmax': 'pro max',
  'prm': 'pro max',
  'prom': 'pro max',
  'macbookpro': 'macbook pro',
  'macbookair': 'macbook air',
  'aothun': 'áo thun',
  'aosomi': 'áo sơ mi',
  'quanjean': 'quần jeans',
  'giaythethao': 'giày thể thao',
  'tuidep': 'túi đẹp',
};

@Injectable()
export class LocalAiService {
  private readonly logger = new Logger(LocalAiService.name);
  private readonly ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434';
  private readonly groqApiKey = (process.env.GROQ_API_KEY || '').trim();
  private readonly groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

  private extractJsonObject(raw: string): any | null {
    const cleaned = (raw || '')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    if (!cleaned) return null;
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private getGroqModelChain(): string[] {
    const primary = (process.env.GROQ_CHAT_MODEL || 'qwen/qwen3.8-27b').trim();
    const fallbacks = (process.env.GROQ_FALLBACK_MODELS || 'openai/gpt-oss-120b,openai/gpt-oss-20b')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set([primary, ...fallbacks]));
  }

  private async callGroqChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    opts: { temperature: number; maxTokens: number; timeoutMs?: number; jsonMode?: boolean },
  ): Promise<{ content: string; model: string } | null> {
    if (!this.groqApiKey) return null;

    const models = this.getGroqModelChain();
    for (const model of models) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
        const isQwen3 = model.startsWith('qwen/qwen3');
        const isGptOss = model.includes('gpt-oss');

        const payload: any = {
          model,
          messages,
          temperature: opts.temperature,
          max_completion_tokens: isGptOss ? Math.max(opts.maxTokens, 520) : opts.maxTokens,
        };

        if (isQwen3) {
          payload.reasoning_effort = 'none';
          if (opts.jsonMode) {
            payload.response_format = { type: 'json_object' };
          }
        } else if (isGptOss) {
          payload.reasoning_effort = 'low';
        } else if (opts.jsonMode) {
          payload.response_format = { type: 'json_object' };
        }

        const res = await fetch(this.groqUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'ZeroMall/1.0',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          this.logger.warn(`Groq [${model}] HTTP ${res.status}: ${errText.slice(0, 160)}`);
          continue;
        }

        const data: any = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) {
          return { content: content.trim(), model };
        }
      } catch (e: any) {
        this.logger.warn(`Groq [${model}] failed: ${e.message}`);
      }
    }
    return null;
  }

  /**
   * Phân tích ý định & chuẩn hóa từ khóa cục bộ (Local NLP sẵn có, 0ms)
   */
  parseQuery(rawQuery: string): LocalParsedIntent {
    const original = (rawQuery || '').trim();
    let q = original
      .toLowerCase()
      .replace(/[đĐ]/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s+]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 1. Sửa lỗi chính tả cơ bản
    for (const [typo, correct] of Object.entries(COMMON_TYPOS)) {
      if (q.includes(typo)) {
        q = q.replace(new RegExp(typo, 'g'), correct);
      }
    }

    const expandedKeywords: string[] = [];
    let detectedIntent = `Tìm kiếm sản phẩm liên quan đến "${original}"`;
    let suggestedCategory = 'Tất cả danh mục';
    let priceRangeMin: number | undefined;
    let priceRangeMax: number | undefined;

    // 2. Tra cứu cụm từ viết tắt từ điển TMĐT
    const tokens = q.split(' ');
    for (let i = tokens.length; i >= 1; i--) {
      for (let start = 0; start <= tokens.length - i; start++) {
        const phrase = tokens.slice(start, start + i).join(' ');
        if (READY_MADE_ABBREVIATIONS[phrase]) {
          const matched = READY_MADE_ABBREVIATIONS[phrase];
          expandedKeywords.push(...matched.keywords);
          detectedIntent = matched.intent;
          suggestedCategory = matched.category;
        }
      }
    }

    // Tra cứu chuỗi dính liền (ví dụ "15prm")
    const qNoSpace = q.replace(/\s/g, '');
    if (READY_MADE_ABBREVIATIONS[qNoSpace]) {
      const matched = READY_MADE_ABBREVIATIONS[qNoSpace];
      expandedKeywords.push(...matched.keywords);
      detectedIntent = matched.intent;
      suggestedCategory = matched.category;
    }

    // 3. Trích xuất khoảng giá
    const priceMaxMatch = q.match(/(?:duoi|dưới)\s+(\d+)\s*(k|trieu|triệu|tr|nghin|nghìn)?/i);
    if (priceMaxMatch) {
      const num = parseInt(priceMaxMatch[1], 10);
      const unit = (priceMaxMatch[2] || '').toLowerCase();
      if (unit === 'k' || unit === 'nghin' || unit === 'nghìn') priceRangeMax = num * 1000;
      else if (unit === 'trieu' || unit === 'triệu' || unit === 'tr') priceRangeMax = num * 1_000_000;
      else if (num > 1000) priceRangeMax = num;
      else priceRangeMax = num * 1000;
    }

    // 4. Nhận diện danh mục nếu chưa có
    if (suggestedCategory === 'Tất cả danh mục') {
      if (/dien thoai|smartphone|iphone|samsung|apple|xiaomi|oppo/.test(q))
        suggestedCategory = 'Điện Thoại & Phụ Kiện';
      else if (/laptop|macbook|may tinh|pc|dell|hp|asus|lenovo/.test(q))
        suggestedCategory = 'Laptop & Máy Tính';
      else if (/tai nghe|airpods|earbuds|loa|bluetooth|phim co/.test(q))
        suggestedCategory = 'Thiết Bị Điện Tử';
      else if (/quan|ao|vay|dam|giay|dep|non/.test(q) && /nu|gai|women/.test(q))
        suggestedCategory = 'Thời Trang Nữ';
      else if (/quan|ao|giay|dep|sneaker|hoodie|bomber|polo|hle|esports/.test(q))
        suggestedCategory = 'Thời Trang Nam';
      else if (/noi chien|may xay|noi com|may giat|tu lanh|bep/.test(q))
        suggestedCategory = 'Gia Dụng';
      else if (/binh giu nhiet|ke|bat dia|noi|chao/.test(q))
        suggestedCategory = 'Nhà Cửa';
    }

    // 5. Tổng hợp từ khóa tìm kiếm (Loại bỏ từ dừng)
    const STOPWORDS = new Set(['va', 'cho', 'de', 'cua', 'la', 'tren', 'trong', 'cac', 'co', 'khong', 'voi', 'tu', 'toi', 'muon', 'tim']);
    const meaningfulTokens = q.split(' ').filter(t => t.length >= 2 && !STOPWORDS.has(t));

    expandedKeywords.unshift(original);
    expandedKeywords.push(...meaningfulTokens);

    const dedupedKeywords = [...new Set(expandedKeywords.filter(k => k && k.length >= 1))];

    return {
      normalizedQuery: q,
      expandedKeywords: dedupedKeywords.slice(0, 10),
      detectedIntent,
      suggestedCategory,
      priceRangeMin,
      priceRangeMax,
    };
  }

  /**
   * Gọi mô hình Ollama Qwen2.5 để phân tích ngữ nghĩa nâng cao (Fallback khi Gemini hết quota)
   */
  async parseSemanticWithOllama(rawQuery: string): Promise<Partial<LocalParsedIntent> | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const prompt = `Bạn là trợ lý tìm kiếm TMĐT ZeroMall. Phân tích cụm từ: "${rawQuery}".
Trả về duy nhất JSON hợp lệ:
{
  "detectedIntent": "Ý định tìm kiếm bằng tiếng Việt",
  "suggestedCategory": "Ngành hàng phù hợp",
  "expandedKeywords": ["3 đến 6 từ khóa tìm kiếm cụ thể tiếng Việt"]
}`;

      const res = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5:1.5b',
          prompt,
          format: 'json',
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data: any = await res.json();
        const parsed = JSON.parse(data.response);
        return {
          detectedIntent: parsed.detectedIntent || parsed.intent,
          suggestedCategory: parsed.suggestedCategory || parsed.category,
          expandedKeywords: parsed.expandedKeywords || parsed.keywords || [],
        };
      }
    } catch {
      // Bỏ qua nếu Ollama bận hoặc chưa tải xong
    }
    return null;
  }

  /**
   * Gọi mô hình Ollama Vision Local để phân tích hình ảnh
   * Ưu tiên: minicpm-v:latest (nhận diện vật thể, OCR, trang phục chi tiết) → moondream (fallback)
   * Sau đó dùng Qwen2.5:1.5b để trích xuất chuẩn cấu trúc tiếng Việt cho e-commerce TMĐT
   */
  async parseVisualWithMoondream(base64Image: string): Promise<{
    detectedProduct: string;
    searchTerms: string[];
    suggestedCategory?: string;
    dominantColors?: string[];
  } | null> {
    const visionModels = [
      {
        model: 'minicpm-v:latest',
        prompt: `Look at this product photo carefully. Describe the product shown:
1. What type of item/clothing is it (e.g. shirt, denim shirt, t-shirt, jacket, polo, pants, shoes, backpack, phone case, cap, etc.)?
2. Color, patterns, details (e.g. blue denim, dots, buttons, collar, long sleeves, short sleeves).
3. Any visible brand, logo or printed text if present.
Answer concisely in 2-3 sentences.`,
        timeout: 18000,
      },
      {
        model: 'moondream:latest',
        prompt: `Describe what product is in this image: item type, color, material, patterns. Answer in 2 short sentences.`,
        timeout: 10000,
      },
    ];

    let rawDescription = '';
    let usedVisionModel = '';

    for (const vm of visionModels) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), vm.timeout);

        const res = await fetch(`${this.ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: vm.model,
            prompt: vm.prompt,
            images: [base64Image],
            stream: false,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data: any = await res.json();
          const text = (data.response || '').trim();
          if (text && text.length > 5 && !/สมิการง|รับมาย/.test(text)) {
            rawDescription = text;
            usedVisionModel = vm.model;
            this.logger.log(`✅ Ollama Vision [${vm.model}] → ${text.substring(0, 120)}...`);
            break;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Ollama Vision [${vm.model}] failed: ${err.message}`);
      }
    }

    if (!rawDescription) return null;

    const descLower = rawDescription.toLowerCase();

    // 1. Phân loại sản phẩm xác định từ mô tả quang học (Tránh nhầm Áo Sơ Mi lót bên trong với Áo Blazer/Suit bên ngoài)
    let ruleDetectedProduct = '';
    let ruleCategory = '';
    let ruleKeywords: string[] = [];

    if (/\bsuit\b|blazer|tuxedo|\bvest\b|formal attire|bộ suit|áo vest|áo blazer/i.test(descLower)) {
      ruleDetectedProduct = 'Áo Blazer Nam Phong Cách Hàn Quốc';
      ruleCategory = 'Thời Trang Nam';
      ruleKeywords = ['áo blazer', 'blazer', 'áo blazer nam', 'áo vest', 'áo vest nam', 'bộ vest', 'bộ suit'];
    } else if (/two-piece|sport|jersey|football|soccer|cycling|athletic|bóng đá|áo đá bóng|đồ thể thao|quần áo thể thao|áo đấu|\bwika\b|\brider\b/i.test(descLower) || (/\bkit\b/i.test(descLower) && /sport|riding|wika|cam|bóng/i.test(descLower))) {
      ruleDetectedProduct = 'Bộ Quần Áo Thể Thao Nam';
      ruleCategory = 'Thể Thao';
      ruleKeywords = ['quần áo thể thao', 'đồ thể thao', 'áo thể thao', 'bộ thể thao', 'áo polo thể thao', 'quần jogger thể thao', 'thể thao'];
    } else if (/denim shirt|button-down|dress shirt|sơ mi|collared shirt|oxford/i.test(descLower)) {
      ruleDetectedProduct = 'Áo Sơ Mi Nam Tay Dài';
      ruleCategory = 'Thời Trang Nam';
      ruleKeywords = ['áo sơ mi', 'sơ mi', 'áo sơ mi nam', 'áo sơ mi dài tay'];
    } else if (/polo/i.test(descLower)) {
      ruleDetectedProduct = 'Áo Polo Nam Thể Thao';
      ruleCategory = 'Thời Trang Nam';
      ruleKeywords = ['áo polo', 'polo', 'áo thun polo', 'áo polo thể thao'];
    } else if (/t-shirt|tshirt|\btee\b|áo thun|áo phông/i.test(descLower)) {
      ruleDetectedProduct = 'Áo Thun Nam Cổ Tròn';
      ruleCategory = 'Thời Trang Nam';
      ruleKeywords = ['áo thun', 'áo phông', 'áo thun nam', 'áo thun thể thao'];
    } else if (/hoodie|sweatshirt/i.test(descLower)) {
      ruleDetectedProduct = 'Áo Hoodie Nam Form Rộng';
      ruleCategory = 'Thời Trang Nam';
      ruleKeywords = ['áo hoodie', 'hoodie', 'áo nỉ'];
    } else if (/bomber|windbreaker/i.test(descLower) || (/\bjacket\b|áo khoác/i.test(descLower) && !/\bsuit\b/i.test(descLower))) {
      ruleDetectedProduct = 'Áo Khoác Nam';
      ruleCategory = 'Thời Trang Nam';
      ruleKeywords = ['áo khoác', 'áo bomber', 'áo khoác nam'];
    } else if (/\bshirt\b/i.test(descLower)) {
      ruleDetectedProduct = 'Áo Thun / Áo Thể Thao Nam';
      ruleCategory = 'Thời Trang Nam';
      ruleKeywords = ['áo thun', 'áo thể thao', 'áo nam', 'áo polo thể thao'];
    } else if (/dress|skirt|váy|đầm/i.test(descLower)) {
      ruleDetectedProduct = 'Váy Đầm Nữ Thời Trang';
      ruleCategory = 'Thời Trang Nữ';
      ruleKeywords = ['váy', 'đầm', 'váy nữ'];
    } else if (/sneaker|running shoe|giày/i.test(descLower)) {
      ruleDetectedProduct = 'Giày Sneaker Thể Thao';
      ruleCategory = 'Giày Dép Nam';
      ruleKeywords = ['giày thể thao', 'giày sneaker', 'giày nam'];
    } else if (/backpack|balo|ba lô/i.test(descLower)) {
      ruleDetectedProduct = 'Balo Thời Trang Nam Nữ';
      ruleCategory = 'Balo & Túi Ví';
      ruleKeywords = ['balo', 'ba lô', 'balo học sinh'];
    } else if (/cap|hat|baseball cap|nón|mũ/i.test(descLower)) {
      ruleDetectedProduct = 'Nón Lưỡi Trai Trơn';
      ruleCategory = 'Phụ Kiện';
      ruleKeywords = ['nón lưỡi trai', 'mũ lưỡi trai', 'nón'];
    }

    // 2. Dùng Qwen để phân tích thêm màu sắc và chi tiết thương hiệu
    const structured = await this.parseVisualStructuredWithQwen(rawDescription);

    let finalProduct = ruleDetectedProduct || structured?.productName || 'Sản phẩm tương tự';
    let finalCategory = ruleCategory || structured?.category || 'Thời Trang Nam';
    let finalTerms = ruleKeywords.length > 0 ? [...ruleKeywords] : (structured?.keywords || []);

    // Bổ sung tên thương hiệu nếu xuất hiện trong mô tả
    const KNOWN_BRANDS = ['wika', 'nike', 'adidas', 'puma', 'hanwha', 'hle', 't1', 'geng', 'apple', 'samsung'];
    for (const b of KNOWN_BRANDS) {
      if (descLower.includes(b)) {
        finalTerms.unshift(b);
      }
    }

    // Khử trùng lặp từ khóa
    finalTerms = [...new Set(finalTerms.filter(t => t && t.length >= 2))].slice(0, 10);

    return {
      detectedProduct: finalProduct,
      searchTerms: finalTerms.length > 0 ? finalTerms : ['áo blazer', 'thời trang nam'],
      suggestedCategory: finalCategory,
      dominantColors: structured?.colors || [],
    };
  }

  /**
   * Dùng Qwen để phân tích mô tả thị giác thành thông tin sản phẩm TMĐT tiếng Việt
   * Ưu tiên qwen2.5:14b (chính xác cao), fallback sang qwen2.5:1.5b
   */
  async parseVisualStructuredWithQwen(visualDescription: string): Promise<{
    productName: string;
    category?: string;
    keywords: string[];
    colors: string[];
  } | null> {
    const qwenModels = ['qwen2.5:14b', 'qwen2.5:1.5b'];

    for (const model of qwenModels) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const prompt = `Bạn là chuyên gia phân tích sản phẩm TMĐT ZeroMall Việt Nam.
Từ mô tả hình ảnh sau: "${visualDescription}"

Nhiệm vụ: Trích xuất thông tin để tìm kiếm sản phẩm trên sàn TMĐT Việt Nam.
LƯU Ý QUAN TRỌNG:
- Tất cả tên sản phẩm và từ khóa PHẢI bằng TIẾNG VIỆT (hoặc từ mượn quen thuộc như blazer, suit, vest, polo).
- Nếu mô tả là suit jacket / blazer / formal suit -> Áo Blazer Nam hoặc Áo Vest Nam.
- Nếu mô tả là đồ thể thao / áo bóng đá / kit / jersey -> Bộ Quần Áo Bóng Đá Thể Thao Nam (Ngành Thể Thao).
- Tuyệt đối KHÔNG dùng từ khóa tiếng Anh thuần như "formal attire", "red pocket square", "sportswear kit", "riding activities".

Chỉ trả về JSON duy nhất:
{
  "productName": "Tên sản phẩm tiếng Việt chuẩn ngắn gọn (ví dụ: Áo Blazer Nam / Áo Sơ Mi Nam / Nón Lưỡi Trai...)",
  "category": "Ngành hàng chuẩn (Thời Trang Nam | Thời Trang Nữ | Giày Dép Nam | Giày Dép Nữ | Thể Thao | Điện Thoại & Phụ Kiện | Thiết Bị Điện Tử | Nhà Cửa | Gia Dụng | Balo & Túi Ví)",
  "keywords": ["danh sách 5-8 từ khóa tìm kiếm tiếng Việt phổ biến trên sàn TMĐT"],
  "colors": ["Màu chính tiếng Việt"]
}`;

        const res = await fetch(`${this.ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            format: 'json',
            stream: false,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data: any = await res.json();
          const parsed = JSON.parse(data.response);
          if (parsed && (parsed.productName || parsed.keywords)) {
            return {
              productName: parsed.productName || parsed.name || 'Sản phẩm tương tự',
              category: parsed.category || undefined,
              keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
              colors: Array.isArray(parsed.colors) ? parsed.colors : [],
            };
          }
        }
      } catch {
        // Thử model tiếp theo
      }
    }
    return null;
  }

  /**
   * Phân loại ý định & trích xuất truy vấn hội thoại đa lượt bằng Ollama (nhanh bằng qwen2.5:1.5b)
   */
  async analyzeChatIntentWithOllama(
    userMessage: string,
    history: Array<{ role: string; content: string }> = [],
  ): Promise<{
    mode: 'CHITCHAT' | 'VOUCHER' | 'SIZE_ADVICE' | 'SUPPORT' | 'PRODUCT_SEARCH';
    searchQuery: string;
    keywords: string[];
    minPrice?: number;
    maxPrice?: number;
    targetGender?: 'NAM' | 'NU' | 'UNISEX';
  } | null> {
    const routerModel = process.env.OLLAMA_ROUTER_MODEL || process.env.OLLAMA_CHAT_MODEL || 'qwen2.5:14b';
    const historyBrief = history
      .slice(-4)
      .map((m) => `${m.role === 'user' ? 'Khách' : 'ZeroAI'}: ${m.content.slice(0, 180)}`)
      .join('\n');

    const prompt = `Phân tích ý định câu nói mới nhất của khách trên sàn TMĐT ZeroMall.
Lịch sử gần đây:
${historyBrief || '(Bắt đầu hội thoại)'}

Câu mới của khách: "${userMessage}"

Phân loại "mode" vào đúng 1 trong 5 giá trị:
- "CHITCHAT": chào hỏi, cảm ơn, hỏi thăm, tán gẫu, hỏi bạn là ai, không hỏi mua món đồ cụ thể.
- "VOUCHER": hỏi mã giảm giá, voucher, freeship, khung giờ vàng săn deal.
- "SIZE_ADVICE": hỏi tư vấn chọn size theo chiều cao, cân nặng, số đo (không tìm mua sản phẩm khác).
- "SUPPORT": hỏi chính sách đổi trả, hoàn tiền, giao hàng ZMX, thanh toán SePay/ZeroPay, thử đồ AI, mở shop, CSKH.
- "PRODUCT_SEARCH": khách muốn tìm/mua/xem/so sánh sản phẩm hoặc hỏi tiếp về món đồ từ lịch sử.

Trả về JSON hợp lệ duy nhất:
{
  "mode": "CHITCHAT|VOUCHER|SIZE_ADVICE|SUPPORT|PRODUCT_SEARCH",
  "searchQuery": "cụm tìm kiếm sản phẩm độc lập tiếng Việt nếu mode=PRODUCT_SEARCH",
  "keywords": ["từ khóa sản phẩm tiếng Việt ngắn gọn nếu mode=PRODUCT_SEARCH, tối đa 5 từ"],
  "minPrice": null,
  "maxPrice": null,
  "targetGender": null
}`;

    const parseRouted = (raw: string) => {
      const parsed = this.extractJsonObject(raw);
      if (!parsed) return null;
      const validModes = new Set(['CHITCHAT', 'VOUCHER', 'SIZE_ADVICE', 'SUPPORT', 'PRODUCT_SEARCH']);
      const mode = validModes.has(parsed?.mode) ? parsed.mode : 'CHITCHAT';
      return {
        mode,
        searchQuery: typeof parsed?.searchQuery === 'string' ? parsed.searchQuery : userMessage,
        keywords: Array.isArray(parsed?.keywords)
          ? parsed.keywords.map((k: any) => String(k).trim()).filter(Boolean)
          : [],
        minPrice: typeof parsed?.minPrice === 'number' && parsed.minPrice > 0 ? parsed.minPrice : undefined,
        maxPrice: typeof parsed?.maxPrice === 'number' && parsed.maxPrice > 0 ? parsed.maxPrice : undefined,
        targetGender:
          parsed?.targetGender === 'NAM' || parsed?.targetGender === 'NU' || parsed?.targetGender === 'UNISEX'
            ? parsed.targetGender
            : undefined,
      };
    };

    if (this.groqApiKey) {
      const groqRes = await this.callGroqChat(
        [{ role: 'user', content: prompt }],
        { temperature: 0.1, maxTokens: 180, timeoutMs: 8000, jsonMode: true },
      );
      if (groqRes?.content) {
        const routed = parseRouted(groqRes.content);
        if (routed) return routed;
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: routerModel,
          prompt,
          format: 'json',
          stream: false,
          keep_alive: '30m',
          options: { temperature: 0.1, num_ctx: 2560, num_predict: 180 },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const data: any = await res.json();
      return parseRouted(data.response);
    } catch {
      return null;
    }
  }

  /**
   * Sinh câu trả lời hội thoại thông minh đa lượt: ưu tiên Groq API (< 1s) -> tự động dự phòng Ollama local
   */
  async generateShoppingChatWithOllama(params: {
    userMessage: string;
    mode: 'CHITCHAT' | 'VOUCHER' | 'SIZE_ADVICE' | 'SUPPORT' | 'PRODUCT_SEARCH';
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    retrievedProducts?: any[];
    activeVouchers?: any[];
    sizeGuidance?: string;
    contextSummary?: string;
  }): Promise<{ reply: string; quickReplies: string[]; showProducts?: boolean } | null> {
    const ollamaModel = process.env.OLLAMA_CHAT_MODEL || 'qwen2.5:14b';
    const {
      userMessage,
      mode,
      history = [],
      retrievedProducts = [],
      activeVouchers = [],
      sizeGuidance = '',
      contextSummary = '',
    } = params;

    const productContext =
      retrievedProducts.length > 0
        ? retrievedProducts
            .slice(0, 6)
            .map((p, idx) => {
              const priceFmt = Number(p.price || 0).toLocaleString('vi-VN') + 'đ';
              const origFmt = p.originalPrice ? ` (gốc ${Number(p.originalPrice).toLocaleString('vi-VN')}đ)` : '';
              const variantsNote = p.variationsText ? ` | Loại: ${p.variationsText}` : '';
              return `${idx + 1}. "${p.name}" - ${priceFmt}${origFmt} | Đã bán: ${p.sales || 0} | Kho: ${p.stock ?? 0}${variantsNote}`;
            })
            .join('\n')
        : '(Kho hiện không có sản phẩm khớp trực tiếp)';

    const voucherContext =
      activeVouchers.length > 0
        ? activeVouchers
            .map((v) => {
              const disc =
                v.type === 'percentage'
                  ? `Giảm ${v.value}%${v.maxDiscount ? ` (tối đa ${Number(v.maxDiscount).toLocaleString('vi-VN')}đ)` : ''}`
                  : `Giảm ${Number(v.value).toLocaleString('vi-VN')}đ`;
              return `- ${v.code}: ${disc}, đơn từ ${Number(v.minSpend || 0).toLocaleString('vi-VN')}đ (còn ${Math.max(0, (v.usageLimit || 0) - (v.usedCount || 0))}/${v.usageLimit} lượt)`;
            })
            .join('\n')
        : '';

    const supportFacts =
      mode === 'SUPPORT' || mode === 'VOUCHER' || mode === 'SIZE_ADVICE'
        ? `\nKIẾN THỨC ZEROMALL: Phòng Thử Đồ AI (ướm đồ + gợi ý size), Tìm kiếm bằng ảnh, Giờ Vàng Voucher FCFS (00:00, 09:00, 12:00, 18:00, 21:00), Ship ZeroExpress (ZMX), COD/ZeroPay/QR SePay, đổi trả 15 ngày có Escrow.`
        : '';

    const systemPrompt = `Bạn là ZeroAI Copilot - trợ lý mua sắm sàn TMĐT ZeroMall (zeromall.id.vn).${supportFacts}
QUY TẮC:
1. Trả lời trực tiếp bằng tiếng Việt tự nhiên, thân thiện (xưng "mình", gọi khách "bạn"), ngắn gọn 2-4 câu, KHÔNG bọc JSON hay markdown rườm rà.
2. Nếu mode="${mode}" là CHITCHAT/SUPPORT/VOUCHER/SIZE_ADVICE hoặc câu hỏi nối tiếp về sản phẩm đã gợi ý trước đó: trả lời đúng trọng tâm từ thông tin thực tế hoặc lịch sử hội thoại, không bịa thêm sản phẩm lạ.
3. Nếu mode="PRODUCT_SEARCH": chỉ giới thiệu sản phẩm có thật trong DANH SÁCH KHO HÀNG bên dưới, tuyệt đối không bịa thêm sản phẩm hay giá ngoài danh sách.
4. Không nhắc từ kỹ thuật nội bộ (SQL, database, JSON, mode).`;

    const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    for (const h of history.slice(-6)) {
      if (h?.content?.trim()) {
        chatMessages.push({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content.trim().slice(0, 650),
        });
      }
    }

    const extraBlocks: string[] = [];
    if (contextSummary) extraBlocks.push(`Ngữ cảnh: ${contextSummary}`);
    if (sizeGuidance) extraBlocks.push(`Số đo/Size:\n${sizeGuidance}`);
    if (voucherContext) extraBlocks.push(`Voucher đang mở:\n${voucherContext}`);
    if (mode === 'PRODUCT_SEARCH') {
      extraBlocks.push(`DANH SÁCH KHO HÀNG:\n${productContext}`);
    }

    const finalUserTurn = extraBlocks.length
      ? `${extraBlocks.join('\n\n')}\n\nKhách hỏi: "${userMessage}"`
      : userMessage;

    chatMessages.push({ role: 'user', content: finalUserTurn });

    const parseChatResponse = (rawText: string) => {
      const trimmed = (rawText || '').trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('{')) {
        const parsed = this.extractJsonObject(trimmed);
        if (typeof parsed?.reply === 'string' && parsed.reply.trim()) {
          return {
            reply: parsed.reply.trim(),
            quickReplies: Array.isArray(parsed.quickReplies)
              ? parsed.quickReplies.map((q: any) => String(q).trim()).filter(Boolean).slice(0, 3)
              : [],
            showProducts: typeof parsed.showProducts === 'boolean' ? parsed.showProducts : undefined,
          };
        }
      }
      return { reply: trimmed, quickReplies: [] };
    };

    // 1. Ưu tiên Groq Cloud API (phản hồi < 1s, tự fallback giữa các model Groq khi gặp 429)
    if (this.groqApiKey) {
      const groqRes = await this.callGroqChat(chatMessages, {
        temperature: 0.35,
        maxTokens: 280,
        timeoutMs: 12000,
        jsonMode: false,
      });
      if (groqRes?.content) {
        const formatted = parseChatResponse(groqRes.content);
        if (formatted) {
          this.logger.log(`⚡ ZeroAI replied via Groq [${groqRes.model}]`);
          return formatted;
        }
      }
    }

    // 2. Dự phòng về Ollama local khi Groq hết hạn mức hoặc chưa cấu hình key
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const res = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: chatMessages,
          stream: false,
          keep_alive: '30m',
          options: {
            temperature: 0.35,
            num_ctx: 2560,
            num_predict: 260,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`Ollama chat HTTP ${res.status}`);
        return null;
      }

      const data: any = await res.json();
      const rawText = data?.message?.content;
      if (!rawText) return null;

      return parseChatResponse(rawText);
    } catch (e: any) {
      this.logger.warn(`Ollama chat (${ollamaModel}) error: ${e.message}`);
    }

    return null;
  }
}
