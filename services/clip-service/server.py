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
    "Đồng Hồ": {
        "prompt": "wrist watch analog watch digital watch luxury timepiece strap smartwatch chronometer dong ho đeo tay",
        "label": "Đồng hồ đeo tay / Smartwatch",
        "suggestedTitle": "Đồng Hồ Thời Trang Nam Nữ Chính Hãng",
        "zero_category": "Đồng Hồ",
        "domain": "WATCH"
    },
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
    "Mẹ & Bé": {
        "prompt": "baby supplies baby bib baby bottle infant clothing baby stroller pacifier do so sinh yem an dam em be me va be",
        "label": "Đồ dùng Mẹ & Bé / Yếm ăn dặm",
        "suggestedTitle": "Đồ Dùng Tiện Ích Mẹ & Bé An Toàn",
        "zero_category": "Mẹ & Bé",
        "domain": "MOM_BABY"
    },
    "Sắc Đẹp": {
        "prompt": "cosmetics skincare serum lipstick moisturizer facial cream beauty makeup perfume sua rua mat kem duong son moi",
        "label": "Mỹ phẩm / Chăm sóc da / Sắc đẹp",
        "suggestedTitle": "Mỹ Phẩm Chăm Sóc Sắc Đẹp Chính Hãng",
        "zero_category": "Sắc Đẹp",
        "domain": "BEAUTY"
    },
    "Sức Khỏe": {
        "prompt": "health vitamins dietary supplements nutritional capsules medicine thuoc bo vien uong vitamin thuc pham chuc nang",
        "label": "Thực phẩm chức năng / Vitamin sức khỏe",
        "suggestedTitle": "Thực Phẩm Bổ Sung Chăm Sóc Sức Khỏe",
        "zero_category": "Sức Khỏe",
        "domain": "HEALTH"
    },
    "Nhà Cửa": {
        "prompt": "bedsheet blanket pillow quilt home living storage rack organizer gia dung nha cua chan ga goi dem",
        "label": "Nhà cửa & Đời sống / Chăn ga gối",
        "suggestedTitle": "Đồ Dùng Nhà Cửa & Đời Sống Tiện Lợi",
        "zero_category": "Nhà Cửa",
        "domain": "HOME"
    },
    "Phụ Kiện Nữ": {
        "prompt": "hair clip earrings necklace jewelry sunglasses hair accessories phu kien nu kep toc vong co khuyen tai mat kinh",
        "label": "Phụ kiện thời trang nữ / Kẹp tóc / Trang sức",
        "suggestedTitle": "Phụ Kiện Thời Trang Nữ Xinh Xắn",
        "zero_category": "Phụ Kiện Nữ",
        "domain": "ACCESSORIES"
    },
    "Gia Dụng": {
        "prompt": "kitchen appliance air fryer cooker pot pan blender microwave",
        "label": "Đồ gia dụng / Thiết bị nhà bếp",
        "suggestedTitle": "Thiết Bị Gia Dụng Nhà Bếp Đa Năng Cao Cấp",
        "zero_category": "Gia Dụng",
        "domain": "KITCHEN"
    },
    "Máy Ảnh": {
        "prompt": "camera photography lens tripod digital camera gopro",
        "label": "Máy ảnh / Thiết bị quay phim",
        "suggestedTitle": "Máy Ảnh Kỹ Thuật Số Chính Hãng",
        "zero_category": "Máy Ảnh",
        "domain": "CAMERA"
    },
    "Điện Thoại & Phụ Kiện": {
        "prompt": "smartphone mobile phone case charger headphones airpods",
        "label": "Điện thoại & Phụ kiện",
        "suggestedTitle": "Điện Thoại Thông Minh Phụ Kiện Cao Cấp",
        "zero_category": "Điện Thoại & Phụ Kiện",
        "domain": "ELECTRONICS"
    },
    "Thiết Bị Điện Tử": {
        "prompt": "bluetooth speaker headphones mechanical keyboard power bank electronic gadget tai nghe loa bluetooth ban phim",
        "label": "Thiết bị điện tử / Loa / Tai nghe",
        "suggestedTitle": "Thiết Bị Điện Tử & Phụ Kiện Công Nghệ",
        "zero_category": "Thiết Bị Điện Tử",
        "domain": "ELECTRONICS"
    },
    "Máy Tính & Laptop": {
        "prompt": "laptop computer pc keyboard monitor gaming mouse",
        "label": "Máy tính & Laptop",
        "suggestedTitle": "Laptop Máy Tính Cấu Hình Cao",
        "zero_category": "Máy Tính & Laptop",
        "domain": "ELECTRONICS"
    },
    "Túi Ví Nữ": {
        "prompt": "backpack handbag wallet purse bag clutch",
        "label": "Balo / Túi xách / Ví",
        "suggestedTitle": "Balo Túi Xách Thời Trang Tiện Lợi",
        "zero_category": "Túi Ví Nữ",
        "domain": "BAGS"
    },
    "Sách & VPP": {
        "prompt": "books textbook notebook stationery pens paper document",
        "label": "Sách & Văn phòng phẩm",
        "suggestedTitle": "Sách & Văn Phòng Phẩm Học Tập",
        "zero_category": "Sách & VPP",
        "domain": "BOOKS"
    },
    "Sơ đồ / Tài liệu": {
        "prompt": "software architecture flowchart code terminal diagram system text",
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
        "threshold": 0.22
    },
    "Vũ khí lạnh / Kiếm / Dao găm": {
        "prompt": "sword katana samurai combat blade tactical dagger hunting knife switchblade weapon bayonet kiếm dao găm vũ khí thô sơ",
        "label": "Kiếm / Dao găm / Vũ khí thô sơ (Swords/Blades)",
        "threshold": 0.22
    },
    "Chất cấm / Cần sa / Ma túy": {
        "prompt": "cannabis marijuana weed dried drug narcotic pills ecstasy heroin substance meth thuốc phiện cần sa ma túy",
        "label": "Cần sa / Ma túy / Chất kích thích (Cannabis/Drugs)",
        "threshold": 0.22
    },
    "Pháo nổ / Thuốc nổ": {
        "prompt": "firecrackers fireworks pyrotechnics explosives explosive device dynamite pháo nổ pháo hoa nổ thuốc nổ",
        "label": "Pháo nổ / Thuốc nổ (Fireworks/Explosives)",
        "threshold": 0.22
    },
    "Thiết bị quay lén giấu kín": {
        "prompt": "hidden spy camera pinhole spy cam covert surveillance camera camera quay lén ngụy trang",
        "label": "Camera quay lén ngụy trang (Spy Cameras)",
        "threshold": 0.22
    },
    "Tiền polymer giả": {
        "prompt": "counterfeit currency fake banknotes fake money polymer bills tiền polymer giả tiền giả",
        "label": "Tiền polymer giả (Counterfeit Currency)",
        "threshold": 0.22
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
    "Thời Trang Nữ": ["Thời Trang Nữ", "Thời Trang Nam", "Phụ Kiện Nữ", "Túi Ví Nữ", "Thể Thao"],
    "Thể Thao": ["Thể Thao", "Thời Trang Nam", "Thời Trang Nữ"],
    "Giày Dép Nam": ["Giày Dép Nam", "Giày Dép Nữ", "Thể Thao"],
    "Giày Dép Nữ": ["Giày Dép Nữ", "Giày Dép Nam", "Thời Trang Nữ"],
    "Đồng Hồ": ["Đồng Hồ", "Phụ Kiện Nữ"],
    "Mẹ & Bé": ["Mẹ & Bé", "Thời Trang Nữ", "Nhà Cửa"],
    "Sắc Đẹp": ["Sắc Đẹp", "Sức Khỏe"],
    "Sức Khỏe": ["Sức Khỏe", "Sắc Đẹp"],
    "Nhà Cửa": ["Nhà Cửa", "Gia Dụng"],
    "Gia Dụng": ["Gia Dụng", "Nhà Cửa"],
    "Phụ Kiện Nữ": ["Phụ Kiện Nữ", "Thời Trang Nữ", "Đồng Hồ"],
    "Túi Ví Nữ": ["Túi Ví Nữ", "Thời Trang Nữ", "Phụ Kiện Nữ"],
    "Điện Thoại & Phụ Kiện": ["Điện Thoại & Phụ Kiện", "Thiết Bị Điện Tử", "Máy Tính & Laptop"],
    "Máy Tính & Laptop": ["Máy Tính & Laptop", "Thiết Bị Điện Tử", "Điện Thoại & Phụ Kiện"],
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
    # Loại bỏ các cụm từ ngữ cảnh mô tả công dụng/tương thích để không gây sai lệch thực thể chính
    t = text.lower()
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

    # 0. QUÉT AN TOÀN THỊ GIÁC: PHÁT HIỆN HÀNG CẤM (Vũ khí, Súng, Kiếm, Cần sa...)
    prohibited_sims = util.cos_sim(img_emb, PROHIBITED_EMBEDDINGS)[0]
    best_proh_idx = prohibited_sims.argmax().item()
    max_proh_sim = float(prohibited_sims[best_proh_idx].item())
    proh_key = PROHIBITED_KEYS[best_proh_idx]
    proh_info = PROHIBITED_CONCEPTS[proh_key]

    is_prohibited = False
    prohibited_label = ""
    if max_proh_sim >= proh_info["threshold"]:
        is_prohibited = True
        prohibited_label = proh_info["label"]

    sims = util.cos_sim(img_emb, CAT_EMBEDDINGS)[0]
    best_idx = sims.argmax().item()
    best_cat = CAT_KEYS[best_idx]
    cat_info = CANONICAL_CATEGORIES[best_cat]
    visual_confidence = round(float(sims[best_idx]) * 100, 1)

    title_sim = 0.0
    is_mismatch = False
    reason = ""

    lower_name = name.lower()
    cleaned_name = clean_title_for_entity_check(lower_name)
    category_clean = (category or "").strip()
    cat_lower = category_clean.lower()
    domain = cat_info.get("domain", "")
    pred_cat = cat_info.get("zero_category", "Thời Trang Nam")

    if is_prohibited:
        is_mismatch = True
        reason = f"[Visual Safety Guard] Hình ảnh nhận diện là {prohibited_label} (độ tin cậy: {round(max_proh_sim*100, 1)}%) - thuộc danh mục hàng cấm kinh doanh tuyệt đối trên sàn ZeroMall!"
    elif best_cat == "Sơ đồ / Tài liệu":
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

        # 1. TOPS vs BOTTOMS & Chi tiết nhóm TOPS
        if domain in TOPS_DOMAINS:
            is_bottom = any(k in cleaned_name for k in ["quần", "quan", "jean", "short", "jogger", "trouser", "sweatpant", "kaki", "quần đùi", "quần dài", "quần âu"])
            is_suit = any(k in cleaned_name for k in ["bộ", "set", "đồ bộ", "bộ đồ", "combo", "áo và quần", "áo phối quần"])
            if is_bottom and not is_suit:
                is_mismatch = True
                reason = f"Ảnh hiển thị áo/áo khoác thời trang, không khớp với tên sản phẩm bạn nhập là quần (\"{name}\")."
            elif any(k in cleaned_name for k in ["giày", "dép", "sneaker", "sandal", "nồi chiên", "bếp", "điện thoại", "laptop", "máy tính"]):
                is_mismatch = True
                reason = f"Ảnh là áo thời trang ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

            # 1.1 Kiểm tra phân loại con: Áo thun vs Áo cardigan / Áo len dệt kim
            if not is_mismatch and domain == "TSHIRT":
                is_cardigan_knit = any(k in cleaned_name for k in ["cardigan", "áo len", "ao len", "dệt kim", "det kim", "len mỏng", "len dệt kim", "knitwear"])
                if is_cardigan_knit:
                    is_mismatch = True
                    reason = f"Ảnh hiển thị áo thun / áo phông năng động, không khớp với sản phẩm là áo cardigan / áo len dệt kim (\"{name}\")."

            if not is_mismatch and domain == "CARDIGAN_KNIT":
                is_tshirt_only = any(k in cleaned_name for k in ["áo thun", "ao thun", "áo phông", "t-shirt", "tee"]) and not any(k in cleaned_name for k in ["cardigan", "len", "dệt kim"])
                if is_tshirt_only:
                    is_mismatch = True
                    reason = f"Ảnh hiển thị áo cardigan / áo len dệt kim, không khớp với sản phẩm là áo thun / áo phông (\"{name}\")."

        # 2. FOOTWEAR: Giày Sneaker vs Dép bánh mì / Sandal
        elif domain in FOOTWEAR_DOMAINS:
            # 2.1 Sneaker thể thao vs Dép bánh mì / Sandal quai ngang
            if domain == "SNEAKERS":
                is_dep_sandal = any(k in cleaned_name for k in [
                    "dép bánh mì", "dep banh mi", "dép", "dep", "dép quai ngang", "dép lê", "dép kẹp",
                    "dép xỏ ngón", "dép sục", "sandal", "xăng đan", "quai ngang", "eva nguyên khối"
                ])
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

            # 2.3 Giày dép vs Quần áo / Gia dụng / Điện tử
            disallowed_themes = ["áo", "quần", "váy", "đầm", "nồi chiên", "điện thoại", "laptop", "máy tính"]
            if any(k in cleaned_name for k in disallowed_themes):
                is_mismatch = True
                reason = f"Ảnh là giày dép ({cat_info['label']}), không khớp với tên sản phẩm \"{name}\"."

        elif domain == "BOTTOMS":
            is_top = any(k in cleaned_name for k in ["áo", "ao", "khoác", "jacket", "hoodie", "sweater", "sơ mi", "polo", "áo thun", "blazer", "vest", "cardigan"])
            is_suit = any(k in cleaned_name for k in ["bộ", "set", "đồ bộ", "bộ đồ", "combo", "áo và quần", "áo phối quần"])
            if is_top and not is_suit:
                is_mismatch = True
                reason = f"Ảnh hiển thị quần thời trang, không khớp với tên sản phẩm bạn nhập là áo (\"{name}\")."
            elif any(k in cleaned_name for k in ["giày", "dép", "sneaker", "sandal", "nồi chiên", "bếp", "điện thoại", "laptop", "máy tính"]):
                is_mismatch = True
                reason = f"Ảnh là quần thời trang, không khớp với tên sản phẩm \"{name}\"."

        elif domain == "DRESS":
            if any(k in cleaned_name for k in ["quần nam", "áo nam", "quần jean nam", "giày nam"]):
                is_mismatch = True
                reason = f"Ảnh là váy đầm thời trang nữ, không khớp với tên sản phẩm \"{name}\"."

        elif domain == "SPORTS":
            disallowed_themes = [
                "siêu nhân", "gao", "công chúa", "bà ba", "áo dài", "đồ ngủ",
                "pijama", "anime", "cosplay", "giày", "dép", "sneaker", "sandal",
                "laptop", "máy tính", "điện thoại", "tai nghe", "bàn phím", "nồi chiên", "bếp"
            ]
            if any(k in cleaned_name for k in disallowed_themes):
                is_mismatch = True
                reason = f"Ảnh là trang phục thể thao/bóng đá thực tế, không khớp với tên sản phẩm \"{name}\"."

        elif domain == "KITCHEN":
            if not any(k in cleaned_name for k in ["nồi", "chảo", "bếp", "lò", "ấm", "máy xay", "gia dụng"]):
                is_mismatch = True
                reason = f"Ảnh là đồ gia dụng nhà bếp, không khớp với tên sản phẩm \"{name}\"."

        elif domain == "ELECTRONICS":
            if any(k in cleaned_name for k in ["áo", "quần", "váy", "đầm", "giày", "dép", "nồi chiên"]):
                is_mismatch = True
                reason = f"Ảnh là thiết bị công nghệ điện tử, không khớp với tên sản phẩm \"{name}\"."

    # B. KIỂM TRA CHÉO HÌNH ẢNH VS NGÀNH HÀNG (Category Cross-Audit Toàn diện)
    if not is_mismatch and category_clean and pred_cat:
        is_compatible = False
        allowed = COMPATIBLE_CATEGORIES.get(pred_cat, [pred_cat])
        for a in allowed:
            if a.lower() in cat_lower or cat_lower in a.lower():
                is_compatible = True
                break

        # Kiểm tra xem tiêu đề sản phẩm có đang chứa từ khóa đại diện đúng cho ngành hàng hiện tại không
        # Nếu tiêu đề ĐÃ rõ ràng là ngành hàng đó (ví dụ chứa "đồng hồ", "blazer", "yếm", "ăn dặm", "áo", "quần", "váy"),
        # thì tuyệt đối không để kết quả zero-shot có điểm số thấp lấn át tiêu đề chuẩn!
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
            # Chỉ báo lệch ngành nếu tiêu đề không hề khớp ngành và độ tự tin thị giác cao
            if not title_matches_current_cat and visual_confidence >= 24.5:
                is_mismatch = True
                reason = f"Ảnh hiển thị {cat_info['label']} (ngành: {pred_cat}), không tương thích với ngành hàng '{category_clean}' bạn chọn."

    # Ngưỡng tương đồng Cosine cấu hình động (Chỉ áp dụng khi title_sim quá thấp < 0.12 và không có ngành hàng tương thích)
    cosine_threshold = float(os.environ.get("CLIP_SIMILARITY_THRESHOLD", "0.14"))
    if not is_mismatch and title_sim > 0 and title_sim < cosine_threshold and not is_compatible and not title_matches_current_cat:
        if not reason:
            is_mismatch = True
            reason = f"Độ tương quan giữa ảnh ({cat_info['label']}) và tiêu đề đạt {round(title_sim, 2)}, thấp hơn ngưỡng an toàn {cosine_threshold}."

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
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

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
                        "suggestedCategory": "Hàng Cấm Kinh Doanh" if any_prohibited else (worst_item["suggestedCategory"] if worst_item else category),
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
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
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
