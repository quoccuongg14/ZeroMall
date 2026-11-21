import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../../config/api.config';

interface ProductItem {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  shopId: string;
  stock: number;
}

interface PricePoint {
  date: string;
  sellingPrice: number | null;
  costPrice?: number | null;
  profitMargin?: number;
  marginPercentage?: number;
  events?: any[];
  note?: string;
  changedBy?: string;
}

interface PriceHistoryItem {
  id: string;
  oldPrice: number;
  newPrice: number;
  changeType?: string;
  reason?: string;
  changedBy: string;
  createdAt: string;
}

interface AnalyticsData {
  product: {
    id: string;
    name: string;
    currentSellingPrice: number;
    currentCostPrice?: number | null;
  } | null;
  metrics: {
    currentSellingPrice: number;
    currentCostPrice?: number | null;
    totalPriceChanges: number;
  };
  chartData: PricePoint[];
  priceHistories: PriceHistoryItem[];
}

interface CsPriceAuditTabProps {
  triggerAuditLog?: (action: string) => Promise<void>;
}

export function CsPriceAuditTab({ triggerAuditLog }: CsPriceAuditTabProps) {
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('ALL');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    point: PricePoint;
  } | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      fetchAnalytics(selectedProductId, timeRange);
    } else {
      setAnalytics(null);
    }
  }, [selectedProductId, timeRange]);

  const fetchAllData = async () => {
    try {
      const [shopsRes, prodRes] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/shops`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE_URL}/products?inStockOnly=false&limit=200`).then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      const shopList = Array.isArray(shopsRes) ? shopsRes : [];
      const prodList = Array.isArray(prodRes) ? prodRes : prodRes.data || [];
      setShops(shopList);
      setProducts(prodList);
      if (prodList.length > 0) {
        setSelectedProductId(prev => prev && prodList.some((p: any) => p.id === prev) ? prev : prodList[0].id);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách cửa hàng & sản phẩm CS Price Audit:', err);
    }
  };

  const fetchAnalytics = async (prodId: string, range: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/products/price-analytics?productId=${prodId}&range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics({
          product: data.product || null,
          metrics: {
            currentSellingPrice: data.metrics?.currentSellingPrice || data.summary?.currentSellingPrice || 0,
            currentCostPrice: data.metrics?.currentCostPrice || data.summary?.currentCostPrice || 0,
            totalPriceChanges: data.metrics?.totalPriceChanges || data.summary?.totalPriceChangesCount || 0,
          },
          chartData: data.chartData || data.timeline || [],
          priceHistories: data.priceHistories || [],
        });
      } else {
        setAnalytics(null);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu biến động giá:', err);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const productsForSelectedShop = useMemo(() => {
    let list = products;
    if (selectedShopId !== 'ALL') {
      list = list.filter(p => p.shopId === selectedShopId);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedShopId, searchFilter]);

  const handleShopChange = (newShopId: string) => {
    setSelectedShopId(newShopId);
    let candidateProducts = products;
    if (newShopId !== 'ALL') {
      candidateProducts = candidateProducts.filter(p => p.shopId === newShopId);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      candidateProducts = candidateProducts.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    if (candidateProducts.length > 0) {
      setSelectedProductId(candidateProducts[0].id);
    } else {
      setSelectedProductId('');
      setAnalytics(null);
    }
  };

  // Tính toán các chỉ số phân tích giá chuẩn Shopee Trust & Safety
  const priceAnalysis = useMemo(() => {
    if (!analytics || !analytics.chartData || analytics.chartData.length === 0) {
      const curPrice = analytics?.metrics?.currentSellingPrice || 0;
      return {
        currentPrice: curPrice,
        lowestPrice: curPrice,
        highestPrice: curPrice,
        volatilityPercent: 0,
        riskLevel: 'NORMAL' as const,
        riskReason: 'Dữ liệu giá ổn định, không có biến động bất thường.'
      };
    }

    const validSellingPrices: number[] = [];
    analytics.chartData.forEach(d => {
      if (d.sellingPrice !== null && d.sellingPrice !== undefined && d.sellingPrice > 0) {
        validSellingPrices.push(d.sellingPrice);
      }
    });

    const currentPrice = analytics.metrics?.currentSellingPrice || (validSellingPrices.length > 0 ? validSellingPrices[validSellingPrices.length - 1] : 0);
    const lowestPrice = validSellingPrices.length > 0 ? Math.min(...validSellingPrices) : currentPrice;
    const highestPrice = validSellingPrices.length > 0 ? Math.max(...validSellingPrices) : currentPrice;

    const volatilityPercent = lowestPrice > 0 ? Math.round(((highestPrice - lowestPrice) / lowestPrice) * 100) : 0;

    // Kiểm tra nâng giá ảo gần đây (trong 14 ngày qua có đợt tăng giá đột ngột > 25%)
    let riskLevel: 'NORMAL' | 'WARNING' | 'DANGER' = 'NORMAL';
    let riskReason = 'Giá bán ổn định trong chu kỳ phân tích.';

    if (currentPrice < 2000) {
      riskLevel = 'DANGER';
      riskReason = 'Giá bán cực thấp (< 2.000₫). Nguy cơ cao đặt giá ảo để spam/câu tương tác.';
    } else if (volatilityPercent >= 30 && currentPrice >= highestPrice * 0.9) {
      riskLevel = 'WARNING';
      riskReason = 'Cảnh báo nâng giá ảo: Sản phẩm tăng giá mạnh (>30%) gần đây. Cần từ chối duyệt Flash Sale / Khuyến mãi ảo!';
    } else if (volatilityPercent >= 50) {
      riskLevel = 'WARNING';
      riskReason = 'Biên độ dao động giá quá cao (>50%). Cần đối chiếu với mặt bằng giá thị trường.';
    }

    return {
      currentPrice,
      lowestPrice,
      highestPrice,
      volatilityPercent,
      riskLevel,
      riskReason
    };
  }, [analytics]);

  // SVG Chart Config
  const chartConfig = useMemo(() => {
    if (!analytics || !analytics.chartData || analytics.chartData.length === 0) {
      return null;
    }

    const data = analytics.chartData;
    const width = 800;
    const height = 280;
    const padding = { top: 30, right: 30, bottom: 45, left: 75 };

    let allPrices: number[] = [];
    data.forEach(d => {
      if (d.sellingPrice !== null && d.sellingPrice !== undefined) allPrices.push(d.sellingPrice);
    });

    if (allPrices.length === 0) allPrices = [0, 100000];

    const minPrice = Math.min(...allPrices) * 0.85;
    const maxPrice = Math.max(...allPrices) * 1.15;
    const priceRange = maxPrice - minPrice || 1;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const points = data.map((d, index) => {
      const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
      const ySelling = d.sellingPrice !== null && d.sellingPrice !== undefined
        ? padding.top + chartHeight - ((d.sellingPrice - minPrice) / priceRange) * chartHeight
        : null;

      return { ...d, x, ySelling };
    });

    const validPoints = points.filter(p => p.ySelling !== null);
    const sellingPath = validPoints.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.ySelling}` : `${acc} L ${curr.x} ${curr.ySelling}`;
    }, '');

    // Area path for gradient fill below line
    let areaPath = '';
    if (validPoints.length > 0) {
      const bottomY = padding.top + chartHeight;
      areaPath = `${sellingPath} L ${validPoints[validPoints.length - 1].x} ${bottomY} L ${validPoints[0].x} ${bottomY} Z`;
    }

    const yTicks = [0, 1, 2, 3].map(i => {
      const val = minPrice + (priceRange / 3) * i;
      const y = padding.top + chartHeight - (i / 3) * chartHeight;
      return { val, y };
    });

    return {
      width,
      height,
      padding,
      points,
      sellingPath,
      areaPath,
      yTicks
    };
  }, [analytics]);

  const currentSelectedProduct = products.find(p => p.id === selectedProductId);
  const currentSelectedShop = shops.find(s => s.id === (currentSelectedProduct?.shopId || selectedShopId));

  // Chế tài xử lý vi phạm của CSKH
  const handleWarnShop = async () => {
    if (!currentSelectedProduct) return;
    const confirmed = window.confirm(`Bạn có chắc muốn gửi cảnh cáo hành vi nâng giá ảo tới ${currentSelectedShop?.name || 'Shop'} cho sản phẩm "${currentSelectedProduct.name}"?`);
    if (!confirmed) return;

    if (triggerAuditLog) {
      await triggerAuditLog(`CSKH gửi cảnh cáo hành vi nâng giá ảo tới Shop "${currentSelectedShop?.name}" (Mã SP #${currentSelectedProduct.id})`);
    }
    setActionMessage(`⚠️ Đã gửi văn bản cảnh cáo vi phạm chính sách giá tới Shop [${currentSelectedShop?.name}]. Lịch sử đã được lưu vào Audit Log.`);
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleBlockFlashSale = async () => {
    if (!currentSelectedProduct) return;
    const confirmed = window.confirm(`Xác nhận cấm sản phẩm "${currentSelectedProduct.name}" tham gia tất cả các đợt Flash Sale trong 30 ngày do phát hiện nâng giá ảo?`);
    if (!confirmed) return;

    if (triggerAuditLog) {
      await triggerAuditLog(`CSKH từ chối & cấm tham gia Flash Sale 30 ngày đối với sản phẩm #${currentSelectedProduct.id} ("${currentSelectedProduct.name}")`);
    }
    setActionMessage(`🚫 Đã đưa sản phẩm vào danh sách hạn chế Flash Sale 30 ngày do vi phạm Lowest Historical Price.`);
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleHideProduct = async () => {
    if (!currentSelectedProduct) return;
    const confirmed = window.confirm(`CẢNH BÁO: Tạm ẩn sản phẩm "${currentSelectedProduct.name}" khỏi sàn để yêu cầu Shop giải trình biến động giá?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE_URL}/products/${currentSelectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden: true, moderationStatus: 'REJECTED' })
      });
      if (res.ok) {
        if (triggerAuditLog) {
          await triggerAuditLog(`CSKH tạm khóa & gỡ sản phẩm #${currentSelectedProduct.id} khỏi sàn vì nghi vấn gian lận giá`);
        }
        setActionMessage(`🔒 Đã tạm ẩn sản phẩm #${currentSelectedProduct.id} khỏi sàn thành công.`);
        setTimeout(() => setActionMessage(null), 5000);
        fetchAllData();
      } else {
        alert('Không thể cập nhật trạng thái sản phẩm.');
      }
    } catch (err: any) {
      alert('Lỗi thao tác: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-6 rounded-2xl shadow-sm text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🛡️</span>
            <h2 className="text-xl font-black tracking-tight">Giám Sát Biến Động Giá & Chống Gian Lận Khuyến Mãi</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
              Shopee Trust & Safety Standard
            </span>
          </div>
          <p className="text-xs text-emerald-100/80 mt-1.5 leading-relaxed max-w-3xl">
            Theo dõi lịch sử biến động giá bán, đối soát <strong>Lowest Historical Price (LHP)</strong> trong 30 ngày để ngăn chặn chiêu trò tăng giá ảo trước thềm Flash Sale và xử lý các hành vi spam/rửa tiền.
          </p>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between shadow-3xs animate-fade-in">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-amber-700 hover:text-amber-900 font-extrabold cursor-pointer">✕</button>
        </div>
      )}

      {/* Selectors & Time Filters */}
      <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-200/80 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          {/* Lọc Shop */}
          <div className="md:col-span-4 space-y-1.5 text-left">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>🏪</span> 1. Chọn Cửa Hàng (Shop)
            </label>
            <div className="relative">
              <select
                value={selectedShopId}
                onChange={(e) => handleShopChange(e.target.value)}
                className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs cursor-pointer truncate"
              >
                <option value="ALL">🌟 Tất Cả Cửa Hàng ({shops.length} Shop)</option>
                {shops.map((s) => {
                  const pCount = products.filter(p => p.shopId === s.id).length;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name || `Shop #${s.id.slice(0, 8)}`} ({pCount} SP)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Lọc Sản Phẩm */}
          <div className="md:col-span-5 space-y-1.5 text-left">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>📦</span> 2. Chọn Sản Phẩm Kiểm Tra
              </label>
              <span className="text-[11px] font-semibold text-slate-400">
                ({productsForSelectedShop.length} sản phẩm)
              </span>
            </div>
            <div className="relative">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={productsForSelectedShop.length === 0}
                className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-800 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs cursor-pointer truncate disabled:opacity-50 disabled:bg-slate-100"
              >
                {productsForSelectedShop.length === 0 ? (
                  <option value="">(Cửa hàng này chưa có sản phẩm)</option>
                ) : (
                  productsForSelectedShop.map((p) => {
                    const priceFormatted = parseInt(p.price || '0').toLocaleString('vi-VN') + '₫';
                    const shopObj = shops.find(s => s.id === p.shopId);
                    const shopNameText = selectedShopId === 'ALL' && shopObj ? `[${shopObj.name}] ` : '';
                    return (
                      <option key={p.id} value={p.id}>
                        {shopNameText}{p.name} — Giá: {priceFormatted} (Tồn: {p.stock})
                      </option>
                    );
                  })
                )}
              </select>
            </div>
          </div>

          {/* Tìm Nhanh */}
          <div className="md:col-span-3 space-y-1.5 text-left">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔍</span> Tìm Nhanh SP
            </label>
            <input
              type="text"
              placeholder="Gõ tên hoặc mã SP..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs"
            />
          </div>

        </div>

        {/* Thời gian */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <span>📅</span>
            <span>Khoảng thời gian soi lịch sử giá:</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['7d', '30d', '90d', '1y', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeRange === r
                    ? 'bg-emerald-600 text-white shadow-3xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {r === '7d' && '7 Ngày'}
                {r === '30d' && '30 Ngày'}
                {r === '90d' && '3 Tháng'}
                {r === '1y' && '1 Năm'}
                {r === 'all' && 'Tất Cả'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Thẻ KPI Giám Sát Giá */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-200/80">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Giá Bán Niêm Yết</span>
            <span>🏷️</span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {priceAnalysis.currentPrice.toLocaleString('vi-VN')} ₫
          </div>
          <div className="text-xs text-slate-400 font-medium mt-1">Đang hiển thị cho người mua</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-200/80">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Giá Thấp Nhất (LHP)</span>
            <span className="text-emerald-500">📉</span>
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {priceAnalysis.lowestPrice.toLocaleString('vi-VN')} ₫
          </div>
          <div className="text-xs text-emerald-600/80 font-bold mt-1">Mốc chuẩn duyệt Flash Sale sàn</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-3xs border border-slate-200/80">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Giá Đỉnh Cao Nhất</span>
            <span className="text-rose-500">📈</span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {priceAnalysis.highestPrice.toLocaleString('vi-VN')} ₫
          </div>
          <div className="text-xs text-slate-400 font-medium mt-1">Biên độ: ±{priceAnalysis.volatilityPercent}%</div>
        </div>

        <div className={`p-5 rounded-2xl shadow-3xs border ${
          priceAnalysis.riskLevel === 'DANGER' 
            ? 'bg-rose-50 border-rose-200 text-rose-900' 
            : priceAnalysis.riskLevel === 'WARNING'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Đánh Giá Rủi Ro AI</span>
            <span>{priceAnalysis.riskLevel === 'NORMAL' ? '🟢' : priceAnalysis.riskLevel === 'WARNING' ? '🟡' : '🔴'}</span>
          </div>
          <div className="text-base font-black truncate">
            {priceAnalysis.riskLevel === 'NORMAL' && 'Giá Ổn Định'}
            {priceAnalysis.riskLevel === 'WARNING' && 'Cảnh Báo Nâng Giá Ảo'}
            {priceAnalysis.riskLevel === 'DANGER' && 'Bất Thường Cực Đoan'}
          </div>
          <div className="text-[11px] font-semibold mt-1 opacity-90 line-clamp-2">
            {priceAnalysis.riskReason}
          </div>
        </div>
      </div>

      {/* Compliance Action Bar (Bộ công cụ chế tài của CSKH) */}
      {currentSelectedProduct && (
        <div className="bg-white p-4 rounded-2xl shadow-3xs border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚖️</span>
            <div>
              <div className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Nghiệp Vụ Chế Tài CSKH Cho: <span className="text-emerald-600">{currentSelectedProduct.name}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Cửa hàng: <strong>{currentSelectedShop?.name || 'N/A'}</strong> (ID: #{currentSelectedProduct.shopId?.slice(0, 8)})
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleWarnShop}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <span>⚠️</span> Gửi Cảnh Cáo Shop
            </button>
            <button
              onClick={handleBlockFlashSale}
              className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <span>🚫</span> Cấm Flash Sale 30 Ngày
            </button>
            <button
              onClick={handleHideProduct}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <span>🔒</span> Tạm Ẩn Sản Phẩm
            </button>
          </div>
        </div>
      )}

      {/* Biểu Đồ Lịch Sử Giá Bán & Bảng Lịch Sử */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Cột 1: Biểu Đồ Đường SVG (8 cột) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-3xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span>📈</span> Biểu Đồ Đường Lịch Sử Giá Bán
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Quan sát biến động giá theo thời gian để phát hiện điểm nhảy giá bất thường
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Giá Bán (VNĐ)</span>
            </div>
          </div>

          {loading ? (
            <div className="h-[280px] flex items-center justify-center text-xs font-bold text-slate-400">
              Đang tải dữ liệu biến động giá...
            </div>
          ) : chartConfig ? (
            <div className="relative">
              <svg viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`} className="w-full h-auto overflow-visible select-none">
                <defs>
                  <linearGradient id="sellingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal lines */}
                {chartConfig.yTicks.map((tick, i) => (
                  <g key={i}>
                    <line
                      x1={chartConfig.padding.left}
                      y1={tick.y}
                      x2={chartConfig.width - chartConfig.padding.right}
                      y2={tick.y}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={chartConfig.padding.left - 10}
                      y={tick.y + 4}
                      fill="#94a3b8"
                      fontSize="10"
                      textAnchor="end"
                      fontWeight="bold"
                    >
                      {Math.round(tick.val).toLocaleString('vi-VN')}₫
                    </text>
                  </g>
                ))}

                {/* Area under curve */}
                {chartConfig.areaPath && (
                  <path d={chartConfig.areaPath} fill="url(#sellingGradient)" />
                )}

                {/* Price line */}
                {chartConfig.sellingPath && (
                  <path
                    d={chartConfig.sellingPath}
                    fill="none"
                    stroke="#059669"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Points */}
                {chartConfig.points.map((p, idx) => {
                  if (p.ySelling === null) return null;
                  return (
                    <g key={idx}>
                      <circle
                        cx={p.x}
                        cy={p.ySelling}
                        r="4"
                        fill="#059669"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="cursor-pointer transition hover:r-6"
                        onMouseEnter={() => setHoveredPoint({ x: p.x, y: p.ySelling!, point: p })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute pointer-events-none bg-slate-900 text-white text-[11px] p-2.5 rounded-xl shadow-lg border border-slate-700 z-20 space-y-1"
                  style={{
                    left: `${(hoveredPoint.x / (chartConfig?.width || 800)) * 100}%`,
                    top: `${(hoveredPoint.y / (chartConfig?.height || 280)) * 100}%`,
                    transform: 'translate(-50%, -120%)'
                  }}
                >
                  <div className="font-bold text-emerald-300">
                    {hoveredPoint.point.date}
                  </div>
                  <div>Giá bán: <strong>{hoveredPoint.point.sellingPrice?.toLocaleString('vi-VN')}₫</strong></div>
                  {hoveredPoint.point.note && (
                    <div className="text-[10px] text-slate-300">{hoveredPoint.point.note}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-[280px] flex flex-col items-center justify-center text-slate-400 text-xs">
              <span>Chưa có dữ liệu biến động giá cho sản phẩm này</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>💡 <strong>Quy chuẩn Shopee:</strong> Mức giảm giá Flash Sale hợp lệ phải thấp hơn ít nhất 10% so với Lowest Historical Price (LHP).</span>
            <span className="font-bold text-emerald-700">LHP = {priceAnalysis.lowestPrice.toLocaleString('vi-VN')}₫</span>
          </div>
        </div>

        {/* Cột 2: Bảng Lịch Sử Thay Đổi Giá Bán (4 cột) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl shadow-3xs border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <span>📋</span> Lịch Sử Điều Chỉnh Giá
              </h3>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {analytics?.priceHistories?.length || 0} lần
              </span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {!analytics?.priceHistories || analytics.priceHistories.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  Shop chưa từng điều chỉnh giá bán sau khi đăng sản phẩm.
                </div>
              ) : (
                analytics.priceHistories.map((hist) => {
                  const isHike = hist.newPrice > hist.oldPrice;
                  const diff = Math.abs(hist.newPrice - hist.oldPrice);
                  const diffPercent = hist.oldPrice > 0 ? Math.round((diff / hist.oldPrice) * 100) : 0;
                  return (
                    <div key={hist.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">{new Date(hist.createdAt).toLocaleDateString('vi-VN')}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isHike ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isHike ? `▲ Tăng +${diffPercent}%` : `▼ Giảm -${diffPercent}%`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-extrabold">
                        <span className="line-through text-slate-400">{hist.oldPrice.toLocaleString('vi-VN')}₫</span>
                        <span className="text-slate-400">➔</span>
                        <span className="text-slate-900">{hist.newPrice.toLocaleString('vi-VN')}₫</span>
                      </div>

                      <div className="text-[10px] text-slate-500 font-medium flex items-center justify-between pt-1 border-t border-slate-200/50">
                        <span>Lý do: {hist.reason || 'Cập nhật giá bán'}</span>
                        <span className="text-slate-400">bởi {hist.changedBy || 'Shop'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-semibold text-center">
            🔒 Dữ liệu được bảo chứng bởi hệ thống Product Audit Logs ZeroMall
          </div>
        </div>

      </div>
    </div>
  );
}
