import React, { useState, useMemo } from 'react'
import { formatOrderId } from '../../utils/orderUtils'
import { SystemRevenueComparisonChart } from './analytics/SystemRevenueComparisonChart'

interface SystemReportsTabProps {
  allOrders: any[]
  users?: any[]
  commissionRate: number
}

export const SystemReportsTab: React.FC<SystemReportsTabProps> = ({
  allOrders,
  commissionRate
}) => {
  const now = new Date()
  type FilterPreset = 'TODAY' | '7_DAYS' | '30_DAYS' | 'MONTH' | 'CUSTOM' | 'ALL'
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('ALL')
  const [openPopover, setOpenPopover] = useState<'MONTH' | 'CUSTOM' | null>(null)

  // Tự động phân tích các năm thực tế có trong hệ thống từ allOrders
  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear()
    const yearsFromOrders = allOrders
      .map(o => {
        try {
          const y = new Date(o.createdAt).getFullYear()
          return isNaN(y) ? null : y
        } catch {
          return null
        }
      })
      .filter((y): y is number => y !== null)

    const uniqueYears = Array.from(new Set([currentY, ...yearsFromOrders])).sort((a, b) => b - a)
    return uniqueYears.length > 0 ? uniqueYears : [currentY]
  }, [allOrders])

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    if (allOrders.length > 0 && allOrders[0]?.createdAt) {
      const d = new Date(allOrders[0].createdAt)
      if (!isNaN(d.getTime())) return d.getMonth() + 1
    }
    return now.getMonth() + 1
  })

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (allOrders.length > 0 && allOrders[0]?.createdAt) {
      const d = new Date(allOrders[0].createdAt)
      if (!isNaN(d.getTime())) return d.getFullYear()
    }
    return now.getFullYear()
  })

  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [activeStatDetail, setActiveStatDetail] = useState<'GMV' | 'COMMISSION'>('GMV')
  const [commTabFilter, setCommTabFilter] = useState<'EARNED' | 'PENDING' | 'IN_TRANSIT' | 'REFUNDED'>('EARNED')

  const getFilterLabel = () => {
    if (filterPreset === 'TODAY') return 'Hôm nay'
    if (filterPreset === '7_DAYS') return '7 ngày qua'
    if (filterPreset === '30_DAYS') return '30 ngày qua'
    if (filterPreset === 'MONTH') return `Tháng ${selectedMonth < 10 ? '0' + selectedMonth : selectedMonth}/${selectedYear}`
    if (filterPreset === 'CUSTOM') {
      if (customStartDate && customEndDate) return `${customStartDate} → ${customEndDate}`
      if (customStartDate) return `Từ ${customStartDate}`
      if (customEndDate) return `Đến ${customEndDate}`
      return 'Tùy chọn ngày'
    }
    return 'Tất cả'
  }

  const filterByRange = (items: any[], dateField: string = 'createdAt') => {
    if (!items || !Array.isArray(items)) return []
    if (filterPreset === 'ALL') return items

    if (filterPreset === 'MONTH') {
      return items.filter(item => {
        if (!item[dateField]) return false
        const d = new Date(item[dateField])
        return d.getMonth() + 1 === Number(selectedMonth) && d.getFullYear() === Number(selectedYear)
      })
    }

    if (filterPreset === 'CUSTOM') {
      const startMs = customStartDate ? new Date(customStartDate + 'T00:00:00').getTime() : 0
      const endMs = customEndDate ? new Date(customEndDate + 'T23:59:59.999').getTime() : Infinity
      return items.filter(item => {
        if (!item[dateField]) return false
        const t = new Date(item[dateField]).getTime()
        return t >= startMs && t <= endMs
      })
    }

    const nowMs = Date.now()
    if (filterPreset === 'TODAY') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      return items.filter(item => {
        if (!item[dateField]) return false
        const t = new Date(item[dateField]).getTime()
        return t >= startOfToday
      })
    }

    let msLimit = 0
    if (filterPreset === '7_DAYS') msLimit = 7 * 24 * 60 * 60 * 1000
    else if (filterPreset === '30_DAYS') msLimit = 30 * 24 * 60 * 60 * 1000

    return items.filter(item => {
      if (!item[dateField]) return false
      const itemDate = new Date(item[dateField]).getTime()
      return (nowMs - itemDate) <= msLimit
    })
  }

  const filteredOrders = filterByRange(allOrders);

  const getOrderCommRate = (o: any) => o.commissionRate ?? 5;
  const getOrderItemSubtotal = (o: any) => {
    if (o.items && Array.isArray(o.items) && o.items.length > 0) {
      return o.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    }
    return Math.max(0, (o.totalAmount || 0) - (o.shippingFee || 0));
  };

  const isValidGmvOrder = (o: any) => {
    const invalidStatuses = ['CANCELLED', 'REFUNDED', 'RETURNED', 'REFUND_PENDING', 'RETURN_PENDING', 'PENDING', 'PENDING_PAYMENT', 'UNPAID'];
    return !invalidStatuses.includes(o.status);
  };

  const validGmvOrders = filteredOrders.filter(isValidGmvOrder);
  const totalGMV = validGmvOrders.reduce((sum, o) => sum + getOrderItemSubtotal(o), 0);
  const aov = validGmvOrders.length > 0 ? Math.round(totalGMV / validGmvOrders.length) : 0;
  const getOrderCommAmount = (o: any) => {
    const itemSubtotal = getOrderItemSubtotal(o);
    const shopDiscount = o.shopDiscountAmount || 0;
    const netSubtotal = Math.max(0, itemSubtotal - shopDiscount);
    return Math.round(netSubtotal * (getOrderCommRate(o) / 100));
  };

  const completedOrdersForComm = filteredOrders.filter(o => o.status === 'COMPLETED');
  const totalCommission = completedOrdersForComm.reduce((sum, o) => sum + getOrderCommAmount(o), 0);
  const heldOrdersForComm = filteredOrders.filter(o => o.status === 'DELIVERED');
  const pendingCommissionCard = heldOrdersForComm.reduce((sum, o) => sum + getOrderCommAmount(o), 0);

  return (
    <div className="space-y-6">
      {/* BỘ LỌC THỜI GIAN THỐNG NHẤT CHUẨN SHOPEE ADMIN */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase">Báo cáo thống kê hệ thống</h3>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
              {getFilterLabel()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-bold mt-1">Lọc số liệu theo thời gian thực từ cơ sở dữ liệu</p>
        </div>
        
        {/* THANH ĐIỀU KHIỂN BỘ LỌC (CỐ ĐỊNH CHIỀU CAO - POPOVER DROPDOWN KHÔNG NHẢY GIAO DIỆN) */}
        <div className="relative flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70 gap-0.5 text-xs font-bold shrink-0">
          <button
            onClick={() => {
              setFilterPreset('TODAY')
              setOpenPopover(null)
            }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer select-none ${
              filterPreset === 'TODAY'
                ? 'bg-white text-emerald-700 shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Hôm nay
          </button>
          <button
            onClick={() => {
              setFilterPreset('7_DAYS')
              setOpenPopover(null)
            }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer select-none ${
              filterPreset === '7_DAYS'
                ? 'bg-white text-emerald-700 shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            7 ngày qua
          </button>
          <button
            onClick={() => {
              setFilterPreset('30_DAYS')
              setOpenPopover(null)
            }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer select-none ${
              filterPreset === '30_DAYS'
                ? 'bg-white text-emerald-700 shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            30 ngày qua
          </button>

          {/* NÚT & POPOVER: THEO THÁNG */}
          <div className="relative">
            <button
              onClick={() => setOpenPopover(openPopover === 'MONTH' ? null : 'MONTH')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer select-none flex items-center gap-1 ${
                filterPreset === 'MONTH'
                  ? 'bg-white text-emerald-700 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>📅</span>
              <span>{filterPreset === 'MONTH' ? `T${selectedMonth < 10 ? '0' + selectedMonth : selectedMonth}/${selectedYear}` : 'Theo Tháng'}</span>
              <span className="text-[9px] ml-0.5 opacity-60">▾</span>
            </button>

            {openPopover === 'MONTH' && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOpenPopover(null)} />
                <div className="absolute right-0 top-full mt-2 z-40 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-4 w-64 space-y-3 animate-in fade-in zoom-in-95 duration-150 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <span>📅</span> Lọc theo Tháng / Năm
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenPopover(null)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Tháng</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>Tháng {m < 10 ? `0${m}` : m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Năm</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                      >
                        {availableYears.map(y => (
                          <option key={y} value={y}>Năm {y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterPreset('MONTH')
                      setOpenPopover(null)
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    Áp Dụng
                  </button>
                </div>
              </>
            )}
          </div>

          {/* NÚT & POPOVER: TÙY CHỌN NGÀY */}
          <div className="relative">
            <button
              onClick={() => setOpenPopover(openPopover === 'CUSTOM' ? null : 'CUSTOM')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer select-none flex items-center gap-1 ${
                filterPreset === 'CUSTOM'
                  ? 'bg-white text-emerald-700 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🗓️</span>
              <span>{filterPreset === 'CUSTOM' && customStartDate ? `${customStartDate.slice(5)} → ${customEndDate ? customEndDate.slice(5) : '...'}` : 'Tùy chọn ngày'}</span>
              <span className="text-[9px] ml-0.5 opacity-60">▾</span>
            </button>

            {openPopover === 'CUSTOM' && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOpenPopover(null)} />
                <div className="absolute right-0 top-full mt-2 z-40 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-4 w-72 space-y-3 animate-in fade-in zoom-in-95 duration-150 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <span>🗓️</span> Khoảng Ngày Tùy Chọn
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenPopover(null)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Từ ngày</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Đến ngày</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomStartDate('')
                        setCustomEndDate('')
                        setFilterPreset('ALL')
                        setOpenPopover(null)
                      }}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Đặt lại
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (customStartDate || customEndDate) {
                          setFilterPreset('CUSTOM')
                        }
                        setOpenPopover(null)
                      }}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      Áp Dụng
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => {
              setFilterPreset('ALL')
              setOpenPopover(null)
            }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer select-none ${
              filterPreset === 'ALL'
                ? 'bg-white text-emerald-700 shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tất cả
          </button>
        </div>
      </div>

      {/* 4 CARD CHỈ SỐ TÀI CHÍNH & DOANH THU THUẦN TÚY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* CARD 1: GMV */}
        <div 
          onClick={() => setActiveStatDetail('GMV')}
          className={`border rounded-xl p-6 shadow-2xs cursor-pointer transition-all duration-200 hover:shadow-sm active:scale-98 relative overflow-hidden ${
            activeStatDetail === 'GMV' 
              ? 'bg-emerald-50/20 border-emerald-500 shadow-emerald-50/50 ring-2 ring-emerald-500/20' 
              : 'bg-white border-slate-200/60 hover:border-slate-350'
          }`}
        >
          <div className="absolute right-3 top-3 w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs">🌱</div>
          <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Tổng GMV Toàn Sàn</p>
          <p className="text-2xl font-black text-emerald-600 mt-1.5">{totalGMV.toLocaleString('vi-VN')}đ</p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Doanh số phát sinh trong kỳ</p>
          {activeStatDetail === 'GMV' && (
            <span className="absolute bottom-1 right-2 text-xs text-emerald-600">✓</span>
          )}
        </div>

        {/* CARD 2: COMMISSION - Doanh Thu Chiết Khấu Sàn (Thực thu) */}
        <div
          onClick={() => setActiveStatDetail('COMMISSION')}
          className={`border rounded-xl p-6 shadow-2xs cursor-pointer transition-all duration-200 hover:shadow-sm active:scale-98 relative overflow-hidden ${
            activeStatDetail === 'COMMISSION'
              ? 'bg-violet-50/30 border-violet-500 shadow-violet-50/50 ring-2 ring-violet-500/20'
              : 'bg-white border-slate-200/60 hover:border-violet-300'
          }`}
        >
          <div className="absolute right-3 top-3 w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs">💰</div>
          <p className="text-[10px] text-violet-600 font-black uppercase tracking-wider">Doanh Thu Chiết Khấu Sàn</p>
          <p className="text-2xl font-black text-violet-700 mt-1.5">{Math.round(totalCommission).toLocaleString('vi-VN')}đ</p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Đã thu từ {completedOrdersForComm.length} đơn COMPLETED</p>
          {activeStatDetail === 'COMMISSION' && (
            <span className="absolute bottom-1 right-2 text-xs text-violet-600">✓</span>
          )}
        </div>

        {/* CARD 3: ESCROW - Chiết Khấu Đang Tạm Giữ 7 Ngày */}
        <div 
          onClick={() => setActiveStatDetail('COMMISSION')}
          className="border rounded-xl p-6 shadow-2xs cursor-pointer transition-all duration-200 hover:shadow-sm active:scale-98 relative overflow-hidden bg-white border-slate-200/60 hover:border-amber-300"
        >
          <div className="absolute right-3 top-3 w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs">⏳</div>
          <p className="text-[10px] text-amber-600 font-black uppercase tracking-wider">Chiết Khấu Đang Tạm Giữ</p>
          <p className="text-2xl font-black text-amber-600 mt-1.5">{Math.round(pendingCommissionCard).toLocaleString('vi-VN')}đ</p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Bảo chứng 7 ngày ({heldOrdersForComm.length} đơn DELIVERED)</p>
        </div>

        {/* CARD 4: AOV - Giá Trị Đơn Trung Bình */}
        <div 
          onClick={() => setActiveStatDetail('GMV')}
          className="border rounded-xl p-6 shadow-2xs cursor-pointer transition-all duration-200 hover:shadow-sm active:scale-98 relative overflow-hidden bg-white border-slate-200/60 hover:border-sky-300"
        >
          <div className="absolute right-3 top-3 w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-xs">🎯</div>
          <p className="text-[10px] text-sky-600 font-black uppercase tracking-wider">Giá Trị Đơn Trung Bình (AOV)</p>
          <p className="text-2xl font-black text-sky-700 mt-1.5">{aov.toLocaleString('vi-VN')}đ</p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Bình quân trên {validGmvOrders.length} đơn phát sinh</p>
        </div>
      </div>

      {/* 2. BIỂU ĐỒ TRỰC QUAN HÓA SO SÁNH DOANH THU & THU NHẬP SÀN THEO THÁNG / NĂM */}
      <SystemRevenueComparisonChart allOrders={allOrders} commissionRate={commissionRate} />

      {/* BẢNG PHÂN TÍCH CHI TIẾT */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-2xs space-y-6">
        {activeStatDetail === 'GMV' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <span>🌱</span> Chi tiết doanh thu (GMV Toàn Sàn)
              </h4>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">
                Kỳ lọc: {getFilterLabel()}
              </span>
            </div>

            {(() => {
              const methods = ['cod', 'zeropay', 'sepay'];
              const methodLabels: Record<string, string> = {
                cod: 'Thanh toán COD',
                zeropay: 'Ví điện tử ZeroPay',
                sepay: 'Chuyển khoản VietQR'
              };
              const distribution = methods.map(m => {
                const ordersForMethod = validGmvOrders.filter(o => o.paymentMethod?.toLowerCase() === m);
                const sum = ordersForMethod.reduce((s, o) => s + getOrderItemSubtotal(o), 0);
                const count = ordersForMethod.length;
                const pct = totalGMV > 0 ? (sum / totalGMV) * 100 : 0;
                return { method: m, label: methodLabels[m] || m, sum, count, pct };
              }).sort((a, b) => b.sum - a.sum);

              return (
                <div className="space-y-6">
                  {/* Khối tóm tắt Doanh thu sàn thu được */}
                  <div className="bg-violet-500/[0.03] border border-violet-500/20 rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <h5 className="text-[10px] font-black text-violet-700 uppercase tracking-wider">Doanh thu chiết khấu sàn thực thu (COMPLETED)</h5>
                      <p className="text-[9px] text-slate-500 mt-0.5 font-bold">
                        Đã giải ngân thực tế: {Math.round(totalCommission).toLocaleString('vi-VN')}đ ({completedOrdersForComm.length} đơn) 
                        {pendingCommissionCard > 0 && ` • Đang tạm giữ 7 ngày: +${Math.round(pendingCommissionCard).toLocaleString('vi-VN')}đ (${heldOrdersForComm.length} đơn Đã giao)`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-violet-700">
                        +{Math.round(totalCommission).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Phân bổ doanh số thanh toán (Đơn hợp lệ)</h5>
                      <div className="space-y-3.5">
                        {distribution.map(item => (
                          <div key={item.method} className="space-y-1 text-xs">
                            <div className="flex justify-between font-bold text-slate-700">
                              <span>{item.label} ({item.count} đơn)</span>
                              <span>{item.sum.toLocaleString('vi-VN')}đ ({item.pct.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                                style={{ width: `${item.pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Top 5 đơn hàng giá trị cao nhất (Chỉ đơn thành công / Đang xử lý)</h5>
                      <div className="divide-y divide-slate-100">
                        {[...validGmvOrders]
                          .sort((a, b) => getOrderItemSubtotal(b) - getOrderItemSubtotal(a))
                          .slice(0, 5)
                          .map((order, idx) => {
                            const subtotal = getOrderItemSubtotal(order);
                            return (
                              <div key={order.id} className="py-2.5 flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-500">
                                    {idx + 1}
                                  </span>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 font-mono">{order.id}</span>
                                    <span className="text-[9px] text-slate-400 font-semibold">{order.buyerEmail}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-extrabold text-slate-855">{subtotal.toLocaleString('vi-VN')}đ</p>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">{order.paymentMethod}</span>
                                </div>
                              </div>
                            );
                          })}
                        {validGmvOrders.length === 0 && (
                          <p className="text-xs text-slate-400 font-bold py-4 text-center">Chưa có dữ liệu đơn hàng hợp lệ</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Danh sách toàn bộ đơn hàng phát sinh</h5>
              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                      <th className="pb-2">Mã đơn hàng</th>
                      <th className="pb-2">Thời gian đặt</th>
                      <th className="pb-2">Email Người Mua</th>
                      <th className="pb-2">Phương thức</th>
                      <th className="pb-2">Trạng thái</th>
                      <th className="pb-2 text-right">Tổng tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50/10">
                        <td className="py-2 font-mono text-[10px] text-slate-800 font-bold">{order.id}</td>
                        <td className="py-2 text-slate-500">{new Date(order.createdAt).toLocaleString('vi-VN')}</td>
                        <td className="py-2 font-semibold text-slate-650">{order.buyerEmail}</td>
                        <td className="py-2 font-mono text-[9px] text-slate-500 uppercase">{order.paymentMethod}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                            order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-650' : 
                            order.status === 'SHIPPING' ? 'bg-blue-50 text-blue-650' : 
                            order.status === 'CANCELLED' ? 'bg-rose-50 text-rose-650' : 'bg-amber-50 text-amber-655'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2 text-right font-black text-slate-750">{getOrderItemSubtotal(order).toLocaleString('vi-VN')}đ</td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400 font-bold">Không tìm thấy đơn hàng nào trong thời gian này</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeStatDetail === 'COMMISSION' && (() => {
          const completedOrders = filteredOrders.filter(o => o.status === 'COMPLETED');
          const pendingOrders = filteredOrders.filter(o => o.status === 'DELIVERED');
          const inTransitOrders = filteredOrders.filter(o =>
            o.status === 'PROCESSING' || o.status === 'SHIPPED' || o.status === 'SHIPPING' ||
            o.status === 'DELIVERING' || o.status === 'IN_TRANSIT' || o.status === 'PENDING' || o.status === 'PENDING_PAYMENT'
          );
          const refundedOrders = filteredOrders.filter(o =>
            o.status === 'REFUNDED' || o.status === 'RETURNED' || o.status === 'REFUND_PENDING' ||
            o.status === 'RETURN_PENDING' || o.status === 'REFUND_DISPUTED'
          );

          const earnedGMV = completedOrders.reduce((s, o) => s + getOrderItemSubtotal(o), 0);
          const pendingGMV = pendingOrders.reduce((s, o) => s + getOrderItemSubtotal(o), 0);
          const inTransitGMV = inTransitOrders.reduce((s, o) => s + getOrderItemSubtotal(o), 0);
          const refundedGMV = refundedOrders.reduce((s, o) => s + getOrderItemSubtotal(o), 0);

          const earnedCommission = completedOrders.reduce((s, o) => s + getOrderCommAmount(o), 0);
          const pendingCommission = pendingOrders.reduce((s, o) => s + getOrderCommAmount(o), 0);
          const inTransitCommission = inTransitOrders.reduce((s, o) => s + getOrderCommAmount(o), 0);
          const refundedCommission = refundedOrders.reduce((s, o) => s + getOrderCommAmount(o), 0);

          const currentTabOrders = 
            commTabFilter === 'EARNED' ? completedOrders :
            commTabFilter === 'PENDING' ? pendingOrders :
            commTabFilter === 'IN_TRANSIT' ? inTransitOrders : refundedOrders;

          const currentTabTotalGMV = 
            commTabFilter === 'EARNED' ? earnedGMV :
            commTabFilter === 'PENDING' ? pendingGMV :
            commTabFilter === 'IN_TRANSIT' ? inTransitGMV : refundedGMV;

          const currentTabTotalComm = 
            commTabFilter === 'EARNED' ? earnedCommission :
            commTabFilter === 'PENDING' ? pendingCommission :
            commTabFilter === 'IN_TRANSIT' ? inTransitCommission : refundedCommission;

          return (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <h4 className="text-xs font-black text-violet-700 uppercase tracking-wide flex items-center gap-2">
                  <span>💰</span> Chi tiết Doanh Thu Chiết Khấu Sàn
                </h4>
                <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded uppercase">
                  Tỷ lệ: {commissionRate}% / đơn hàng
                </span>
              </div>

              {/* 4 INTERACTIVE KPI CARDS */}
              <div className="grid grid-cols-4 gap-3">
                {/* 1. ĐÃ THU */}
                <div 
                  onClick={() => setCommTabFilter('EARNED')}
                  className={`rounded-xl p-3.5 text-white relative overflow-hidden cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md ${
                    commTabFilter === 'EARNED'
                      ? 'bg-violet-700 ring-4 ring-violet-500/30 scale-[1.02]'
                      : 'bg-violet-600/90 hover:bg-violet-600'
                  }`}
                >
                  <div className="absolute right-2 bottom-2 opacity-10 text-4xl pointer-events-none">💰</div>
                  <p className="text-[9px] font-black uppercase tracking-wider opacity-90">Đã Thu (Thực tế)</p>
                  <p className="text-lg font-black mt-1">{earnedCommission.toLocaleString('vi-VN')}đ</p>
                  <p className="text-[8px] opacity-80 mt-1">{completedOrders.length} đơn COMPLETED (Đã giải ngân)</p>
                  {commTabFilter === 'EARNED' && (
                    <span className="absolute top-2 right-2 text-[10px] bg-white text-violet-700 rounded-full px-1.5 py-0.5 font-bold">Đang xem</span>
                  )}
                </div>

                {/* 2. ĐANG TẠM GIỮ (ESCROW 7 NGÀY) */}
                <div 
                  onClick={() => setCommTabFilter('PENDING')}
                  className={`border rounded-xl p-3.5 relative overflow-hidden cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md ${
                    commTabFilter === 'PENDING'
                      ? 'bg-amber-100/90 border-amber-500 ring-4 ring-amber-500/30 scale-[1.02]'
                      : 'bg-amber-50 border-amber-200 hover:border-amber-300'
                  }`}
                >
                  <div className="absolute right-2 bottom-2 opacity-10 text-4xl pointer-events-none">🔒</div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-amber-700">Đang Tạm Giữ (Escrow)</p>
                  <p className="text-lg font-black text-amber-700 mt-1">{pendingCommission.toLocaleString('vi-VN')}đ</p>
                  <p className="text-[8px] text-amber-600 font-bold mt-1">{pendingOrders.length} đơn DELIVERED (Chờ 7 ngày/Đánh giá)</p>
                  {commTabFilter === 'PENDING' && (
                    <span className="absolute top-2 right-2 text-[10px] bg-amber-600 text-white rounded-full px-1.5 py-0.5 font-bold">Đang xem</span>
                  )}
                </div>

                {/* 3. CHƯA GIAO / ĐANG GIAO (CHƯA TÍNH TẠM GIỮ) */}
                <div 
                  onClick={() => setCommTabFilter('IN_TRANSIT')}
                  className={`border rounded-xl p-3.5 relative overflow-hidden cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md ${
                    commTabFilter === 'IN_TRANSIT'
                      ? 'bg-blue-100/90 border-blue-500 ring-4 ring-blue-500/30 scale-[1.02]'
                      : 'bg-blue-50 border-blue-200 hover:border-blue-300'
                  }`}
                >
                  <div className="absolute right-2 bottom-2 opacity-10 text-4xl pointer-events-none">🚚</div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-blue-700">Chưa Giao / Đang Giao</p>
                  <p className="text-lg font-black text-blue-700 mt-1">{inTransitCommission.toLocaleString('vi-VN')}đ</p>
                  <p className="text-[8px] text-blue-600 font-bold mt-1">{inTransitOrders.length} đơn đang xử lý (Chưa tạm giữ)</p>
                  {commTabFilter === 'IN_TRANSIT' && (
                    <span className="absolute top-2 right-2 text-[10px] bg-blue-600 text-white rounded-full px-1.5 py-0.5 font-bold">Đang xem</span>
                  )}
                </div>

                {/* 4. BỊ HOÀN / KHIẾU NẠI (KHÔNG THU) */}
                <div 
                  onClick={() => setCommTabFilter('REFUNDED')}
                  className={`border rounded-xl p-3.5 relative overflow-hidden cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md ${
                    commTabFilter === 'REFUNDED'
                      ? 'bg-rose-100/90 border-rose-500 ring-4 ring-rose-500/30 scale-[1.02]'
                      : 'bg-rose-50 border-rose-200 hover:border-rose-300'
                  }`}
                >
                  <div className="absolute right-2 bottom-2 opacity-10 text-4xl pointer-events-none">↩️</div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-rose-600">Bị Hoàn (Không thu)</p>
                  <p className="text-lg font-black text-rose-600 mt-1">-{refundedCommission.toLocaleString('vi-VN')}đ</p>
                  <p className="text-[8px] text-rose-500 font-bold mt-1">{refundedOrders.length} đơn hoàn tiền/khiếu nại</p>
                  {commTabFilter === 'REFUNDED' && (
                    <span className="absolute top-2 right-2 text-[10px] bg-rose-600 text-white rounded-full px-1.5 py-0.5 font-bold">Đang xem</span>
                  )}
                </div>
              </div>

              {/* TỔNG KẾT CHIẾT KHẤU */}
              <div className="bg-gradient-to-r from-violet-50 via-indigo-50 to-purple-50 border border-violet-200/80 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">💰</span>
                    <h5 className="text-xs font-black uppercase text-violet-800 tracking-wide">
                      Doanh Thu Chiết Khấu Thực Tế Đã Về Ví Sàn
                    </h5>
                  </div>
                  <p className="text-[10px] text-slate-600 font-semibold">
                    Tiền chiết khấu thực tế đã giải ngân thành công về Ví Sàn từ các đơn COMPLETED.
                  </p>
                </div>

                <div className="flex items-center gap-6 divide-x divide-violet-200/80 shrink-0">
                  <div className="text-right">
                    <p className="text-2xl font-black text-violet-700">{earnedCommission.toLocaleString('vi-VN')}đ</p>
                    <p className="text-[9px] font-extrabold text-emerald-600 uppercase">✅ Đã thu về Ví Sàn</p>
                  </div>

                  {pendingCommission > 0 && (
                    <div className="pl-6 text-right">
                      <p className="text-lg font-black text-amber-600">+{pendingCommission.toLocaleString('vi-VN')}đ</p>
                      <p className="text-[9px] font-extrabold text-amber-600 uppercase">🔒 Đang tạm giữ (7 ngày)</p>
                    </div>
                  )}

                  <div className="pl-6 text-right">
                    <p className="text-base font-black text-slate-800">{(earnedCommission + pendingCommission).toLocaleString('vi-VN')}đ</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Tổng dự kiến (Đơn đã giao)</p>
                  </div>
                </div>
              </div>


              {/* BẢNG CHI TIẾT ĐƠN HÀNG LỌC THEO TAB ACTIVE */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center">
                  <h5 className="text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-white font-bold text-[9px] ${
                      commTabFilter === 'EARNED' ? 'bg-violet-600' :
                      commTabFilter === 'PENDING' ? 'bg-amber-500' :
                      commTabFilter === 'IN_TRANSIT' ? 'bg-blue-600' : 'bg-rose-500'
                    }`}>
                      {commTabFilter === 'EARNED' ? '✅ ĐÃ THU THỰC TẾ' :
                       commTabFilter === 'PENDING' ? '🔒 ĐANG TẠM GIỮ (7 NGÀY)' :
                       commTabFilter === 'IN_TRANSIT' ? '🚚 CHƯA GIAO / ĐANG GIAO' : '❌ BỊ HOÀN (KHÔNG THU)'}
                    </span>
                    <span className="text-slate-700">
                      {commTabFilter === 'EARNED' ? 'Danh sách các đơn hàng đã thu chiết khấu thành công' :
                       commTabFilter === 'PENDING' ? 'Danh sách các đơn ĐÃ GIAO (DELIVERED) đang tạm giữ 7 ngày hoặc chờ đánh giá' :
                       commTabFilter === 'IN_TRANSIT' ? 'Danh sách các đơn đang xử lý/vận chuyển (chưa giao tới khách, chưa tính tạm giữ)' : 'Danh sách các đơn hàng bị hoàn tiền (Không lấy chiết khấu)'}
                    </span>
                  </h5>

                  {/* TAB FILTER BUTTONS */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                    <button
                      onClick={() => setCommTabFilter('EARNED')}
                      className={`px-2 py-1 rounded-md transition cursor-pointer ${
                        commTabFilter === 'EARNED' ? 'bg-white text-violet-700 font-black shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      Đã Thu ({completedOrders.length})
                    </button>
                    <button
                      onClick={() => setCommTabFilter('PENDING')}
                      className={`px-2 py-1 rounded-md transition cursor-pointer ${
                        commTabFilter === 'PENDING' ? 'bg-white text-amber-600 font-black shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      Tạm Giữ ({pendingOrders.length})
                    </button>
                    <button
                      onClick={() => setCommTabFilter('IN_TRANSIT')}
                      className={`px-2 py-1 rounded-md transition cursor-pointer ${
                        commTabFilter === 'IN_TRANSIT' ? 'bg-white text-blue-600 font-black shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      Đang Giao ({inTransitOrders.length})
                    </button>
                    <button
                      onClick={() => setCommTabFilter('REFUNDED')}
                      className={`px-2 py-1 rounded-md transition cursor-pointer ${
                        commTabFilter === 'REFUNDED' ? 'bg-white text-rose-600 font-black shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      Bị Hoàn ({refundedOrders.length})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[300px] border border-slate-200/80 rounded-xl bg-white">
                  <table className="w-full text-xs text-left text-slate-700">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                      <tr className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                        <th className="p-3">Mã đơn hàng</th>
                        <th className="p-3">Thời gian</th>
                        <th className="p-3">Khách hàng</th>
                        <th className="p-3">PTTT</th>
                        <th className="p-3">Trạng thái</th>
                        <th className="p-3 text-right">GMV</th>
                        <th className="p-3 text-right font-black text-violet-700">Chiết khấu ({commissionRate}%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentTabOrders.map(order => {
                        const commRate = getOrderCommRate(order);
                        const comm = getOrderCommAmount(order);
                        const itemSubtotal = getOrderItemSubtotal(order);
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-mono text-[10px] text-slate-800 font-bold">#{formatOrderId(order.id)}</td>
                            <td className="p-3 text-slate-500 font-medium">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
                            <td className="p-3 font-semibold text-slate-650 truncate max-w-[120px]">{order.buyerEmail}</td>
                            <td className="p-3 font-mono text-[9px] uppercase text-slate-500">{order.paymentMethod}</td>
                            <td className="p-3">
                              {(() => {
                                if (commTabFilter === 'EARNED') {
                                  return <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-50 text-emerald-650">✅ Đã thu (Giải ngân)</span>;
                                }
                                if (commTabFilter === 'PENDING') {
                                  return <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-amber-50 text-amber-655">🔒 Tạm giữ (Chờ 7 ngày/Đánh giá)</span>;
                                }
                                if (commTabFilter === 'IN_TRANSIT') {
                                  return <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-blue-50 text-blue-650">🚚 Chưa giao (Chưa tạm giữ)</span>;
                                }
                                return <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-rose-50 text-rose-650">❌ Bị hoàn tiền</span>;
                              })()}
                            </td>
                            <td className="p-3 text-right font-semibold">{itemSubtotal.toLocaleString('vi-VN')}đ</td>
                            <td className="p-3 text-right font-black text-violet-700">
                              {commTabFilter === 'REFUNDED' ? '0đ (Đã hoàn)' : `+${comm.toLocaleString('vi-VN')}đ (${commRate}%)`}
                            </td>
                          </tr>
                        );
                      })}
                      {currentTabOrders.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400 font-bold">
                            Không có đơn hàng nào thuộc danh mục này trong kỳ lọc
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {currentTabOrders.length > 0 && (
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50/70 font-black">
                        <tr>
                          <td colSpan={5} className="p-3 text-[10px] text-slate-700 uppercase">
                            Tổng cộng ({currentTabOrders.length} đơn)
                          </td>
                          <td className="p-3 text-right text-slate-800">{currentTabTotalGMV.toLocaleString('vi-VN')}đ</td>
                          <td className="p-3 text-right text-violet-700 text-sm">
                            {commTabFilter === 'REFUNDED' ? '0đ' : `+${currentTabTotalComm.toLocaleString('vi-VN')}đ`}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  )
}
