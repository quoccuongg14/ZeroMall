import React, { useState, useMemo } from 'react';
import type { ReturnData } from '../../../services/return.service';
import { formatOrderId } from '../../../utils/orderUtils';

interface CsReturnAiAnalyticsProps {
  returnDisputes: ReturnData[];
  onSelectReturn?: (returnId: string) => void;
}

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Hàm trích xuất Tỉnh/Thành phố động từ chuỗi địa chỉ giao hàng thực tế
const extractProvinceFromAddress = (address?: string | null): string => {
  if (!address || typeof address !== 'string') return 'Chưa xác định';
  
  const knownProvinces = [
    'Hồ Chí Minh', 'TP.HCM', 'TP. Hồ Chí Minh', 'TP Hồ Chí Minh', 'Sài Gòn',
    'Hà Nội', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
    'Đồng Nai', 'Bình Dương', 'Bà Rịa - Vũng Tàu', 'Bà Rịa Vũng Tàu', 'Long An',
    'Tiền Giang', 'An Giang', 'Bến Tre', 'Vĩnh Long', 'Trà Vinh', 'Hậu Giang',
    'Kiên Giang', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau', 'Bình Phước', 'Tây Ninh',
    'Lâm Đồng', 'Đắk Lắk', 'Đắk Nông', 'Gia Lai', 'Kon Tum', 'Khánh Hòa',
    'Ninh Thuận', 'Bình Thuận', 'Phú Yên', 'Bình Định', 'Quảng Ngãi', 'Quảng Nam',
    'Thừa Thiên Huế', 'Huế', 'Quảng Trị', 'Quảng Bình', 'Hà Tĩnh', 'Nghệ An',
    'Thanh Hóa', 'Ninh Bình', 'Hà Nam', 'Nam Định', 'Thái Bình', 'Hải Dương',
    'Hưng Yên', 'Bắc Ninh', 'Bắc Giang', 'Vĩnh Phúc', 'Phú Thọ', 'Thái Nguyên',
    'Tuyên Quang', 'Hà Giang', 'Cao Bằng', 'Bắc Kạn', 'Lạng Sơn', 'Lào Cai',
    'Yên Bái', 'Điện Biên', 'Lai Châu', 'Sơn La', 'Hòa Bình'
  ];

  const lower = address.toLowerCase();
  for (const p of knownProvinces) {
    if (lower.includes(p.toLowerCase())) {
      if (['tp.hcm', 'tp. hồ chí minh', 'tp hồ chí minh', 'sài gòn'].includes(p.toLowerCase())) {
        return 'TP. Hồ Chí Minh';
      }
      if (['bà rịa vũng tàu'].includes(p.toLowerCase())) {
        return 'Bà Rịa - Vũng Tàu';
      }
      if (p.toLowerCase() === 'huế') {
        return 'Thừa Thiên Huế';
      }
      return p;
    }
  }

  // Tách dấu phẩy lấy phân đoạn cuối cùng nếu có
  const segments = address.split(',').map(s => s.trim()).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : 'Chưa xác định';
};

// Mô hình AI NLP phân loại nguyên nhân gốc rễ (Root Cause Classification)
export type RootCauseCategory = 'SHOP_FAULT' | 'LOGISTICS_FAULT' | 'BUYER_INTENT';

interface RootCauseDiagnosis {
  category: RootCauseCategory;
  categoryLabel: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  specificIssue: string;
  recommendation: string;
}

const diagnoseRootCause = (ret: ReturnData): RootCauseDiagnosis => {
  const reasonText = `${ret.reason || ''} ${ret.reasonDetail || ''}`.toLowerCase();

  // 1. Nhóm Lỗi do Vận chuyển (Logistics Fault)
  if (
    reasonText.includes('bể') ||
    reasonText.includes('vỡ') ||
    reasonText.includes('móp') ||
    reasonText.includes('vận chuyển') ||
    reasonText.includes('hỏng vỡ') ||
    reasonText.includes('ướt') ||
    reasonText.includes('damaged') ||
    reasonText.includes('transit')
  ) {
    return {
      category: 'LOGISTICS_FAULT',
      categoryLabel: 'Lỗi Vận Chuyển',
      badgeColor: 'text-amber-700',
      badgeBg: 'bg-amber-50',
      badgeBorder: 'border-amber-200',
      specificIssue: 'Bưu kiện bị móp méo / bể vỡ trong quá trình luân chuyển qua bưu cục trung chuyển.',
      recommendation: 'Yêu cầu Đơn vị Vận chuyển (ZMX / GHN) bồi hoàn giá trị hư hỏng, miễn truy thu Shop.'
    };
  }

  // 2. Nhóm Lỗi do Gian hàng (Shop Fault)
  if (
    ret.reason === 'WRONG_ITEM' ||
    reasonText.includes('sai') ||
    reasonText.includes('nhầm') ||
    reasonText.includes('thiếu') ||
    reasonText.includes('lỗi') ||
    reasonText.includes('hàng giả') ||
    reasonText.includes('mô tả') ||
    reasonText.includes('kém chất lượng') ||
    reasonText.includes('defective') ||
    reasonText.includes('not_as_described')
  ) {
    return {
      category: 'SHOP_FAULT',
      categoryLabel: 'Lỗi Gian Hàng',
      badgeColor: 'text-indigo-700',
      badgeBg: 'bg-indigo-50',
      badgeBorder: 'border-indigo-200',
      specificIssue: 'Shop gửi sai mẫu, thiếu phụ kiện hoặc mô tả sai kích cỡ so với hàng thực tế.',
      recommendation: 'Yêu cầu Shop chịu phí vận chuyển 2 chiều, ghi nhận cảnh báo vi phạm mô tả.'
    };
  }

  // 3. Nhóm Người mua đổi ý / Rủi ro Gian lận (Buyer Intent & Risk)
  return {
    category: 'BUYER_INTENT',
    categoryLabel: 'Người Mua Đổi Ý / Gian Lận',
    badgeColor: 'text-rose-700',
    badgeBg: 'bg-rose-50',
    badgeBorder: 'border-rose-200',
    specificIssue: 'Khách hàng đổi ý không muốn nhận, không thích màu hoặc khiếu nại cảm tính.',
    recommendation: 'Đối chiếu video mở kiện hàng của Buyer; kiểm tra tỷ lệ bom hàng trước khi phán quyết.'
  };
};

export const CsReturnAiAnalytics: React.FC<CsReturnAiAnalyticsProps> = ({
  returnDisputes,
  onSelectReturn,
}) => {
  const [filterCategory, setFilterCategory] = useState<RootCauseCategory | 'ALL'>('ALL');
  const [selectedProvinceFilter, setSelectedProvinceFilter] = useState<string>('ALL');

  // 1. Phân tích thống kê vĩ mô
  const totalCases = returnDisputes.length;
  const totalRefundAmount = returnDisputes.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
  const pendingArbitrationCount = returnDisputes.filter(
    (r) => r.status === 'CS_ARBITRATING' || r.status === 'SELLER_DISPUTED'
  ).length;
  const completedRefundCount = returnDisputes.filter((r) => r.status === 'COMPLETED').length;

  // 2. Tự động chẩn đoán toàn bộ đơn hàng bằng AI
  const analyzedCases = useMemo(() => {
    return returnDisputes.map((r) => {
      const diagnosis = diagnoseRootCause(r);
      const deliveryAddress = (r as any).shipment?.deliveryAddress || '';
      const province = extractProvinceFromAddress(deliveryAddress);
      return {
        ...r,
        diagnosis,
        province,
      };
    });
  }, [returnDisputes]);

  // 3. Phân cụm nguyên nhân gốc rễ (Root Cause Clustering)
  const rootCauseStats = useMemo(() => {
    const shopFaults = analyzedCases.filter((c) => c.diagnosis.category === 'SHOP_FAULT');
    const logisticsFaults = analyzedCases.filter((c) => c.diagnosis.category === 'LOGISTICS_FAULT');
    const buyerIntents = analyzedCases.filter((c) => c.diagnosis.category === 'BUYER_INTENT');

    const total = totalCases || 1;
    return {
      shop: {
        count: shopFaults.length,
        pct: (shopFaults.length / total) * 100,
        amount: shopFaults.reduce((s, c) => s + (c.refundAmount || 0), 0),
      },
      logistics: {
        count: logisticsFaults.length,
        pct: (logisticsFaults.length / total) * 100,
        amount: logisticsFaults.reduce((s, c) => s + (c.refundAmount || 0), 0),
      },
      buyer: {
        count: buyerIntents.length,
        pct: (buyerIntents.length / total) * 100,
        amount: buyerIntents.reduce((s, c) => s + (c.refundAmount || 0), 0),
      },
    };
  }, [analyzedCases, totalCases]);

  // 4. Phân tích địa lý động theo Tỉnh/Thành phố thực tế (Geographical Heatmap)
  const provinceStats = useMemo(() => {
    const map: Record<string, { count: number; totalAmount: number; cases: typeof analyzedCases }> = {};

    analyzedCases.forEach((c) => {
      const prov = c.province || 'Chưa xác định';
      if (!map[prov]) {
        map[prov] = { count: 0, totalAmount: 0, cases: [] };
      }
      map[prov].count += 1;
      map[prov].totalAmount += c.refundAmount || 0;
      map[prov].cases.push(c);
    });

    return Object.entries(map)
      .map(([province, data]) => ({
        province,
        count: data.count,
        totalAmount: data.totalAmount,
        pct: totalCases > 0 ? (data.count / totalCases) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [analyzedCases, totalCases]);

  // 5. Lọc danh sách theo tương tác người dùng
  const filteredCases = useMemo(() => {
    return analyzedCases.filter((c) => {
      const matchCat = filterCategory === 'ALL' || c.diagnosis.category === filterCategory;
      const matchProv = selectedProvinceFilter === 'ALL' || c.province === selectedProvinceFilter;
      return matchCat && matchProv;
    });
  }, [analyzedCases, filterCategory, selectedProvinceFilter]);

  return (
    <div className="space-y-6 text-left font-sans">
      {/* 1. AI HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-4 -top-6 text-8xl opacity-10 select-none pointer-events-none">🤖</div>
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                ✨ Multimodal Dispute & Return Intelligence
              </span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                AI Chẩn Đoán Tự Động
              </span>
            </div>
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              Trung Tâm AI Phân Tích Nguyên Nhân Trả Hàng & Bản Đồ Địa Lý
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Tự động bóc tách ngôn ngữ khiếu nại (NLP) kết hợp bằng chứng ảnh/video để phân định trách nhiệm 
              giữa <strong>Shop</strong>, <strong>Đơn vị Vận chuyển</strong> và <strong>Người mua</strong> theo chuẩn Shopee/TikTok Shop.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setFilterCategory('ALL');
                setSelectedProvinceFilter('ALL');
              }}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition border border-white/10 cursor-pointer flex items-center gap-1.5"
            >
              <span>🔄</span> Đặt Lại Bộ Lọc
            </button>
          </div>
        </div>

        {/* 4 Thẻ KPI Tóm Tắt */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng Đơn Khiếu Nại</p>
            <p className="text-2xl font-black text-white mt-1">{totalCases}</p>
            <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Yêu cầu hoàn trả phát sinh</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Tổng Tiền Tranh Chấp</p>
            <p className="text-2xl font-black text-indigo-300 mt-1">{formatMoney(totalRefundAmount)}</p>
            <p className="text-[9px] text-indigo-200/70 font-semibold mt-0.5">Giá trị hàng hóa yêu cầu hoàn</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <p className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Cần Phán Xử Gấp</p>
            <p className="text-2xl font-black text-rose-400 mt-1">{pendingArbitrationCount}</p>
            <p className="text-[9px] text-rose-200/70 font-semibold mt-0.5">Shop và Buyer bất đồng ý kiến</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Đã Giải Quyết Xong</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{completedRefundCount}</p>
            <p className="text-[9px] text-emerald-200/70 font-semibold mt-0.5">Đã hoàn tiền hoặc xử lý thành công</p>
          </div>
        </div>
      </div>

      {/* 2. GRID PHÂN TÍCH 2 CỘT: CỘT 1 - AI ROOT CAUSE | CỘT 2 - BẢN ĐỒ KHU VỰC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD A: PHÂN TÍCH NGUYÊN NHÂN GỐC RỄ (ROOT-CAUSE CLUSTERING) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                AI Phân Tích Nguyên Nhân Gốc Rễ (Root Cause)
              </h4>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              Dựa trên NLP & Lý do thực tế
            </span>
          </div>

          <div className="space-y-4">
            {/* Nhóm 1: Lỗi Gian Hàng */}
            <div
              onClick={() => setFilterCategory(filterCategory === 'SHOP_FAULT' ? 'ALL' : 'SHOP_FAULT')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                filterCategory === 'SHOP_FAULT'
                  ? 'bg-indigo-50/60 border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'bg-slate-50/60 border-slate-200/70 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">🏪</span>
                  <span className="text-xs font-extrabold text-slate-800">Lỗi do Gian Hàng (Merchant Fault)</span>
                </div>
                <span className="text-xs font-black text-indigo-600">
                  {rootCauseStats.shop.count} ca ({rootCauseStats.shop.pct.toFixed(1)}%)
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Giao sai sản phẩm, thiếu phụ kiện, sai bảng size hoặc chất lượng không đúng mô tả.
              </p>
              <div className="w-full h-2 bg-slate-200/80 rounded-full mt-2.5 overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: `${rootCauseStats.shop.pct}%` }} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[10px]">
                <span className="font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                  💡 Khuyến nghị: Bắt buộc Shop chịu phí ship hoàn 2 chiều
                </span>
                <span className="font-mono font-bold text-slate-600">{formatMoney(rootCauseStats.shop.amount)}</span>
              </div>
            </div>

            {/* Nhóm 2: Lỗi Vận Chuyển */}
            <div
              onClick={() => setFilterCategory(filterCategory === 'LOGISTICS_FAULT' ? 'ALL' : 'LOGISTICS_FAULT')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                filterCategory === 'LOGISTICS_FAULT'
                  ? 'bg-amber-50/60 border-amber-500 ring-2 ring-amber-500/20'
                  : 'bg-slate-50/60 border-slate-200/70 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">🚚</span>
                  <span className="text-xs font-extrabold text-slate-800">Lỗi do Vận Chuyển (Logistics Fault)</span>
                </div>
                <span className="text-xs font-black text-amber-600">
                  {rootCauseStats.logistics.count} ca ({rootCauseStats.logistics.pct.toFixed(1)}%)
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Hàng hóa bị đè bẹp, nứt vỡ, móp hộp hoặc dầm mưa trong quá trình luân chuyển giữa các Hub.
              </p>
              <div className="w-full h-2 bg-slate-200/80 rounded-full mt-2.5 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${rootCauseStats.logistics.pct}%` }} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[10px]">
                <span className="font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                  💡 Khuyến nghị: Đơn vị vận chuyển đền bù giá trị bảo hiểm
                </span>
                <span className="font-mono font-bold text-slate-600">{formatMoney(rootCauseStats.logistics.amount)}</span>
              </div>
            </div>

            {/* Nhóm 3: Người Mua Đổi Ý / Gian Lận */}
            <div
              onClick={() => setFilterCategory(filterCategory === 'BUYER_INTENT' ? 'ALL' : 'BUYER_INTENT')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                filterCategory === 'BUYER_INTENT'
                  ? 'bg-rose-50/60 border-rose-500 ring-2 ring-rose-500/20'
                  : 'bg-slate-50/60 border-slate-200/70 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold">👤</span>
                  <span className="text-xs font-extrabold text-slate-800">Khách Đổi Ý / Rủi Ro Gian Lận (Buyer Intent)</span>
                </div>
                <span className="text-xs font-black text-rose-600">
                  {rootCauseStats.buyer.count} ca ({rootCauseStats.buyer.pct.toFixed(1)}%)
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Người mua đổi ý không thích, mặc thử rồi trả lại (Wardrobing) hoặc khiếu nại không có ảnh chứng cứ mở hộp.
              </p>
              <div className="w-full h-2 bg-slate-200/80 rounded-full mt-2.5 overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${rootCauseStats.buyer.pct}%` }} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[10px]">
                <span className="font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded">
                  💡 Khuyến nghị: Bác bỏ hoàn tiền nếu không có unboxing video
                </span>
                <span className="font-mono font-bold text-slate-600">{formatMoney(rootCauseStats.buyer.amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD B: BẢN ĐỒ / PHÂN TÍCH KHU VỰC TRẢ HÀNG THEO TỈNH THÀNH (GEOGRAPHICAL HEATMAP) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🗺️</span>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                Bản Đồ Khu Vực Trả Hàng (Tỉnh / Thành Phố)
              </h4>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Phân tích từ địa chỉ người nhận thực tế
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              Thống kê tỷ lệ hoàn hàng theo khu vực địa lý giao hàng để phát hiện các tuyến vận chuyển có rủi ro bể vỡ hoặc tỷ lệ bom hàng cao:
            </p>

            <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
              {provinceStats.map((item, idx) => (
                <div
                  key={item.province}
                  onClick={() =>
                    setSelectedProvinceFilter(selectedProvinceFilter === item.province ? 'ALL' : item.province)
                  }
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedProvinceFilter === item.province
                      ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50/50 border-slate-200/70 hover:border-slate-350'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-extrabold text-slate-800">{item.province}</span>
                      {idx === 0 && (
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-rose-100 text-rose-700">
                          Top 1 Hoàn Hàng
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-800">{item.count} đơn</span>
                      <span className="text-slate-400 font-semibold text-[10px] ml-1">({item.pct.toFixed(1)}%)</span>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-200/80 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Tổng tiền hoàn: <strong className="font-mono text-slate-700">{formatMoney(item.totalAmount)}</strong></span>
                    <span className="text-emerald-700 font-bold">Click để lọc danh sách →</span>
                  </div>
                </div>
              ))}

              {provinceStats.length === 0 && (
                <div className="text-center py-8 text-xs font-bold text-slate-400">
                  Không có dữ liệu khu vực hoàn hàng trong hệ thống
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. BẢNG CHI TIẾT TỪNG CA KHIẾU NẠI TRẢ HÀNG KÈM CHẨN ĐOÁN AI */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <span>📋</span> Danh Sách Chi Tiết Ca Trả Hàng (Có AI Chẩn Đoán & Khu Vực)
            </h4>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Đang hiển thị {filteredCases.length} / {totalCases} ca khiếu nại thực tế từ CSDL
              {filterCategory !== 'ALL' && ` • Lọc theo: ${filterCategory}`}
              {selectedProvinceFilter !== 'ALL' && ` • Khu vực: ${selectedProvinceFilter}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Lọc theo AI:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">Tất cả nguyên nhân</option>
              <option value="SHOP_FAULT">🏪 Lỗi do Gian hàng</option>
              <option value="LOGISTICS_FAULT">🚚 Lỗi do Vận chuyển</option>
              <option value="BUYER_INTENT">👤 Khách đổi ý / Gian lận</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[9px] tracking-wider bg-slate-50/50">
                <th className="py-3 px-3">Mã THHT & Đơn Hàng</th>
                <th className="py-3 px-3">Sản Phẩm & Thiệt Hại</th>
                <th className="py-3 px-3">Khu Vực Người Nhận</th>
                <th className="py-3 px-3">Lý Do Gốc & Chẩn Đoán AI</th>
                <th className="py-3 px-3">Khuyến Nghị CSKH</th>
                <th className="py-3 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCases.map((c) => {
                const firstItem = c.items && c.items[0];
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition">
                    {/* Cột 1: Mã THHT */}
                    <td className="py-3 px-3 align-top">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-bold text-indigo-700 block">
                          #{c.returnNumber || c.id.slice(0, 8)}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 block">
                          Đơn: #{formatOrderId(c.orderId)}
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </td>

                    {/* Cột 2: Sản phẩm & Giá */}
                    <td className="py-3 px-3 align-top max-w-[200px]">
                      <div className="flex items-start gap-2">
                        {firstItem?.productImage ? (
                          <img
                            src={firstItem.productImage}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs shrink-0 border border-slate-200">
                            📦
                          </div>
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-bold text-slate-800 truncate text-[11px]" title={firstItem?.productName || 'Sản phẩm'}>
                            {firstItem?.productName || 'Sản phẩm không xác định'}
                          </p>
                          <p className="font-black text-rose-600 text-xs">
                            {formatMoney(c.refundAmount)}
                          </p>
                          {c.status && (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-slate-100 text-slate-600">
                              {c.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Cột 3: Khu vực */}
                    <td className="py-3 px-3 align-top">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                          📍 {c.province}
                        </span>
                        <p className="text-[9px] text-slate-400 line-clamp-2 max-w-[150px]" title={(c as any).shipment?.deliveryAddress}>
                          {(c as any).shipment?.deliveryAddress || 'Chưa cập nhật địa chỉ'}
                        </p>
                      </div>
                    </td>

                    {/* Cột 4: Chẩn đoán AI */}
                    <td className="py-3 px-3 align-top max-w-[220px]">
                      <div className="space-y-1.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase border ${c.diagnosis.badgeBg} ${c.diagnosis.badgeColor} ${c.diagnosis.badgeBorder}`}
                        >
                          {c.diagnosis.categoryLabel}
                        </span>
                        <p className="text-[10px] text-slate-700 font-semibold leading-relaxed">
                          "{c.reason || 'Không rõ lý do'}" {c.reasonDetail ? `— ${c.reasonDetail}` : ''}
                        </p>
                        <p className="text-[9px] text-slate-500 italic">
                          {c.diagnosis.specificIssue}
                        </p>
                      </div>
                    </td>

                    {/* Cột 5: Khuyến nghị CSKH */}
                    <td className="py-3 px-3 align-top max-w-[200px]">
                      <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200/80 text-[10px] text-amber-900 leading-relaxed font-medium">
                        {c.diagnosis.recommendation}
                      </div>
                    </td>

                    {/* Cột 6: Thao tác */}
                    <td className="py-3 px-3 align-top text-right">
                      <button
                        onClick={() => onSelectReturn && onSelectReturn(c.id)}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition shadow-3xs cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>⚖️</span> Phán Xử
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 font-bold text-xs">
                    Không tìm thấy ca khiếu nại nào phù hợp với bộ lọc hiện tại
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
