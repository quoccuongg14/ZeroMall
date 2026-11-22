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

    // Dùng Qwen2.5 để phân tích mô tả sang dữ liệu e-commerce tiếng Việt
    const structured = await this.parseVisualStructuredWithQwen(rawDescription);
    if (structured && structured.productName) {
      return {
        detectedProduct: structured.productName,
        searchTerms: structured.keywords,
        suggestedCategory: structured.category,
        dominantColors: structured.colors,
      };
    }

    // Fallback: Trích xuất từ khóa nổi bật từ mô tả thô
    const STOP_WORDS = new Set([
      'this', 'that', 'with', 'from', 'shows', 'image', 'person', 'wearing', 'appears',
      'the', 'and', 'for', 'are', 'was', 'has', 'have', 'its', 'their', 'there',
      'which', 'what', 'where', 'when', 'how', 'who', 'into', 'about', 'also',
      'very', 'just', 'main', 'product', 'shown', 'answer', 'visible', 'dominant',
      'colors', 'text', 'logo', 'brand', 'look', 'carefully', 'these', 'questions',
      'read', 'list', 'every', 'word', 'they', 'does', 'been', 'being', 'could',
      'would', 'should', 'might', 'like', 'seem', 'than', 'then', 'here', 'some',
      'một', 'các', 'của', 'cho', 'này', 'trong', 'với', 'được', 'không', 'trên',
      'hình', 'ảnh', 'sản', 'phẩm', 'chính', 'xuất', 'hiện', 'nhìn', 'thấy',
    ]);

    const rawWords = rawDescription
      .split(/[\s,.\-;:!?()\[\]{}'"\/]+/)
      .filter((w: string) => w.length >= 2 && !STOP_WORDS.has(w.toLowerCase()))
      .map((w: string) => w.replace(/^[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]+|[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]+$/g, ''))
      .filter((w: string) => w.length >= 2);

    const uniqueWords = [...new Set(rawWords)];

    // Tìm các cụm từ khóa quan trọng (tên thương hiệu, tên đội)
    const KNOWN_BRANDS_TEAMS = [
      'HLE', 'Hanwha', 'Hanwha Life', 'Hanwha Life Esports', 'Gumayusi', 'Zeka', 'Delight',
      'T1', 'Faker', 'GenG', 'Gen.G', 'DRX', 'KT', 'Dplus', 'BLG', 'JDG', 'TES',
      'Nike', 'Adidas', 'Puma', 'New Balance', 'Converse', 'Vans',
      'Apple', 'iPhone', 'Samsung', 'Galaxy', 'Xiaomi', 'OPPO', 'Huawei',
      'Corsair', 'Logitech', 'Razer',
      'MSI', 'LCK', 'LPL', 'Worlds', 'Esports', 'Fanmeeting',
      'Wika', 'Wika Rider',
    ];

    const detectedBrands: string[] = [];
    const descLower = rawDescription.toLowerCase();
    for (const brand of KNOWN_BRANDS_TEAMS) {
      if (descLower.includes(brand.toLowerCase())) {
        detectedBrands.push(brand);
      }
    }

    // Xác định danh mục từ mô tả
    let suggestedCategory: string | undefined;
    if (/esports|jersey|đấu|thể thao|sports|team|uniform|đội/i.test(rawDescription)) {
      suggestedCategory = 'Thể Thao';
    } else if (/shirt|áo|polo|hoodie|jacket|bomber|t-shirt|tshirt/i.test(rawDescription)) {
      suggestedCategory = 'Thời Trang Nam';
    } else if (/phone|điện thoại|iphone|samsung|galaxy|smartphone/i.test(rawDescription)) {
      suggestedCategory = 'Điện Thoại & Phụ Kiện';
    } else if (/shoe|giày|sneaker|boot|dép|sandal/i.test(rawDescription)) {
      suggestedCategory = 'Giày Dép Nam';
    } else if (/dress|váy|đầm|skirt/i.test(rawDescription)) {
      suggestedCategory = 'Thời Trang Nữ';
    }

    const searchTerms = [...detectedBrands, ...uniqueWords.slice(0, 10)];
    const dedupedTerms = [...new Set(searchTerms.filter(t => t.length >= 2))].slice(0, 12);

    return {
      detectedProduct: rawDescription.substring(0, 120),
      searchTerms: dedupedTerms,
      suggestedCategory,
    };
  }

  /**
   * Dùng Qwen2.5 để phân tích mô tả thị giác thành thông tin sản phẩm TMĐT tiếng Việt
   */
  async parseVisualStructuredWithQwen(visualDescription: string): Promise<{
    productName: string;
    category?: string;
    keywords: string[];
    colors: string[];
  } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const prompt = `Bạn là chuyên gia phân tích sản phẩm TMĐT ZeroMall Việt Nam.
Từ mô tả hình ảnh sau: "${visualDescription}"

Nhiệm vụ: Trích xuất thông tin để tìm kiếm sản phẩm trên sàn TMĐT Việt Nam.
LƯU Ý QUAN TRỌNG:
- Tất cả tên sản phẩm và từ khóa PHẢI bằng TIẾNG VIỆT (hoặc kèm từ mượn quen thuộc như blazer, polo, jean, sneaker, hoodie).
- Nếu là đồ vest/suit/blazer nam: tên sản phẩm là "Áo Blazer Nam Phong Cách Hàn Quốc" hoặc "Bộ Vest Nam", keywords: ["áo blazer", "blazer", "áo blazer nam", "áo vest", "áo vest nam", "bộ vest"].
- Nếu là áo sơ mi: ["áo sơ mi", "sơ mi", "áo sơ mi nam"].
- Tuyệt đối KHÔNG dùng từ khóa tiếng Anh thuần như "formal attire", "red pocket square", "dress suit".

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
          productName: parsed.productName || parsed.name || 'Sản phẩm tương tự',
          category: parsed.category || undefined,
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
          colors: Array.isArray(parsed.colors) ? parsed.colors : [],
        };
      }
    } catch (e: any) {
      this.logger.warn(`Qwen2.5 visual extraction failed: ${e.message}`);
    }
    return null;
  }
}
