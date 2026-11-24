import os
import sys
import json
import base64
import io
import urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from PIL import Image
from sentence_transformers import SentenceTransformer, util

PORT = int(os.environ.get("CLIP_PORT", 5005))
print(f"[*] Loading clip-ViT-B-32 model on Apple Silicon / CPU / CUDA...")
model = SentenceTransformer("clip-ViT-B-32")
print(f"[+] Model loaded!")

# Ngành hàng & vật thể chuẩn để phân loại hình ảnh (Zero-shot Multimodal Vision)
CANONICAL_CATEGORIES = {
    # 1. ĐỒNG HỒ & PHỤ KIỆN
    "Đồng Hồ Đeo Tay": {
        "prompt": "wrist watch analog watch digital watch luxury timepiece smartwatch chronometer dong ho đeo tay mat kinh dong ho",
        "label": "Đồng hồ đeo tay / Smartwatch",
        "suggestedTitle": "Đồng Hồ Thời Trang Nam Nữ Chính Hãng",
        "zero_category": "Đồng Hồ",
        "domain": "WATCH"
    },
    "Dây Đeo / Phụ Kiện Đồng Hồ": {
        "prompt": "watch strap watch band watch bracelet replacement strap leather strap silicone band day dong ho day đeo dong ho thay the",
        "label": "Dây đeo / Phụ kiện đồng hồ",
        "suggestedTitle": "Dây Đeo Đồng Hồ Thời Trang Cao Cấp",
        "zero_category": "Đồng Hồ",
        "domain": "WATCH_STRAP"
    },

    # 2. ĐIỆN THOẠI & PHỤ KIỆN (Bóc tách rõ Host Device vs Accessories)
    "Điện Thoại Thông Minh": {
        "prompt": "smartphone mobile phone with touchscreen front screen notch iphone samsung handset dien thoai di dong thong minh",
        "label": "Điện thoại thông minh / Smartphone",
        "suggestedTitle": "Điện Thoại Thông Minh Chính Hãng",
        "zero_category": "Điện Thoại & Phụ Kiện",
        "domain": "SMARTPHONE"
    },
    "Pin Sạc Dự Phòng / Củ Cáp Sạc": {
        "prompt": "power bank portable charger battery pack with usb ports external battery pin sac du phong cuc sac cap sac adapter",
        "label": "Pin sạc dự phòng / Củ cáp sạc",
        "suggestedTitle": "Pin Sạc Dự Phòng Tiện Lợi Dung Lượng Chuẩn",
        "zero_category": "Điện Thoại & Phụ Kiện",
        "domain": "POWERBANK_CHARGER"
    },
    "Ốp Lưng / Kính Cường Lực": {
        "prompt": "phone case protective silicone back cover tempered glass screen protector op lung dien thoai kinh cuong luc",
        "label": "Ốp lưng / Kính cường lực điện thoại",
        "suggestedTitle": "Ốp Lưng Điện Thoại Thời Trang Chống Sốc",
        "zero_category": "Điện Thoại & Phụ Kiện",
        "domain": "PHONE_CASE"
    },

    # 3. THIẾT BỊ ĐIỆN TỬ & ÂM THANH
    "Tai Nghe / Loa Bluetooth": {
        "prompt": "bluetooth headphones wireless earbuds airpods over-ear headset bluetooth speaker loa bluetooth tai nghe khong day",
        "label": "Tai nghe / Loa bluetooth",
        "suggestedTitle": "Tai Nghe Bluetooth Không Dây Âm Thanh Sống Động",
        "zero_category": "Thiết Bị Điện Tử",
        "domain": "AUDIO_DEVICE"
    },

    # 4. MÁY TÍNH & PHỤ KIỆN
    "Máy Tính & Laptop": {
        "prompt": "laptop computer notebook macbook open laptop screen keyboard may tinh xach tay laptop",
        "label": "Máy tính xách tay / Laptop",
        "suggestedTitle": "Laptop Máy Tính Cấu Hình Cao",
        "zero_category": "Máy Tính & Laptop",
        "domain": "LAPTOP"
    },
    "Chuột / Bàn Phím / Phụ Kiện Máy Tính": {
        "prompt": "computer mouse mechanical keyboard mousepad computer monitor ban phim co chuot may tinh",
        "label": "Bàn phím / Chuột / Linh kiện máy tính",
        "suggestedTitle": "Bàn Phím Chuột Máy Tính Tiện Lợi",
        "zero_category": "Máy Tính & Laptop",
        "domain": "PC_PERIPHERALS"
    },

    # 5. MÁY ẢNH & PHỤ KIỆN
    "Máy Ảnh / Ống Kính": {
        "prompt": "camera photography lens digital camera dslr mirrorless gopro may anh ky thuat so",
        "label": "Máy ảnh / Thiết bị quay phim",
        "suggestedTitle": "Máy Ảnh Kỹ Thuật Số Chính Hãng",
        "zero_category": "Máy Ảnh",
        "domain": "CAMERA"
    },
    "Chân Máy / Phụ Kiện Máy Ảnh": {
        "prompt": "camera tripod tripod stand gimbal camera mount selfie stick chan may anh tripod",
        "label": "Chân máy ảnh / Tripod / Gimbal",
        "suggestedTitle": "Chân Máy Ảnh Tripod Chống Rung Đa Năng",
        "zero_category": "Máy Ảnh",
        "domain": "CAMERA_ACCESSORIES"
    },

    # 6. SẮC ĐẸP (Phân biệt Hộp phấn tròn vs Mỹ phẩm chung)
    "Hộp Phấn / Bảng Phấn Trang Điểm": {
        "prompt": "face powder compact blush palette eyeshadow palette makeup compact cosmetic powder box bobbi brown hop phan phan phu phan ma",
        "label": "Hộp phấn / Bảng phấn trang điểm",
        "suggestedTitle": "Phấn Nền Trang Điểm Mịn Lì Tự Nhiên",
        "zero_category": "Sắc Đẹp",
        "domain": "BEAUTY_COMPACT"
    },
    "Sắc Đẹp": {
        "prompt": "cosmetics skincare serum lipstick moisturizer facial cream beauty makeup perfume sua rua mat kem duong son moi",
        "label": "Mỹ phẩm / Chăm sóc da / Sắc đẹp",
        "suggestedTitle": "Mỹ Phẩm Chăm Sóc Sắc Đẹp Chính Hãng",
        "zero_category": "Sắc Đẹp",
        "domain": "BEAUTY"
    },

    # 7. SỨC KHỎE
    "Sức Khỏe": {
        "prompt": "health vitamins dietary supplements nutritional capsules medicine thuoc bo vien uong vitamin thuc pham chuc nang",
        "label": "Thực phẩm chức năng / Vitamin sức khỏe",
        "suggestedTitle": "Thực Phẩm Bổ Sung Chăm Sóc Sức Khỏe",
        "zero_category": "Sức Khỏe",
        "domain": "HEALTH"
    },

    # 8. NHÀ CỬA & GIA DỤNG
    "Bình Nước / Ly Giữ Nhiệt": {
        "prompt": "thermos water bottle tumbler stainless steel insulated cup binh giu nhiet ly giu nhiet binh nuoc",
        "label": "Bình giữ nhiệt / Ly giữ nhiệt / Bình nước",
        "suggestedTitle": "Bình Giữ Nhiệt Inox Cao Cấp Giữ Nhiệt Lâu",
        "zero_category": "Nhà Cửa",
        "domain": "THERMOS_BOTTLE"
    },
    "Nhà Cửa": {
        "prompt": "bedsheet blanket pillow quilt home living organizer chan ga goi dem noi that tham",
        "label": "Nhà cửa & Đời sống / Chăn ga gối",
        "suggestedTitle": "Đồ Dùng Nhà Cửa & Đời Sống Tiện Lợi",
        "zero_category": "Nhà Cửa",
        "domain": "HOME"
    },
    "Gia Dụng": {
        "prompt": "kitchen appliance air fryer cooker pot pan blender microwave ke de gia vi ke bep do gia dung nha bep",
        "label": "Đồ gia dụng / Thiết bị nhà bếp",
        "suggestedTitle": "Thiết Bị Gia Dụng Nhà Bếp Đa Năng Cao Cấp",
        "zero_category": "Gia Dụng",
        "domain": "KITCHEN"
    },

    # 9. PHỤ KIỆN & BALO TÚI XÁCH
    "Phụ Kiện Nữ": {
        "prompt": "hair clip earrings necklace jewelry sunglasses hair accessories phu kien nu kep toc vong co khuyen tai mat kinh",
        "label": "Phụ kiện thời trang nữ / Kẹp tóc / Trang sức",
        "suggestedTitle": "Phụ Kiện Thời Trang Nữ Xinh Xắn",
        "zero_category": "Phụ Kiện Nữ",
        "domain": "ACCESSORIES"
    },
    "Túi Ví Nữ": {
        "prompt": "backpack handbag wallet purse bag clutch cap ba lo tui xach vi cam tay",
        "label": "Balo / Túi xách / Ví",
        "suggestedTitle": "Balo Túi Xách Thời Trang Tiện Lợi",
        "zero_category": "Túi Ví Nữ",
        "domain": "BAGS"
    },

    # 10. MẸ & BÉ
    "Mẹ & Bé": {
        "prompt": "baby supplies baby bib baby bottle infant clothing baby stroller pacifier do so sinh yem an dam em be me va be",
        "label": "Đồ dùng Mẹ & Bé / Yếm ăn dặm",
        "suggestedTitle": "Đồ Dùng Tiện Ích Mẹ & Bé An Toàn",
        "zero_category": "Mẹ & Bé",
        "domain": "MOM_BABY"
    },

    # 11. SÁCH & VPP
    "Sách & VPP": {
        "prompt": "books textbook notebook stationery pens paper document sach truyen giao trinh",
        "label": "Sách & Văn phòng phẩm",
        "suggestedTitle": "Sách & Văn Phòng Phẩm Học Tập",
        "zero_category": "Sách & VPP",
        "domain": "BOOKS"
    },

    # 12. THỜI TRANG & GIÀY DÉP
    "Áo Blazer / Áo Vest": {
        "prompt": "formal suit jacket blazer suit business gentleman tailored jacket ao vest nam ao blazer",
        "label": "Áo Blazer / Áo Vest",
        "suggestedTitle": "Áo Blazer Nam Nữ Phong Cách Lịch Lãm",
        "zero_category": "Thời Trang Nam",
        "domain": "OUTERWEAR"
    },
    "Áo khoác / Outerwear": {
        "prompt": "leather jacket coat outerwear jacket bomber hoodie windbreaker jacket top",
        "label": "Áo khoác / Outerwear",
        "suggestedTitle": "Áo Khoác Phong Cách Thời Trang Nam Nữ Cao Cấp",
        "zero_category": "Thời Trang Nam",
        "domain": "OUTERWEAR"
    },
    "Áo thun / Áo phông": {
        "prompt": "graphic t-shirt casual tee cotton t-shirt streetwear tee shirt ao thun ao phong",
        "label": "Áo thun / Áo phông",
        "suggestedTitle": "Áo Thun Cổ Tròn Thời Trang Năng Động",
        "zero_category": "Thời Trang Nam",
        "domain": "TSHIRT"
    },
    "Áo Cardigan / Áo len dệt kim": {
        "prompt": "knit cardigan wool knitwear buttoned sweater knitted cardigan wool jacket ao len det kim ao cardigan len",
        "label": "Áo Cardigan / Áo len dệt kim",
        "suggestedTitle": "Áo Cardigan Len Dệt Kim Nhẹ Nhàng Thanh Lịch",
        "zero_category": "Thời Trang Nữ",
        "domain": "CARDIGAN_KNIT"
    },
    "Áo sơ mi công sở": {
        "prompt": "button down dress shirt collared shirt formal shirt ao so mi cong so",
        "label": "Áo sơ mi công sở",
        "suggestedTitle": "Áo Sơ Mi Nam Nữ Chuẩn Dáng Công Sở",
        "zero_category": "Thời Trang Nam",
        "domain": "SHIRT"
    },
    "Quần / Quần dài / Quần thể thao": {
        "prompt": "pants trousers jeans shorts sweatpants joggers bottom clothing",
        "label": "Quần dài / Quần thời trang",
        "suggestedTitle": "Quần Thể Thao Dài Nam Nữ Năng Động",
        "zero_category": "Thời Trang Nam",
        "domain": "BOTTOMS"
    },
    "Váy / Đầm nữ": {
        "prompt": "women dress skirt gown female clothing",
        "label": "Váy đầm thời trang nữ",
        "suggestedTitle": "Đầm Váy Thời Trang Nữ Dáng Xinh Cao Cấp",
        "zero_category": "Thời Trang Nữ",
        "domain": "DRESS"
    },
    "Thể Thao": {
        "prompt": "sports football soccer jersey athletic sportswear kit wika runner",
        "label": "Bộ quần áo thể thao / bóng đá",
        "suggestedTitle": "Bộ Quần Áo Bóng Đá Thể Thao Nam Nữ Thoáng Khí",
        "zero_category": "Thể Thao",
        "domain": "SPORTS"
    },
    "Giày thể thao / Sneaker": {
        "prompt": "sneakers running shoes tennis shoes athletic shoes sport sneakers walking shoes giay the thao giay sneaker",
        "label": "Giày thể thao / Sneaker",
        "suggestedTitle": "Giày Sneaker Thể Thao Năng Động Chính Hãng",
        "zero_category": "Giày Dép Nam",
        "domain": "SNEAKERS"
    },
    "Dép bánh mì / Dép quai ngang / Sandal": {
        "prompt": "slides foam slides slippers flip flops pool slides sandals eva foam clogs dep banh mi dep quai ngang dep le",
        "label": "Dép bánh mì / Dép quai ngang / Sandal",
        "suggestedTitle": "Dép Quai Ngang EVA Êm Chân Phong Cách",
        "zero_category": "Giày Dép Nữ",
        "domain": "SLIDES_SANDALS"
    },
    "Giày cao gót / Giày búp bê nữ": {
        "prompt": "women high heels stiletto pumps ballet flats dress shoes giay cao got giay bup be",
        "label": "Giày cao gót / Giày búp bê nữ",
        "suggestedTitle": "Giày Cao Gót Nữ Thời Trang Quý Phái",
        "zero_category": "Giày Dép Nữ",
        "domain": "HEELS"
    },
    "Sơ đồ / Tài liệu": {
        "prompt": "software flowchart source code IDE terminal text screenshot technical diagram report whitepaper document",
        "label": "Sơ đồ luồng mã nguồn / text hệ thống",
        "suggestedTitle": "Tài Liệu Hướng Dẫn Hệ Thống ZeroMall",
        "zero_category": "Sách & VPP",
        "domain": "DIAGRAM"
    }
}

CAT_KEYS = list(CANONICAL_CATEGORIES.keys())
CAT_PROMPTS = [CANONICAL_CATEGORIES[k]["prompt"] for k in CAT_KEYS]
print("[*] Pre-encoding canonical category vectors for instant zero-shot matching...")
CAT_EMBEDDINGS = model.encode(CAT_PROMPTS)

# ------------------------------------------------------------------------------
# DANH MỤC VẬT PHẨM NGUY HẠI / CẤM KINH DOANH TRÊN SÀN (Visual Contraband Detector)
# ------------------------------------------------------------------------------
PROHIBITED_CONCEPTS = {
    "Vũ khí / Súng đạn": {
        "prompt": "gun handgun pistol rifle shotgun assault firearm weapon ammunition military weapon revolver sniper firearm súng súng ngắn súng trường vũ khí",
        "label": "Súng / Vũ khí sát thương (Firearms/Weapons)",
        "threshold": 0.30
    },
    "Vũ khí lạnh / Kiếm / Dao găm": {
        "prompt": "sword katana samurai combat blade tactical dagger hunting knife switchblade weapon bayonet kiếm dao găm vũ khí thô sơ",
        "label": "Kiếm / Dao găm / Vũ khí thô sơ (Swords/Blades)",
        "threshold": 0.30
    },
    "Chất cấm / Cần sa / Ma túy": {
        "prompt": "cannabis marijuana weed dried drug narcotic pills ecstasy heroin substance meth thuốc phiện cần sa ma túy",
        "label": "Cần sa / Ma túy / Chất kích thích (Cannabis/Drugs)",
        "threshold": 0.30
    },
    "Pháo nổ / Thuốc nổ": {
        "prompt": "firecrackers fireworks pyrotechnics explosives explosive device dynamite pháo nổ pháo hoa nổ thuốc nổ",
        "label": "Pháo nổ / Thuốc nổ (Fireworks/Explosives)",
        "threshold": 0.30
    },
    "Thiết bị quay lén giấu kín": {
        "prompt": "hidden spy camera pinhole spy cam covert surveillance camera camera quay lén ngụy trang",
        "label": "Camera quay lén ngụy trang (Spy Cameras)",
        "threshold": 0.30
    },
    "Tiền polymer giả": {
        "prompt": "counterfeit currency fake banknotes fake money polymer bills tiền polymer giả tiền giả",
        "label": "Tiền polymer giả (Counterfeit Currency)",
        "threshold": 0.30
    }
}

PROHIBITED_KEYS = list(PROHIBITED_CONCEPTS.keys())
PROHIBITED_PROMPTS = [PROHIBITED_CONCEPTS[k]["prompt"] for k in PROHIBITED_KEYS]
print("[*] Pre-encoding prohibited safety vectors for visual contraband detection...")
PROHIBITED_EMBEDDINGS = model.encode(PROHIBITED_PROMPTS)
print(f"[+] {len(PROHIBITED_KEYS)} prohibited safety concepts ready!")

print(f"[+] {len(CAT_KEYS)} category vectors ready! Starting server on port {PORT}...")


COMPATIBLE_CATEGORIES = {
    "Thời Trang Nam": ["Thời Trang Nam", "Thời Trang Nữ", "Thể Thao"],
    "Thời Trang Nữ": ["Thời Trang Nữ", "Thời Trang Nam", "Thể Thao"],
    "Thể Thao": ["Thể Thao", "Thời Trang Nam", "Thời Trang Nữ"],
    "Giày Dép Nam": ["Giày Dép Nam", "Giày Dép Nữ", "Thể Thao"],
    "Giày Dép Nữ": ["Giày Dép Nữ", "Giày Dép Nam"],
    "Đồng Hồ": ["Đồng Hồ"],
    "Mẹ & Bé": ["Mẹ & Bé"],
    "Sắc Đẹp": ["Sắc Đẹp", "Sức Khỏe"],
    "Sức Khỏe": ["Sức Khỏe", "Sắc Đẹp"],
    "Nhà Cửa": ["Nhà Cửa", "Gia Dụng"],
    "Gia Dụng": ["Gia Dụng", "Nhà Cửa"],
    "Phụ Kiện Nữ": ["Phụ Kiện Nữ"],
    "Túi Ví Nữ": ["Túi Ví Nữ"],
    "Điện Thoại & Phụ Kiện": ["Điện Thoại & Phụ Kiện", "Thiết Bị Điện Tử"],
    "Máy Tính & Laptop": ["Máy Tính & Laptop", "Thiết Bị Điện Tử"],
    "Thiết Bị Điện Tử": ["Thiết Bị Điện Tử", "Điện Thoại & Phụ Kiện", "Máy Tính & Laptop", "Máy Ảnh"],
    "Máy Ảnh": ["Máy Ảnh", "Thiết Bị Điện Tử"],
    "Sách & VPP": ["Sách & VPP"],
}


def parse_single_image_item(item):
    if not item:
        return None
    if isinstance(item, str):
        if item.startswith("data:") or len(item) > 200:
            raw_str = item.split(",", 1)[1] if item.startswith("data:") else item
            try:
                raw_bytes = base64.b64decode(raw_str)
                return Image.open(io.BytesIO(raw_bytes)).convert("RGB")
            except Exception:
                return None
        elif item.startswith("http://") or item.startswith("https://"):
            try:
                req = urllib.request.Request(item, headers={"User-Agent": "Mozilla/5.0"})
                raw_bytes = urllib.request.urlopen(req, timeout=10).read()
                return Image.open(io.BytesIO(raw_bytes)).convert("RGB")
            except Exception:
                return None
    elif isinstance(item, dict):
        return parse_pil_image(item)
    return None


def parse_pil_image(payload):
    image_b64 = payload.get("imageBase64") or payload.get("image")
    image_url = payload.get("imageUrl") or payload.get("image")

    try:
        if image_b64 and (image_b64.startswith("data:") or len(image_b64) > 200):
            if image_b64.startswith("data:"):
                image_b64 = image_b64.split(",", 1)[1]
            raw_bytes = base64.b64decode(image_b64)
            return Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        elif image_url and (image_url.startswith("http://") or image_url.startswith("https://")):
            req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
            raw_bytes = urllib.request.urlopen(req, timeout=10).read()
            return Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    except Exception:
        return None
    return None


import re

def clean_title_for_entity_check(text):
    if not text:
        return ""
    t = text.lower()
    # Loại bỏ các cụm từ mô tả phối đồ, ngữ cảnh mix & match trong tiêu đề TMĐT
    t = re.sub(r'(dễ mix đồ|dễ phối đồ|mix đồ|phối đồ|mix cùng|phối cùng|mặc cùng|kết hợp cùng|diện cùng|phù hợp mix)\s+[\w\s]+', ' ', t)
    t = re.sub(r'(bỏ túi quần|túi quần|bỏ túi|nhét túi|nhét vừa|bỏ vừa)', ' ', t)
    t = re.sub(r'(đựng vừa điện thoại|đựng điện thoại|bỏ vừa điện thoại|chứa điện thoại)', ' ', t)
    t = re.sub(r'(dành cho|dùng cho|thích hợp cho|tương thích với|phù hợp cho)\s+[\w\s]+', ' ', t)
    t = re.sub(r'(in hình|họa tiết|tặng kèm|kèm theo)\s+[\w\s]+', ' ', t)
    return " ".join(t.split())

def audit_single_image_logic(pil_img, name, category, name_emb=None):
    """
    AGENT: MultiImageVisualAgent
    Thẩm định 1 bức ảnh cụ thể bằng mô hình CLIP ViT-B-32 Zero-Shot Matching
    """
    img_emb = model.encode(pil_img)

    # Tính độ khớp với các danh mục ngành hàng tiêu chuẩn
    sims = util.cos_sim(img_emb, CAT_EMBEDDINGS)[0]
    best_idx = sims.argmax().item()
    best_cat = CAT_KEYS[best_idx]
    cat_info = CANONICAL_CATEGORIES[best_cat]
    max_cat_sim = float(sims[best_idx].item())
    visual_confidence = round(max_cat_sim * 100, 1)

    # 0. QUÉT AN TOÀN THỊ GIÁC: PHÁT HIỆN HÀNG CẤM (Vũ khí, Súng, Kiếm, Cần sa...)
    # Chỉ cảnh báo hàng cấm khi độ tương đồng với vật phẩm cấm đạt ngưỡng cao (>= threshold)
    # VÀ vượt trội hơn so với các ngành hàng thương mại hợp pháp (max_proh_sim > max_cat_sim + 0.03)
    # Tránh tuyệt đối việc nếp gấp quần áo/váy hoa bị nhận diện nhầm thành vũ khí!
    prohibited_sims = util.cos_sim(img_emb, PROHIBITED_EMBEDDINGS)[0]
    best_proh_idx = prohibited_sims.argmax().item()
    max_proh_sim = float(prohibited_sims[best_proh_idx].item())
    proh_key = PROHIBITED_KEYS[best_proh_idx]
    proh_info = PROHIBITED_CONCEPTS[proh_key]

    is_prohibited = False
    prohibited_label = ""
    if max_proh_sim >= proh_info["threshold"] and max_proh_sim > (max_cat_sim + 0.03):
        is_prohibited = True
        prohibited_label = proh_info["label"]

    title_sim = 0.0
    is_mismatch = False
    reason = ""

    lower_name = name.lower()
    cleaned_name = clean_title_for_entity_check(lower_name)
    category_clean = (category or "").strip()
    cat_lower = category_clean.lower()
    domain = cat_info.get("domain", "")
    pred_cat = cat_info.get("zero_category", "Thời Trang Nam")

    # Phân tích thực thể chính trong tiêu đề (Primary Entity Recognition)
    has_footwear_title = any(k in cleaned_name for k in [
        "giày", "giay", "dép", "dep", "sneaker", "sandal", "xăng đan", "boots", "guốc", "cao gót", "slip-on", "suc"
    ])
    has_top_title = any(k in cleaned_name for k in [
        "áo", "ao", "khoác", "jacket", "hoodie", "sweater", "sơ mi", "polo", "áo thun", "blazer", "vest", "cardigan", "croptop"
    ])
    has_bottom_title = any(k in cleaned_name for k in [
        "quần", "quan", "jean", "short", "jogger", "trouser", "sweatpant", "kaki", "quần đùi", "quần dài", "quần âu"
    ])
    has_dress_title = any(k in cleaned_name for k in ["váy", "đầm", "vay", "dam", "chân váy", "chan vay"])
    has_kitchen_title = any(k in cleaned_name for k in [
        "kệ", "ke", "nồi", "chảo", "bếp", "lò", "ấm", "máy xay", "gia vị", "đũa", "thớt", "dao", "bát", "đĩa", "hộp đựng", "gia dụng", "giá để"
    ])
    has_bag_title = any(k in cleaned_name for k in [
        "balo", "ba lô", "backpack", "túi", "tui", "ví", "vi", "bóp", "bop", "cặp", "cap", "clutch", "tote", "handbag", "purse", "crossbody", "vali"
    ])

    # 1. Đồng hồ & Dây đeo phụ kiện
    has_watchstrap_title = any(k in cleaned_name for k in [
        "dây đồng hồ", "day dong ho", "dây đeo đồng hồ", "dây da đồng hồ", "dây kim loại", "dây thép", "dây silicone", "dây thay thế", "watch strap", "watch band"
    ])
    has_watch_title = any(k in cleaned_name for k in [
        "đồng hồ", "dong ho", "watch", "smartwatch", "apple watch"
    ]) and not has_watchstrap_title

    # 2. Phụ kiện thời trang nữ
    has_acc_title = any(k in cleaned_name for k in [
        "kẹp tóc", "khuyên tai", "bông tai", "vòng cổ", "dây chuyền", "nhẫn", "trang sức", "mắt kính", "kính mát", "phụ kiện"
    ])

    # 3. Mỹ phẩm, sắc đẹp & hộp phấn (Geometric shape confusion prevention)
    has_compact_title = any(k in cleaned_name for k in [
        "hộp phấn", "hop phan", "phấn phủ", "phan phu", "phấn nền", "phan nen", "phấn má", "phan ma", "bảng phấn", "cushion", "phấn nước", "eyeshadow", "powder"
    ])
    has_beauty_title = any(k in cleaned_name for k in [
        "son", "serum", "kem", "mỹ phẩm", "nước hoa", "sữa rửa mặt", "trang điểm", "mascara", "phấn", "toner", "kem chống nắng", "tẩy trang", "lotion", "sữa tắm", "dầu gội", "tẩy da chết", "mặt nạ", "lipstick"
    ]) or has_compact_title

    # 4. Thực phẩm chức năng / Sức khỏe
    has_health_title = any(k in cleaned_name for k in [
        "vitamin", "viên uống", "thực phẩm chức năng", "thuốc", "collagen", "dầu cá", "omega", "canxi", "kẽm", "bổ não", "bổ gan", "men vi sinh", "whey", "protein"
    ])

    # 5. Điện thoại vs Pin sạc dự phòng vs Ốp lưng (Device vs Accessory anti bait-and-switch)
    has_powerbank_charger_title = any(k in cleaned_name for k in [
        "sạc dự phòng", "sac du phong", "pin dự phòng", "pin du phong", "power bank", "powerbank", "củ sạc", "cu sac", "cáp sạc", "cap sac", "dây sạc", "day sac", "bộ sạc", "dock sạc", "sạc nhanh", "adapter sạc"
    ])
    has_phonecase_title = any(k in cleaned_name for k in [
        "ốp lưng", "op lung", "kính cường lực", "kinh cuong luc", "bao da", "miếng dán màn hình", "ốp chống sốc", "ốp bảo vệ", "phone case"
    ])
    has_smartphone_title = any(k in cleaned_name for k in [
        "điện thoại", "dien thoai", "smartphone", "iphone", "samsung galaxy", "xiaomi redmi", "oppo reno", "vivo", "realme"
    ]) and not has_powerbank_charger_title and not has_phonecase_title

    # 6. Thiết bị âm thanh
    has_audio_title = any(k in cleaned_name for k in [
        "loa", "loa bluetooth", "loa không dây", "soundbar", "tai nghe", "headphone", "earphone", "airpods"
    ])

    # 7. Máy tính & Laptop vs Phụ kiện máy tính
    has_pc_peripheral_title = any(k in cleaned_name for k in [
        "chuột", "chuot", "bàn phím", "ban phim", "bàn di chuột", "lót chuột", "tản nhiệt", "hub", "cổng chuyển", "đế tản nhiệt"
    ])
    has_laptop_title = any(k in cleaned_name for k in [
        "laptop", "máy tính xách tay", "macbook", "thinkpad", "asus zenbook"
    ]) and not has_pc_peripheral_title and not any(k in cleaned_name for k in ["balo", "túi chống sốc", "tui chong soc"])

    # 8. Máy ảnh vs Phụ kiện máy ảnh
    has_camera_acc_title = any(k in cleaned_name for k in [
        "tripod", "chân máy", "chan may", "gimbal", "gậy selfie", "ngàm", "mount", "cap lens", "kính lọc", "filter", "dây đeo máy ảnh"
    ])
    has_camera_device_title = any(k in cleaned_name for k in [
        "máy ảnh", "may anh", "camera", "dslr", "mirrorless", "gopro", "flycam"
    ]) and not has_camera_acc_title
    has_camera_title = has_camera_device_title or has_camera_acc_title

    # 9. Bình giữ nhiệt / Đồ dùng nhà cửa
    has_thermos_title = any(k in cleaned_name for k in [
        "bình giữ nhiệt", "binh giu nhiet", "ly giữ nhiệt", "ly giu nhiet", "bình nước", "binh nuoc", "ly inox", "tumbler", "thermos"
    ])
    has_home_title = any(k in cleaned_name for k in [
        "chăn", "ga", "gối", "nệm", "đệm", "màn", "rèm", "bàn", "ghế", "tủ", "kệ sách", "thảm", "đèn ngủ"
    ]) or has_thermos_title

    # 10. Sách & VPP
    has_books_title = any(k in cleaned_name for k in [
        "sách", "truyện", "vở", "bút", "tập", "sổ", "tiểu thuyết", "giáo trình", "từ điển", "thước", "văn phòng phẩm"
    ])

    # 11. Mẹ & Bé
    has_mom_baby_title = any(k in cleaned_name for k in [
        "yếm", "ăn dặm", "bình sữa", "tã", "bỉm", "xe đẩy", "núm ti", "máy hút sữa", "sơ sinh", "địu", "ti giả"
    ])

    # Tổng hợp các thiết bị điện tử chung
    has_electronics_title = has_smartphone_title or has_powerbank_charger_title or has_phonecase_title or has_audio_title or has_laptop_title or has_pc_peripheral_title or any(k in cleaned_name for k in [
        "máy tính", "pc", "màn hình", "router", "wifi", "ipad", "tablet", "phụ kiện công nghệ"
    ])

    if is_prohibited:
        is_mismatch = True
        reason = f"[Visual Safety Guard] Hình ảnh nhận diện là {prohibited_label} (độ tin cậy: {round(max_proh_sim*100, 1)}%) - thuộc danh mục hàng cấm kinh doanh tuyệt đối trên sàn ZeroMall!"
    elif best_cat == "Sơ đồ / Tài liệu":
        # Chỉ coi là sơ đồ / tài liệu khi độ tin cậy thực sự cao (>= 0.30)
        # VÀ tên sản phẩm không phải là sản phẩm gia dụng/vật lý rõ ràng
        if max_cat_sim >= 0.30 and not (has_kitchen_title or has_footwear_title or has_top_title or has_bottom_title or has_bag_title):
            is_mismatch = True
            reason = f"Ảnh hiển thị sơ đồ/văn bản hệ thống, không phải ảnh chụp sản phẩm thực tế (\"{name}\")."

    # A. KIỂM TRA CHÉO HÌNH ẢNH VS TIÊU ĐỀ SẢN PHẨM (Tier 1: Visual-to-Text Consistency)
    if not is_mismatch and name:
        if name_emb is None:
            name_emb = model.encode([name])[0]
        title_sim = float(util.cos_sim(img_emb, name_emb)[0].item())

        # Danh sách các nhóm Domain chi tiết
        TOPS_DOMAINS = ["TSHIRT", "CARDIGAN_KNIT", "OUTERWEAR", "SHIRT"]
        FOOTWEAR_DOMAINS = ["SNEAKERS", "SLIDES_SANDALS", "HEELS"]

        # 1. TOPS vs OTHER DOMAINS & Chi tiết nhóm TOPS
        if domain in TOPS_DOMAINS:
            is_suit = any(k in cleaned_name for k in ["bộ", "set", "đồ bộ", "bộ đồ", "combo", "áo và quần", "áo phối quần"])
            if has_bottom_title and not has_top_title and not is_suit:
                is_mismatch = True
                reason = f"Ảnh hiển thị áo/áo khoác thời trang, không khớp với tên sản phẩm bạn nhập là quần (\"{name}\")."
            elif not has_top_title and not is_suit and (has_bag_title or has_watch_title or has_footwear_title or has_kitchen_title or has_beauty_title or has_health_title or has_electronics_title or has_camera_title or has_books_title or any(k in cleaned_name for k in ["giày", "dép", "sneaker", "sandal", "nồi chiên", "bếp", "điện thoại", "laptop", "máy tính", "balo", "túi", "ví", "cặp", "đồng hồ", "son", "kem"])):
                is_mismatch = True
                reason = f"Ảnh là áo thời trang ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

            # 1.1 Kiểm tra phân loại con: Áo thun vs Áo cardigan / Áo len dệt kim
            if not is_mismatch and domain == "TSHIRT":
                is_cardigan_knit = any(k in cleaned_name for k in ["cardigan", "áo len", "ao len", "dệt kim", "det kim", "len mỏng", "len dệt kim", "knitwear"])
                if is_cardigan_knit and not any(k in cleaned_name for k in ["áo thun", "ao thun", "áo phông"]):
                    is_mismatch = True
                    reason = f"Ảnh hiển thị áo thun / áo phông năng động, không khớp với sản phẩm là áo cardigan / áo len dệt kim (\"{name}\")."

            if not is_mismatch and domain == "CARDIGAN_KNIT":
                is_tshirt_only = any(k in cleaned_name for k in ["áo thun", "ao thun", "áo phông", "t-shirt", "tee"]) and not any(k in cleaned_name for k in ["cardigan", "len", "dệt kim"])
                if is_tshirt_only:
                    is_mismatch = True
                    reason = f"Ảnh hiển thị áo cardigan / áo len dệt kim, không khớp với sản phẩm là áo thun / áo phông (\"{name}\")."

        # 2. FOOTWEAR: Giày Sneaker vs Dép bánh mì / Sandal & vs Khác
        elif domain in FOOTWEAR_DOMAINS:
            # 2.1 Sneaker thể thao vs Dép bánh mì / Sandal quai ngang
            if domain == "SNEAKERS":
                is_dep_sandal = any(k in cleaned_name for k in [
                    "dép bánh mì", "dep banh mi", "dép", "dep", "dép quai ngang", "dép lê", "dép kẹp",
                    "dép xỏ ngón", "dép sục", "sandal", "xăng đan", "quai ngang", "eva nguyên khối"
                ]) and not any(k in cleaned_name for k in ["sneaker", "giày thể thao", "giay the thao"])
                if is_dep_sandal:
                    is_mismatch = True
                    reason = f"Ảnh hiển thị giày thể thao / sneaker buộc dây, không khớp với sản phẩm là dép / dép bánh mì (\"{name}\")."

            # 2.2 Dép / Sandal vs Giày Sneaker thể thao
            elif domain == "SLIDES_SANDALS":
                is_sneaker_shoes = any(k in cleaned_name for k in [
                    "sneaker", "giày thể thao", "giay the thao", "giày chạy bộ", "giay chay bo",
                    "giày bóng đá", "giày đá bóng", "giày tây", "boots", "giày da"
                ]) and not any(k in cleaned_name for k in ["dép", "sandal", "xăng đan"])
                if is_sneaker_shoes:
                    is_mismatch = True
                    reason = f"Ảnh hiển thị dép / dép bánh mì / quai ngang, không khớp với sản phẩm là giày thể thao / sneaker (\"{name}\")."

            # 2.3 Giày dép vs Các nhóm sản phẩm khác
            if not has_footwear_title:
                disallowed_themes = ["nồi chiên", "điện thoại", "laptop", "máy tính", "balo", "túi", "ví", "cặp", "đồng hồ", "son", "kem"]
                if has_top_title or has_bottom_title or has_dress_title or has_bag_title or has_watch_title or has_beauty_title or has_health_title or has_electronics_title or has_camera_title or has_books_title or any(k in cleaned_name for k in disallowed_themes):
                    is_mismatch = True
                    reason = f"Ảnh là giày dép ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        elif domain == "BOTTOMS":
            is_suit = any(k in cleaned_name for k in ["bộ", "set", "đồ bộ", "bộ đồ", "combo", "áo và quần", "áo phối quần"])
            if has_top_title and not has_bottom_title and not is_suit:
                is_mismatch = True
                reason = f"Ảnh hiển thị quần thời trang, không khớp với tên sản phẩm bạn nhập là áo (\"{name}\")."
            elif not has_bottom_title and not is_suit and (has_bag_title or has_watch_title or has_beauty_title or has_health_title or has_electronics_title or has_camera_title or has_books_title or any(k in cleaned_name for k in ["giày", "dép", "sneaker", "sandal", "nồi chiên", "bếp", "điện thoại", "laptop", "máy tính", "balo", "túi", "ví", "cặp", "đồng hồ", "son", "kem"])):
                is_mismatch = True
                reason = f"Ảnh là quần thời trang, không khớp với tên sản phẩm \"{name}\"."

        elif domain == "DRESS":
            if any(k in cleaned_name for k in ["quần nam", "áo nam", "quần jean nam", "giày nam", "balo", "cặp", "đồng hồ", "laptop", "máy tính"]):
                is_mismatch = True
                reason = f"Ảnh là váy đầm thời trang nữ, không khớp với tên sản phẩm \"{name}\"."

        elif domain == "SPORTS":
            disallowed_themes = [
                "siêu nhân", "gao", "công chúa", "bà ba", "áo dài", "đồ ngủ",
                "pijama", "anime", "cosplay", "giày", "dép", "sneaker", "sandal",
                "laptop", "máy tính", "điện thoại", "tai nghe", "bàn phím", "nồi chiên", "bếp",
                "balo", "túi", "ví", "cặp", "đồng hồ", "son", "mỹ phẩm"
            ]
            if any(k in cleaned_name for k in disallowed_themes):
                is_mismatch = True
                reason = f"Ảnh là trang phục thể thao/bóng đá thực tế, không khớp với tên sản phẩm \"{name}\"."

        # 3. BALO / TÚI XÁCH / VÍ (BAGS)
        elif domain == "BAGS":
            disallowed_for_bags = [
                "áo", "ao", "shirt", "quần", "quan", "pant", "jean", "váy", "đầm",
                "giày", "dép", "sneaker", "sandal", "nồi chiên", "bếp", "đồng hồ", "điện thoại", "laptop", "máy tính", "son", "kem"
            ]
            if not has_bag_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_kitchen_title or has_watch_title or has_beauty_title or has_health_title or has_electronics_title or has_camera_device_title or has_books_title or any(k in cleaned_name for k in disallowed_for_bags)):
                is_mismatch = True
                reason = f"Ảnh hiển thị Balo / Túi xách / Cặp ({cat_info['label']}), không khớp với tên sản phẩm bạn nhập là \"{name}\"."

        # 4. ĐỒNG HỒ ĐEO TAY (WATCH)
        elif domain == "WATCH":
            if has_watchstrap_title and not has_watch_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Đồng hồ nguyên chiếc ({cat_info['label']}), không khớp với sản phẩm Dây đeo / Phụ kiện đồng hồ (\"{name}\")."
            elif has_beauty_title or has_compact_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Đồng hồ ({cat_info['label']}), không khớp với sản phẩm Mỹ phẩm / Sắc đẹp (\"{name}\")."
            elif not has_watch_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_kitchen_title or has_health_title or has_camera_device_title or has_books_title or has_smartphone_title or has_powerbank_charger_title or any(k in cleaned_name for k in ["áo", "ao", "shirt", "quần", "quan", "váy", "đầm", "giày", "dép", "nồi chiên", "bếp", "balo", "túi", "ví", "cặp", "điện thoại", "laptop", "son", "kem"])):
                is_mismatch = True
                reason = f"Ảnh hiển thị Đồng hồ ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        # 4.1 DÂY ĐEO / PHỤ KIỆN ĐỒNG HỒ (WATCH_STRAP)
        elif domain == "WATCH_STRAP":
            if has_watch_title and not has_watchstrap_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Dây đeo / Phụ kiện đồng hồ ({cat_info['label']}), không khớp với sản phẩm Đồng hồ đeo tay nguyên chiếc (\"{name}\")."
            elif not has_watchstrap_title and not has_watch_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Dây đeo đồng hồ ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        # 5. PHỤ KIỆN THỜI TRANG (ACCESSORIES)
        elif domain == "ACCESSORIES":
            disallowed_for_acc = [
                "áo", "ao", "shirt", "quần", "quan", "váy", "đầm", "giày", "dép", "sneaker", "sandal",
                "nồi chiên", "bếp", "balo", "cặp", "đồng hồ"
            ]
            if not has_acc_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_watch_title or any(k in cleaned_name for k in disallowed_for_acc)):
                is_mismatch = True
                reason = f"Ảnh hiển thị Phụ kiện thời trang ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        # 6. MỸ PHẨM / CHĂM SÓC SẮC ĐẸP (BEAUTY / BEAUTY_COMPACT)
        elif domain in ["BEAUTY", "BEAUTY_COMPACT"]:
            if has_watch_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Hộp phấn / Mỹ phẩm làm đẹp ({cat_info['label']}), không khớp với tên sản phẩm Đồng hồ (\"{name}\")."
            elif has_smartphone_title or has_powerbank_charger_title or has_laptop_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Mỹ phẩm / Hộp phấn trang điểm ({cat_info['label']}), không khớp với sản phẩm Công nghệ / Điện tử (\"{name}\")."
            elif not has_beauty_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_kitchen_title or has_camera_device_title or has_books_title or any(k in cleaned_name for k in ["áo", "quần", "váy", "đầm", "giày", "dép", "nồi", "balo", "cặp", "điện thoại", "laptop", "sách"])):
                is_mismatch = True
                reason = f"Ảnh hiển thị Mỹ phẩm / Chăm sóc sắc đẹp ({cat_info['label']}), không khớp với tên sản phẩm bạn nhập là \"{name}\"."

        # 7. THỰC PHẨM CHỨC NĂNG / VITAMIN (HEALTH)
        elif domain == "HEALTH":
            disallowed_for_health = [
                "áo", "ao", "shirt", "quần", "quan", "váy", "đầm", "giày", "dép", "sneaker", "sandal",
                "nồi chiên", "bếp", "balo", "cặp", "đồng hồ", "điện thoại", "laptop", "máy tính", "sách"
            ]
            if not has_health_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_watch_title or has_electronics_title or has_kitchen_title or has_books_title or any(k in cleaned_name for k in disallowed_for_health)):
                is_mismatch = True
                reason = f"Ảnh hiển thị Thực phẩm chức năng / Vitamin ({cat_info['label']}), không khớp với tên sản phẩm bạn nhập là \"{name}\"."

        # 8. MÁY ẢNH & THIẾT BỊ QUAY PHIM (CAMERA / CAMERA_ACCESSORIES)
        elif domain == "CAMERA":
            if has_camera_acc_title and not has_camera_device_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Máy ảnh ({cat_info['label']}), không khớp với sản phẩm Chân máy / Phụ kiện máy ảnh (\"{name}\")."
            elif not has_camera_device_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_beauty_title or has_kitchen_title):
                is_mismatch = True
                reason = f"Ảnh hiển thị Máy ảnh / Thiết bị quay phim ({cat_info['label']}), không khớp với tên sản phẩm bạn nhập là \"{name}\"."

        elif domain == "CAMERA_ACCESSORIES":
            if has_camera_device_title and not has_camera_acc_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Phụ kiện máy ảnh / Chân máy ({cat_info['label']}), không khớp với sản phẩm Máy ảnh nguyên chiếc (\"{name}\")."
            elif not has_camera_acc_title and not has_camera_device_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Phụ kiện máy ảnh ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        # 9. SÁCH & VĂN PHÒNG PHẨM (BOOKS)
        elif domain == "BOOKS":
            disallowed_for_books = [
                "áo", "ao", "shirt", "quần", "quan", "váy", "đầm", "giày", "dép", "sneaker", "sandal",
                "nồi chiên", "bếp", "balo", "cặp", "son", "mỹ phẩm", "đồng hồ", "điện thoại"
            ]
            if not has_books_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_watch_title or has_beauty_title or has_kitchen_title or any(k in cleaned_name for k in disallowed_for_books)):
                is_mismatch = True
                reason = f"Ảnh hiển thị Sách / Văn phòng phẩm ({cat_info['label']}), không khớp với tên sản phẩm bạn nhập là \"{name}\"."

        # 10. ĐỒ DÙNG MẸ & BÉ (MOM_BABY)
        elif domain == "MOM_BABY":
            disallowed_for_baby = ["điện thoại", "laptop", "máy tính", "đồng hồ", "giày cao gót", "giày tây", "rượu", "bia"]
            if not has_mom_baby_title and (has_watch_title or has_electronics_title or has_camera_device_title or any(k in cleaned_name for k in disallowed_for_baby)):
                is_mismatch = True
                reason = f"Ảnh hiển thị Đồ dùng Mẹ & Bé ({cat_info['label']}), không khớp với tên sản phẩm bạn nhập là \"{name}\"."

        # 11. NHÀ CỬA & ĐỜI SỐNG (HOME / THERMOS_BOTTLE)
        elif domain == "THERMOS_BOTTLE":
            if has_audio_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Bình nước / Ly giữ nhiệt ({cat_info['label']}), không khớp với sản phẩm Loa / Thiết bị âm thanh (\"{name}\")."
            elif has_watch_title or has_smartphone_title or has_powerbank_charger_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Bình giữ nhiệt ({cat_info['label']}), không khớp với sản phẩm Công nghệ / Đồng hồ (\"{name}\")."
            elif not has_thermos_title and not has_kitchen_title and not has_home_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Bình nước / Ly giữ nhiệt ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        elif domain == "HOME":
            if has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_beauty_title or has_health_title or has_electronics_title:
                if not has_home_title and not has_kitchen_title:
                    is_mismatch = True
                    reason = f"Ảnh hiển thị Đồ dùng Nhà cửa / Nội thất ({cat_info['label']}), không khớp với tên sản phẩm bạn nhập là \"{name}\"."

        # 12. GIA DỤNG NHÀ BẾP (KITCHEN)
        elif domain == "KITCHEN":
            if not has_kitchen_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_watch_title or has_beauty_title or has_health_title or has_electronics_title or has_camera_device_title or has_books_title):
                is_mismatch = True
                reason = f"Ảnh là đồ gia dụng nhà bếp ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        # 13. ĐIỆN THOẠI THÔNG MINH & ỐP LƯNG (SMARTPHONE / PHONE_CASE)
        # Chống triệt để thủ đoạn dùng ảnh điện thoại/ốp lưng để bán pin sạc dự phòng hoặc đồ gia dụng/thời trang
        elif domain in ["SMARTPHONE", "PHONE_CASE"]:
            if has_powerbank_charger_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Điện thoại thông minh / Ốp lưng ({cat_info['label']}), không khớp với sản phẩm Pin sạc dự phòng / Củ cáp sạc (\"{name}\")."
            elif has_watch_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Điện thoại thông minh / Phụ kiện ({cat_info['label']}), không khớp với sản phẩm Đồng hồ (\"{name}\")."
            elif not has_smartphone_title and not has_phonecase_title and not has_electronics_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_beauty_title or has_health_title or has_kitchen_title or has_books_title):
                is_mismatch = True
                reason = f"Ảnh hiển thị Điện thoại / Phụ kiện điện thoại ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        # 14. PIN SẠC DỰ PHÒNG / CỦ CÁP SẠC (POWERBANK_CHARGER)
        # Chống thủ đoạn ngược lại: dùng ảnh củ sạc/sạc dự phòng để rao bán điện thoại nguyên chiếc
        elif domain == "POWERBANK_CHARGER":
            if has_smartphone_title and not has_powerbank_charger_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Pin sạc dự phòng / Củ cáp sạc ({cat_info['label']}), không khớp với sản phẩm Điện thoại thông minh (\"{name}\")."
            elif has_watch_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Pin sạc dự phòng / Củ sạc ({cat_info['label']}), không khớp với sản phẩm Đồng hồ (\"{name}\")."
            elif not has_powerbank_charger_title and not has_electronics_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_beauty_title or has_kitchen_title or has_books_title):
                is_mismatch = True
                reason = f"Ảnh hiển thị Pin sạc dự phòng / Củ sạc ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        # 16. THIẾT BỊ ÂM THANH (AUDIO_DEVICE)
        elif domain == "AUDIO_DEVICE":
            if not has_audio_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_watch_title or has_beauty_title or has_health_title or has_kitchen_title or has_books_title or has_smartphone_title or has_powerbank_charger_title):
                is_mismatch = True
                reason = f"Ảnh hiển thị Thiết bị âm thanh / Loa / Tai nghe ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        # 17. MÁY TÍNH & LAPTOP (LAPTOP)
        elif domain == "LAPTOP":
            if has_pc_peripheral_title and not has_laptop_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Laptop / Máy tính xách tay ({cat_info['label']}), không khớp với sản phẩm Chuột / Bàn phím / Phụ kiện (\"{name}\")."
            elif not has_laptop_title and not has_electronics_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Laptop / Máy tính xách tay ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        # 18. CHUỘT / BÀN PHÍM / PHỤ KIỆN (PC_PERIPHERALS)
        elif domain == "PC_PERIPHERALS":
            if has_laptop_title and not has_pc_peripheral_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Chuột / Bàn phím / Linh kiện máy tính ({cat_info['label']}), không khớp với sản phẩm Laptop nguyên chiếc (\"{name}\")."
            elif not has_pc_peripheral_title and not has_electronics_title:
                is_mismatch = True
                reason = f"Ảnh hiển thị Chuột / Bàn phím / Phụ kiện máy tính ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        # 19. CÔNG NGHỆ & ĐIỆN TỬ CHUNG (ELECTRONICS)
        elif domain == "ELECTRONICS":
            if not has_electronics_title and (has_top_title or has_bottom_title or has_dress_title or has_footwear_title or has_bag_title or has_beauty_title or has_health_title or has_kitchen_title or has_books_title or any(k in cleaned_name for k in ["áo", "quần", "váy", "đầm", "giày", "dép", "nồi chiên", "balo", "ví", "cặp", "son", "kem"])):
                is_mismatch = True
                reason = f"Ảnh là thiết bị công nghệ điện tử ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

    # B. KIỂM TRA CHÉO HÌNH ẢNH VS NGÀNH HÀNG (Category Cross-Audit Toàn diện)
    if not is_mismatch and category_clean and pred_cat:
        is_compatible = False
        allowed = COMPATIBLE_CATEGORIES.get(pred_cat, [pred_cat])
        for a in allowed:
            if a.lower() in cat_lower or cat_lower in a.lower():
                is_compatible = True
                break

        # Kiểm tra xem tiêu đề sản phẩm có đang chứa từ khóa đại diện đúng cho ngành hàng hiện tại không
        title_matches_current_cat = any(
            w in cleaned_name for w in [
                "đồng hồ", "dong ho", "watch", "smartwatch",
                "blazer", "vest", "khoác", "jacket", "áo", "quần", "váy", "đầm",
                "yếm", "ăn dặm", "bé", "sữa", "tã", "bỉm", "bình sữa",
                "son", "serum", "kem", "mỹ phẩm", "nước hoa", "sữa rửa mặt",
                "vitamin", "viên uống", "thực phẩm chức năng", "thuốc bổ",
                "nồi", "chảo", "bếp", "ấm", "bình giữ nhiệt", "bát", "đĩa", "kệ",
                "balo", "túi", "ví", "bóp", "giày", "dép", "sandal", "sneaker",
                "điện thoại", "iphone", "samsung", "laptop", "máy tính", "tai nghe", "chuột", "bàn phím"
            ]
            if (
                ("đồng hồ" in w and "đồng hồ" in cat_lower) or
                ("bé" in w or "yếm" in w or "sữa" in w or "tã" in w or "bỉm" in w) and "mẹ & bé" in cat_lower or
                ("son" in w or "serum" in w or "kem" in w or "mỹ phẩm" in w) and "sắc đẹp" in cat_lower or
                ("vitamin" in w or "viên uống" in w or "thuốc bổ" in w) and "sức khỏe" in cat_lower or
                ("nồi" in w or "chảo" in w or "bếp" in w or "ấm" in w) and ("gia dụng" in cat_lower or "nhà cửa" in cat_lower) or
                ("bình giữ nhiệt" in w or "bát" in w or "đĩa" in w or "kệ" in w) and ("nhà cửa" in cat_lower or "gia dụng" in cat_lower) or
                ("balo" in w or "túi" in w or "ví" in w) and "túi ví" in cat_lower or
                ("áo" in w or "blazer" in w or "vest" in w or "khoác" in w or "quần" in w) and "thời trang" in cat_lower or
                ("giày" in w or "dép" in w or "sandal" in w or "sneaker" in w) and "giày dép" in cat_lower or
                ("điện thoại" in w or "tai nghe" in w) and "điện thoại" in cat_lower or
                ("laptop" in w or "máy tính" in w or "chuột" in w or "bàn phím" in w) and ("máy tính" in cat_lower or "thiết bị điện tử" in cat_lower)
            )
        )

        if not is_compatible:
            # Khi hình ảnh và ngành hàng KHÔNG TƯƠNG THÍCH trong COMPATIBLE_CATEGORIES:
            # Nếu AI thị giác đạt độ tự tin nhận diện >= 22.0% (mức tin cậy rõ rệt của mô hình CLIP):
            # Tuyệt đối KHÔNG cho phép bỏ qua chỉ vì tên sản phẩm khớp ngành hàng được chọn (chống thủ đoạn gian lận ảnh khác - tên khác)!
            if visual_confidence >= 22.0:
                is_mismatch = True
                reason = f"Ảnh hiển thị {cat_info['label']} (ngành: {pred_cat}), hoàn toàn không tương thích với ngành hàng '{category_clean}' bạn chọn."
            elif not title_matches_current_cat and visual_confidence >= 19.0:
                is_mismatch = True
                reason = f"Ảnh hiển thị {cat_info['label']} (ngành: {pred_cat}), không tương thích với ngành hàng '{category_clean}' bạn chọn."

    # Ngưỡng tương đồng Cosine cấu hình động
    cosine_threshold = float(os.environ.get("CLIP_SIMILARITY_THRESHOLD", "0.18"))
    if not is_mismatch and title_sim > 0 and title_sim < cosine_threshold and not is_compatible:
        if not reason:
            is_mismatch = True
            reason = f"Độ tương quan giữa ảnh ({cat_info['label']}) và tiêu đề chỉ đạt {round(title_sim, 2)}, thấp hơn ngưỡng an toàn {cosine_threshold}."

    final_suggested_cat = cat_info.get("zero_category", "Thời Trang Nam")

    return {
        "isMismatch": is_mismatch,
        "isProhibited": is_prohibited,
        "prohibitedLabel": prohibited_label,
        "detectedVisual": prohibited_label if is_prohibited else cat_info["label"],
        "suggestedTitle": cat_info["suggestedTitle"],
        "suggestedCategory": final_suggested_cat,
        "visualConfidence": visual_confidence,
        "similarity": round(title_sim, 4),
        "reason": reason,
        "source": "local-clip-engine"
    }


class ClipHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ["/health", "/", "/status"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "service": "zeromall-clip-local-ai",
                "model": "clip-ViT-B-32",
                "dimensions": 512,
                "multiImageCapable": True,
                "endpoints": ["/embed", "/audit", "/classify"]
            }).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(body) if body else {}
        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Invalid JSON: {str(e)}"}).encode("utf-8"))
            return

        if self.path == "/embed":
            try:
                pil_img = parse_pil_image(payload)
                if pil_img is None:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Vui lòng cung cấp imageBase64 hoặc imageUrl"}).encode("utf-8"))
                    return

                embedding = model.encode(pil_img).tolist()
                rounded = [round(x, 6) for x in embedding]

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "embedding": rounded,
                    "dimensions": len(rounded)
                }).encode("utf-8"))
            except Exception as e:
                import traceback
                traceback.print_exc()
                try:
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                except Exception:
                    pass

        elif self.path in ["/audit", "/classify"]:
            try:
                name = (payload.get("name") or payload.get("title") or "").strip()
                category = (payload.get("category") or "").strip()
                name_emb = model.encode([name])[0] if name else None

                # Kiểm tra nếu client gửi mảng nhiều ảnh (Multi-Image Audit)
                raw_images = payload.get("images")
                if isinstance(raw_images, list) and len(raw_images) > 0:
                    image_results = []
                    worst_idx = 0
                    worst_item = None
                    min_sim = 1.0

                    for idx, img_item in enumerate(raw_images[:9]): # Quét tối đa 9 ảnh
                        pil_img = parse_single_image_item(img_item)
                        if pil_img is None:
                            continue

                        audit_res = audit_single_image_logic(pil_img, name, category, name_emb)
                        audit_res["imageIndex"] = idx
                        image_results.append(audit_res)

                        # Thuật toán Worst-case Pooling (Lấy trường hợp xấu nhất)
                        cur_sim = audit_res["similarity"]
                        if audit_res["isMismatch"] or cur_sim < min_sim:
                            min_sim = cur_sim
                            worst_idx = idx
                            worst_item = audit_res

                    if not image_results:
                        self.send_response(200)
                        self.send_header("Content-Type", "application/json")
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            "isMismatch": False,
                            "message": "Không đọc được hình ảnh hợp lệ trong album"
                        }).encode("utf-8"))
                        return

                    # Đánh giá tổng hợp: Ưu tiên phát hiện hàng cấm (Vũ khí, Súng, Dao kiếm, Cần sa...)
                    any_prohibited = any(r.get("isProhibited", False) for r in image_results)
                    any_mismatch = any(r["isMismatch"] for r in image_results) or any_prohibited

                    if any_prohibited:
                        proh_item = next(r for r in image_results if r.get("isProhibited", False))
                        worst_item = proh_item
                        worst_idx = proh_item.get("imageIndex", 0)
                        agg_reason = f"Ảnh số {worst_idx + 1} phát hiện {proh_item.get('prohibitedLabel', 'hàng cấm')} - thuộc danh mục hàng cấm kinh doanh trên sàn!"
                    elif any_mismatch:
                        agg_reason = f"Ảnh số {worst_idx + 1} vi phạm: {worst_item['reason'] if worst_item else 'Bất tương đồng với tiêu đề'}"
                    else:
                        agg_reason = f"Toàn bộ {len(image_results)} ảnh hợp lệ và tương đồng với tiêu đề sản phẩm."

                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "isMismatch": any_mismatch,
                        "isProhibited": any_prohibited,
                        "prohibitedLabel": worst_item.get("prohibitedLabel", "") if any_prohibited and worst_item else "",
                        "worstImageIndex": worst_idx,
                        "minSimilarity": round(min_sim, 4),
                        "detectedVisual": worst_item["detectedVisual"] if worst_item else "Sản phẩm",
                        "suggestedTitle": worst_item["suggestedTitle"] if worst_item else name,
                        "suggestedCategory": (worst_item["suggestedCategory"] if worst_item else category) if not any_prohibited else category,
                        "visualConfidence": worst_item["visualConfidence"] if worst_item else 95.0,
                        "similarity": round(min_sim, 4),
                        "reason": agg_reason,
                        "totalImagesScanned": len(image_results),
                        "imageAudits": image_results,
                        "source": "multi-image-clip-agent"
                    }, ensure_ascii=False).encode("utf-8"))
                    return

                # Nếu chỉ gửi 1 ảnh (Single image - Backward compatibility)
                pil_img = parse_pil_image(payload)
                if pil_img is None:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "isMismatch": False,
                        "message": "Không có ảnh hợp lệ để kiểm tra thị giác"
                    }).encode("utf-8"))
                    return

                res = audit_single_image_logic(pil_img, name, category, name_emb)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))

            except Exception as e:
                import traceback
                traceback.print_exc()
                try:
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                except Exception:
                    pass
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), ClipHandler)
    print(f"[*] ZeroMall Local CLIP Multi-Image Audit Agent (Multi-Threaded) is listening on 0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Stopping server...")
        server.server_close()
