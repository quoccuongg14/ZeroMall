import React, { useState, useMemo } from 'react'
import { SystemRevenueComparisonChart } from './analytics/SystemRevenueComparisonChart'
import { FinancialDetailModal } from './analytics/FinancialDetailModal'

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
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [detailModalTab, setDetailModalTab] = useState<'GMV' | 'COMMISSION'>('GMV')

  const openDetailModal = (tab: 'GMV' | 'COMMISSION') => {
    setDetailModalTab(tab)
    setIsDetailModalOpen(true)
  }

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
          onClick={() => openDetailModal('GMV')}
          className="border rounded-xl p-5 shadow-2xs cursor-pointer transition-all duration-200 hover:shadow-sm active:scale-98 relative overflow-hidden bg-white border-slate-200/60 hover:border-emerald-400 group"
          title="Click để mở báo cáo chi tiết đơn hàng & GMV"
        >
          <div className="absolute right-3 top-3 w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs">🌱</div>
          <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Tổng GMV Toàn Sàn</p>
          <p className="text-2xl font-black text-emerald-600 mt-1.5">{totalGMV.toLocaleString('vi-VN')}đ</p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Doanh số phát sinh trong kỳ</p>
          <span className="text-[9px] text-emerald-600 font-bold block mt-1 group-hover:underline">🔍 Xem giao dịch chi tiết →</span>
        </div>

        {/* CARD 2: COMMISSION - Doanh Thu Chiết Khấu Sàn (Thực thu) */}
        <div
          onClick={() => openDetailModal('COMMISSION')}
          className="border rounded-xl p-5 shadow-2xs cursor-pointer transition-all duration-200 hover:shadow-sm active:scale-98 relative overflow-hidden bg-white border-slate-200/60 hover:border-violet-400 group"
          title="Click để đối soát chi tiết chiết khấu sàn"
        >
          <div className="absolute right-3 top-3 w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs">💰</div>
          <p className="text-[10px] text-violet-600 font-black uppercase tracking-wider">Doanh Thu Chiết Khấu Sàn</p>
          <p className="text-2xl font-black text-violet-700 mt-1.5">{Math.round(totalCommission).toLocaleString('vi-VN')}đ</p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Đã thu từ {completedOrdersForComm.length} đơn COMPLETED</p>
          <span className="text-[9px] text-violet-600 font-bold block mt-1 group-hover:underline">🔍 Đối soát chiết khấu →</span>
        </div>

        {/* CARD 3: ESCROW - Chiết Khấu Đang Tạm Giữ 7 Ngày */}
        <div 
          onClick={() => openDetailModal('COMMISSION')}
          className="border rounded-xl p-5 shadow-2xs cursor-pointer transition-all duration-200 hover:shadow-sm active:scale-98 relative overflow-hidden bg-white border-slate-200/60 hover:border-amber-400 group"
          title="Click để xem đơn hàng đang tạm giữ 7 ngày"
        >
          <div className="absolute right-3 top-3 w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs">⏳</div>
          <p className="text-[10px] text-amber-600 font-black uppercase tracking-wider">Chiết Khấu Đang Tạm Giữ</p>
          <p className="text-2xl font-black text-amber-600 mt-1.5">{Math.round(pendingCommissionCard).toLocaleString('vi-VN')}đ</p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Bảo chứng 7 ngày ({heldOrdersForComm.length} đơn DELIVERED)</p>
          <span className="text-[9px] text-amber-600 font-bold block mt-1 group-hover:underline">🔍 Xem đơn bảo chứng →</span>
        </div>

        {/* CARD 4: AOV - Giá Trị Đơn Trung Bình */}
        <div 
          onClick={() => openDetailModal('GMV')}
          className="border rounded-xl p-5 shadow-2xs cursor-pointer transition-all duration-200 hover:shadow-sm active:scale-98 relative overflow-hidden bg-white border-slate-200/60 hover:border-sky-400 group"
          title="Click để xem cơ cấu đơn hàng và quy mô giỏ hàng"
        >
          <div className="absolute right-3 top-3 w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-xs">🎯</div>
          <p className="text-[10px] text-sky-600 font-black uppercase tracking-wider">Giá Trị Đơn Trung Bình (AOV)</p>
          <p className="text-2xl font-black text-sky-700 mt-1.5">{aov.toLocaleString('vi-VN')}đ</p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Bình quân trên {validGmvOrders.length} đơn phát sinh</p>
          <span className="text-[9px] text-sky-600 font-bold block mt-1 group-hover:underline">🔍 Xem phân bổ đơn →</span>
        </div>
      </div>

      {/* 2. BIỂU ĐỒ TRỰC QUAN HÓA SO SÁNH DOANH THU & THU NHẬP SÀN THEO THÁNG / NĂM */}
      <SystemRevenueComparisonChart allOrders={allOrders} commissionRate={commissionRate} />

      {/* 3. NÚT KÍCH HOẠT MODAL TRA CỨU GIAO DỊCH CHUYÊN SÂU */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4 border border-indigo-900/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0 border border-white/10">
            🔍
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wide text-white">
              Báo Cáo Dòng Tiền & Tra Cứu Giao Dịch Chi Tiết
            </h4>
            <p className="text-[11px] text-slate-300 font-medium mt-0.5">
              Mở cửa sổ modal chuyên sâu để tra cứu phương thức thanh toán, đơn hàng giá trị cao và danh sách toàn bộ {filteredOrders.length} đơn phát sinh
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => openDetailModal('GMV')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-3xs cursor-pointer flex items-center gap-1.5"
          >
            <span>🌱</span> Xem Đơn Hàng & GMV
          </button>
          <button
            onClick={() => openDetailModal('COMMISSION')}
            className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition shadow-3xs cursor-pointer flex items-center gap-1.5"
          >
            <span>💰</span> Đối Soát Chiết Khấu Sàn
          </button>
        </div>
      </div>

      {/* 4. MODAL BÁO CÁO DÒNG TIỀN & ĐƠN HÀNG CHI TIẾT */}
      <FinancialDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        initialTab={detailModalTab}
        filteredOrders={filteredOrders}
        validGmvOrders={validGmvOrders}
        totalGMV={totalGMV}
        totalCommission={totalCommission}
        pendingCommissionCard={pendingCommissionCard}
        completedOrdersForComm={completedOrdersForComm}
        heldOrdersForComm={heldOrdersForComm}
        filterLabel={getFilterLabel()}
      />
    </div>
  )
}
