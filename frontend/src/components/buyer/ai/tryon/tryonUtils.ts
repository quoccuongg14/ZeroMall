import { formatCurrencyVND } from '../../../../utils/formatters'

export const formatDisplayPrice = formatCurrencyVND

// Các danh mục và sản phẩm phi thời trang (Điện tử, Gia dụng, Sách, Mỹ phẩm, v.v.)
export const NON_FASHION_CATS = [
  'gia-dung', 'gia dụng', 'may-anh', 'máy ảnh', 'may-tinh-laptop', 'máy tính',
  'dien-thoai-phu-kien', 'điện thoại', 'dien thoai', 'thiet-bi-dien-tu', 'thiết bị điện tử',
  'sach-vpp', 'sách', 'me-va-be', 'mẹ & bé', 'sac-dep', 'sắc đẹp', 'suc-khoe', 'sức khỏe',
  'oto-xe-may', 'ô tô', 'xe máy', 'the-thao-da-ngoai', 'bach-hoa', 'bách hóa', 'dien-may'
]

export const NON_FASHION_WORDS = [
  'bàn là', 'bàn ủi', 'nồi cơm', 'nồi chiên', 'máy giặt', 'tủ lạnh', 'bếp điện', 'bếp từ', 'chảo chống dính',
  'điện thoại', 'máy tính', 'laptop', 'màn hình', 'chuột máy tính', 'chuột gaming', 'bàn phím',
  'cáp sạc', 'sạc dự phòng', 'củ sạc', 'dây sạc', 'tai nghe', 'loa bluetooth', 'cường lực', 'ốp lưng', 'op lung', 'bao da',
  'giá đỡ điện thoại', 'hub chuyển', 'adapter', 'webcam', 'mic thu âm',
  'son môi', 'kem dưỡng', 'serum', 'sữa rửa mặt', 'nước hoa', 'dầu gội', 'sữa tắm', 'phấn phủ',
  'sách giáo khoa', 'tiểu thuyết', 'vở viết', 'bút bi', 'tã bỉm', 'sữa bột'
]

// Hàm kiểm tra nghiêm ngặt xem một sản phẩm có phải là sản phẩm thời trang hay không
export const isFashionProduct = (product: any): boolean => {
  if (!product) return false
  const cat = (product.category || '').toLowerCase().trim()
  const slug = (product.categoryRef?.slug || '').toLowerCase().trim()
  const name = ' ' + (product.name || '').toLowerCase().trim() + ' '

  // 1. Blacklist tuyệt đối: Nếu danh mục hoặc tên chứa từ khóa phi thời trang
  if (NON_FASHION_CATS.some(c => cat.includes(c) || slug.includes(c))) {
    return false
  }
  if (NON_FASHION_WORDS.some(w => name.includes(w))) {
    return false
  }

  // 2. Whitelist: Kiểm tra danh mục thời trang thực thụ
  const isFashionCat = [
    'thời trang', 'thoi-trang', 'thoi trang',
    'giày dép', 'giay-dep', 'giay dep',
    'túi ví', 'tui-vi', 'tui vi',
    'phụ kiện thời trang', 'phu-kien-thoi-trang', 'trang sức', 'trang-suc'
  ].some(c => cat.includes(c) || slug.includes(c))

  // 3. Whitelist: Kiểm tra từ khóa trang phục rõ ràng trong tên
  const isFashionName = [
    'áo', 'ao ', 'quần', 'quan ', 'váy', 'đầm', 'jean', 'jogger', 'bomber', 'jacket',
    'sơ mi', 'thun', 'hoodie', 'blazer', 'polo', 'yếm', 'short', 'croptop', 'cardigan',
    'giày', 'sneaker', 'dép', 'sandal', 'boot', 'guốc',
    'túi xách', 'túi đeo', 'túi tote', 'ví nữ', 'ví nam', 'balo', 'ba lô', 'clutch',
    'nón', 'mũ', 'thắt lưng', 'dây nịt', 'kính râm', 'kính mát', 'khuyên tai', 'bông tai', 'vòng cổ', 'dây chuyền', 'lắc tay'
  ].some(k => name.includes(k))

  return isFashionCat || isFashionName || detectItemSlot(product) !== null
}

// Tính toán BMI và phân loại thể hình theo chuẩn nhân trắc học
export const getBodyPhysiqueInfo = (bmiVal: number) => {
  if (bmiVal < 18.5) {
    return {
      label: 'Gầy mảnh khảnh (Ectomorph)',
      badge: '🦴 Dáng Gầy (Skinny)',
      color: 'text-sky-700 bg-sky-50 border-sky-300',
      textColor: 'text-sky-600',
      desc: 'Khung người gầy, chân tay thon nhỏ'
    }
  }
  if (bmiVal < 22.0) {
    return {
      label: 'Thon gọn, thanh mảnh',
      badge: '✨ Dáng Thon (Slim)',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-300',
      textColor: 'text-emerald-600',
      desc: 'Vóc dáng thon thả, eo nhỏ, chân gọn'
    }
  }
  if (bmiVal < 25.0) {
    return {
      label: 'Cân đối tiêu chuẩn (Mesomorph)',
      badge: '💪 Cân Đối (Standard)',
      color: 'text-indigo-700 bg-indigo-50 border-indigo-300',
      textColor: 'text-indigo-600',
      desc: 'Vóc dáng tiêu chuẩn vừa vặn'
    }
  }
  if (bmiVal < 29.0) {
    return {
      label: 'Đậm người / Cơ bắp (Endomorph)',
      badge: '🏋️ Đậm Người (Stout)',
      color: 'text-amber-800 bg-amber-50 border-amber-300',
      textColor: 'text-amber-600',
      desc: 'Khung người đậm, bắp chân & đùi to'
    }
  }
  return {
    label: 'Đầy đặn / Tròn trịa (Plus size)',
    badge: '👕 Dáng Mập (Chubby)',
    color: 'text-rose-700 bg-rose-50 border-rose-300',
    textColor: 'text-rose-600',
    desc: 'Khung người đậm, vòng bụng & đùi đầy đặn'
  }
}

// Phân loại slot trang phục chính xác tuyệt đối theo loại sản phẩm (Top / Bottom / Shoes / Accessory / null)
export const detectItemSlot = (p: any): 'top' | 'bottom' | 'shoes' | 'accessory' | null => {
  if (!p) return null
  const name = ' ' + (p.name || '').toLowerCase().trim() + ' '
  const cat = (p.category || '').toLowerCase().trim()
  const slug = (p.categoryRef?.slug || '').toLowerCase().trim()

  // 0. Loại trừ các danh mục và sản phẩm phi thời trang
  if (NON_FASHION_CATS.some(c => cat.includes(c) || slug.includes(c))) {
    return null
  }
  if (NON_FASHION_WORDS.some(w => name.includes(w))) {
    return null
  }

  // 1. GIÀY DÉP (Footwear) - Ưu tiên hàng đầu để chống nhầm giày "mũi nhọn", "mũi vuông" sang phụ kiện
  const isShoesCat = slug.includes('giay-dep') || cat.includes('giày dép') || cat.includes('giay dep')
  const isShoesWords = [
    'giày', 'giay', 'dép', 'dep', 'sneaker', 'sandal', 'guốc', 'guoc',
    'cao gót', 'búp bê', 'loafer', 'derby', 'chelsea', 'boots', 'bốt', 'ủng', 'sục', 'mwc', 'slip-on', 'slip on', 'oxford'
  ].some(k => name.includes(k))

  if ((isShoesCat || isShoesWords) && !name.includes('hộp đựng') && !name.includes('túi đựng giày') && !name.includes('kệ để')) {
    return 'shoes'
  }

  // 2. QUẦN & VÁY & ĐẦM (Bottoms / Lower Garments) - Ưu tiên trước accessory để tránh "quần túi hộp"
  const isBottomWords = [
    'quần', 'quan', 'jean', 'jeans', 'jogger', 'short', 'shorts', 'tây âu', 'quần tây',
    'quần đùi', 'quần baggy', 'quần ống', 'quần culottes', 'quần legging',
    'quần bò', 'quần lửng', 'quần nỉ', 'quần thun', 'boxer',
    'chân váy', 'váy xòe', 'váy chữ a', 'váy xếp ly', 'váy midi', 'váy maxi', 'váy body', 'váy yếm', 'váy hoa', 'váy tay bồng', 'váy công chúa', 'váy',
    'đầm', 'dam', 'maxi', 'jumpsuit', 'set đồ bộ'
  ].some(k => name.includes(k)) || (name.includes('kaki') && !name.includes('nón') && !name.includes('mũ') && !name.includes('áo') && !name.includes('khoác') && !name.includes('jacket'))

  if (isBottomWords) {
    return 'bottom'
  }

  // 3. ÁO (Tops / Upper Garments) - Ưu tiên trước accessory để tránh "áo hoodie có mũ" hay "áo có túi"
  const isTopWords = [
    'áo', 'ao', 'sơ mi', 'so mi', 'thun', 'polo', 'khoác', 'khoac', 'bomber', 'blazer',
    'cardigan', 'hoodie', 'sweater', 'croptop', 'crop top', 'tank top', 'ba lỗ',
    'gile', 'vest', 'bra', 'sát nách', 'cộc tay', 'tay phồng', 'len dệt kim', 'jacket', 'măng tô', 'áo gió', 'áo nỉ'
  ].some(k => {
    if (k === 'áo' || k === 'ao') {
      return /(?:^|[^\p{L}])áo(?:[^\p{L}]|$)/ui.test(name) || name.includes(' áo ') || name.startsWith(' áo') || name.includes('áo-')
    }
    if (k === 'thun') {
      return name.includes('thun') && !name.includes('dây thun') && !name.includes('cột tóc') && !name.includes('buộc tóc')
    }
    return name.includes(k)
  })

  if (isTopWords) {
    return 'top'
  }

  // 4. MŨ NÓN & PHỤ KIỆN THỜI TRANG & TRANG SỨC & TÚI VÍ (Accessories)
  const isAccCat = slug.includes('phu-kien') || slug.includes('tui-vi') || slug.includes('dong-ho') ||
                   cat.includes('phụ kiện thời trang') || cat.includes('túi ví') || cat.includes('đồng hồ') || cat.includes('phụ kiện nữ') ||
                   (cat.includes('phụ kiện') && !cat.includes('điện thoại') && !cat.includes('máy tính') && !cat.includes('xe') && !cat.includes('công nghệ'))

  // Khớp chính xác từ "mũ" (từ độc lập, không phải "mũi nhọn", "mũi vuông", "mũi giày")
  const hasHatWord = /(?:^|[^\p{L}])(?:mũ|nón|cap|beanie|snapback|bucket|beret)(?:[^\p{L}]|$)/ui.test(name) && !name.includes('mũi')

  const isAccWords = [
    'kính', 'gọng kính', 'kính râm', 'kính mát', 'tròng kính',
    'túi', 'ví', 'balo', 'ba lô', 'clutch', 'tote', 'túi xách', 'ví cầm tay', 'túi đeo',
    'khăn', 'cà vạt', 'caravat', 'nơ cổ',
    'kẹp tóc', 'cột tóc', 'dây thun', 'băng đô', 'cài tóc', 'bờm', 'chun buộc', 'kẹp càng cua',
    'dây chuyền', 'vòng cổ', 'vòng tay', 'lắc tay', 'lắc chân', 'khuyên tai', 'hoa tai', 'bông tai', 'nhẫn', 'kiềng', 'charm', 'trâm cài', 'mặt dây',
    'thắt lưng', 'dây nịt', 'belt',
    'đồng hồ'
  ].some(k => name.includes(k))

  if (isAccCat || isAccWords || hasHatWord) {
    return 'accessory'
  }

  return null
}

// Phân loại giới tính sản phẩm: 'male' | 'female' | 'unisex'
export const detectProductGender = (p: any): 'male' | 'female' | 'unisex' => {
  if (!p) return 'unisex'
  const name = ' ' + (p.name || '').toLowerCase() + ' '
  const cat = ((p.category || '') + ' ' + (p.categoryRef?.slug || '')).toLowerCase()

  // 1. Nếu là phụ kiện chung (Nón, Mũ, Kính mát, Đồng hồ, Thắt lưng, Balo, Khăn) mà không có từ "nữ" -> coi là UNISEX
  const isGeneralAccessory = [
    'nón', 'mũ', 'kính', 'đồng hồ', 'thắt lưng', 'dây nịt', 'balo', 'ba lô'
  ].some(k => name.includes(k))

  if (isGeneralAccessory) {
    const hasNam = name.includes(' nam ') || name.includes(' nam') || name.includes('-nam')
    const hasNu = name.includes(' nữ ') || name.includes(' nu ') || name.includes(' nữ') || name.includes('-nữ') || name.includes('đính đá') || name.includes('công chúa')
    if (hasNam && !hasNu) return 'male'
    if (hasNu && !hasNam) return 'female'
    return 'unisex' // Mũ nón, nón lưỡi trai, kính râm, đồng hồ nam nữ tự động là unisex!
  }

  // 2. Phân loại theo category / slug rõ ràng
  const isMaleCat = cat.includes('thoi-trang-nam') || cat.includes('giay-dep-nam') || cat.includes('thời trang nam')
  const isFemaleCat = cat.includes('thoi-trang-nu') || cat.includes('giay-dep-nu') || cat.includes('phu-kien-nu') || cat.includes('tui-vi-nu') || cat.includes('thời trang nữ')

  // 3. Từ khóa unisex
  if (name.includes('unisex') || name.includes('nam nữ') || name.includes('nam & nữ') || name.includes('nam/nữ')) {
    return 'unisex'
  }

  // 4. Từ khóa đặc thù nữ
  const strictlyFemaleWords = [
    'chân váy', 'váy xòe', 'váy chữ a', 'váy xếp ly', 'váy midi', 'váy maxi', 'váy body', 'váy yếm', 'váy hoa', 'váy',
    'đầm', 'dam', 'croptop', 'crop top', 'hai dây', 'pastel ngọt ngào', 'công chúa', 'bèo nhún', 'ren nữ', 'babydoll', 'yếm nữ'
  ]
  if (strictlyFemaleWords.some(w => name.includes(w))) {
    return 'female'
  }

  // 5. Từ khóa đặc thù nam
  const strictlyMaleWords = [
    'sơ mi nam', 'quần tây nam', 'quần đùi nam', 'boxer', 'kaki nam', 'vest nam', 'suit nam'
  ]
  if (strictlyMaleWords.some(w => name.includes(w))) {
    return 'male'
  }

  // 6. Kiểm tra chữ "nam" vs "nữ" trong tên
  const hasNam = name.includes(' nam ') || name.includes(' nam') || name.includes('-nam')
  const hasNu = name.includes(' nữ ') || name.includes(' nu ') || name.includes(' nữ') || name.includes('-nữ')

  if (hasNam && !hasNu) return 'male'
  if (hasNu && !hasNam) return 'female'

  if (isMaleCat && !isFemaleCat) return 'male'
  if (isFemaleCat && !isMaleCat) return 'female'

  return 'unisex'
}

// Kiểm tra xem sản phẩm có phù hợp với giới tính targetGender ('male' | 'female') không
export const isProductMatchingGender = (p: any, targetGender: 'male' | 'female' | 'all'): boolean => {
  if (targetGender === 'all') return true
  const itemGender = detectProductGender(p)
  if (itemGender === 'unisex') return true
  return itemGender === targetGender
}

// Nhãn badge hiển thị chuẩn xác từng món đồ
export const getSlotBadgeText = (p: any) => {
  const slot = detectItemSlot(p)
  if (slot === 'top') return '👔 Áo'
  if (slot === 'bottom') return '👖 Quần/Váy'
  if (slot === 'shoes') return '👟 Giày/Dép'
  if (slot === 'accessory') {
    const n = (p.name || '').toLowerCase()
    if (n.includes('mũ') || n.includes('nón')) return '🧢 Mũ/Nón'
    if (n.includes('kính')) return '🕶️ Kính'
    if (n.includes('túi') || n.includes('ví') || n.includes('balo')) return '👜 Túi/Ví'
    if (n.includes('khăn')) return '🧣 Khăn'
    if (n.includes('kẹp tóc') || n.includes('cột tóc') || n.includes('băng đô') || n.includes('cài tóc')) return '🎀 Kẹp Tóc'
    if (n.includes('dây chuyền') || n.includes('vòng cổ') || n.includes('vòng tay') || n.includes('lắc') || n.includes('nhẫn') || n.includes('khuyên tai') || n.includes('hoa tai') || n.includes('bông tai')) return '💍 Trang Sức'
    return '✨ Phụ Kiện'
  }
  return 'Thời trang'
}
