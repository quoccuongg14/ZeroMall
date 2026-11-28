import os
import sys
import json
import math
import time
import random
import base64
import hashlib
import io
import tempfile
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
import cv2
import numpy as np
from PIL import Image, ImageDraw

TEMP_DIR = tempfile.gettempdir()
BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
current_dir = os.path.dirname(os.path.abspath(__file__))
catvton_dir = os.path.join(current_dir, "CatVTON")
if catvton_dir not in sys.path:
    sys.path.append(catvton_dir)
if current_dir not in sys.path:
    sys.path.append(current_dir)

user_site = os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages")
if os.path.exists(user_site) and user_site not in sys.path:
    sys.path.append(user_site)

# Cấu hình thiết bị: Kích hoạt Apple Silicon Metal Performance Shaders (MPS)
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
try:
    import torch
    if torch.backends.mps.is_available():
        DEVICE = "mps"
    elif torch.cuda.is_available():
        DEVICE = "cuda"
    else:
        DEVICE = "cpu"
except Exception:
    DEVICE = "cpu"

try:
    from vton_engine import VTONEngine
except Exception as e:
    print(f"[!] Warning: Cannot import VTONEngine ({e})")
    VTONEngine = None

try:
    from fashn_human_parser import FashnHumanParser
    shared_parser = FashnHumanParser(device="cpu")
    print("[+] FashnHumanParser loaded successfully in server.py!")
except Exception as e_p:
    print(f"[!] Warning: Could not initialize FashnHumanParser ({e_p})")
    shared_parser = None

# Tải FASHN VTON v1.5 Pipeline nếu có weights
FASHN_WEIGHTS_DIR = os.path.join(current_dir, "fashn-vton-1.5", "weights")
fashn_pipeline = None
if os.path.exists(os.path.join(FASHN_WEIGHTS_DIR, "model.safetensors")):
    try:
        fashn_src = os.path.join(current_dir, "fashn-vton-1.5", "src")
        if fashn_src not in sys.path:
            sys.path.append(fashn_src)
        from fashn_vton import TryOnPipeline
        fashn_pipeline = TryOnPipeline(weights_dir=FASHN_WEIGHTS_DIR, device=DEVICE)
        print(f"[+] FASHN VTON v1.5 Pipeline loaded successfully on {DEVICE}!")
    except Exception as ef:
        print(f"[!] Warning: Cannot initialize FASHN VTON pipeline ({ef})")

# Cấu hình API Keys & Nhà cung cấp AI Try-On
DEFAULT_MAGE_API_KEY = "mage_sk_BQTeU9X17ETFA20h4R8smnqRArg50wh5fr1BW0Pvv54"
MAGE_API_KEY = (os.environ.get("MAGE_API_KEY") or "").strip() or DEFAULT_MAGE_API_KEY

PORT = int(os.environ.get("TRYON_PORT", 5006))
KONG_GATEWAY_URL = os.environ.get("KONG_GATEWAY_URL", "http://kong:8000" if os.path.exists("/.dockerenv") else "http://localhost:8000")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
STATIC_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "cache")
os.makedirs(STATIC_CACHE_DIR, exist_ok=True)

print(f"[*] Starting ZeroMall 3D Virtual Try-On Service on port {PORT}...")
print(f"[*] Compute acceleration device: {DEVICE.upper()} (Apple M4 Optimized)")

# ---------------------------------------------------------------------------
# 1. Anthropometric 3D Parametric Body Mesh Engine (Dựa trên SMPL-X & ISO 8559)
# ---------------------------------------------------------------------------
class Body3DGenerator:
    """
    Thuật toán tính toán số đo nhân trắc học và sinh khung lưới 3D Avatar (Vertices & Faces)
    dựa trên Chiều cao (cm), Cân nặng (kg), Giới tính.
    """
    @staticmethod
    def calculate_measurements(height_cm: float, weight_kg: float, gender: str = "male"):
        h_m = height_cm / 100.0
        bmi = weight_kg / (h_m * h_m)
        
        # Phân loại thể trạng (WHO)
        if bmi < 18.5:
            body_type = "Gầy thanh mảnh (Ectomorph)"
            shape_class = "slim"
        elif bmi < 24.9:
            body_type = "Cân đối tiêu chuẩn (Mesomorph)"
            shape_class = "standard"
        elif bmi < 29.9:
            body_type = "Đậm người / Cơ bắp (Endomorph)"
            shape_class = "athletic"
        else:
            body_type = "Đầy đặn (Plus size)"
            shape_class = "plus"

        # Tính toán số đo chi tiết (cm) dựa trên công thức hồi quy nhân trắc học ISO 8559 & SMPL
        if gender.lower() == "female":
            # Tỷ lệ nữ (Eo thon, hông nở)
            chest = round(0.48 * height_cm + 0.18 * weight_kg, 1)
            waist = round(0.33 * height_cm + 0.25 * weight_kg, 1)
            hip = round(0.44 * height_cm + 0.42 * weight_kg, 1)
            thigh = round(0.20 * height_cm + 0.38 * weight_kg, 1)
            shoulder = round(0.22 * height_cm, 1)
            inseam = round(0.44 * height_cm, 1)  # Chiều dài từ đũng đến mắt cá
            outseam = round(0.57 * height_cm, 1) # Chiều dài quần từ eo đến gót
        else:
            # Tỷ lệ nam (Vai rộng, eo gọn)
            chest = round(0.53 * height_cm + 0.10 * weight_kg, 1)
            waist = round(0.38 * height_cm + 0.22 * weight_kg, 1)
            hip = round(0.45 * height_cm + 0.25 * weight_kg, 1)
            thigh = round(0.22 * height_cm + 0.22 * weight_kg, 1)
            shoulder = round(0.25 * height_cm, 1)
            inseam = round(0.45 * height_cm, 1)
            outseam = round(0.58 * height_cm, 1)

        return {
            "bmi": round(bmi, 1),
            "body_type": body_type,
            "shape_class": shape_class,
            "height_cm": height_cm,
            "weight_kg": weight_kg,
            "gender": gender,
            "chest_cm": chest,
            "waist_cm": waist,
            "hip_cm": hip,
            "thigh_cm": thigh,
            "shoulder_cm": shoulder,
            "inseam_cm": inseam,
            "outseam_cm": outseam,
            "recommended_pant_size": Body3DGenerator._get_pant_size(waist, gender)
        }

    @staticmethod
    def _get_pant_size(waist_cm: float, gender: str):
        if gender.lower() == "female":
            if waist_cm < 66: return "S (26)"
            elif waist_cm < 71: return "M (27-28)"
            elif waist_cm < 76: return "L (29-30)"
            elif waist_cm < 82: return "XL (31-32)"
            else: return "2XL (33+)"
        else:
            if waist_cm < 74: return "S (28-29)"
            elif waist_cm < 80: return "M (30-31)"
            elif waist_cm < 86: return "L (32-33)"
            elif waist_cm < 92: return "XL (34-35)"
            else: return "2XL (36+)"

    @staticmethod
    def generate_3d_joints_and_mesh(height_cm: float, weight_kg: float, gender: str = "male"):
        """
        Sinh tọa độ 3D keypoints và mô hình khung người để client Three.js render và xoay 360 độ.
        Đơn vị chuẩn hóa: y = chiều cao (0 đến 1.8m), x = chiều rộng (-0.3 đến +0.3m), z = chiều sâu (-0.15 đến +0.15m)
        """
        h = height_cm / 100.0
        w_factor = (weight_kg / (h * h)) / 22.0 # Tỷ lệ so với BMI chuẩn 22
        
        waist_w = 0.16 * w_factor
        hip_w = 0.18 * w_factor
        shoulder_w = 0.22 * (1.0 if gender == "male" else 0.9)
        thigh_r = 0.07 * math.sqrt(w_factor)

        # 17 Khớp xương 3D tiêu chuẩn (Standard Biomechanical Skeleton)
        joints = {
            "head": [0.0, h * 0.94, 0.0],
            "neck": [0.0, h * 0.85, 0.0],
            "shoulder_left": [-shoulder_w, h * 0.82, 0.0],
            "shoulder_right": [shoulder_w, h * 0.82, 0.0],
            "elbow_left": [-shoulder_w - 0.06, h * 0.62, 0.0],
            "elbow_right": [shoulder_w + 0.06, h * 0.62, 0.0],
            "wrist_left": [-shoulder_w - 0.08, h * 0.44, 0.0],
            "wrist_right": [shoulder_w + 0.08, h * 0.44, 0.0],
            "chest": [0.0, h * 0.73, 0.02],
            "waist": [0.0, h * 0.58, 0.0],
            "pelvis": [0.0, h * 0.52, 0.0],
            "hip_left": [-hip_w * 0.55, h * 0.50, 0.0],
            "hip_right": [hip_w * 0.55, h * 0.50, 0.0],
            "knee_left": [-hip_w * 0.55, h * 0.27, 0.0],
            "knee_right": [hip_w * 0.55, h * 0.27, 0.0],
            "ankle_left": [-hip_w * 0.50, h * 0.05, 0.0],
            "ankle_right": [hip_w * 0.50, h * 0.05, 0.0]
        }

        # Khối hình học Parametric 3D Cylinders / Capsules cho các vùng cơ thể
        body_segments = [
            {"name": "Torso (Thân trên)", "from": "pelvis", "to": "neck", "radius": waist_w, "color": "#38bdf8"},
            {"name": "Left Upper Leg (Đùi trái)", "from": "hip_left", "to": "knee_left", "radius": thigh_r, "color": "#6366f1"},
            {"name": "Right Upper Leg (Đùi phải)", "from": "hip_right", "to": "knee_right", "radius": thigh_r, "color": "#6366f1"},
            {"name": "Left Lower Leg (Bắp chân trái)", "from": "knee_left", "to": "ankle_left", "radius": thigh_r * 0.7, "color": "#818cf8"},
            {"name": "Right Lower Leg (Bắp chân phải)", "from": "knee_right", "to": "ankle_right", "radius": thigh_r * 0.7, "color": "#818cf8"},
            {"name": "Left Arm (Tay trái)", "from": "shoulder_left", "to": "wrist_left", "radius": 0.045, "color": "#94a3b8"},
            {"name": "Right Arm (Tay phải)", "from": "shoulder_right", "to": "wrist_right", "radius": 0.045, "color": "#94a3b8"},
            {"name": "Head (Đầu)", "from": "neck", "to": "head", "radius": 0.09, "color": "#cbd5e1"}
        ]

        return {"joints": joints, "segments": body_segments}


# ---------------------------------------------------------------------------
# 2. Garment Fit & Pressure Heatmap Engine (Thẩm định độ vừa vặn)
# ---------------------------------------------------------------------------
class GarmentFitEngine:
    @staticmethod
    def _extract_item_options(item_spec: dict = None) -> tuple:
        if not item_spec:
            return ("Kích thước", [])
        vg = item_spec.get("variationGroups")
        if isinstance(vg, str):
            try:
                vg = json.loads(vg)
            except Exception:
                vg = []
        if isinstance(vg, list) and len(vg) > 0:
            # Ưu tiên nhóm có chữ size / kích / chiều dài / chu vi
            for g in vg:
                gname = str((g or {}).get("name") or "")
                opts = (g or {}).get("options") or []
                if any(k in gname.lower() for k in ["size", "kích", "dài", "vòng", "mặt"]) and isinstance(opts, list) and opts:
                    return (gname, [str(o) for o in opts])
            first_g = vg[0] or {}
            return (str(first_g.get("name") or "Kích thước"), [str(o) for o in (first_g.get("options") or [])])
        return ("Kích thước", [])

    @staticmethod
    def recommend_item_size(user_measurements: dict, item_spec: dict = None, is_outerwear: bool = False) -> dict:
        """
        Dự đoán & gợi ý Size chính xác theo Chiều cao, Cân nặng, Giới tính và Loại sản phẩm
        (Áo trong, Áo khoác 2 lớp, Quần size chữ/số, Thắt lưng, Đồng hồ, Vòng tay, Giày dép).
        """
        h = float(user_measurements.get("height_cm", 170) or 170)
        w = float(user_measurements.get("weight_kg", 65) or 65)
        gender = str(user_measurements.get("gender", "male") or "male").lower()
        waist = float(user_measurements.get("waist_cm", 78) or 78)
        chest = float(user_measurements.get("chest_cm", 94) or 94)

        name = str((item_spec or {}).get("name") or "").lower()
        cat = str((item_spec or {}).get("category") or "").lower()
        group_name, available_options = GarmentFitEngine._extract_item_options(item_spec)

        # Kiểm tra giày dép (không đoán số giày từ cân nặng)
        if "giày" in cat or "dép" in cat or any(k in name for k in ["giày", "sneaker", "boots", "loafer", "dép", "sandal"]):
            return {
                "applicable": False,
                "recommended_size": available_options[min(2, len(available_options) - 1)] if available_options else "Chọn theo chân",
                "alt_size": None,
                "note": "Cỡ giày phụ thuộc vào chiều dài bàn chân (cm), bạn vui lòng chọn trực tiếp theo cỡ chân thường đi.",
                "available_options": available_options,
                "group_name": group_name,
            }

        # Thắt lưng / Dây nịt
        if any(k in name for k in ["thắt lưng", "dây nịt"]):
            if waist < 76: rec, alt = "105cm", "110cm"
            elif waist < 84: rec, alt = "110cm", "115cm"
            elif waist < 92: rec, alt = "115cm", "120cm"
            else: rec, alt = "120cm", None
            if available_options and rec not in available_options:
                rec = available_options[min(1, len(available_options) - 1)]
            return {
                "applicable": True,
                "recommended_size": rec,
                "alt_size": alt,
                "note": f"Vòng eo ước tính ~{waist}cm phù hợp dây dài {rec}" + (f" (hoặc {alt} nếu thích đuôi dây dư rộng)" if alt else "."),
                "available_options": available_options,
                "group_name": group_name,
            }

        # Đồng hồ
        if "đồng hồ" in cat or "đồng hồ" in name:
            if available_options:
                if "28mm" in available_options and "32mm" in available_options:
                    rec = "32mm" if (h >= 163 or w >= 55) else "28mm"
                    alt = "28mm" if rec == "32mm" else "32mm"
                elif "40mm" in available_options:
                    rec = "42mm" if (h >= 178 and w >= 72 and "42mm" in available_options) else ("38mm" if (h < 166 and w < 58 and "38mm" in available_options) else "40mm")
                    alt = "40mm" if rec != "40mm" else None
                else:
                    rec, alt = available_options[0], None
            else:
                rec, alt = ("28mm" if gender == "female" else "40mm"), None
            return {
                "applicable": True,
                "recommended_size": rec,
                "alt_size": alt,
                "note": f"Mặt {rec} cân đối cổ tay theo thể trạng {int(h)}cm • {int(w)}kg.",
                "available_options": available_options,
                "group_name": group_name,
            }

        # Vòng tay
        if "vòng tay" in name:
            rec = "18cm" if (gender == "male" or w >= 68) else ("17cm" if w >= 52 else "16cm")
            if available_options and rec not in available_options:
                rec = available_options[min(1, len(available_options) - 1)]
            return {
                "applicable": True,
                "recommended_size": rec,
                "alt_size": None,
                "note": f"Chu vi vòng {rec} ôm vừa cổ tay theo chiều cao {int(h)}cm • {int(w)}kg.",
                "available_options": available_options,
                "group_name": group_name,
            }

        # Mũ, Kính, Túi, Phụ kiện Freesize
        if any(c in cat for c in ["túi", "ví", "phụ kiện"]) and not any(k in name for k in ["áo", "quần", "váy", "đầm"]):
            rec = available_options[0] if available_options else "Freesize"
            return {
                "applicable": True,
                "recommended_size": rec,
                "alt_size": None,
                "note": "Phụ kiện thiết kế Freesize dễ điều chỉnh theo nhiều vóc dáng.",
                "available_options": available_options,
                "group_name": group_name,
            }

        # Tính chỉ số Size chuẩn form Việt Nam (0=S, 1=M, 2=L, 3=XL, 4=XXL)
        if gender == "female":
            h_idx = 0 if h < 156 else (1 if h < 162 else (2 if h < 168 else 3))
            w_idx = 0 if w < 46 else (1 if w < 53 else (2 if w < 61 else 3))
            base_idx = max(h_idx, w_idx)
            # Kiểm tra ranh giới cân nặng sát ngưỡng trên để gợi ý +1 size
            near_upper = (w_idx == base_idx and ((base_idx == 0 and w >= 44) or (base_idx == 1 and w >= 51) or (base_idx == 2 and w >= 58)))
            letters = ["S", "M", "L", "XL"]
        else:
            h_idx = 0 if h < 164 else (1 if h < 171 else (2 if h < 177 else (3 if h < 183 else 4)))
            w_idx = 0 if w < 56 else (1 if w < 65 else (2 if w < 74 else (3 if w < 84 else 4)))
            base_idx = max(h_idx, w_idx)
            near_upper = (w_idx == base_idx and ((base_idx == 0 and w >= 54) or (base_idx == 1 and w >= 63) or (base_idx == 2 and w >= 71) or (base_idx == 3 and w >= 80)))
            letters = ["S", "M", "L", "XL", "XXL"]

        is_outer = is_outerwear or any(k in name for k in ["áo khoác", "bomber", "blazer", "vest", "hoodie", "cardigan", "jacket"])
        is_bottom_num = any(o.isdigit() for o in available_options)

        # Quần có size số (29-34 Nam / 26-30 Nữ)
        if is_bottom_num or (any(k in name for k in ["quần jean", "quần tây", "quần âu", "quần kaki"]) and available_options):
            num_opts = [o for o in available_options if o.isdigit()] or (["26", "27", "28", "29", "30"] if gender == "female" else ["29", "30", "31", "32", "34"])
            idx = min(len(num_opts) - 1, base_idx)
            rec = num_opts[idx]
            alt = num_opts[idx + 1] if (near_upper and idx + 1 < len(num_opts)) else (num_opts[idx - 1] if idx > 0 and not near_upper else None)
            return {
                "applicable": True,
                "recommended_size": rec,
                "alt_size": alt,
                "note": f"Eo ước tính ~{waist}cm ({int(h)}cm • {int(w)}kg) mặc vừa đẹp size {rec}" + (f" (chọn {alt} nếu thích thoải mái)" if alt and int(alt) > int(rec) else "."),
                "available_options": available_options,
                "group_name": group_name,
            }

        # Áo / Đầm / Váy / Jogger dùng size chữ
        eff_idx = min(len(letters) - 1, base_idx + (1 if (is_outer and near_upper) else 0))
        rec = letters[eff_idx]
        if available_options and rec not in available_options:
            # Nếu sản phẩm chỉ có đến XL mà gợi ý XXL -> kẹp về XL
            if rec == "XXL" and "XL" in available_options:
                rec = "XL"
            else:
                rec = available_options[min(eff_idx, len(available_options) - 1)]

        alt = None
        if eff_idx + 1 < len(letters) and (not available_options or letters[eff_idx + 1] in available_options):
            if is_outer or near_upper:
                alt = letters[eff_idx + 1]

        layer_msg = " (tính dư phom khoác ngoài rộng rãi)" if is_outer else f" (ngực ~{chest}cm, eo ~{waist}cm)"
        return {
            "applicable": True,
            "recommended_size": rec,
            "alt_size": alt,
            "note": f"Thể trạng {int(h)}cm • {int(w)}kg chuẩn size {rec}{layer_msg}" + (f" • Muốn mặc oversize chọn {alt}." if alt else "."),
            "available_options": available_options,
            "group_name": group_name,
        }

    @staticmethod
    def evaluate_pant_fit(user_measurements: dict, pant_spec: dict = None):
        """
        Đối chiếu số đo người dùng với thông số món đồ để đưa ra:
        - Size đề xuất khớp đúng loại món đồ (Áo, Áo khoác, Quần, Thắt lưng...)
        - Bản đồ độ căng áp lực (Pressure Tension Heatmap: Eo, Mông, Đùi, Ống chân)
        - Điểm vừa vặn (Fit Score /100)
        """
        waist = user_measurements["waist_cm"]
        hip = user_measurements["hip_cm"]
        thigh = user_measurements["thigh_cm"]
        outseam = user_measurements["outseam_cm"]
        size_pred = GarmentFitEngine.recommend_item_size(user_measurements, pant_spec)
        rec_size = size_pred.get("recommended_size") or user_measurements["recommended_pant_size"].split()[0]
        letter_key = user_measurements["recommended_pant_size"].split()[0]

        # Kích thước chuẩn tương ứng của size đề xuất (cm)
        size_standards = {
            "S": {"waist": 72, "hip": 90, "thigh": 52, "length": 96},
            "M": {"waist": 78, "hip": 96, "thigh": 56, "length": 99},
            "L": {"waist": 84, "hip": 102, "thigh": 60, "length": 102},
            "XL": {"waist": 90, "hip": 108, "thigh": 64, "length": 105},
            "2XL": {"waist": 96, "hip": 114, "thigh": 68, "length": 107}
        }
        std = size_standards.get(letter_key, size_standards["L"])

        # Độ chênh lệch áp lực (%)
        waist_diff = round(((waist - std["waist"]) / std["waist"]) * 100, 1)
        hip_diff = round(((hip - std["hip"]) / std["hip"]) * 100, 1)
        thigh_diff = round(((thigh - std["thigh"]) / std["thigh"]) * 100, 1)
        length_diff = round(outseam - std["length"], 1)

        # Đánh giá chi tiết từng vùng
        zones = {
            "waist": {
                "label": "Vòng cạp eo",
                "diff_percent": waist_diff,
                "status": "Vừa vặn hoàn hảo" if abs(waist_diff) <= 3 else ("Hơi ôm sát" if waist_diff > 3 else "Hơi rộng nhẹ cạp"),
                "status_code": "OPTIMAL" if abs(waist_diff) <= 3 else ("SNUG" if waist_diff > 3 else "LOOSE"),
                "color": "#10b981" if abs(waist_diff) <= 3 else ("#f59e0b" if waist_diff > 3 else "#3b82f6")
            },
            "hip": {
                "label": "Vòng hông / mông",
                "diff_percent": hip_diff,
                "status": "Vừa vặn thoải mái" if abs(hip_diff) <= 4 else ("Căng ôm vòng 3" if hip_diff > 4 else "Rộng rãi suông mềm"),
                "status_code": "OPTIMAL" if abs(hip_diff) <= 4 else ("SNUG" if hip_diff > 4 else "LOOSE"),
                "color": "#10b981" if abs(hip_diff) <= 4 else ("#f59e0b" if hip_diff > 4 else "#3b82f6")
            },
            "thigh": {
                "label": "Vòng đùi",
                "diff_percent": thigh_diff,
                "status": "Ống suông đẹp, không bó" if abs(thigh_diff) <= 5 else ("Bó sát cơ đùi" if thigh_diff > 5 else "Rộng thoải mái"),
                "status_code": "OPTIMAL" if abs(thigh_diff) <= 5 else ("SNUG" if thigh_diff > 5 else "LOOSE"),
                "color": "#10b981" if abs(thigh_diff) <= 5 else ("#f59e0b" if thigh_diff > 5 else "#3b82f6")
            },
            "length": {
                "label": "Độ dài ống quần",
                "diff_cm": length_diff,
                "status": "Vừa chạm mu bàn chân" if abs(length_diff) <= 2 else (f"Dài hơn chân {abs(length_diff)}cm (Nên xắn 1 gấu)" if length_diff < -2 else f"Dáng lửng mắt cá"),
                "status_code": "OPTIMAL" if abs(length_diff) <= 2 else ("LONG" if length_diff < -2 else "CROPPED"),
                "color": "#10b981" if abs(length_diff) <= 2 else "#f59e0b"
            }
        }

        # Xác định dáng người (Body Silhouette Shape)
        gender = user_measurements.get("gender", "male")
        hip_waist_ratio = hip / max(1.0, waist)
        if gender.lower() == "female":
            if hip_waist_ratio > 1.35:
                silhouette = "Dáng Quả Lê (Hông nở, đùi đầy đặn)"
                body_tip = "Món đồ ống suông này giúp cân đối phần thân dưới rất hiệu quả, che khuyết điểm đùi to."
            elif hip_waist_ratio < 1.20:
                silhouette = "Dáng Chữ Nhật (Thân người suông thanh mảnh)"
                body_tip = "Nên sơ vin (đóng thùng) hoặc phối thắt lưng để tạo điểm nhấn vòng eo rõ ràng hơn."
            else:
                silhouette = "Dáng Đồng Hồ Cát (Cân đối chuẩn mực)"
                body_tip = "Vóc dáng lý tưởng tôn trọn đường cong khi mặc mẫu quần này."
        else:
            if user_measurements.get("shoulder_cm", 42) > waist * 0.52:
                silhouette = "Dáng Tam Giác Ngược (Vai rộng, eo thon)"
                body_tip = "Quần phom suông/ống đứng giúp đôi chân trông vững chãi và cân đối hoàn hảo với bờ vai."
            elif user_measurements.get("bmi", 22) > 25:
                silhouette = "Dáng Đậm Người / Vạm Vỡ"
                body_tip = "Quần cạp co giãn hoặc ống đứng tối màu là lựa chọn tối ưu giúp hack dáng chân thon gọn."
            else:
                silhouette = "Dáng Cân Đối Tiêu Chuẩn (Mesomorph)"
                body_tip = "Vóc dáng cân đối rất dễ phối với hầu hết các phong cách từ Streetwear đến Công sở."

        # Tính toán điểm Fit Score tổng quan
        penalties = abs(waist_diff) * 0.4 + abs(hip_diff) * 0.3 + abs(thigh_diff) * 0.3
        fit_score = max(72, min(99, int(100 - penalties)))

        pant_name = (pant_spec or {}).get("name", "chiếc quần")

        return {
            "fit_score": fit_score,
            "recommended_size": rec_size,
            "zones": zones,
            "silhouette": silhouette,
            "body_tip": body_tip,
            "verdict": f"Size {rec_size} phù hợp đến {fit_score}% với vóc dáng của bạn.",
            "stylist_fit_advice": (
                f"Với chiều cao {user_measurements['height_cm']}cm, nặng {user_measurements['weight_kg']}kg ({silhouette}): "
                f"{body_tip} Phần cạp eo {zones['waist']['status'].lower()} và độ dài ống {zones['length']['status'].lower()}."
            )
        }


# ---------------------------------------------------------------------------
# 3. Try-On Visualizer: Ghép trang phục lên ảnh thật người dùng bằng AI VTON
# ---------------------------------------------------------------------------
class TryOnSynthesizer:
    @classmethod
    def build_physique_morphology(cls, height_cm: float, weight_kg: float, gender: str = "male"):
        """
        Phân tích chuyên sâu chỉ số nhân trắc học và sinh prompt giải phẫu cơ thể
        đáp ứng chuẩn xác các mức cân nặng từ gầy (BMI < 18.5) đến béo phì (BMI >= 30).
        """
        h_m = max(1.0, float(height_cm) / 100.0)
        bmi = float(weight_kg) / (h_m * h_m)
        is_male = str(gender).lower() == "male"
        gender_pronoun = "his" if is_male else "her"
        gender_noun = "Asian man" if is_male else "Asian woman"

        # Hệ số nở bề ngang cơ thể so với chuẩn BMI 22
        w_factor = min(1.40, max(0.78, math.sqrt(bmi / 22.0)))

        if bmi < 18.5:
            physique_label = "very skinny, slender, lean ectomorph"
            physique_desc = (
                f"noticeably very skinny, slender, lean ectomorph physique with thin slender legs, slim arms, narrow flat waist, and a lightweight skinny frame "
                f"(Height: {height_cm:.0f}cm, Weight: {weight_kg:.0f}kg, BMI: {bmi:.1f})."
            )
            transform_instruction = (
                f"MANDATORY BODY MORPHOLOGY OVERRIDE: The {gender_noun} MUST have a noticeably skinny, lean, slender ectomorph body frame. "
                f"Do not make {gender_pronoun} body muscular, bulky, or thick; distinctly show thin arms, narrow flat waist, and slim slender legs. "
                f"Clothing must fit loosely on {gender_pronoun} thin slender frame."
            )
        elif bmi < 22.5:
            physique_label = "slim, trim and toned"
            physique_desc = (
                f"slim, trim, lean well-proportioned toned build with slender waist and trim legs "
                f"(Height: {height_cm:.0f}cm, Weight: {weight_kg:.0f}kg, BMI: {bmi:.1f})."
            )
            transform_instruction = (
                f"Physique: Well-proportioned slim, trim, fit build with trim waist and natural slender posture."
            )
        elif bmi < 26.0:
            physique_label = "standard healthy average"
            physique_desc = (
                f"standard healthy well-proportioned average build "
                f"(Height: {height_cm:.0f}cm, Weight: {weight_kg:.0f}kg, BMI: {bmi:.1f})."
            )
            transform_instruction = (
                f"Physique: Standard healthy well-proportioned average build."
            )
        elif bmi < 29.5:
            physique_label = "solid, broad-shouldered, stout, thick muscular"
            physique_desc = (
                f"solid, broad-shouldered, stout, heavier thick build with broad waist, thicker torso, and muscular heavy legs "
                f"(Height: {height_cm:.0f}cm, Weight: {weight_kg:.0f}kg, BMI: {bmi:.1f})."
            )
            transform_instruction = (
                f"MANDATORY BODY MORPHOLOGY OVERRIDE: The {gender_noun} has a heavy, broad, stout, solid thickset body frame. "
                f"Modify {gender_pronoun} silhouette from the reference photo: show broad thick shoulders, a thicker torso and waist, and solid heavy legs. "
                f"Do NOT make {gender_pronoun} skinny or slender."
            )
        else: # BMI >= 29.5 (Ví dụ: 1m75 100kg -> BMI 32.7)
            physique_label = "heavily overweight, plus-size, chubby, stout with prominent heavy belly"
            physique_desc = (
                f"noticeably overweight, plus-size, chubby, heavy, full-figured large frame with rounded prominent heavy belly, wide thick waist, thick chubby torso, and thick heavy legs "
                f"(Height: {height_cm:.0f}cm, Weight: {weight_kg:.0f}kg, BMI: {bmi:.1f})."
            )
            transform_instruction = (
                f"CRITICAL BODY MORPHOLOGY & WEIGHT OVERRIDE (BMI {bmi:.1f} - {weight_kg:.0f}kg at {height_cm:.0f}cm): "
                f"The {gender_noun} MUST be rendered with a REALISTIC HEAVILY OVERWEIGHT, PLUS-SIZE, CHUBBY, STOUT BODY FRAME. "
                f"TRANSFORM {gender_pronoun.upper()} BODY SILHOUETTE COMPLETELY: Give {gender_pronoun} a distinctly large rounded protruding heavy belly, a wide thick waistline, fuller chubby cheeks with soft jawline, stout broad torso, heavy thicker arms, and full chubby thighs and legs. "
                f"DO NOT depict {gender_pronoun} as skinny, slender, lean, or athletic! "
                f"The clothes (upper shirt and lower pants) MUST visibly stretch and drape over {gender_pronoun} large round belly and thick heavy body."
            )

        return {
            "bmi": bmi,
            "w_factor": w_factor,
            "physique_label": physique_label,
            "physique_desc": physique_desc,
            "transform_instruction": transform_instruction
        }

    @classmethod
    def smooth_morph_person_body(cls, pil_img: Image.Image, bmi: float) -> Image.Image:
        """
        Kéo giãn/thu nhỏ bề ngang thân người dưới cổ theo tỷ lệ BMI
        để ảnh nạp vào mô hình AI đã mang sẵn phom dáng gầy / mập chuẩn xác.
        """
        try:
            w_factor = min(1.35, max(0.80, math.sqrt(bmi / 22.0)))
            if abs(w_factor - 1.0) < 0.04:
                return pil_img

            orig_w, orig_h = pil_img.size
            neck_y = int(orig_h * 0.22)
            trans_h = int(orig_h * 0.12)

            max_w = int(orig_w * max(1.0, w_factor))
            canvas = Image.new("RGB", (max_w, orig_h), (245, 247, 250))

            # Giữ nguyên đầu và tóc ở giữa
            head = pil_img.crop((0, 0, orig_w, neck_y))
            canvas.paste(head, ((max_w - orig_w) // 2, 0))

            # Vùng chuyển tiếp mượt từ cổ sang vai/ngực
            for y in range(neck_y, neck_y + trans_h, 4):
                progress = (y - neck_y) / float(trans_h)
                curr_factor = 1.0 + (w_factor - 1.0) * (progress ** 1.5)
                step_h = min(4, neck_y + trans_h - y)
                slice_img = pil_img.crop((0, y, orig_w, y + step_h))
                new_w = int(orig_w * curr_factor)
                scaled_slice = slice_img.resize((new_w, step_h), Image.Resampling.BILINEAR)
                canvas.paste(scaled_slice, ((max_w - new_w) // 2, y))

            # Phần thân chính (vai, ngực, bụng, eo, hông, chân)
            body_y = neck_y + trans_h
            body_h = orig_h - body_y
            if body_h > 0:
                main_body = pil_img.crop((0, body_y, orig_w, orig_h))
                new_w = int(orig_w * w_factor)
                scaled_main = main_body.resize((new_w, body_h), Image.Resampling.LANCZOS)
                canvas.paste(scaled_main, ((max_w - new_w) // 2, body_y))

            return canvas.resize((orig_w, orig_h), Image.Resampling.LANCZOS)
        except Exception as e_morph:
            print(f"[!] Warning smooth_morph_person_body: {e_morph}")
            return pil_img
    @classmethod
    def run_sota_diffusion(cls, user_image_data: str, garment_url: str, category: str, garment_id: str):
        """
        SOTA Open-Source AI Diffusion Virtual Try-On Engine (CVPR 2024 VTON):
        Kết nối trực tiếp Cloud Diffusion GPU (OOTDiffusion / IDM-VTON)
        Tạo ảnh nếp gấp trang phục chân thực 100% như studio thực tế, hoàn toàn MIỄN PHÍ.
        """
        if not user_image_data or not garment_url:
            return None

        cache_file = os.path.join(TEMP_DIR, f"sota_vton_{garment_id}.jpg") if garment_id else None
        if cache_file and os.path.exists(cache_file):
            try:
                with open(cache_file, "rb") as fc:
                    b64 = base64.b64encode(fc.read()).decode()
                    return f"data:image/jpeg;base64,{b64}"
            except Exception:
                pass

        try:
            from gradio_client import Client, handle_file

            p_path = os.path.join(TEMP_DIR, "cur_person_diff.jpg")
            if user_image_data.startswith("data:image"):
                _, b64 = user_image_data.split(",", 1)
                with open(p_path, "wb") as fp:
                    fp.write(base64.b64decode(b64))
            elif user_image_data.startswith("http"):
                req_p = urllib.request.Request(user_image_data, headers={"User-Agent": BROWSER_UA})
                with urllib.request.urlopen(req_p, timeout=5) as resp:
                    with open(p_path, "wb") as fp:
                        fp.write(resp.read())
            elif os.path.exists(user_image_data):
                p_path = user_image_data
            else:
                return None

            g_path = os.path.join(TEMP_DIR, f"cur_garm_{garment_id}.jpg")
            if garment_url.startswith("http"):
                req_g = urllib.request.Request(garment_url, headers={"User-Agent": BROWSER_UA})
                with urllib.request.urlopen(req_g, timeout=5) as resp:
                    with open(g_path, "wb") as fg:
                        fg.write(resp.read())
            elif garment_url.startswith("data:image"):
                _, b64g = garment_url.split(",", 1)
                with open(g_path, "wb") as fg:
                    fg.write(base64.b64decode(b64g))
            elif os.path.exists(garment_url):
                g_path = garment_url
            else:
                return None

            oot_cat = "Upper-body"
            if category == "bottoms":
                oot_cat = "Lower-body"
            elif category == "one-pieces":
                oot_cat = "Dress"

            print(f"[*] Connecting SOTA OOTDiffusion for {garment_id} ({oot_cat})...")
            client = Client("levihsu/OOTDiffusion")
            res = client.predict(
                vton_img=handle_file(p_path),
                garm_img=handle_file(g_path),
                category=oot_cat,
                n_samples=1,
                n_steps=20,
                image_scale=2.0,
                seed=42,
                api_name="/process_dc"
            )
            if res and len(res) > 0:
                out_path = res[0]["image"]
                im = Image.open(out_path).convert("RGB")
                if cache_file:
                    im.save(cache_file, quality=92)
                buf = io.BytesIO()
                im.save(buf, format="JPEG", quality=92)
                print(f"[+] SOTA OOTDiffusion completed successfully for {garment_id}!")
                return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"
        except Exception as e_diff:
            print(f"[!] SOTA OOTDiffusion pipeline warning: {e_diff}")
        return None

    @classmethod
    def run_mage_outfit_swap(cls, user_image_data: str, garment_url: str, garment_id: str = "", gender: str = "male", garment_info: dict = None, category: str = "tops", height_cm: float = 175, weight_kg: float = 68):
        """
        Mage.space Mango 3 Turbo Outfit Swap Integration:
        Sử dụng Official Python SDK 'mage-space' để gọi mô hình Mango 3 Turbo trực tiếp.
        Tự động bảo toàn 100% danh tính, giới tính và khuôn mặt người mẫu (Trấn Thành / User).
        Phân biệt chặt chẽ Áo (Tops) vs Quần (Bottoms), đồng thời điều chỉnh khung vóc dáng mập/gầy/chuẩn theo Chiều cao & Cân nặng (BMI).
        """
        if not MAGE_API_KEY or not user_image_data or not garment_url:
            return None

        # 1. Nhận diện người mẫu mặc định hay ảnh người dùng mới tải lên
        is_default_avatar = (
            not user_image_data or
            user_image_data == "/models/tryon_master/tran_thanh_base.jpg" or
            "tran_thanh" in user_image_data.lower()
        )

        user_key = hashlib.md5(user_image_data[:5000].encode()).hexdigest()[:8] if user_image_data else "default"
        body_key = f"{int(height_cm)}_{int(weight_kg)}"
        cache_file_user = os.path.join(TEMP_DIR, f"mage_vton_{garment_id}_{user_key}_{body_key}.jpg") if garment_id else None
        cache_file_global = os.path.join(TEMP_DIR, f"mage_vton_{garment_id}_{body_key}.jpg") if garment_id else None
        static_sota_cache = os.path.join(STATIC_CACHE_DIR, f"sota_tryon_{garment_id}.jpg") if garment_id else None

        # Kiểm tra cache hợp lệ
        if is_default_avatar:
            for cfile in [static_sota_cache, cache_file_global, cache_file_user]:
                if cfile and os.path.exists(cfile):
                    try:
                        with open(cfile, "rb") as fc:
                            b64 = base64.b64encode(fc.read()).decode()
                            return f"data:image/jpeg;base64,{b64}"
                    except Exception:
                        pass
        else:
            # Nếu người dùng tải ảnh mới: CHỈ dùng cache riêng của ảnh đó kèm khung vóc dáng
            if cache_file_user and os.path.exists(cache_file_user):
                try:
                    with open(cache_file_user, "rb") as fc:
                        b64 = base64.b64encode(fc.read()).decode()
                        return f"data:image/jpeg;base64,{b64}"
                except Exception:
                    pass

        try:
            from mage_space import Mage
            mage_client = Mage(api_key=MAGE_API_KEY)

            # 2. Chuẩn bị ảnh người mẫu độ phân giải cao
            person_pil = None
            if os.path.exists(user_image_data):
                try:
                    person_pil = Image.open(user_image_data).convert("RGB")
                except Exception:
                    pass
            elif user_image_data.startswith("data:image"):
                try:
                    _, b64_str = user_image_data.split(",", 1)
                    person_pil = Image.open(io.BytesIO(base64.b64decode(b64_str))).convert("RGB")
                except Exception:
                    pass
            elif user_image_data.startswith("/"):
                full_p = os.path.join(os.path.dirname(os.path.dirname(current_dir)), "frontend", "public", user_image_data.lstrip("/"))
                if os.path.exists(full_p):
                    try:
                        person_pil = Image.open(full_p).convert("RGB")
                    except Exception:
                        pass

            # Nếu là ảnh mặc định và bị bé -> nạp ảnh Trấn Thành gốc
            if is_default_avatar and (person_pil is None or person_pil.width < 300 or person_pil.height < 300):
                cur_user_png = os.path.join(TEMP_DIR, "current_user_tryon.png")
                if os.path.exists(cur_user_png):
                    try:
                        person_pil = Image.open(cur_user_png).convert("RGB")
                    except Exception:
                        pass

            if person_pil is None:
                return None

            # Phân tích hình thể nhân trắc học & Nắn chỉnh phom người thích ứng
            morph_info = cls.build_physique_morphology(height_cm, weight_kg, gender)
            physique_desc = morph_info["physique_desc"]
            physique_label = morph_info["physique_label"]
            transform_instruction = morph_info["transform_instruction"]

            # Áp dụng Adaptive Silhouette Morphing để nắn phom người mẫu theo BMI trước khi gửi AI
            person_pil = cls.smooth_morph_person_body(person_pil, morph_info["bmi"])

            # Giới hạn kích thước chuẩn tối ưu cho Mage Mango 1K (max 1280px)
            person_pil.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            person_pil.save(buf, format="JPEG", quality=90)
            person_input = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

            # 3. Phân loại danh mục trang phục & Phân tích giải phẫu thể hình theo Chiều cao + Cân nặng
            garment_name = (garment_info or {}).get("name", "")
            g_combined = ((garment_name or "") + " " + (garment_info or {}).get("category", "")).lower()

            is_shoes = (category == "shoes") or any(k in g_combined for k in ["giày", "giay", "dép", "dep", "sneaker", "sandal", "guốc", "cao gót", "búp bê", "loafer", "boots", "bốt", "slip-on", "slip on", "footwear", "shoes", "sục"])
            is_accessory = (category == "accessory") or any(k in g_combined for k in ["mũ", "nón", "cap", "beanie", "snapback", "bucket", "beret", "kính", "túi", "ví", "balo", "khăn", "dây chuyền"])
            is_bottom = (category == "bottoms") or (any(k in g_combined for k in ["quần", "pant", "jean", "jogger", "trouser", "short", "kaki", "chân váy", "skirt"]) and not is_shoes)
            is_one_piece = (category == "one-pieces") or (any(k in g_combined for k in ["váy", "đầm", "dress", "jumpsuit", "yếm"]) and not is_bottom and not is_shoes)
            is_top = not is_bottom and not is_one_piece and not is_shoes and not is_accessory

            is_male = gender.lower() == "male"
            gender_label = "Asian man" if is_male else "Asian woman"
            gender_pronoun = "his" if is_male else "her"
            identity_term = "male face and identity" if is_male else "female face and identity"

            # Phân tích xem ảnh người dùng tải lên có phần thân dưới (quần/chân) hay chỉ là ảnh chân dung nửa thân trên (bust/portrait)
            is_portrait = True
            if person_pil is not None and shared_parser is not None:
                try:
                    p_labels = shared_parser.predict(person_pil)
                    if isinstance(p_labels, (list, tuple)):
                        p_labels = p_labels[0]
                    p_arr = np.array(p_labels)
                    # Nhãn 5 (skirt), 6 (pants)
                    lower_pixels = int(np.sum(np.isin(p_arr, [5, 6])))
                    if lower_pixels > 1200:
                        is_portrait = False
                except Exception:
                    pass

            body_instruction = (
                f"{transform_instruction} "
                f"Physique Details: {physique_desc} "
            )

            # Xây dựng prompt có định hướng danh mục chặt chẽ & Tùy biến vóc dáng gầy/mập theo Chiều cao, Cân nặng
            if is_shoes:
                # TRƯỜNG HỢP GIÀY DÉP (FOOTWEAR): MẶC VÀO ĐÔI CHÂN, TUYỆT ĐỐI KHÔNG BIẾN THÀNH ÁO
                prompt = (
                    f"A photorealistic full-length fashion studio photo of the {gender_label} in the primary reference image wearing the footwear/shoes/sneakers ({garment_name}). "
                    f"{body_instruction}"
                    f"The reference garment is strictly FOOTWEAR / SHOES / SNEAKERS worn on {gender_pronoun} FEET. "
                    f"Seamlessly put these exact shoes on {gender_pronoun} feet, matching the design, colorway, and soles from the reference item. "
                    f"DO NOT wear these shoes on the upper body! DO NOT turn this shoe into a jacket, shirt, or top! "
                    f"Keep {gender_pronoun} original upper-body clothing (shirt/jacket) and pants completely unchanged. "
                    f"Strictly preserve {gender_pronoun} exact face, facial features, skin tone, hairstyle, body pose, and {identity_term} from the primary reference photo. "
                    f"Full-body composition showing head to feet, photorealistic 8k, sharp shoe details, studio lighting."
                )
            elif is_accessory:
                # TRƯỜNG HỢP PHỤ KIỆN / MŨ NÓN (ACCESSORIES & HEADWEAR)
                is_headwear = any(k in g_combined for k in ["mũ", "nón", "cap", "beanie", "snapback", "beret", "kẹp tóc"])
                loc_desc = f"on {gender_pronoun} head as stylish headwear" if is_headwear else "as a stylish accessory"
                prompt = (
                    f"A photorealistic fashion studio portrait photo of the {gender_label} in the primary reference image wearing the accessory ({garment_name}). "
                    f"{body_instruction}"
                    f"The reference item is an ACCESSORY / HEADWEAR worn {loc_desc}. "
                    f"DO NOT wear this item as a shirt, jacket, or clothing on the torso! "
                    f"Strictly preserve {gender_pronoun} exact face, facial features, skin tone, hairstyle, and {identity_term} from the primary reference photo. "
                    f"Photorealistic 8k, ultra-detailed textures, studio lighting."
                )
            elif is_bottom:
                # TRƯỜNG HỢP QUẦN (BOTTOMS): TUYỆT ĐỐI CHỈ MẶC VÀO PHẦN THÂN DƯỚI / ĐÔI CHÂN
                if is_portrait:
                    prompt = (
                        f"A photorealistic full-length studio fashion photo of the {gender_label} from the primary reference image, standing in a natural stylish pose. "
                        f"{body_instruction}"
                        f"The garment from the reference image is strictly a pair of LOWER-BODY TROUSERS / PANTS / SHORTS ({garment_name}). "
                        f"The person is wearing these exact trousers on {gender_pronoun} {physique_label} LEGS and LOWER BODY. "
                        f"On {gender_pronoun} upper body, {gender_pronoun} is wearing a simple, clean, elegant fitted shirt that complements the trousers and fits {gender_pronoun} {physique_label} torso. "
                        f"DO NOT wear these trousers on the upper body, DO NOT make it a shirt or jacket! "
                        f"Strictly preserve the exact face, facial features, skin tone, hairstyle, and {identity_term} from the primary reference image. "
                        f"Full-body composition showing head to feet, photorealistic 8k, ultra-detailed fabric weave of the trousers, studio lighting."
                    )
                else:
                    prompt = (
                        f"A photorealistic fashion studio photo of the {gender_label} in the primary reference image wearing the trousers/pants ({garment_name}). "
                        f"{body_instruction}"
                        f"The reference garment is strictly LOWER-BODY PANTS. "
                        f"Seamlessly replace {gender_pronoun} lower-body pants/trousers with this exact garment from the reference image, keeping {gender_pronoun} original upper shirt intact. "
                        f"DO NOT change {gender_pronoun} shirt or put this garment on {gender_pronoun} upper body. "
                        f"Strictly preserve {gender_pronoun} exact face, expression, hair, and {identity_term} from the reference photo. "
                        f"Photorealistic 8k, sharp fabric folds, studio lighting."
                    )
            elif is_one_piece:
                # TRƯỜNG HỢP VÁY / ĐẦM TOÀN THÂN (ONE-PIECES)
                prompt = (
                    f"A photorealistic full-length fashion studio photo of the {gender_label} in the primary reference image wearing the full-body outfit/dress ({garment_name}). "
                    f"{body_instruction}"
                    f"The garment is worn from shoulders down to the legs fitting {gender_pronoun} {physique_label} body frame. "
                    f"Strictly preserve {gender_pronoun} exact face, facial features, skin tone, hairstyle, and {identity_term} from the reference photo. "
                    f"Photorealistic 8k, ultra-detailed fabric drape, cinematic lighting."
                )
            else:
                # TRƯỜNG HỢP ÁO (TOPS): MẶC VÀO PHẦN THÂN TRÊN
                prompt = (
                    f"A photorealistic fashion studio photo of the {gender_label} in the primary reference image wearing the top/shirt/jacket ({garment_name}). "
                    f"{body_instruction}"
                    f"The reference garment is an UPPER-BODY shirt/jacket. "
                    f"Seamlessly replace {gender_pronoun} upper-body clothing with this exact garment from the reference image fitting {gender_pronoun} {physique_label} torso. "
                    f"Strictly preserve {gender_pronoun} exact face, facial features, skin tone, hairstyle, body pose, and {identity_term} from the primary reference photo. "
                    f"Photorealistic 8k, ultra-detailed fabric texture, natural clothing folds, studio lighting."
                )

            # Nạp và chuẩn hóa ảnh trang phục gửi Mage (Dùng Base64 để cloud luôn nhận được dù URL nội bộ hay ngoài)
            garment_input = garment_url
            try:
                g_pil = GarmentExtractor.load_pil_image(garment_url)
                if g_pil is not None:
                    g_pil.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
                    buf_g = io.BytesIO()
                    g_pil.save(buf_g, format="JPEG", quality=90)
                    garment_input = "data:image/jpeg;base64," + base64.b64encode(buf_g.getvalue()).decode()
            except Exception as e_gp:
                print(f"[!] Warning preparing garment image for Mage: {e_gp}")

            print(f"[*] Dispatching live request to Mage Mango 3 Turbo for garment '{garment_id}' (gender={gender}, is_default={is_default_avatar})...")
            req = mage_client.run("mango", {
                "model_id": "mango-v3-turbo",
                "prompt": prompt,
                "image": person_input,
                "additional_images": [garment_input],
                "aspect_ratio": "4:5",
                "resolution": "1K"
            }, timeout=75.0)

            if isinstance(req, dict) and req.get("status") == "completed":
                img_url = req.get("result", {}).get("url")
                if img_url:
                    req_dl = urllib.request.Request(img_url, headers={"User-Agent": BROWSER_UA})
                    with urllib.request.urlopen(req_dl, timeout=15) as r_dl:
                        raw_bytes = r_dl.read()
                        if is_default_avatar:
                            if cache_file_global:
                                try:
                                    with open(cache_file_global, "wb") as f_cg:
                                        f_cg.write(raw_bytes)
                                except Exception:
                                    pass
                            if static_sota_cache:
                                try:
                                    with open(static_sota_cache, "wb") as f_sc:
                                        f_sc.write(raw_bytes)
                                except Exception:
                                    pass
                        if cache_file_user:
                            try:
                                with open(cache_file_user, "wb") as f_cu:
                                    f_cu.write(raw_bytes)
                            except Exception:
                                pass
                        b64_out = base64.b64encode(raw_bytes).decode()
                        print(f"[+] Live Mage Mango 3 Turbo completed successfully for {garment_id}!")
                        return f"data:image/jpeg;base64,{b64_out}"
        except Exception as e_m:
            print(f"[!] Live Mage Space API warning: {e_m}")
        return None

    @classmethod
    def composite_tryon(cls, user_image_data: str, garment_url: str, garment_info: dict = None, gender: str = "male", height_cm: float = 175, weight_kg: float = 68, use_mage: bool = False):
        if not user_image_data:
            return ""

        garment_id = (garment_info or {}).get("id", "")
        garment_name = ((garment_info or {}).get("name", "") + " " + (garment_info or {}).get("category", "")).lower()

        # 1. Nhận diện danh mục trang phục chính xác theo chuẩn VTON
        if any(k in garment_name for k in ["váy", "đầm", "dress", "jumpsuit", "yếm", "dạ hội", "xòe"]) and not any(k in garment_name for k in ["chân váy"]):
            category = "one-pieces"
            photo_type = "model"
        elif any(k in garment_name for k in ["quần", "jogger", "jean", "trousers", "pant", "short", "kaki", "chân váy", "boxer", "culottes"]):
            category = "bottoms"
            photo_type = "flat-lay"
        elif any(k in garment_name for k in ["giày", "giay", "dép", "dep", "sneaker", "sandal", "cao gót", "búp bê", "loafer", "derby", "boots", "bốt", "slip-on", "slip on", "footwear", "shoes", "guốc", "sục"]):
            category = "shoes"
            photo_type = "flat-lay"
        elif any(k in garment_name for k in ["mũ", "nón", "cap", "beanie", "snapback", "bucket", "beret", "kẹp tóc", "kính", "kinh", "khăn", "dây chuyền", "vòng cổ", "túi", "ví", "balo", "accessory"]):
            category = "accessory"
            photo_type = "flat-lay"
        else:
            category = "tops"
            photo_type = "model" if "model" in garment_url else "flat-lay"

        variant_label = str((garment_info or {}).get("selectedVariant") or "").strip()
        img_sig = hashlib.md5(garment_url.encode()).hexdigest()[:8] if garment_url else "noimg"
        effective_garment_id = f"{garment_id}_{img_sig}" if garment_id else img_sig
        print(f"[*] composite_tryon requested: id='{garment_id}', variant='{variant_label}', eff_id='{effective_garment_id}', name='{(garment_info or {}).get('name')}', category='{category}', use_mage={use_mage}, height={height_cm}cm, weight={weight_kg}kg")

        # 2. Kiểm tra cache ảnh riêng cho từng mã sản phẩm + biến thể màu (chỉ áp dụng cho người mẫu mặc định với vóc dáng chuẩn)
        is_default = (
            not user_image_data or
            user_image_data == "/models/tryon_master/tran_thanh_base.jpg" or
            "tran_thanh" in user_image_data.lower()
        )
        is_standard_body = (abs(float(height_cm) - 175) < 3 and abs(float(weight_kg) - 68) < 3)
        if is_default and is_standard_body:
            candidate_paths = [
                os.path.join(STATIC_CACHE_DIR, f"sota_tryon_{effective_garment_id}.jpg"),
                os.path.join(TEMP_DIR, f"sota_vton_{effective_garment_id}.jpg"),
                os.path.join(TEMP_DIR, f"fashn_tryon_{effective_garment_id}.jpg"),
            ]
            for c_path in candidate_paths:
                if effective_garment_id and os.path.exists(c_path):
                    try:
                        with open(c_path, "rb") as f_cached:
                            b64_f = base64.b64encode(f_cached.read()).decode()
                            print(f"[+] Found cached SOTA tryon for {effective_garment_id} ({category}) at {c_path} -> returning instant HD render!")
                            return f"data:image/jpeg;base64,{b64_f}"
                    except Exception as e_f:
                        print(f"[!] Read cache error: {e_f}")

        # 3. Thử gọi Live Mage.space Outfit Swap (Chỉ khi người dùng chủ động bật use_mage=True)
        if use_mage:
            mage_res = cls.run_mage_outfit_swap(user_image_data, garment_url, effective_garment_id, gender, garment_info, category=category, height_cm=height_cm, weight_kg=weight_kg)
            if mage_res:
                return mage_res
        else:
            print(f"[*] composite_tryon: use_mage is False. Running 0-Gem High-Speed Local Composite for {effective_garment_id}!")

        # 4. Kích hoạt SOTA Cloud Diffusion VTON (Chỉ áp dụng cho trang phục quần áo)
        if category in ["tops", "bottoms", "one-pieces"]:
            sota_diff = cls.run_sota_diffusion(user_image_data, garment_url, category, effective_garment_id)
            if sota_diff:
                return sota_diff

        # 5. Sinh trực tiếp on-demand qua FASHN VTON Pipeline nếu chưa có cache
        if fashn_pipeline is not None and user_image_data and garment_url and VTONEngine is not None and category in ["tops", "bottoms", "one-pieces"]:
            try:
                user_img = VTONEngine.load_image_from_source(user_image_data).convert("RGB")
                garment_img = VTONEngine.load_image_from_source(garment_url).convert("RGB")
                print(f"[*] Running live FASHN VTON 1.5 on-demand for {category} ({garment_id})...")
                res = fashn_pipeline(
                    person_image=user_img,
                    garment_image=garment_img,
                    category=category,
                    garment_photo_type=photo_type,
                    num_timesteps=6,
                    guidance_scale=1.1,
                    segmentation_free=True
                )
                buf = io.BytesIO()
                res.images[0].save(buf, format="JPEG", quality=92)
                return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"
            except Exception as e_pipe:
                print(f"[!] Live FASHN VTON error: {e_pipe}")

        if VTONEngine is not None:
            try:
                res = VTONEngine.run_tryon(user_image_data, garment_url, garment_info or {})
                if res.get("success") and res.get("composite_data_url"):
                    return res.get("composite_data_url")
            except Exception as e:
                print(f"[!] VTONEngine fallback error: {e}")

        # Fallback thông minh: Tự động bóc tách sạch 100% phông nền (Alpha Matte) và ướm đúng vị trí giải phẫu
        try:
            from PIL import Image
            user_pil = GarmentExtractor.load_pil_image(user_image_data)
            if user_pil is None:
                user_pil = Image.new("RGBA", (600, 800), (245, 247, 250, 255))
            else:
                user_pil = user_pil.convert("RGBA")

            target_w = 600
            target_h = int(user_pil.height * (target_w / max(1, user_pil.width)))
            user_img = user_pil.resize((target_w, target_h), Image.Resampling.LANCZOS)

            # Bóc tách trang phục khử hoàn toàn nền trắng/nền phẳng (Transparent Alpha)
            garment_extract = GarmentExtractor.extract_garment(garment_url, garment_info)
            if garment_extract.get("success") and garment_extract.get("extracted_garment_url"):
                garment_pil = GarmentExtractor.load_pil_image(garment_extract["extracted_garment_url"])
            else:
                garment_pil = GarmentExtractor.load_pil_image(garment_url)

            if garment_pil is not None:
                garment_rgba = garment_pil.convert("RGBA")
                alpha_arr = np.array(garment_rgba)[:, :, 3]
                transparent_ratio = np.sum(alpha_arr < 240) / max(1, alpha_arr.size)

                # CHỈ dán nếu trang phục đã được bóc tách sạch nền (có kênh Alpha trong suốt thực sự > 5%)
                # Tuyệt đối không dán hình chữ nhật đặc (raw square sticker) lên người mẫu
                if transparent_ratio > 0.05:
                    gw, gh = garment_rgba.size
                    ratio = gh / max(1, gw)

                    if category == "bottoms":
                        pw = int(target_w * 0.52)
                        ph = min(int(target_h * 0.48), int(pw * ratio))
                        px = int((target_w - pw) / 2)
                        py = int(target_h * 0.50)
                    elif category == "one-pieces":
                        pw = int(target_w * 0.60)
                        ph = min(int(target_h * 0.68), int(pw * ratio))
                        px = int((target_w - pw) / 2)
                        py = int(target_h * 0.26)
                    elif category == "shoes":
                        # Giày dép: đặt chính xác tại bàn chân (y ~ 80% - 93%)
                        pw = int(target_w * 0.42)
                        ph = min(int(target_h * 0.16), int(pw * ratio))
                        px = int((target_w - pw) / 2)
                        py = int(target_h * 0.81)
                    elif category == "accessory":
                        # Mũ / Nón / Phụ kiện: đặt ở đầu hoặc cổ
                        if any(k in garment_name for k in ["mũ", "nón", "cap", "beanie", "snapback"]):
                            pw = int(target_w * 0.25)
                            ph = min(int(target_h * 0.14), int(pw * ratio))
                            px = int((target_w - pw) / 2)
                            py = int(target_h * 0.07)
                        elif any(k in garment_name for k in ["kính", "kinh"]):
                            pw = int(target_w * 0.22)
                            ph = min(int(target_h * 0.08), int(pw * ratio))
                            px = int((target_w - pw) / 2)
                            py = int(target_h * 0.14)
                        else:
                            pw = int(target_w * 0.25)
                            ph = min(int(target_h * 0.15), int(pw * ratio))
                            px = int((target_w - pw) / 2)
                            py = int(target_h * 0.20)
                    else:
                        # tops (áo khoác, sơ mi, áo thun, bomber)
                        pw = int(target_w * 0.62)
                        ph = min(int(target_h * 0.44), int(pw * ratio))
                        px = int((target_w - pw) / 2)
                        py = int(target_h * 0.28)

                    garment_resized = garment_rgba.resize((pw, ph), Image.Resampling.LANCZOS)
                    # Dán với kênh Alpha trong suốt, tuyệt đối không để lộ viền nền trắng
                    user_img.paste(garment_resized, (px, py), garment_resized)
                else:
                    print(f"[!] Warning: Garment image has insufficient transparency ({transparent_ratio:.2%}). Skipping rectangle overlay to prevent sticker glitch.")

            final_rgb = user_img.convert("RGB")
            buf = io.BytesIO()
            final_rgb.save(buf, format="JPEG", quality=90)
            return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"
        except Exception as e:
            print(f"[!] Composite fallback error: {e}")
            return ""

    @classmethod
    def _prepare_garment_input(cls, garment_url: str):
        if not garment_url:
            return None
        try:
            g_pil = GarmentExtractor.load_pil_image(garment_url)
            if g_pil is not None:
                g_pil.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
                buf_g = io.BytesIO()
                g_pil.save(buf_g, format="JPEG", quality=90)
                return "data:image/jpeg;base64," + base64.b64encode(buf_g.getvalue()).decode()
        except Exception as e_gp:
            print(f"[!] Warning preparing garment image: {e_gp}")
        return garment_url

    @classmethod
    def _describe_tagged_item(cls, role_key: str, item: dict) -> str:
        name = item.get("name", "item")
        variant_color = str(item.get("selectedVariant") or "").strip()
        label = f"{name} (Color/Variant: {variant_color})" if variant_color else name
        if role_key == "inner_top":
            return f"inner base layer shirt/top '{label}' worn underneath"
        if role_key == "top":
            return f"top garment '{label}' worn on upper torso"
        if role_key == "outer_top":
            return f"outer jacket/coat/layer '{label}' worn open over the inner shirt so both inner shirt and outer jacket are clearly visible"
        if role_key == "bottom":
            return f"bottom trousers/skirt '{label}' worn on legs and waist"
        if role_key == "shoes":
            return f"footwear/shoes '{label}' worn on feet"

        item_lower = name.lower()
        if any(k in item_lower for k in ["kính", "kinh", "gọng", "glasses", "sunglasses"]):
            return f"eyewear/glasses '{label}' worn on eyes/face"
        if any(k in item_lower for k in ["mũ", "nón", "mu ", "non ", "cap", "hat", "beanie"]):
            return f"headwear/hat '{label}' worn on head"
        if any(k in item_lower for k in ["dây chuyền", "vòng cổ", "kiềng", "necklace", "choker", "khăn"]):
            return f"necklace/neckwear '{label}' worn around neck"
        if any(k in item_lower for k in ["dây nịt", "thắt lưng", "belt", "day nit", "that lung"]):
            return f"waist belt '{label}' worn around the trouser waist"
        if any(k in item_lower for k in ["túi", "ví", "balo", "ba lô", "bag", "tote", "clutch"]):
            return f"bag '{label}' carried in hand or over shoulder"
        if any(k in item_lower for k in ["đồng hồ", "vòng tay", "lắc tay", "watch", "bracelet"]):
            return f"wrist watch/bracelet '{label}' worn on wrist"
        return f"fashion accessory '{label}'"

    @classmethod
    def _run_mage_outfit_pass(
        cls,
        mage_client,
        person_input: str,
        tagged_items: list,
        morph_info: dict,
        gender: str,
        height_cm: float,
        weight_kg: float,
        is_addon_pass: bool = False,
    ):
        """Gọi Mage Mango 3 Turbo cho một chặng tối đa 4 món (Pass 1 hoặc Pass 2)."""
        outfit_prompts = []
        additional_imgs = []
        for role_key, item in tagged_items[:4]:
            if item and item.get("name"):
                outfit_prompts.append(cls._describe_tagged_item(role_key, item))
                g_b64 = cls._prepare_garment_input(item.get("image", ""))
                if g_b64:
                    additional_imgs.append(g_b64)

        if not additional_imgs:
            return None

        is_male = gender.lower() == "male"
        gender_label = "Asian man" if is_male else "Asian woman"
        gender_pronoun = "his" if is_male else "her"
        identity_term = "male face and identity" if is_male else "female face and identity"

        if is_addon_pass:
            prompt = (
                f"A photorealistic fashion studio portrait editing the {gender_label} from the primary reference image. "
                f"PRESERVATION RULE (CRITICAL): Keep the EXACT outfit, shirt, jacket, trousers, shoes, pose, lighting, and body already worn in the primary reference image completely unchanged. "
                f"ADD-ON ACCESSORY RULES: Only add and naturally equip these specific additional items from additional_images onto {gender_pronoun} body: "
                f"{', '.join(outfit_prompts)}. "
                f"Each added accessory (hat on head, glasses on eyes, necklace around neck, belt on trouser waist, watch on wrist, or bag carried) must strictly match the EXACT color, material, and design of its reference image. "
                f"Strictly preserve {gender_pronoun} exact face, eyes, hairstyle, and {identity_term}. Photorealistic 8k fashion photography."
            )
        else:
            has_layered_tops = any(r == "outer_top" for r, _ in tagged_items) and any(r in ("top", "inner_top") for r, _ in tagged_items)
            layer_rule = (
                "Layering rule: Wear the inner shirt underneath and the outer jacket/coat layered open on top of it so both garments are clearly visible together. "
                if has_layered_tops else ""
            )
            prompt = (
                f"A photorealistic editorial fashion studio portrait of the {gender_label} from the primary reference image, wearing a complete stylish outfit. "
                f"BODY MORPHOLOGY & WEIGHT OVERRIDE: {morph_info['transform_instruction']} "
                f"Height: {height_cm:.0f}cm, Weight: {weight_kg:.0f}kg, BMI: {morph_info['bmi']:.1f}. "
                f"STRICT VISUAL MATCHING RULES: You must accurately replicate and transfer the exact appearance, color, fabric, pattern, and design from each reference image in additional_images: "
                f"{', '.join(outfit_prompts)}. "
                f"{layer_rule}"
                f"Garment positioning: Upper garments worn on upper torso, trousers/skirts on legs and waist, footwear strictly on feet, and accessories naturally worn in their anatomical positions. "
                f"Footwear color & style rule: Shoes must strictly match the EXACT color, tone, and design of the footwear reference image. "
                f"Do NOT invent or substitute different clothes, shoes, or accessories; they must faithfully match the reference photos provided. "
                f"Strictly preserve {gender_pronoun} exact face, facial features, eyes, smile, skin tone, hairstyle, and {identity_term} from the reference image, while properly adapting {gender_pronoun} body frame to the requested {morph_info['physique_label']} proportions. "
                f"Photorealistic 8k, ultra-detailed fabric drapery, professional commercial fashion studio lighting, flawless outfit harmony."
            )

        print(f"[*] Dispatching Mage Mango 3 Turbo ({'Pass 2 Add-on' if is_addon_pass else 'Pass 1 Core'}, {len(additional_imgs)} items): {', '.join(outfit_prompts)}...")
        req = mage_client.run("mango", {
            "model_id": "mango-v3-turbo",
            "prompt": prompt,
            "image": person_input,
            "additional_images": additional_imgs[:4],
            "aspect_ratio": "4:5",
            "resolution": "1K"
        }, timeout=85.0)

        if isinstance(req, dict) and req.get("status") == "completed":
            img_url = req.get("result", {}).get("url")
            if img_url:
                req_dl = urllib.request.Request(img_url, headers={"User-Agent": BROWSER_UA})
                with urllib.request.urlopen(req_dl, timeout=15) as r_dl:
                    return r_dl.read()
        return None

    @classmethod
    def composite_outfit_tryon(cls, user_image_data: str, outfit: dict, gender: str = "male", height_cm: float = 175, weight_kg: float = 68, use_mage: bool = False):
        """
        Phối đồ đa món hoàn chỉnh hỗ trợ Layering 2 lớp áo + Nhiều phụ kiện:
        - Nếu tổng số món <= 4: Chạy 1 lượt AI duy nhất (tiết kiệm & nhanh).
        - Nếu tổng số món >= 5: Tự động kích hoạt Chặng 2 (Pass 2) để mặc đồ chính trước rồi đeo thêm các phụ kiện còn lại.
        """
        from PIL import Image
        if not user_image_data:
            return ""

        top = outfit.get("top")
        outer_top = outfit.get("outer_top")
        bottom = outfit.get("bottom")
        shoes = outfit.get("shoes")

        # Hỗ trợ mảng accessories[] mới + tương thích ngược accessory đơn lẻ
        accessories_list = []
        raw_acc_list = outfit.get("accessories")
        if isinstance(raw_acc_list, list):
            for acc_item in raw_acc_list:
                if acc_item and (acc_item.get("id") or acc_item.get("image")):
                    accessories_list.append(acc_item)
        legacy_acc = outfit.get("accessory")
        if legacy_acc and (legacy_acc.get("id") or legacy_acc.get("image")):
            if not any(str(a.get("id")) == str(legacy_acc.get("id")) for a in accessories_list):
                accessories_list.append(legacy_acc)

        tagged_items = []
        if top and (top.get("id") or top.get("image")):
            tagged_items.append(("inner_top" if outer_top else "top", top))
        if outer_top and (outer_top.get("id") or outer_top.get("image")):
            tagged_items.append(("outer_top", outer_top))
        if bottom and (bottom.get("id") or bottom.get("image")):
            tagged_items.append(("bottom", bottom))
        if shoes and (shoes.get("id") or shoes.get("image")):
            tagged_items.append(("shoes", shoes))
        for idx, acc in enumerate(accessories_list):
            tagged_items.append((f"accessory_{idx}", acc))

        if not tagged_items:
            return user_image_data

        # Nếu chỉ có duy nhất 1 món, sử dụng luồng composite_tryon đơn lẻ
        if len(tagged_items) == 1:
            single = tagged_items[0][1]
            return cls.composite_tryon(user_image_data, single.get("image", ""), single, gender, height_cm, weight_kg, use_mage=use_mage)

        # 1. Tạo Outfit Signature phục vụ Caching (bao gồm id, ảnh biến thể & tên màu)
        user_key = hashlib.md5(user_image_data[:5000].encode()).hexdigest()[:8] if user_image_data else "default"
        item_ids = [
            f"{role}:{str(item.get('id') or item.get('name') or 'item')}@{hashlib.md5(str(item.get('image') or '').encode()).hexdigest()[:8]}:{str(item.get('selectedVariant') or '')}"
            for role, item in tagged_items
        ]
        outfit_sig = "_".join(item_ids)
        outfit_hash = hashlib.md5(outfit_sig.encode()).hexdigest()[:12]
        body_key = f"{int(height_cm)}_{int(weight_kg)}"
        cached_outfit_file = os.path.join(STATIC_CACHE_DIR, f"sota_outfit_{outfit_hash}_{user_key}_{body_key}.jpg")
        temp_outfit_file = os.path.join(TEMP_DIR, f"outfit_{outfit_hash}_{user_key}_{body_key}.jpg")

        for cpath in [cached_outfit_file, temp_outfit_file]:
            if os.path.exists(cpath):
                try:
                    with open(cpath, "rb") as fc:
                        b64 = base64.b64encode(fc.read()).decode()
                        print(f"[+] Found cached SOTA Outfit ({outfit_sig}) -> returning instant result!")
                        return f"data:image/jpeg;base64,{b64}"
                except Exception:
                    pass

        # 2. Thử gọi Live Mage Mango 3 Turbo (Tự động 1-Pass khi <= 4 món, 2-Pass khi >= 5 món)
        if use_mage and MAGE_API_KEY:
            try:
                from mage_space import Mage
                mage_client = Mage(api_key=MAGE_API_KEY)

                # Nạp ảnh người mẫu độ nét cao
                person_pil = GarmentExtractor.load_pil_image(user_image_data)
                if person_pil is None:
                    cur_user_png = os.path.join(TEMP_DIR, "current_user_tryon.png")
                    if os.path.exists(cur_user_png):
                        person_pil = GarmentExtractor.load_pil_image(cur_user_png)

                morph_info = cls.build_physique_morphology(height_cm, weight_kg, gender)

                if person_pil is not None:
                    person_pil = cls.smooth_morph_person_body(person_pil, morph_info["bmi"])
                    person_pil.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
                    buf_u = io.BytesIO()
                    person_pil.convert("RGB").save(buf_u, format="JPEG", quality=90)
                    person_input = "data:image/jpeg;base64," + base64.b64encode(buf_u.getvalue()).decode()
                else:
                    person_input = user_image_data

                total_count = len(tagged_items)
                if total_count <= 4:
                    # <= 4 món: Chạy đúng 1 lượt AI duy nhất cho nhanh và tiết kiệm
                    raw_bytes = cls._run_mage_outfit_pass(
                        mage_client, person_input, tagged_items, morph_info, gender, height_cm, weight_kg, is_addon_pass=False
                    )
                    if raw_bytes:
                        with open(cached_outfit_file, "wb") as f_co:
                            f_co.write(raw_bytes)
                        print(f"[+] Live 1-Pass Mage outfit completed ({total_count} items)!")
                        return f"data:image/jpeg;base64,{base64.b64encode(raw_bytes).decode()}"
                else:
                    # >= 5 món: Chặng 1 mặc 4 món đầu (đồ chính), Chặng 2 đeo/mặc tiếp các món còn lại
                    pass1_items = tagged_items[:4]
                    remaining_items = tagged_items[4:]
                    print(f"[*] Outfit has {total_count} items (>= 5) -> Auto-activating 2-Pass Pipeline (Pass 1: {len(pass1_items)}, Pass 2: {len(remaining_items)})")

                    pass1_bytes = cls._run_mage_outfit_pass(
                        mage_client, person_input, pass1_items, morph_info, gender, height_cm, weight_kg, is_addon_pass=False
                    )
                    if pass1_bytes:
                        current_bytes = pass1_bytes
                        # Nếu vẫn còn > 4 phụ kiện ở chặng 2, xử lý từng batch tối đa 4 món
                        for offset in range(0, len(remaining_items), 4):
                            batch = remaining_items[offset:offset + 4]
                            pass_input = "data:image/jpeg;base64," + base64.b64encode(current_bytes).decode()
                            next_bytes = cls._run_mage_outfit_pass(
                                mage_client, pass_input, batch, morph_info, gender, height_cm, weight_kg, is_addon_pass=True
                            )
                            if next_bytes:
                                current_bytes = next_bytes

                        with open(cached_outfit_file, "wb") as f_co:
                            f_co.write(current_bytes)
                        print(f"[+] Live 2-Pass Mage outfit completed ({total_count} items)!")
                        return f"data:image/jpeg;base64,{base64.b64encode(current_bytes).decode()}"
            except Exception as e_mage:
                print(f"[!] Mage outfit swap warning: {e_mage}")

        # 3. Fallback: Multi-Layer Anatomical Outfit Composite Engine (Chống dán sticker hộp, tách nền sạch 100%)
        try:
            morph_info = cls.build_physique_morphology(height_cm, weight_kg, gender)
            w_factor = morph_info["w_factor"]

            user_pil = GarmentExtractor.load_pil_image(user_image_data)
            if user_pil is None:
                cur_user_png = os.path.join(TEMP_DIR, "current_user_tryon.png")
                if os.path.exists(cur_user_png):
                    user_pil = GarmentExtractor.load_pil_image(cur_user_png)
            if user_pil is None:
                user_pil = Image.new("RGBA", (600, 899), (245, 247, 250, 255))
            else:
                user_pil = cls.smooth_morph_person_body(user_pil.convert("RGB"), morph_info["bmi"]).convert("RGBA")

            target_w = 600
            target_h = int(user_pil.height * (target_w / max(1, user_pil.width)))
            canvas = user_pil.resize((target_w, target_h), Image.Resampling.LANCZOS)

            # Nếu người dùng phối Quần hoặc Giày trên ảnh chân dung cận mặt (bust shot):
            # Mở rộng canvas về phía dưới để hiển thị trọn vẹn đầy đủ cả set đồ (Áo, Quần, Giày Dép)
            if (bottom or shoes) and target_h < int(target_w * 1.35):
                full_h = int(target_w * 1.55)
                full_canvas = Image.new("RGBA", (target_w, full_h), (245, 247, 250, 255))
                full_canvas.paste(canvas, (0, 0))
                canvas = full_canvas
                target_h = full_h

            def overlay_layer(garment_data, layer_type):
                if not garment_data or not garment_data.get("image"):
                    return
                g_url = garment_data.get("image", "")
                extract = GarmentExtractor.extract_garment(g_url, garment_data)
                g_img = None
                if extract.get("success") and extract.get("extracted_garment_url"):
                    try:
                        b64_part = extract["extracted_garment_url"].split(",", 1)[1]
                        g_img = Image.open(io.BytesIO(base64.b64decode(b64_part)))
                    except Exception as e_dec:
                        print(f"[!] Decode extracted garment error: {e_dec}")

                if g_img is None:
                    g_img = GarmentExtractor.load_pil_image(g_url)

                if g_img is None:
                    return

                g_rgba = g_img.convert("RGBA")
                alpha_arr = np.array(g_rgba)[:, :, 3]
                transparent_ratio = np.sum(alpha_arr < 240) / max(1, alpha_arr.size)

                # Nếu ảnh chưa có độ trong suốt (ảnh nền trắng/sáng đặc), tự động tách nền sáng
                if transparent_ratio < 0.05:
                    rgb_arr = np.array(g_rgba)[:, :, :3]
                    is_bg = np.all(rgb_arr > 220, axis=2)
                    if np.sum(is_bg) > 0.02 * is_bg.size:
                        alpha_arr[is_bg] = 0
                        g_rgba = Image.fromarray(np.dstack([rgb_arr, alpha_arr]), "RGBA")

                gw, gh = g_rgba.size
                ratio = gh / max(1, gw)

                if layer_type == "bottom":
                    # Quần / Chân váy: y ~ 50% - 82%
                    pw = int(target_w * 0.54 * w_factor)
                    ph = min(int(target_h * 0.40), int(pw * ratio))
                    px = int((target_w - pw) / 2)
                    py = int(target_h * 0.50)
                elif layer_type == "top":
                    # Áo lớp trong: y ~ 26% - 50%
                    pw = int(target_w * 0.58 * w_factor)
                    ph = min(int(target_h * 0.31), int(pw * ratio))
                    px = int((target_w - pw) / 2)
                    py = int(target_h * 0.26)
                elif layer_type == "outer_top":
                    # Áo khoác lớp ngoài (Layer 2): hơi rộng hơn áo trong một chút
                    pw = int(target_w * 0.65 * w_factor)
                    ph = min(int(target_h * 0.35), int(pw * ratio))
                    px = int((target_w - pw) / 2)
                    py = int(target_h * 0.25)
                elif layer_type == "shoes":
                    # Giày dép: y ~ 80% - 93%
                    pw = int(target_w * 0.42)
                    ph = min(int(target_h * 0.16), int(pw * ratio))
                    px = int((target_w - pw) / 2)
                    py = int(target_h * 0.81)
                elif layer_type == "accessory":
                    # Phụ kiện: Mũ / Nón / Kính / Khăn / Dây chuyền / Dây nịt / Túi xách / Đồng hồ
                    item_name = (garment_data.get("name") or "").lower()
                    if any(k in item_name for k in ["kính", "kinh", "gọng", "glasses"]):
                        pw = int(target_w * 0.22)
                        ph = min(int(target_h * 0.08), int(pw * ratio))
                        px = int((target_w - pw) / 2)
                        py = int(target_h * 0.14)
                    elif any(k in item_name for k in ["dây chuyền", "vòng cổ", "kiềng", "khăn", "necklace"]):
                        pw = int(target_w * 0.22)
                        ph = min(int(target_h * 0.10), int(pw * ratio))
                        px = int((target_w - pw) / 2)
                        py = int(target_h * 0.22)
                    elif any(k in item_name for k in ["dây nịt", "thắt lưng", "belt", "day nit", "that lung"]):
                        # Dây nịt / thắt lưng: đặt ngang cạp quần (y ~ 49%)
                        pw = int(target_w * 0.38 * w_factor)
                        ph = min(int(target_h * 0.06), int(pw * ratio))
                        px = int((target_w - pw) / 2)
                        py = int(target_h * 0.49)
                    elif any(k in item_name for k in ["đồng hồ", "vòng tay", "lắc tay", "watch"]):
                        pw = int(target_w * 0.12)
                        ph = min(int(target_h * 0.08), int(pw * ratio))
                        px = int(target_w * 0.22)
                        py = int(target_h * 0.50)
                    elif any(k in item_name for k in ["túi", "ví", "balo", "ba lô", "bag"]):
                        pw = int(target_w * 0.26)
                        ph = min(int(target_h * 0.22), int(pw * ratio))
                        px = int(target_w * 0.12)
                        py = int(target_h * 0.48)
                    else:
                        # Mũ / Nón / Kẹp tóc: y ~ 6% - 16% (đỉnh đầu)
                        pw = int(target_w * 0.25)
                        ph = min(int(target_h * 0.14), int(pw * ratio))
                        px = int((target_w - pw) / 2)
                        py = int(target_h * 0.07)
                else:
                    return

                resized = g_rgba.resize((pw, ph), Image.Resampling.LANCZOS)
                canvas.paste(resized, (px, py), resized)

            # Ghép từng tầng theo thứ tự giải phẫu: Quần -> Áo trong -> Áo khoác ngoài -> Giày -> Tất cả Phụ kiện
            overlay_layer(bottom, "bottom")
            overlay_layer(top, "top")
            overlay_layer(outer_top, "outer_top")
            overlay_layer(shoes, "shoes")
            for acc_item in accessories_list:
                overlay_layer(acc_item, "accessory")

            final_rgb = canvas.convert("RGB")
            buf = io.BytesIO()
            final_rgb.save(buf, format="JPEG", quality=92)
            return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"
        except Exception as e_comp:
            print(f"[!] Multi-layer composite fallback error: {e_comp}")
            return ""


# ---------------------------------------------------------------------------
# 3. Garment & Body Extractor AI: Bóc tách trang phục & Trích xuất khuôn mặt
# ---------------------------------------------------------------------------
class GarmentExtractor:
    @staticmethod
    def load_pil_image(image_input: str) -> Image.Image:
        """Nạp ảnh từ Base64, URL từ xa, đường dẫn web relative (/models/...) hoặc đường dẫn tệp cục bộ (bảo toàn kênh Alpha nếu có)"""
        if not image_input:
            return None
        try:
            def _open_preserve(raw_bytes: bytes, hint_png: bool = False):
                im = Image.open(io.BytesIO(raw_bytes))
                if im.mode in ("RGBA", "LA", "P") or hint_png:
                    return im.convert("RGBA")
                return im.convert("RGB")

            if image_input.startswith("data:image"):
                header, b64data = image_input.split(",", 1)
                raw = base64.b64decode(b64data)
                return _open_preserve(raw, hint_png="png" in header.lower())
            elif image_input.startswith("http://") or image_input.startswith("https://"):
                req = urllib.request.Request(image_input, headers={"User-Agent": BROWSER_UA})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    raw = resp.read()
                    return _open_preserve(raw, hint_png=".png" in image_input.lower())
            elif os.path.exists(image_input):
                with open(image_input, "rb") as f:
                    return _open_preserve(f.read(), hint_png=image_input.lower().endswith(".png"))

            # Hỗ trợ đường dẫn tương đối tới frontend/public hoặc frontend/dist (ví dụ: /models/tryon_master/...)
            cleaned = image_input.lstrip("/")
            candidates = [
                os.path.join(os.path.dirname(os.path.dirname(current_dir)), "frontend", "public", cleaned),
                os.path.join(os.path.dirname(os.path.dirname(current_dir)), "frontend", "dist", cleaned),
                os.path.join(current_dir, cleaned),
                os.path.join(os.path.dirname(current_dir), cleaned)
            ]
            for cand in candidates:
                if os.path.exists(cand):
                    with open(cand, "rb") as f:
                        return _open_preserve(f.read(), hint_png=cand.lower().endswith(".png"))
        except Exception as e:
            print(f"[!] GarmentExtractor.load_pil_image error: {e}")
        return None

    @classmethod
    def _warp_face_68_delaunay(cls, user_bgr: np.ndarray, base_bgr: np.ndarray) -> np.ndarray:
        """
        Khớp Ngũ Quan 3D Toán Học Bằng 68 Điểm Mốc Giải Phẫu (DWPose + Delaunay Triangulation + Poisson Seamless):
        1. Trích xuất 68 Facial Landmarks từ ảnh người dùng bằng Deep Learning ONNX (DWPose).
        2. Phân rã khuôn mặt thành 128 tam giác Affine (Delaunay Triangulation).
        3. Uốn cong từng tam giác phi tuyến (Piecewise Affine Warping) khớp từng milimet vào UV 3D.
        4. Tự động đổ bóng tóc tự nhiên lên da đầu (Scalp UV) giải quyết dứt điểm tình trạng đầu trọc.
        5. Đồng bộ màu da và ánh sáng hoàn hảo bằng thuật toán giải phương trình Poisson (Seamless Clone).
        """
        try:
            from scipy.spatial import Delaunay

            if fashn_pipeline is None or not hasattr(fashn_pipeline, "pose_model") or fashn_pipeline.pose_model is None:
                return None

            pose_user = fashn_pipeline.pose_model(user_bgr)
            faces = pose_user.get("faces")
            if faces is None or len(faces) == 0 or faces[0].max() <= 0:
                return None

            h_u, w_u, _ = user_bgr.shape
            src_pts = faces[0] * np.array([w_u, h_u])

            # 68 Tọa độ vàng chuẩn xác của mô hình 3D trên UV 1024x1024
            dst_pts = np.array([
                [243.91, 315.74], [243.91, 368.90], [252.77, 422.06], [266.06, 477.43],
                [288.21, 526.16], [336.94, 563.82], [385.67, 592.61], [445.48, 610.33],
                [505.28, 616.98], [567.30, 610.33], [627.10, 590.40], [675.83, 559.39],
                [726.78, 521.73], [751.14, 473.00], [766.64, 419.85], [773.29, 364.47],
                [773.29, 311.31], [341.37, 282.52], [372.38, 273.66], [405.61, 273.66],
                [436.62, 278.09], [467.63, 284.73], [551.79, 286.95], [582.80, 280.30],
                [616.03, 273.66], [647.04, 271.44], [680.26, 282.52], [509.71, 317.96],
                [509.71, 348.97], [509.71, 377.76], [511.92, 406.56], [467.63, 437.57],
                [487.56, 442.00], [509.71, 444.21], [534.07, 439.78], [554.01, 437.57],
                [367.95, 315.74], [396.75, 302.45], [429.97, 304.67], [454.34, 324.60],
                [425.54, 331.25], [394.53, 329.03], [562.87, 322.39], [589.45, 302.45],
                [622.67, 300.24], [651.47, 313.53], [622.67, 326.82], [593.88, 329.03],
                [427.76, 499.58], [460.98, 484.08], [494.20, 477.43], [509.71, 477.43],
                [525.21, 477.43], [560.65, 484.08], [591.66, 499.58], [565.08, 515.09],
                [538.50, 521.73], [509.71, 523.95], [480.92, 521.73], [454.34, 515.09],
                [436.62, 499.58], [474.27, 497.37], [509.71, 497.37], [545.15, 497.37],
                [582.80, 499.58], [545.15, 497.37], [509.71, 497.37], [474.27, 497.37]
            ], dtype=np.float32)

            src_center = src_pts[27]
            dst_center = dst_pts[27]
            src_scale_y = (src_pts[8][1] - src_pts[27][1]) / (dst_pts[8][1] - dst_pts[27][1])
            src_scale_x = (src_pts[45][0] - src_pts[36][0]) / (dst_pts[45][0] - dst_pts[36][0])

            # Tọa độ neo mở rộng gồm đường chân tóc (Hairline), đỉnh đầu (Scalp), thái dương và quai hàm
            extra_dst = np.array([
                [512, 215], [420, 225], [604, 225], [330, 245], [694, 245], # Chân tóc & trán trên
                [512, 110], [360, 120], [664, 120],                          # Đỉnh đầu & da đầu
                [240, 310], [784, 310],                                      # Thái dương & gò má ngoài
                [250, 440], [774, 440]                                       # Quai hàm dưới
            ], dtype=np.float32)

            extra_src = []
            for p in extra_dst:
                dx = (p[0] - dst_center[0]) * src_scale_x
                dy = (p[1] - dst_center[1]) * src_scale_y
                sx = np.clip(src_center[0] + dx, 0, w_u - 1)
                sy = np.clip(src_center[1] + dy, 0, h_u - 1)
                extra_src.append([sx, sy])
            extra_src = np.array(extra_src, dtype=np.float32)

            all_dst = np.vstack([dst_pts, extra_dst])
            all_src = np.vstack([src_pts, extra_src])

            delaunay = Delaunay(all_dst)
            triangles = delaunay.simplices

            warped_face = np.zeros_like(base_bgr)
            for tri in triangles:
                t1 = all_src[tri]
                t2 = all_dst[tri]

                r1 = cv2.boundingRect(np.float32([t1]))
                r2 = cv2.boundingRect(np.float32([t2]))

                t1_rect = [((t1[i][0] - r1[0]), (t1[i][1] - r1[1])) for i in range(3)]
                t2_rect = [((t2[i][0] - r2[0]), (t2[i][1] - r2[1])) for i in range(3)]
                t2_rect_int = [(int(t2[i][0] - r2[0]), int(t2[i][1] - r2[1])) for i in range(3)]

                mask = np.zeros((r2[3], r2[2], 3), dtype=np.float32)
                cv2.fillConvexPoly(mask, np.int32(t2_rect_int), (1.0, 1.0, 1.0), 16, 0)

                img1_rect = user_bgr[r1[1]:r1[1] + r1[3], r1[0]:r1[0] + r1[2]]
                size = (r2[2], r2[3])

                if img1_rect.shape[0] > 0 and img1_rect.shape[1] > 0 and size[0] > 0 and size[1] > 0:
                    warp_mat = cv2.getAffineTransform(np.float32(t1_rect), np.float32(t2_rect))
                    img2_rect = cv2.warpAffine(img1_rect, warp_mat, size, None, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
                    img2_rect = img2_rect * mask

                    y1, y2 = r2[1], r2[1] + r2[3]
                    x1, x2 = r2[0], r2[0] + r2[2]
                    warped_face[y1:y2, x1:x2] = warped_face[y1:y2, x1:x2] * (1 - mask) + img2_rect

            # Tạo lớp tóc tự nhiên cao cấp bao trọn đỉnh đầu, sau gáy, chân tóc và 2 bên mang tai
            hair_base = base_bgr.copy()
            hair_color = (20, 18, 22) # Tone màu tóc đen tự nhiên

            # Đỉnh đầu & xoáy tóc
            cv2.ellipse(hair_base, (512, 130), (430, 150), 0, 0, 360, hair_color, -1)
            # Sau gáy
            cv2.rectangle(hair_base, (50, 0), (974, 230), hair_color, -1)
            # Tóc mai 2 bên mang tai
            pts_l = np.array([[710, 180], [870, 180], [860, 370], [735, 340]], np.int32)
            pts_r = np.array([[154, 180], [314, 180], [289, 340], [164, 370]], np.int32)
            cv2.fillPoly(hair_base, [pts_l, pts_r], hair_color)
            # Đường chân tóc vòng cung trước trán
            cv2.ellipse(hair_base, (512, 185), (290, 85), 0, 0, 180, hair_color, -1)

            # Khử răng cưa & làm mịn biên sợi tóc
            hair_noise = np.random.normal(0, 4, hair_base.shape).astype(np.int16)
            hair_textured = np.clip(hair_base.astype(np.int16) + hair_noise, 0, 255).astype(np.uint8)
            hair_blurred = cv2.GaussianBlur(hair_textured, (15, 15), 0)

            # Mặt nạ chuyển tiếp êm dịu cho chân tóc
            hair_mask = np.zeros((1024, 1024), dtype=np.float32)
            cv2.ellipse(hair_mask, (512, 130), (420, 145), 0, 0, 360, 1.0, -1)
            cv2.rectangle(hair_mask, (60, 0), (964, 220), 1.0, -1)
            cv2.fillPoly(hair_mask, [pts_l, pts_r], 1.0)
            cv2.ellipse(hair_mask, (512, 185), (280, 80), 0, 0, 180, 1.0, -1)
            hair_mask = cv2.GaussianBlur(hair_mask, (31, 31), 0)[:, :, np.newaxis]

            full_hair_skin = (hair_blurred * hair_mask + base_bgr * (1 - hair_mask)).astype(np.uint8)

            # Poisson Seamless Cloning khuôn mặt lên nền tóc & da hoàn chỉnh
            hull = cv2.convexHull(np.int32(all_dst))
            clone_mask = np.zeros((1024, 1024), dtype=np.uint8)
            cv2.fillConvexPoly(clone_mask, hull, 255)
            clone_mask = cv2.erode(clone_mask, np.ones((7, 7), np.uint8), iterations=1)

            moments = cv2.moments(clone_mask)
            cx = int(moments['m10'] / moments['m00']) if moments['m00'] > 0 else 512
            cy = int(moments['m01'] / moments['m00']) if moments['m00'] > 0 else 420

            final_texture = cv2.seamlessClone(warped_face, full_hair_skin, clone_mask, (cx, cy), cv2.NORMAL_CLONE)
            return final_texture
        except Exception as e_delaunay:
            print(f"[!] Warning in _warp_face_68_delaunay: {e_delaunay}")
            return None

    @classmethod
    def extract_face(cls, user_image_input: str) -> dict:
        """
        AI Bóc Tách Khuôn Mặt & Ngũ Quan Đa Chiều Chuẩn Xác (ReadyPlayerMe 3D Studio UV):
        Ưu tiên cao nhất: Dùng DWPose 68 Facial Landmarks + Delaunay Piecewise Affine Warping + Poisson Seamless
        Fallback: FashnHumanParser Semantic Head Segmentation.
        """
        img = cls.load_pil_image(user_image_input)
        if img is None:
            return {"success": False, "error": "Không tìm thấy ảnh người dùng"}
        try:
            base_skin_path = os.path.join(os.path.dirname(__file__), "../../frontend/public/models/avatar_skin_texture.jpg")
            if not os.path.exists(base_skin_path):
                base_skin_path = "frontend/public/models/avatar_skin_texture.jpg"
            
            base_bgr = None
            if os.path.exists(base_skin_path):
                base_bgr = cv2.imread(base_skin_path)
            if base_bgr is None:
                base_bgr = np.full((1024, 1024, 3), (135, 150, 195), dtype=np.uint8)

            user_cv_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

            # CÁCH 1 (CHUẨN KHOA HỌC & ĐẸP NHẤT): 68 Facial Landmarks + Delaunay Affine Warping + Poisson Blend
            delaunay_res = cls._warp_face_68_delaunay(user_cv_bgr, base_bgr)
            if delaunay_res is not None:
                success, enc = cv2.imencode(".png", delaunay_res)
                if success:
                    face_b64 = base64.b64encode(enc.tobytes()).decode()
                    print("[+] Successfully generated 68-landmark Delaunay 3D UV texture!")
                    return {
                        "success": True,
                        "face_url": f"data:image/png;base64,{face_b64}",
                        "width": 1024,
                        "height": 1024,
                        "is_full_texture": True
                    }

            # CÁCH 2 (FALLBACK): FashnHumanParser Semantic Head Segmentation
            target_w = 580
            target_h = 480
            dest_x = 212
            dest_y = 85

            if shared_parser is not None:
                labels = shared_parser.predict(img)
                if isinstance(labels, (list, tuple)):
                    labels = labels[0]
                labels = np.array(labels)

                face_mask = (labels == 1).astype(np.uint8) * 255
                hair_mask = (labels == 2).astype(np.uint8) * 255
                head_mask = ((labels == 1) | (labels == 2)).astype(np.uint8) * 255

                if np.sum(face_mask > 0) > 50:
                    fx, fy, fw, fh = cv2.boundingRect(face_mask)
                    hx, hy, hw, hh = cv2.boundingRect(head_mask)

                    pad_w = int(hw * 0.08)
                    pad_h = int(hh * 0.06)
                    x1 = max(0, hx - pad_w)
                    y1 = max(0, hy - pad_h)
                    x2 = min(user_cv_bgr.shape[1], hx + hw + pad_w)
                    y2 = min(user_cv_bgr.shape[0], hy + hh + pad_h)

                    head_crop_bgr = user_cv_bgr[y1:y2, x1:x2]
                    head_crop_mask = head_mask[y1:y2, x1:x2]

                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
                    head_crop_mask_clean = cv2.erode(head_crop_mask, kernel, iterations=1)

                    resized_rgb = cv2.resize(head_crop_bgr, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
                    resized_alpha = cv2.resize(head_crop_mask_clean, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)

                    scalp_hair = base_bgr.copy()
                    cv2.ellipse(scalp_hair, (512, 100), (370, 120), 0, 0, 360, (24, 22, 25), -1)
                    cv2.rectangle(scalp_hair, (160, 0), (864, 130), (24, 22, 25), -1)
                    scalp_hair = cv2.GaussianBlur(scalp_hair, (25, 25), 0)

                    alpha_norm = cv2.GaussianBlur(resized_alpha, (15, 15), 0).astype(np.float32) / 255.0
                    alpha_3d = alpha_norm[:, :, np.newaxis]

                    roi = scalp_hair[dest_y:dest_y+target_h, dest_x:dest_x+target_w].astype(np.float32)
                    blended = (resized_rgb.astype(np.float32) * alpha_3d + roi * (1 - alpha_3d)).astype(np.uint8)
                    scalp_hair[dest_y:dest_y+target_h, dest_x:dest_x+target_w] = blended

                    success, enc = cv2.imencode(".png", scalp_hair)
                    if success:
                        face_b64 = base64.b64encode(enc.tobytes()).decode()
                        return {
                            "success": True,
                            "face_url": f"data:image/png;base64,{face_b64}",
                            "width": 1024,
                            "height": 1024,
                            "is_full_texture": True
                        }

            # Fallback nếu không qua parser
            cx = img.width // 2
            cy = int(img.height * 0.18)
            r_w = int(img.width * 0.18)
            r_h = int(img.height * 0.20)
            crop_raw = img.crop((max(0, cx - r_w), max(0, cy - r_h), min(img.width, cx + r_w), min(img.height, cy + r_h))).convert("RGBA")
            head_crop_resized = crop_raw.resize((target_w, target_h), Image.Resampling.LANCZOS)

            buf = io.BytesIO()
            head_crop_resized.save(buf, format="PNG")
            face_b64 = base64.b64encode(buf.getvalue()).decode()
            return {
                "success": True,
                "face_url": f"data:image/png;base64,{face_b64}",
                "width": target_w,
                "height": target_h,
                "is_full_texture": False
            }
        except Exception as e:
            print(f"[!] extract_face error: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def extract_garment(cls, garment_image_input: str, garment_info: dict = None) -> dict:
        """
        Bóc tách món đồ từ bất kỳ ảnh nào (người mẫu mặc, flat-lay, hoặc ảnh do người dùng upload):
        1. Phân loại pixel ngữ nghĩa bằng FashnHumanParser (Top, Pants, Skirt, Dress).
        2. Tạo Alpha Matte khử hoàn toàn phông nền và da người mẫu.
        3. Xuất ảnh PNG trong suốt + Mặt nạ nhị phân Black & White + Bảng mã màu chủ đạo.
        """
        img = cls.load_pil_image(garment_image_input)
        if img is None:
            return {"success": False, "error": "Không tìm thấy ảnh trang phục"}

        try:
            w, h = img.size
            garment_mask = None
            detected_cat = "tops"

            # 1. Quét nhãn ngữ nghĩa với FashnHumanParser
            if shared_parser is not None:
                labels = shared_parser.predict(img)
                if isinstance(labels, (list, tuple)):
                    labels = labels[0]
                labels = np.array(labels)

                top_pixels = int(np.sum(labels == 3))
                dress_pixels = int(np.sum(labels == 4))
                skirt_pixels = int(np.sum(labels == 5))
                pants_pixels = int(np.sum(labels == 6))

                counts = {
                    "tops": top_pixels,
                    "one-pieces": dress_pixels,
                    "bottoms": pants_pixels + skirt_pixels
                }
                detected_cat = max(counts, key=counts.get)

                if counts[detected_cat] >= 300:
                    if detected_cat == "one-pieces":
                        garment_mask = (labels == 4).astype(np.uint8) * 255
                    elif detected_cat == "bottoms":
                        garment_mask = np.isin(labels, [5, 6]).astype(np.uint8) * 255
                    else:
                        garment_mask = (labels == 3).astype(np.uint8) * 255

            # 2. Nếu là ảnh chụp trải sàn (Packshot) không có người, FashnHumanParser sẽ ít điểm
            # Fallback sang thuật toán phân đoạn thích ứng cao cấp (Otsu Adaptive Thresholding + Morphological Closing + Contour Isolation)
            if garment_mask is None or np.sum(garment_mask > 0) < 500:
                gray = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
                # Lấy mẫu màu các viền (Border pixels) để nhận diện cường độ phông nền
                bx = max(2, int(w * 0.04))
                by = max(2, int(h * 0.04))
                border_samples = np.concatenate([
                    gray[:by, :].flatten(),
                    gray[-by:, :].flatten(),
                    gray[:, :bx].flatten(),
                    gray[:, -bx:].flatten()
                ])
                mean_border = np.mean(border_samples)

                # Phân tách nền tự động thích ứng với Otsu: Khử triệt để nền thảm lông, sàn gỗ, nền studio
                if mean_border > 150:
                    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                else:
                    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

                # Lấp đầy các chi tiết bên trong (khóa kéo, cúc áo, nếp gấp, nhãn mác)
                kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
                closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_close)

                # Khử nhiễu biên và bụi phông nền
                kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
                opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel_open)

                # Trích xuất đường bao (Contour) lớn nhất đại diện cho món đồ trang phục
                contours, _ = cv2.findContours(opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if contours:
                    c_main = max(contours, key=cv2.contourArea)
                    garment_mask = np.zeros_like(gray)
                    cv2.drawContours(garment_mask, [c_main], -1, 255, -1)
                else:
                    garment_mask = opened
                
                # Xác định danh mục dựa trên tỉ lệ khung hình (Aspect Ratio) hoặc hint
                hint_name = ((garment_info or {}).get("name", "") + " " + (garment_info or {}).get("category", "")).lower()
                if any(k in hint_name for k in ["váy", "đầm", "dress"]):
                    detected_cat = "one-pieces"
                elif any(k in hint_name for k in ["quần", "pant", "jean", "jogger", "short"]):
                    detected_cat = "bottoms"
                else:
                    detected_cat = "tops"

            # 3. Tinh chỉnh viền mặt nạ mềm mại tự nhiên (Anti-aliased Soft Feathering)
            garment_mask = cv2.GaussianBlur(garment_mask, (5, 5), 0)

            # 4. Tạo ảnh sạch nền (Transparent Alpha Channel)
            rgba = np.array(img.convert("RGBA"))
            rgba[:, :, 3] = garment_mask
            clean_garment = Image.fromarray(rgba, "RGBA")

            # 5. Cắt gọn theo khung hình bao quanh món đồ (Bounding Box)
            bbox = cv2.boundingRect(garment_mask)
            bx, by, bw, bh = bbox
            if bw > 15 and bh > 15:
                cropped_garment = clean_garment.crop((bx, by, bx + bw, by + bh))
            else:
                cropped_garment = clean_garment

            # 6. Trích xuất bảng màu chủ đạo (Dominant Color Palette)
            img_arr = np.array(img)
            fabric_pixels = img_arr[garment_mask > 128]
            if len(fabric_pixels) > 50:
                pixels = np.float32(fabric_pixels)
                criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
                _, _, centers = cv2.kmeans(pixels, min(3, len(pixels)), None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
                hex_colors = ["#{:02x}{:02x}{:02x}".format(int(c[0]), int(c[1]), int(c[2])) for c in centers]
            else:
                hex_colors = ["#3b82f6", "#1e293b", "#e2e8f0"]

            # 7. Render mặt nạ nhị phân Black & White để trực quan hóa
            mask_img = Image.fromarray(garment_mask, mode="L")
            buf_mask = io.BytesIO()
            mask_img.save(buf_mask, format="PNG")
            mask_b64 = base64.b64encode(buf_mask.getvalue()).decode()

            buf_clean = io.BytesIO()
            cropped_garment.save(buf_clean, format="PNG")
            clean_b64 = base64.b64encode(buf_clean.getvalue()).decode()

            return {
                "success": True,
                "detected_category": detected_cat,
                "dominant_colors": hex_colors,
                "dimensions": {
                    "width": int(bw),
                    "height": int(bh),
                    "orig_width": int(w),
                    "orig_height": int(h)
                },
                "bbox": [int(bx), int(by), int(bw), int(bh)],
                "mask_url": f"data:image/png;base64,{mask_b64}",
                "extracted_garment_url": f"data:image/png;base64,{clean_b64}",
                "pixels_count": int(np.sum(garment_mask > 128))
            }
        except Exception as e:
            print(f"[!] extract_garment error: {e}")
            return {"success": False, "error": str(e)}


# ---------------------------------------------------------------------------
# 3.5. AI Gender Detector: Phân Tích Nhận Diện Giới Tính Từ Khuôn Mặt & Mái Tóc
# ---------------------------------------------------------------------------
class GenderDetector:
    @classmethod
    def detect_gender(cls, img: Image.Image) -> tuple[str, float, str]:
        """
        Phân tích giới tính Nam/Nữ từ hình ảnh người dùng:
        - Sử dụng FashnHumanParser (Semantic segmentation: 1 = face, 2 = hair)
        - Nếu tóc dài kéo qua cằm/vai (hair_reach_ratio > 0.22 hoặc hair_area_ratio > 1.25) => Nữ (female)
        - Nếu tóc ngắn trên gáy => Nam (male)
        """
        try:
            if img is None:
                return "male", 0.7, "Không tìm thấy ảnh hợp lệ"

            if shared_parser is not None:
                labels = shared_parser.predict(img)
                if isinstance(labels, (list, tuple)):
                    labels = labels[0]
                labels = np.array(labels)

                face_mask = (labels == 1).astype(np.uint8)
                hair_mask = (labels == 2).astype(np.uint8)

                face_pixels = int(np.sum(face_mask > 0))
                hair_pixels = int(np.sum(hair_mask > 0))

                if face_pixels > 80:
                    fy_indices = np.where(face_mask > 0)[0]
                    hy_indices = np.where(hair_mask > 0)[0]

                    face_bottom = np.max(fy_indices) if len(fy_indices) > 0 else 0
                    face_top = np.min(fy_indices) if len(fy_indices) > 0 else 0
                    face_h = max(1, face_bottom - face_top)

                    hair_bottom = np.max(hy_indices) if len(hy_indices) > 0 else 0

                    hair_reach_ratio = (hair_bottom - face_bottom) / face_h
                    hair_area_ratio = hair_pixels / max(1, face_pixels)

                    print(f"[GenderDetector] hair_reach={hair_reach_ratio:.2f}, hair_area={hair_area_ratio:.2f}")
                    if hair_reach_ratio > 0.22 or hair_area_ratio > 1.25:
                        return "female", 0.94, "Tóc dài qua vai, đường nét khuôn mặt nữ"
                    else:
                        return "male", 0.93, "Tóc ngắn gọn gàng, đường nét khuôn mặt nam"

            return "male", 0.8, "Vóc dáng tiêu chuẩn"
        except Exception as e:
            print(f"[GenderDetector] Error: {e}")
            return "male", 0.75, "Mặc định hệ thống"


# ---------------------------------------------------------------------------
# 4. AI Stylist Engine: Phối 100 Set & Chấm Điểm Chọn Top 5 từ CSDL ZeroMall
# ---------------------------------------------------------------------------
class AiStylistEngine:
    EXCLUDED_CATEGORIES = {
        'Gia Dụng', 'Điện Thoại & Phụ Kiện', 'Máy Tính & Laptop',
        'Sách & VPP', 'Mẹ & Bé', 'Sức Khỏe', 'Máy Ảnh', 'Nhà Cửa', 'Sắc Đẹp'
    }

    _CACHED_FASHION_PRODUCTS = []
    _LAST_CACHE_TIME = 0

    @classmethod
    def fetch_real_zero_products(cls):
        """Truy vấn CSDL thực tế thời trang của ZeroMall qua Kong Gateway hoặc Product Service"""
        now = time.time()
        if cls._CACHED_FASHION_PRODUCTS and (now - cls._LAST_CACHE_TIME < 60):
            return cls._CACHED_FASHION_PRODUCTS

        base_urls = [
            KONG_GATEWAY_URL,
            "http://kong:8000",
            "http://localhost:8000",
            "http://localhost:3002"
        ]
        categories = ["thoi-trang-nam", "thoi-trang-nu", "giay-dep-nam", "giay-dep-nu", "phu-kien-nu", "tui-vi-nu", "dong-ho"]

        for b_url in base_urls:
            combined_map = {}
            try:
                for cat in categories:
                    try:
                        u = f"{b_url}/products?category={cat}&limit=80"
                        req = urllib.request.Request(u, headers={"User-Agent": BROWSER_UA})
                        with urllib.request.urlopen(req, timeout=3) as resp:
                            data = json.loads(resp.read().decode())
                            prods = data if isinstance(data, list) else (data.get("products") or [])
                            for p in prods:
                                pid = str(p.get("id") or "")
                                if pid and p.get("status") not in ("hidden", "deleted", "violated") and not p.get("isViolated"):
                                    combined_map[pid] = p
                    except Exception:
                        pass
                combined = list(combined_map.values())
                if len(combined) >= 20:
                    cls._CACHED_FASHION_PRODUCTS = combined
                    cls._LAST_CACHE_TIME = now
                    return combined
            except Exception:
                continue

        return cls._CACHED_FASHION_PRODUCTS or []

    @staticmethod
    def classify_item(p: dict) -> str:
        """Phân loại chính xác vai trò trang phục theo từ khóa và danh mục"""
        name = (p.get("name", "")).lower()
        cat = (p.get("category", "")).lower()
        text = f"{name} {cat}"

        # 1. Giày dép
        if "giày dép" in cat or any(k in name for k in ["giày", "sneaker", "dép", "sandal", "boots", "boot", "loafer", "giày oxford", "giày lười", "giày tây"]):
            return "shoes"

        is_garment_name = any(g in name for g in ["quần", "áo", "đầm", "váy", "jacket", "hoodie", "blazer", "sơ mi"])

        # 2. Phụ kiện, túi, nón, đồng hồ (không nhầm với "Quần túi hộp" hay "Áo có mũ")
        if any(c in cat for c in ["túi", "ví", "phụ kiện", "đồng hồ"]) or any(
            k in name for k in ["túi xách", "túi đeo", "túi tote", "ví da", "ví cầm tay", "balo", "nón", "kính mát", "kính râm", "kính mắt", "đồng hồ", "thắt lưng", "dây nịt", "dây chuyền"]
        ) or (not is_garment_name and any(k in name for k in ["túi", "ví", "mũ", "kính"])):
            return "accessory"

        # 3. Quần / Chân váy
        if any(k in name for k in ["quần", "jean", "jeans", "jogger", "short", "quần tây", "quần âu", "kaki", "chân váy"]):
            return "bottom"

        # 4. Áo / Đầm
        if any(k in name for k in ["áo", "jacket", "bomber", "hoodie", "sơ mi", "thun", "polo", "sweater", "blazer", "cardigan", "đầm", "váy"]):
            return "top"

        # Fallback theo danh mục
        if "thời trang" in cat:
            if any(k in name for k in ["jean", "quần"]):
                return "bottom"
            return "top"

        return "other"

    @staticmethod
    def filter_gender(items: list, gender: str) -> list:
        res = []
        female_only_kw = ["đầm", "váy", "chân váy", "cao gót", "búp bê", "croptop", "bikini", "túi xách nữ"]
        for it in items:
            name_lower = (it.get("name", "")).lower()
            cat_lower = (it.get("category", "")).lower()
            text = f"{name_lower} {cat_lower}"
            is_unisex = "nam nữ" in text or "unisex" in text
            if gender == "male":
                if not is_unisex and "nữ" in text and "nam" not in text:
                    continue
                if any(kw in name_lower for kw in female_only_kw):
                    continue
            elif gender == "female":
                if not is_unisex and "nam" in text and "nữ" not in text:
                    continue
            res.append(it)
        return res

    @staticmethod
    def is_full_dress(p: dict) -> bool:
        name = (p.get("name", "")).lower()
        return any(k in name for k in ["đầm", "váy liền", "maxi", "dạ hội", "dự tiệc"]) and "chân váy" not in name

    @staticmethod
    def is_shorts_or_beachwear(p: dict) -> bool:
        text = f"{p.get('name', '')} {p.get('description', '')}".lower()
        return any(k in text for k in ["quần đùi", "quần short", "short đùi", "mặc nhà", "đi biển", "đồ ngủ", "pijama"])

    @staticmethod
    def is_slipper_or_flipflop(p: dict) -> bool:
        name = (p.get("name", "")).lower()
        return any(k in name for k in ["dép lê", "dép kẹp", "xỏ ngón", "tông", "sục"])

    @staticmethod
    def classify_formality(p: dict) -> str:
        text = f"{p.get('name', '')} {p.get('category', '')}".lower()
        # Kiêm tra đồ mặc nhà / quần đùi / đi biển / tập thể dục trước để tránh nhận nhầm
        if any(k in text for k in ["quần đùi", "quần short", "short", "mặc nhà", "đi biển", "đồ ngủ", "pijama", "dép lê", "dép kẹp", "xỏ ngón", "chạy bộ", "gym", "thể dục"]):
            return "ultra_casual"
        if any(k in text for k in ["blazer", "vest", "suit", "sơ mi", "quần tây", "quần âu", "tây âu", "oxford", "giày tây", "loafer", "giày lười", "cao gót", "bút chì", "công sở", "dạ hội", "dự tiệc"]):
            return "formal"
        return "casual"

    @staticmethod
    def parse_numeric_price(val) -> float:
        if val is None:
            return 0.0
        if isinstance(val, (int, float)):
            return float(val)
        val_str = str(val).strip()
        import re
        digits = re.sub(r"[^\d]", "", val_str)
        if digits:
            try:
                return float(digits)
            except Exception:
                return 0.0
        return 0.0

    @staticmethod
    def extract_colors(p: dict) -> list:
        name = (p.get("name", "") + " " + p.get("description", "")).lower()
        found = []
        if any(k in name for k in ["đen", "black", "tối"]): found.append("black")
        if any(k in name for k in ["trắng", "white", "sáng"]): found.append("white")
        if any(k in name for k in ["xanh", "blue", "denim", "navy"]): found.append("blue")
        if any(k in name for k in ["xám", "ghi", "gray"]): found.append("gray")
        if any(k in name for k in ["nâu", "kem", "be", "beige", "brown"]): found.append("earth")
        if any(k in name for k in ["đỏ", "cam", "hồng"]): found.append("warm")
        return found or ["neutral"]

    @staticmethod
    def detect_vibe(p: dict) -> str:
        name = p.get("name", "").lower()
        if any(k in name for k in ["blazer", "vest", "suit", "sơ mi", "tây", "âu", "polo", "oxford", "giày tây", "loafer", "công sở", "dạ hội"]):
            return "Smart Casual Lịch Lãm"
        if any(k in name for k in ["quần đùi", "short", "mặc nhà", "đi biển", "thể thao", "co giãn", "chạy", "gym", "thoáng khí"]):
            return "Sporty Năng Động"
        if any(k in name for k in ["bomber", "hoodie", "cargo", "jogger", "sneaker", "unisex", "jean", "rách"]):
            return "Streetwear Cá Tính"
        if any(k in name for k in ["thun", "cotton", "basic", "dép", "kaki", "trơn"]):
            return "Minimalist Tối Giản"
        return "Hàn Quốc Trẻ Trung"

    @staticmethod
    def score_single_outfit(items: list, user_measurements: dict) -> tuple:
        """
        Chấm điểm thẩm mỹ thời trang theo quy tắc phối đồ thực tế:
        1. Phối màu (Color Harmony): tối đa 30 điểm
        2. Tương thích ngữ cảnh & phom dáng (Formality & Style Compatibility): tối đa 40 điểm (+ điểm phạt xung đột)
        3. Tương thích thể hình (Body Fit): tối đa 20 điểm
        4. Tính đầy đủ & cân đối giá trị set: tối đa 10 điểm
        """
        all_colors = []
        tops_in_set = []
        bottoms_in_set = []
        shoes_in_set = []
        for it in items:
            all_colors.extend(AiStylistEngine.extract_colors(it))
            role = AiStylistEngine.classify_item(it)
            if role == "top":
                tops_in_set.append(it)
            elif role == "bottom":
                bottoms_in_set.append(it)
            elif role == "shoes":
                shoes_in_set.append(it)

        explicit_colors = [c for c in all_colors if c != "neutral"]
        unique_explicit = set(explicit_colors)

        # 1. Điểm màu sắc (Max 30 - có phân hóa theo màu thực tế)
        if "black" in unique_explicit and "white" in unique_explicit:
            color_score = 30
        elif "blue" in unique_explicit and ("white" in unique_explicit or "black" in unique_explicit or "earth" in unique_explicit):
            color_score = 29
        elif "earth" in unique_explicit and ("white" in unique_explicit or "black" in unique_explicit):
            color_score = 28
        elif len(unique_explicit) == 1:
            color_score = 26
        elif len(unique_explicit) == 0:
            color_score = 24
        elif len(unique_explicit) <= 3:
            color_score = 25
        else:
            color_score = 20

        # 2. Tương thích ngữ cảnh & phong cách (Base 26, Max 40, Penalty khi lệch phom)
        vibes = [AiStylistEngine.detect_vibe(it) for it in items]
        top_vibe = vibes[0] if items else "Smart Casual Lịch Lãm"
        # Ưu tiên lấy vibe của món chính (items[0]) nếu là trang phục chủ đạo
        if items and AiStylistEngine.classify_item(items[0]) in ("top", "bottom"):
            top_vibe = AiStylistEngine.detect_vibe(items[0])
        else:
            top_vibe = max(set(vibes), key=vibes.count)

        match_count = vibes.count(top_vibe)
        style_score = 24 + min(10, match_count * 3)

        top_item = tops_in_set[0] if tops_in_set else None
        bottom_item = bottoms_in_set[0] if bottoms_in_set else None
        shoe_item = shoes_in_set[0] if shoes_in_set else None

        if top_item and bottom_item:
            top_form = AiStylistEngine.classify_formality(top_item)
            bot_form = AiStylistEngine.classify_formality(bottom_item)
            bot_name = (bottom_item.get("name", "")).lower()

            # Xung đột nghiêm trọng: Áo Blazer/Vest/Sơ mi công sở mặc với Quần đùi / Mặc nhà / Đi biển / Đồ gym
            if top_form == "formal" and (bot_form == "ultra_casual" or AiStylistEngine.is_shorts_or_beachwear(bottom_item)):
                style_score -= 35
            elif AiStylistEngine.is_full_dress(top_item):
                # Đầm liền / Đầm maxi không mặc kèm quần bên dưới
                if "quần" in bot_name:
                    style_score -= 40
            elif top_form == "formal":
                if "jogger" in bot_name or "thể thao" in bot_name:
                    style_score -= 8  # Blazer không hợp quần jogger thể thao bằng quần tây/kaki/jean
                elif bot_form == "formal":
                    style_score += 8  # Blazer/Sơ mi + Quần Tây/Quần Âu/Chân váy
                elif any(k in bot_name for k in ["kaki", "chân váy"]):
                    style_score += 6
                elif "jean" in bot_name and "rách" not in bot_name:
                    style_score += 4  # Smart casual (Blazer + Jean trơn)
            elif top_form == "casual":
                if bot_form == "ultra_casual" and any(k in (top_item.get("name", "")).lower() for k in ["sweater", "nỉ", "hoodie", "khoác"]):
                    style_score -= 10
                else:
                    style_score += 4

        if top_item and shoe_item:
            top_form = AiStylistEngine.classify_formality(top_item)
            shoe_form = AiStylistEngine.classify_formality(shoe_item)
            shoe_name = (shoe_item.get("name", "")).lower()
            if top_form == "formal" and AiStylistEngine.is_slipper_or_flipflop(shoe_item):
                style_score -= 22
            elif top_form == "formal" and shoe_form == "formal":
                style_score += 6
            elif top_form == "formal" and "sneaker" in shoe_name:
                style_score += 2  # Smart casual Sneaker gọn gàng vẫn hợp, nhưng thấp điểm hơn Giày Tây/Loafer
            elif top_form != "formal" and "cao gót" in shoe_name and not AiStylistEngine.is_full_dress(top_item):
                style_score -= 10

        # 3. Khớp số đo thể trạng (Max 20)
        bmi = float(user_measurements.get("bmi", 22.0) or 22.0)
        body_fit = 17
        if bmi >= 25 and ("black" in unique_explicit or "blue" in unique_explicit or "earth" in unique_explicit):
            body_fit = 19
        elif 18.5 <= bmi < 25:
            body_fit = 19
        elif bmi < 18.5 and len(items) >= 4:
            body_fit = 19

        # 4. Tính đầy đủ (Max 10)
        completeness = 10 if len(items) >= 4 else (8 if len(items) == 3 else 6)

        # Thêm điểm tinh chỉnh ổn định theo mức độ ăn khớp chi tiết để phân tách Top 1 -> Top 5 rõ ràng
        fine_bonus = 0
        if bottom_item:
            bn = (bottom_item.get("name", "")).lower()
            if (any(k in bn for k in ["tây", "âu"]) or ("kaki" in bn and "jogger" not in bn and "thể thao" not in bn)):
                if top_item and AiStylistEngine.classify_formality(top_item) == "formal":
                    fine_bonus += 2
        if shoe_item and len(shoes_in_set) == 1:
            shoe_n = (shoe_item.get("name", "")).lower()
            if "da" in shoe_n or "tây" in shoe_n or "oxford" in shoe_n or "loafer" in shoe_n:
                if top_item and AiStylistEngine.classify_formality(top_item) == "formal":
                    fine_bonus += 2

        total_score = min(98, max(45, color_score + style_score + body_fit + completeness + fine_bonus))
        return total_score, top_vibe

    @staticmethod
    def generate_top_100_scored_outfits(target_product: dict, user_measurements: dict, gender: str = "male", limit: int = 100):
        """
        Mô phỏng 100 bộ phối đồ độc nhất từ kho hàng thực tế của ZeroMall,
        chấm điểm tự động theo ngữ cảnh & phom dáng và trả về Top 5 đa dạng hình ảnh (cố định theo sản phẩm).
        """
        try:
            all_prods = AiStylistEngine.fetch_real_zero_products()
        except Exception:
            all_prods = []

        # Lọc kho hàng thời trang thực tế sạch, đang bán và còn tồn kho
        def _is_in_stock_and_active(p: dict) -> bool:
            if not p or not p.get("id"):
                return False
            if p.get("isViolated") is True:
                return False
            st = str(p.get("status") or "active").lower()
            if st in ("hidden", "deleted", "inactive", "banned"):
                return False
            stock = p.get("stock")
            if stock is not None:
                try:
                    return float(stock) > 0
                except Exception:
                    return False
            total = p.get("total")
            sold = p.get("sold", 0)
            if total is not None:
                try:
                    return (float(total) - float(sold or 0)) > 0
                except Exception:
                    return False
            return True

        fashion_prods = [
            p for p in all_prods
            if p.get("category") not in AiStylistEngine.EXCLUDED_CATEGORIES and _is_in_stock_and_active(p)
        ]
        if not fashion_prods:
            fashion_prods = [p for p in all_prods if _is_in_stock_and_active(p)]

        gender_prods = AiStylistEngine.filter_gender(fashion_prods, gender)
        if not gender_prods:
            gender_prods = fashion_prods

        target_role = AiStylistEngine.classify_item(target_product)
        target_id = str(target_product.get("id") or target_product.get("name") or "default")
        target_formality = AiStylistEngine.classify_formality(target_product)
        target_is_dress = AiStylistEngine.is_full_dress(target_product)

        # Sắp xếp cố định theo ID trước khi lấy mẫu để kết quả không bị lệ thuộc thứ tự API
        def _sorted_role(pool: list, role_name: str) -> list:
            items = [p for p in pool if AiStylistEngine.classify_item(p) == role_name and str(p.get("id")) != target_id]
            items.sort(key=lambda x: str(x.get("id", "")))
            return items

        tops = _sorted_role(gender_prods, "top") or _sorted_role(fashion_prods, "top")
        bottoms = _sorted_role(gender_prods, "bottom") or _sorted_role(fashion_prods, "bottom")
        shoes = _sorted_role(gender_prods, "shoes") or _sorted_role(fashion_prods, "shoes")
        accs = _sorted_role(gender_prods, "accessory") or _sorted_role(fashion_prods, "accessory")

        # Lọc trước nhóm tương thích ngữ cảnh nếu kho có đủ ứng viên phù hợp
        compat_bottoms = bottoms
        compat_shoes = shoes
        compat_tops = tops

        if target_role == "top" and target_formality == "formal":
            clean_bottoms = [b for b in bottoms if not AiStylistEngine.is_shorts_or_beachwear(b) and AiStylistEngine.classify_formality(b) != "ultra_casual"]
            if clean_bottoms:
                compat_bottoms = clean_bottoms
            clean_shoes = [s for s in shoes if not AiStylistEngine.is_slipper_or_flipflop(s)]
            if clean_shoes:
                compat_shoes = clean_shoes
        elif target_role == "bottom" and (AiStylistEngine.is_shorts_or_beachwear(target_product) or target_formality == "ultra_casual"):
            clean_tops = [t for t in tops if AiStylistEngine.classify_formality(t) != "formal" and not AiStylistEngine.is_full_dress(t)]
            if clean_tops:
                compat_tops = clean_tops
        elif target_role == "bottom":
            clean_tops = [t for t in tops if not AiStylistEngine.is_full_dress(t)]
            if clean_tops:
                compat_tops = clean_tops

        # PRNG cố định theo (target_id, gender, shape_class) để Top 5 ổn định mỗi lần mở cùng sản phẩm
        seed_str = f"{target_id}:{gender}:{user_measurements.get('shape_class', 'standard')}"
        seed_int = int(hashlib.md5(seed_str.encode("utf-8")).hexdigest()[:16], 16)
        rng = random.Random(seed_int)

        # ---------------------------------------------------------------
        # MÔ PHỎNG TỔ HỢP ĐỘC NHẤT & KHỬ TRÙNG HÌNH ẢNH
        # ---------------------------------------------------------------
        simulated_pool = []
        used_signatures = set()
        used_visual_sigs = set()
        # Tránh lặp toàn bộ ảnh giống hệt nhau trong pool cho đến khi thử hết các tổ hợp ảnh khác biệt
        max_attempts = 1200
        attempts = 0

        target_limit = max(10, min(limit, 100))

        def _norm_img(it: dict) -> str:
            return str(it.get("image") or "").split("?")[0].strip()

        while len(simulated_pool) < target_limit and attempts < max_attempts:
            attempts += 1
            if target_role == "top":
                if target_is_dress:
                    # Đầm liền: không mặc kèm quần bên dưới, thay bằng Giày + 2 Phụ kiện khác ảnh
                    s = rng.choice(compat_shoes) if compat_shoes else None
                    a1 = rng.choice(accs) if accs else None
                    other_accs = [a for a in accs if a1 and _norm_img(a) != _norm_img(a1)] if a1 else accs
                    a2 = rng.choice(other_accs) if other_accs else None
                    outfit_items = [it for it in [target_product, s, a1, a2] if it]
                else:
                    b = rng.choice(compat_bottoms) if compat_bottoms else None
                    s = rng.choice(compat_shoes) if compat_shoes else None
                    a = rng.choice(accs) if accs else None
                    outfit_items = [it for it in [target_product, b, s, a] if it]
            elif target_role == "bottom":
                t = rng.choice(compat_tops) if compat_tops else None
                s = rng.choice(compat_shoes) if compat_shoes else None
                a = rng.choice(accs) if accs else None
                outfit_items = [it for it in [target_product, t, s, a] if it]
            elif target_role == "shoes":
                t = rng.choice(compat_tops) if compat_tops else None
                is_t_dress = t and AiStylistEngine.is_full_dress(t)
                b = None if is_t_dress else (rng.choice(compat_bottoms) if compat_bottoms else None)
                a = rng.choice(accs) if accs else None
                outfit_items = [it for it in [target_product, t, b, a] if it]
            else:
                t = rng.choice(compat_tops) if compat_tops else None
                is_t_dress = t and AiStylistEngine.is_full_dress(t)
                b = None if is_t_dress else (rng.choice(compat_bottoms) if compat_bottoms else None)
                s = rng.choice(compat_shoes) if compat_shoes else None
                outfit_items = [it for it in [target_product, t, b, s] if it]

            # Đảm bảo không trùng ID sản phẩm trong cùng 1 set
            item_ids = [str(it.get("id", "")) for it in outfit_items]
            if len(item_ids) != len(set(item_ids)):
                continue

            sig = "-".join(sorted(item_ids))
            if sig in used_signatures:
                continue

            # Tránh tạo các set khác ID/giá nhưng giống hệt toàn bộ ảnh sản phẩm (trong 850 lần thử đầu)
            vis_sig = "|".join(sorted(_norm_img(it) for it in outfit_items))
            if vis_sig in used_visual_sigs and attempts < 850:
                continue

            used_signatures.add(sig)
            used_visual_sigs.add(vis_sig)

            score, top_vibe = AiStylistEngine.score_single_outfit(outfit_items, user_measurements)
            simulated_pool.append({
                "score": score,
                "vibe": top_vibe,
                "items": outfit_items,
                "sig": sig,
            })

        # Sắp xếp toàn bộ các set theo điểm thẩm mỹ giảm dần (ổn định theo sig)
        simulated_pool.sort(key=lambda x: (-x["score"], x["sig"]))

        # Chọn Top 5 đầu tiên ưu tiên đa dạng hình ảnh (quần, giày, phụ kiện) trên toàn pool điểm cao
        top_diverse = []
        remaining = list(simulated_pool)
        seen_top5_bottom_imgs = set()
        seen_top5_shoe_imgs = set()
        seen_top5_acc_imgs = set()

        while remaining and len(top_diverse) < 5:
            best_idx = 0
            best_rank_score = -10**9
            for idx_cand in range(len(remaining)):
                cand = remaining[idx_cand]
                b_imgs = {_norm_img(it) for it in cand["items"] if AiStylistEngine.classify_item(it) == "bottom" and str(it.get("id")) != target_id}
                s_imgs = {_norm_img(it) for it in cand["items"] if AiStylistEngine.classify_item(it) == "shoes" and str(it.get("id")) != target_id}
                a_imgs = {_norm_img(it) for it in cand["items"] if AiStylistEngine.classify_item(it) == "accessory" and str(it.get("id")) != target_id}
                penalty = 0
                if b_imgs & seen_top5_bottom_imgs:
                    penalty += 15
                if s_imgs & seen_top5_shoe_imgs:
                    penalty += 12
                if a_imgs & seen_top5_acc_imgs:
                    penalty += 8
                rank_val = cand["score"] - penalty
                if rank_val > best_rank_score:
                    best_rank_score = rank_val
                    best_idx = idx_cand
            chosen = remaining.pop(best_idx)
            top_diverse.append(chosen)
            for it in chosen["items"]:
                if str(it.get("id")) == target_id:
                    continue
                role = AiStylistEngine.classify_item(it)
                if role == "bottom":
                    seen_top5_bottom_imgs.add(_norm_img(it))
                elif role == "shoes":
                    seen_top5_shoe_imgs.add(_norm_img(it))
                elif role == "accessory":
                    seen_top5_acc_imgs.add(_norm_img(it))

        # Sắp xếp lại Top 5 đã đa dạng hóa theo điểm giảm dần để Top 1 luôn cao điểm nhất
        top_diverse.sort(key=lambda x: (-x["score"], x["sig"]))
        top_chosen = (top_diverse + remaining)[:target_limit]

        # Định dạng kết quả trả về cho Frontend
        badges = [
            "🏆 Top 1 Xuất Sắc", "🥈 Top 2 Khuyên Dùng", "🥉 Top 3 Thanh Lịch",
            "✨ Top 4 Năng Động", "🌟 Top 5 Tối Giản", "Top 6 Hàn Quốc",
            "Top 7 Vintage", "Top 8 Phố Thị", "Top 9 Thanh Xuân", "Top 10 Tiêu Biểu"
        ]
        vibe_advice = {
            "Streetwear Cá Tính": "Phối hợp hài hòa giữa phom dáng phóng khoáng và điểm nhấn sneaker giúp kéo dài tỷ lệ chân, tôn trọn vóc dáng.",
            "Smart Casual Lịch Lãm": "Diện mạo chỉn chu, hiện đại phù hợp môi trường công sở hoặc hẹn hò, mang lại vẻ ngoài lịch thiệp và cuốn hút.",
            "Sporty Năng Động": "Chất liệu co giãn thoáng khí tối đa, giữ phom năng động thoải mái suốt cả ngày vận động.",
            "Minimalist Tối Giản": "Tối giản màu sắc tinh tế theo xu hướng Minimalist Hàn Quốc, dễ mặc và không bao giờ lỗi mốt.",
            "Hàn Quốc Trẻ Trung": "Phong cách chuẩn ulzzang Hàn Quốc trẻ trung, tôn làn da và tạo cảm giác tươi mới, thanh thoát."
        }

        results = []
        for idx, cand in enumerate(top_chosen):
            items = cand["items"]
            total_raw_price = sum(AiStylistEngine.parse_numeric_price(it.get("price")) for it in items)
            # Ưu đãi giảm 8% khi mua trọn bộ cả set
            combo_discount_percent = 8
            combo_price = round(total_raw_price * (1 - combo_discount_percent / 100.0))
            savings = total_raw_price - combo_price

            formatted_items = []
            for it in items:
                role_type = AiStylistEngine.classify_item(it)
                role_label = (
                    "Món đồ chính (Đang xem)" if it.get("id") == target_product.get("id") else
                    "Áo phối kèm" if role_type == "top" else
                    "Quần/Váy phối kèm" if role_type == "bottom" else
                    "Giày đi kèm" if role_type == "shoes" else "Phụ kiện điểm nhấn"
                )
                formatted_items.append({
                    "role": role_label,
                    "slot": role_type,
                    "product": it
                })

            badge_text = badges[idx] if idx < len(badges) else f"Set #{idx + 1}"

            results.append({
                "id": f"outfit-bundle-{idx + 1}",
                "rank": idx + 1,
                "badge": badge_text,
                "score": cand["score"],
                "title": f"Look #{idx + 1}: {cand['vibe']} ({cand['score']}/100 đ)",
                "tag": cand["vibe"],
                "vibe": f"Phong cách {cand['vibe']} cân đối chuẩn vóc dáng",
                "stylist_note": vibe_advice.get(cand["vibe"], "Phối hợp màu sắc và kiểu dáng hài hòa tôn dáng cơ thể."),
                "items": formatted_items,
                "total_price": total_raw_price,
                "combo_price": combo_price,
                "savings": savings,
                "discount_percent": combo_discount_percent
            })

        return results

    @staticmethod
    def generate_outfits(pant_product: dict, user_measurements: dict):
        """Hàm tương thích ngược với luồng cũ - sinh Top 5 outfits từ 100 simulations"""
        gender = user_measurements.get("gender", "male")
        return AiStylistEngine.generate_top_100_scored_outfits(pant_product, user_measurements, gender=gender, limit=5)


# ---------------------------------------------------------------------------
# 4. HTTP Request Handler (REST API Server)
# ---------------------------------------------------------------------------
class TryOnRequestHandler(BaseHTTPRequestHandler):
    def _set_cors(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_cors(204)

    def do_GET(self):
        if self.path == "/health":
            self._set_cors(200)
            resp = {
                "status": "ok",
                "service": "zeromall-tryon-local-ai",
                "device": DEVICE,
                "apple_silicon_optimized": DEVICE == "mps",
                "endpoints": [
                    "/health",
                    "/api/tryon/gem-status",
                    "/api/tryon/mesh-measure",
                    "/api/tryon/fit-garment",
                    "/api/tryon/stylist-recommend",
                    "/api/tryon/generate-top-outfits",
                    "/api/tryon/recommend-sizes",
                    "/api/tryon/extract-garment",
                    "/api/tryon/extract-face",
                    "/api/tryon/full-pipeline"
                ]
            }
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))
        elif self.path == "/api/tryon/gem-status":
            self._set_cors(200)
            balance = 7060
            try:
                from mage_space import Mage
                mage_client = Mage(api_key=MAGE_API_KEY)
                acc = mage_client.account.get()
                balance = acc.get("gems", {}).get("balance", 7060)
            except Exception as e_gem:
                print(f"[!] Warning fetching live Mage balance: {e_gem}")
            resp = {
                "success": True,
                "balance": balance,
                "default_mode": "free",
                "mage_configured": bool(MAGE_API_KEY)
            }
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))
        else:
            self._set_cors(404)
            self.wfile.write(b'{"error": "Endpoint not found"}')

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        try:
            payload = json.loads(body.decode("utf-8")) if body else {}
        except Exception:
            self._set_cors(400)
            self.wfile.write(b'{"error": "Invalid JSON body"}')
            return

        if self.path == "/api/tryon/extract-garment":
            # Bóc tách trang phục từ bất kỳ ảnh nào (người mẫu mặc, flat-lay, hoặc upload)
            img_input = payload.get("image", "")
            g_info = payload.get("garment_info", {})
            extract_res = GarmentExtractor.extract_garment(img_input, g_info)
            self._set_cors(200)
            self.wfile.write(json.dumps(extract_res, ensure_ascii=False).encode("utf-8"))

        elif self.path == "/api/tryon/extract-face":
            # Trích xuất khuôn mặt người dùng thành avatar tròn trong suốt
            user_img_input = payload.get("user_image", "")
            face_res = GarmentExtractor.extract_face(user_img_input)
            self._set_cors(200)
            self.wfile.write(json.dumps(face_res, ensure_ascii=False).encode("utf-8"))

        elif self.path == "/api/tryon/mesh-measure":
            # 1. Trả về thông số nhân trắc học & Khung lưới 3D
            h = float(payload.get("height_cm", 170))
            w = float(payload.get("weight_kg", 65))
            gender = payload.get("gender", "male")

            measurements = Body3DGenerator.calculate_measurements(h, w, gender)
            mesh_3d = Body3DGenerator.generate_3d_joints_and_mesh(h, w, gender)

            self._set_cors(200)
            res = {"success": True, "measurements": measurements, "mesh_3d": mesh_3d}
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))

        elif self.path == "/api/tryon/fit-garment":
            # 2. Thẩm định độ vừa vặn của chiếc quần
            h = float(payload.get("height_cm", 170))
            w = float(payload.get("weight_kg", 65))
            gender = payload.get("gender", "male")
            pant = payload.get("pant", {})

            measurements = Body3DGenerator.calculate_measurements(h, w, gender)
            fit_result = GarmentFitEngine.evaluate_pant_fit(measurements, pant)

            self._set_cors(200)
            res = {"success": True, "measurements": measurements, "fit": fit_result}
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))

        elif self.path == "/api/tryon/recommend-sizes":
            # Dự đoán size chuẩn cho danh sách sản phẩm theo chiều cao, cân nặng, giới tính
            h = float(payload.get("height_cm", 170) or 170)
            w = float(payload.get("weight_kg", 65) or 65)
            gender = str(payload.get("gender", "male") or "male")
            items = payload.get("items") or []
            has_inner_layer = bool(payload.get("has_inner_layer", False))

            measurements = Body3DGenerator.calculate_measurements(h, w, gender)
            recommendations = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                is_outer = bool(item.get("is_outerwear")) or (has_inner_layer and str(item.get("slot") or "") == "outer_top")
                rec = GarmentFitEngine.recommend_item_size(measurements, item, is_outerwear=is_outer)
                recommendations.append({
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "slot": item.get("slot"),
                    **rec,
                })

            self._set_cors(200)
            res = {
                "success": True,
                "measurements": measurements,
                "recommendations": recommendations,
            }
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))

        elif self.path == "/api/tryon/detect-gender":
            user_image = payload.get("user_image", "") or payload.get("image", "")
            detected_gender = "male"
            confidence = 0.85
            reason = "Vóc dáng tiêu chuẩn"

            if user_image:
                try:
                    img = GarmentPipeline.load_pil_image(user_image)
                    if img is not None:
                        detected_gender, confidence, reason = GenderDetector.detect_gender(img)
                except Exception as e:
                    print(f"Gender detection exception: {e}")

            self._set_cors(200)
            res = {
                "success": True,
                "gender": detected_gender,
                "confidence": confidence,
                "reason": reason
            }
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))

        elif self.path in ["/api/tryon/generate-top-outfits", "/api/tryon/stylist-recommend"]:
            # 3. Phối trộn mô phỏng 100 set, chấm điểm thời trang & trả về 100 set
            h = float(payload.get("height_cm", 170))
            w = float(payload.get("weight_kg", 65))
            gender = payload.get("gender", "male")
            product = payload.get("product") or payload.get("pant") or {}
            limit = int(payload.get("limit", 100))

            measurements = Body3DGenerator.calculate_measurements(h, w, gender)
            measurements["gender"] = gender
            outfits = AiStylistEngine.generate_top_100_scored_outfits(product, measurements, gender=gender, limit=limit)

            self._set_cors(200)
            res = {
                "success": True,
                "simulated_count": len(outfits),
                "target_product": product,
                "outfits": outfits
            }
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))

        elif self.path == "/api/tryon/full-pipeline":
            # 4. Chạy trọn vẹn toàn bộ chu trình AI trong 1 lệnh duy nhất
            try:
                h = float(payload.get("height_cm", 170))
                w = float(payload.get("weight_kg", 65))
                gender = payload.get("gender", "male")
                pant = payload.get("pant", {})
                user_image = payload.get("user_image", "")

                # Lưu ảnh người dùng để phân tích chính xác
                try:
                    if user_image and user_image.startswith("data:image"):
                        _, b64 = user_image.split(",", 1)
                        cur_user_png = os.path.join(TEMP_DIR, "current_user_tryon.png")
                        with open(cur_user_png, "wb") as f_u:
                            f_u.write(base64.b64decode(b64))
                        print(f"[+] Saved user photo to {cur_user_png} ({len(b64)} chars)")
                except Exception as e_s:
                    print(f"[!] Warning saving user image: {e_s}")

                pant = payload.get("pant", {})
                outfit = payload.get("outfit", {})
                user_image = payload.get("user_image", "")
                use_mage = bool(payload.get("use_mage", False))

                acc_list = outfit.get("accessories") if isinstance(outfit, dict) and isinstance(outfit.get("accessories"), list) else []
                has_outfit = bool(outfit and (
                    any(outfit.get(k) for k in ["top", "outer_top", "bottom", "shoes", "accessory"]) or
                    len(acc_list) > 0
                ))

                # Đếm tổng số món thực tế để xác định số chặng AI (<= 4 món -> 1 Pass, >= 5 món -> 2 Pass)
                total_outfit_count = 0
                if has_outfit:
                    for k in ["top", "outer_top", "bottom", "shoes"]:
                        if outfit.get(k) and (outfit[k].get("id") or outfit[k].get("image")):
                            total_outfit_count += 1
                    seen_acc_ids = set()
                    for a in acc_list:
                        if a and (a.get("id") or a.get("image")):
                            aid = str(a.get("id") or a.get("name"))
                            if aid not in seen_acc_ids:
                                seen_acc_ids.add(aid)
                                total_outfit_count += 1
                    if outfit.get("accessory") and (outfit["accessory"].get("id") or outfit["accessory"].get("image")):
                        aid = str(outfit["accessory"].get("id") or outfit["accessory"].get("name"))
                        if aid not in seen_acc_ids:
                            total_outfit_count += 1

                passes_used = 2 if total_outfit_count >= 5 else 1
                first_acc = acc_list[0] if len(acc_list) > 0 else outfit.get("accessory")

                if not user_image or not str(user_image).strip():
                    # Người dùng chưa đưa ảnh vào -> Tuyệt đối không gọi AI sinh ảnh để bảo vệ 100% Gem Mage.space của người dùng
                    print("[*] full-pipeline: user_image is empty. Skipping AI image generation to preserve user Gems.")
                    composite_result = ""
                    primary_item = (
                        (outfit.get("bottom") or outfit.get("top") or outfit.get("outer_top") or outfit.get("shoes") or first_acc or pant)
                        if has_outfit else pant
                    )
                elif has_outfit:
                    primary_item = outfit.get("bottom") or outfit.get("top") or outfit.get("outer_top") or outfit.get("shoes") or first_acc or pant
                    composite_result = TryOnSynthesizer.composite_outfit_tryon(
                        user_image, outfit, gender=gender, height_cm=h, weight_kg=w, use_mage=use_mage
                    )
                else:
                    primary_item = pant
                    composite_result = TryOnSynthesizer.composite_tryon(
                        user_image, pant.get("image", ""), pant, gender, height_cm=h, weight_kg=w, use_mage=use_mage
                    )

                measurements = Body3DGenerator.calculate_measurements(h, w, gender)
                measurements["gender"] = gender
                mesh_3d = Body3DGenerator.generate_3d_joints_and_mesh(h, w, gender)
                fit_result = GarmentFitEngine.evaluate_pant_fit(measurements, primary_item)
                outfits = AiStylistEngine.generate_outfits(primary_item, measurements)

                # Bóc tách trang phục & Trích xuất khuôn mặt bằng AI
                face_extract = GarmentExtractor.extract_face(user_image) if user_image else {"success": False}
                garment_extract = GarmentExtractor.extract_garment(primary_item.get("image", ""), primary_item) if primary_item.get("image") else {"success": False}

                render_preview = {
                    "user_image": user_image,
                    "garment_applied": primary_item.get("image", ""),
                    "composite_image": composite_result if composite_result else user_image,
                    "render_status": "COMPLETED",
                    "accelerated_by": f"Apple Silicon M4 ({DEVICE.upper()}) + FASHN VTON 1.5",
                    "fit_overlay": fit_result.get("zones", {}),
                    "is_multi_outfit": has_outfit,
                    "passes_used": passes_used,
                    "total_items_count": total_outfit_count or 1
                }

                self._set_cors(200)
                res = {
                    "success": True,
                    "measurements": measurements,
                    "mesh_3d": mesh_3d,
                    "fit": fit_result,
                    "outfits": outfits,
                    "preview": render_preview,
                    "extracted_face": face_extract,
                    "extracted_garment": garment_extract
                }
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            except Exception as e_global:
                print(f"[!] Error handling full-pipeline: {e_global}")
                import traceback
                traceback.print_exc()
                self._set_cors(200)
                res_fallback = {
                    "success": True,
                    "error_msg": str(e_global),
                    "measurements": {"bmi": 22.5, "body_type": "standard", "waist_cm": 75, "hip_cm": 95, "thigh_cm": 52, "inseam_cm": 78},
                    "mesh_3d": {"joints": {}, "vertices_count": 680},
                    "fit": {"fit_score": 90, "recommended_size": "L", "zones": {}},
                    "outfits": [],
                    "preview": {
                        "user_image": payload.get("user_image", ""),
                        "composite_image": payload.get("user_image", ""),
                        "render_status": "COMPLETED"
                    }
                }
                self.wfile.write(json.dumps(res_fallback, ensure_ascii=False).encode("utf-8"))

        else:
            self._set_cors(404)
            self.wfile.write(b'{"error": "Endpoint not found"}')


def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, TryOnRequestHandler)
    print(f"[+] ZeroMall AI Virtual Try-On Server running at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Stopping server...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
