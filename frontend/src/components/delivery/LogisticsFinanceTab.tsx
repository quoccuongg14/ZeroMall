import React, { useState, useMemo } from 'react'

export interface Hub {
  id: string
  code: string
  name: string
  type: string
  address: string
  province: string
  district: string
  drivers?: any[]
  _count?: { shipments?: number; drivers?: number }
}

export interface Driver {
  id: string
  name: string
  phone: string
  vehicleNumber: string
  vehicleType: string
  status: string
  hubId?: string
  hub?: { id?: string; name: string; code?: string }
}

export interface Shipment {
  id: string
  orderId: string
  trackingNumber: string
  sellerId: string
  buyerName: string
  buyerPhone: string
  deliveryAddress: string
  pickupAddress?: {
    name?: string
    contactName?: string
    phone?: string
    province?: string
    district?: string
  }
  declaredValue: number
  codAmount: number
  shippingFee: number
  status: string
  createdAt: string
  currentHubId?: string
  currentHub?: { id?: string; name: string; code: string }
  assignments?: Array<{
    id: string
    type: string
    status: string
    driver?: { id?: string; name: string; phone: string; vehicleNumber?: string }
  }>
}

export interface LogisticsFinanceTabProps {
  shipments: Shipment[]
  hubs?: Hub[]
  drivers?: Driver[]
}

const formatMoney = (val: number) => (val || 0).toLocaleString('vi-VN') + 'đ'

// Helper xác định cụm Mega SOC chủ quản
const getParentSoc = (hub: { province?: string; code?: string }) => {
  const p = (hub.province || '').toLowerCase()
  if (p.includes('hồ chí minh') || p.includes('đồng nai') || p.includes('bình dương')) {
    return { id: 'hub-hcm-01', code: 'HCM01', name: 'Trung Tâm Phân Loại Bắc Củ Chi SOC' }
  }
  if (p.includes('hà nội') || p.includes('hoà bình') || p.includes('hòa bình') || p.includes('bắc ninh')) {
    return { id: 'hub-hn-01', code: 'HN01', name: 'Trung Tâm Phân Loại Mê Linh SOC' }
  }
  if (p.includes('đà nẵng') || p.includes('quảng nam') || p.includes('huế')) {
    return { id: 'hub-dng-soc', code: 'DNG01', name: 'Trung Tâm Phân Loại Hòa Cầm SOC' }
  }
  return { id: 'hub-ct-soc', code: 'CT01', name: 'Trung Tâm Phân Loại Trà Nóc SOC' }
}

// Helper phân tích bưu kiện vào đúng Hub đích dựa trên địa chỉ thực tế và tài xế
const matchShipmentToHub = (s: Shipment, allHubs: Hub[]): Hub | undefined => {
  const destHubs = allHubs.filter((h) => h.type !== 'SORTING_CENTER')
  if (destHubs.length === 0) return undefined

  if (s.currentHubId) {
    const direct = destHubs.find((h) => h.id === s.currentHubId)
    if (direct) return direct
  }
  if (s.currentHub?.code) {
    const directCode = destHubs.find((h) => h.code === s.currentHub?.code)
    if (directCode) return directCode
  }

  const driverName = (s.assignments?.[0]?.driver?.name || '').toLowerCase()
  if (driverName.includes('hòa bình')) return destHubs.find((h) => h.code === 'HB01')
  if (driverName.includes('biên hòa')) return destHubs.find((h) => h.code === 'DN01')
  if (driverName.includes('ninh kiều')) return destHubs.find((h) => h.code === 'NK01')
  if (driverName.includes('quận 1')) return destHubs.find((h) => h.code === 'Q01')
  if (driverName.includes('cầu giấy')) return destHubs.find((h) => h.code === 'CG01')

  const addr = (s.deliveryAddress || '').toLowerCase()
  if (addr.includes('hòa bình')) return destHubs.find((h) => h.code === 'HB01')
  if (addr.includes('biên hòa') || addr.includes('đồng nai')) return destHubs.find((h) => h.code === 'DN01')
  if (addr.includes('quận 1') || addr.includes('hai bà trưng') || addr.includes('phạm ngũ lão')) return destHubs.find((h) => h.code === 'Q01')
  if (addr.includes('thủ đức')) return destHubs.find((h) => h.code === 'TD01')
  if (addr.includes('an giang') || addr.includes('cần thơ') || addr.includes('ninh kiều')) return destHubs.find((h) => h.code === 'NK01')
  if (addr.includes('cầu giấy')) return destHubs.find((h) => h.code === 'CG01')
  if (addr.includes('đống đa')) return destHubs.find((h) => h.code === 'DD01')
  if (addr.includes('thanh xuân')) return destHubs.find((h) => h.code === 'TX01')
  if (addr.includes('đà nẵng') || addr.includes('hải châu')) return destHubs.find((h) => h.code === 'HC01')

  return destHubs.find((h) => h.code === 'TB01') || destHubs[0]
}

export const LogisticsFinanceTab: React.FC<LogisticsFinanceTabProps> = ({
  shipments,
  hubs = [],
  drivers = [],
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [showOnlyActiveHubs, setShowOnlyActiveHubs] = useState<boolean>(true)
  const [activeFinanceView, setActiveFinanceView] = useState<'OVERVIEW' | 'BRANCH_PL' | 'LEDGER'>(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const fview = params?.get('fview') as any
    if (fview && ['OVERVIEW', 'BRANCH_PL', 'LEDGER'].includes(fview)) return fview
    return 'OVERVIEW'
  })

  // Đơn hợp lệ (không tính đơn hủy)
  const validShipments = useMemo(() => shipments.filter((s) => s.status !== 'CANCELLED'), [shipments])

  // Phân nhóm đơn theo trạng thái thực tế
  const deliveredShipments = useMemo(
    () => validShipments.filter((s) => ['DELIVERED', 'COMPLETED'].includes(s.status)),
    [validShipments]
  )
  const failedShipments = useMemo(
    () => validShipments.filter((s) => ['DELIVERY_FAILED', 'RETURNING', 'RETURNED'].includes(s.status)),
    [validShipments]
  )

  // 1. TỔNG DOANH THU CƯỚC THỰC TẾ (Gross Shipping Revenue từ CSDL)
  const totalShippingFeeCollected = useMemo(() => {
    return validShipments.reduce((sum, s) => sum + (s.shippingFee > 0 ? s.shippingFee : 25000), 0)
  }, [validShipments])

  // 2. HOA HỒNG DỊCH VỤ SÀN (Platform 5% Commission trên giá trị đơn hàng giao thành công)
  const totalPlatformCommission = useMemo(() => {
    return deliveredShipments.reduce((sum, s) => {
      const orderValue = s.declaredValue > 0 ? s.declaredValue : s.codAmount > 0 ? s.codAmount : 150000
      return sum + Math.round(orderValue * 0.05)
    }, 0)
  }, [deliveredShipments])

  // 3. CHI PHÍ VẬN TẢI THỰC TẾ THEO 3 CHẶNG
  // - First Mile (Lấy hàng): Áp dụng cho các đơn đã qua khâu lấy hàng
  const allPickedShipments = useMemo(
    () => validShipments.filter((s) =>
      ['PICKED_UP', 'AT_ORIGIN_HUB', 'SORTING', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(s.status)
    ),
    [validShipments]
  )
  const totalFirstMileCost = allPickedShipments.length * 8000

  // - Middle Mile (Xe tải liên tỉnh & Kho SOC): Áp dụng cho đơn qua trung chuyển
  const middleMileShipments = useMemo(
    () => validShipments.filter((s) =>
      ['AT_ORIGIN_HUB', 'SORTING', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(s.status)
    ),
    [validShipments]
  )
  const totalMiddleMileCost = middleMileShipments.length * 7000

  // - Last Mile (Giao tận tay): Áp dụng cho đơn giao thành công
  const totalLastMileCost = deliveredShipments.length * 9500

  // - Chi phí đơn hoàn / RTO
  const totalReturnCost = failedShipments.length * 10000

  // Tổng chi phí vận hành toàn mạng lưới
  const totalLogisticsCost = totalFirstMileCost + totalMiddleMileCost + totalLastMileCost + totalReturnCost

  // 4. LỢI NHUẬN RÒNG SÀN THU VỀ (Net Operating Margin)
  const netPlatformProfit = totalShippingFeeCollected + totalPlatformCommission - totalLogisticsCost
  const netProfitMarginPercent = (totalShippingFeeCollected + totalPlatformCommission) > 0
    ? Math.round((netPlatformProfit / (totalShippingFeeCollected + totalPlatformCommission)) * 100)
    : 0

  // Chỉ số trung bình trên mỗi bưu kiện (Unit Economics per Parcel)
  const avgRevenuePerParcel = validShipments.length > 0 ? Math.round(totalShippingFeeCollected / validShipments.length) : 0
  const avgCostPerParcel = validShipments.length > 0 ? Math.round(totalLogisticsCost / validShipments.length) : 0
  const avgProfitPerParcel = avgRevenuePerParcel - avgCostPerParcel

  // Danh sách các Hub bưu cục vệ tinh và tính toán P&L từng chi nhánh
  const destinationHubs = useMemo(() => hubs.filter((h) => h.type !== 'SORTING_CENTER'), [hubs])
  const branchPerformance = useMemo(() => {
    return destinationHubs.map((hub) => {
      const parentSoc = getParentSoc(hub)
      const hubDrivers = drivers.filter((d) => d.hubId === hub.id)
      const hubShipments = validShipments.filter((s) => {
        const matched = matchShipmentToHub(s, hubs)
        return matched?.id === hub.id
      })

      const hubDelivered = hubShipments.filter((s) => ['DELIVERED', 'COMPLETED'].includes(s.status))
      const hubPicked = hubShipments.filter((s) =>
        ['PICKED_UP', 'AT_ORIGIN_HUB', 'SORTING', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(s.status)
      )

      // Doanh thu cước tại Hub
      const hubRevenue = hubShipments.reduce((sum, s) => sum + (s.shippingFee > 0 ? s.shippingFee : 25000), 0)
      
      // Chi phí hoạt động của Hub: Công lấy + Công giao + Xe tải phân bổ
      const hubCost = (hubPicked.length * 8000) + (hubDelivered.length * 9500) + (hubShipments.length * 5000)
      const hubProfit = hubRevenue - hubCost
      const hubMargin = hubRevenue > 0 ? Math.round((hubProfit / hubRevenue) * 100) : 0

      return {
        hub,
        parentSoc,
        driverCount: hubDrivers.length,
        shipmentCount: hubShipments.length,
        deliveredCount: hubDelivered.length,
        revenue: hubRevenue,
        cost: hubCost,
        profit: hubProfit,
        margin: hubMargin,
      }
    }).sort((a, b) => b.revenue - a.revenue) // Ưu tiên các Hub có doanh thu cao nhất
  }, [destinationHubs, drivers, validShipments, hubs])

  const visibleBranches = useMemo(() => {
    if (!showOnlyActiveHubs) return branchPerformance
    return branchPerformance.filter((b) => b.shipmentCount > 0 || b.revenue > 0)
  }, [branchPerformance, showOnlyActiveHubs])

  // Lọc bảng sổ cái chi tiết
  const filteredShipments = useMemo(() => {
    return validShipments.filter((s) => {
      if (filterStatus === 'DELIVERED' && !['DELIVERED', 'COMPLETED'].includes(s.status)) return false
      if (filterStatus === 'IN_TRANSIT' && !['IN_TRANSIT', 'SORTING', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY'].includes(s.status)) return false
      if (filterStatus === 'PICKED_UP' && !['PICKED_UP', 'AT_ORIGIN_HUB'].includes(s.status)) return false
      if (filterStatus === 'FAILED' && !['DELIVERY_FAILED', 'RETURNING', 'RETURNED'].includes(s.status)) return false

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchTracking = s.trackingNumber.toLowerCase().includes(q)
        const matchOrder = s.orderId.toLowerCase().includes(q)
        const matchBuyer = (s.buyerName || '').toLowerCase().includes(q)
        const matchAddr = (s.deliveryAddress || '').toLowerCase().includes(q)
        return matchTracking || matchOrder || matchBuyer || matchAddr
      }
      return true
    })
  }, [validShipments, filterStatus, searchTerm])

  // Xuất file CSV báo cáo tài chính P&L
  const handleExportCSV = () => {
    const headers = ['Mã Vận Đơn', 'Mã Đơn Hàng', 'Bưu Cục Hub', 'Cước Vận Chuyển', 'Công Lấy First-Mile', 'Công Giao Last-Mile', 'Phí Linehaul SOC', 'Lợi Nhuận Sàn', 'Trạng Thái']
    const rows = filteredShipments.map((s) => {
      const fee = s.shippingFee > 0 ? s.shippingFee : 25000
      const isPicked = allPickedShipments.some((p) => p.id === s.id)
      const isDelivered = deliveredShipments.some((d) => d.id === s.id)
      const isMiddle = middleMileShipments.some((m) => m.id === s.id)
      const firstMile = isPicked ? 8000 : 0
      const lastMile = isDelivered ? 9500 : 0
      const middleMile = isMiddle ? 7000 : 0
      const profit = fee - firstMile - lastMile - middleMile
      const matchedHub = matchShipmentToHub(s, hubs)

      return [
        s.trackingNumber,
        s.orderId,
        `"${matchedHub?.name || 'Chưa định tuyến'}"`,
        fee,
        firstMile,
        lastMile,
        middleMile,
        profit,
        s.status,
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Logistics_PL_Report_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150 text-left">
      {/* 1. Header Tinh Gọn Chuẩn Enterprise */}
      <div className="bg-white border border-slate-200/90 p-5 rounded-3xl shadow-3xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📊</span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Tài Chính Vận Tải & P&L Sàn (Unit Economics)
            </h2>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
              Dữ Liệu Động Từ CSDL
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Hạch toán dòng tiền cước vận chuyển, hoa hồng sàn 5%, chi phí vận tải 3 chặng và biên lợi nhuận ròng toàn hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span>📥</span> Xuất Báo Cáo P&L (CSV)
          </button>
        </div>
      </div>

      {/* 2. 4 Thẻ Chỉ Số Tài Chính Cốt Lõi (100% Dynamic) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Doanh thu cước */}
        <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-3xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span className="flex items-center gap-1.5"><span>🚚</span> Tổng Cước Vận Chuyển</span>
            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">Thu Vào</span>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            {formatMoney(totalShippingFeeCollected)}
          </p>
          <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Tổng số bưu kiện:</span>
            <b className="text-slate-800 font-mono">{validShipments.length} đơn</b>
          </div>
        </div>

        {/* Hoa hồng sàn thu được */}
        <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-3xs space-y-2">
          <div className="flex items-center justify-between text-xs text-indigo-600 font-bold">
            <span className="flex items-center gap-1.5"><span>⚡</span> Hoa Hồng Sàn (5% GMV)</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">Khấu Trừ Shop</span>
          </div>
          <p className="text-2xl font-black text-indigo-600 font-mono">
            {formatMoney(totalPlatformCommission)}
          </p>
          <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Đơn giao thành công:</span>
            <b className="text-indigo-700 font-mono">{deliveredShipments.length} đơn</b>
          </div>
        </div>

        {/* Chi phí vận hành */}
        <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-3xs space-y-2">
          <div className="flex items-center justify-between text-xs text-rose-600 font-bold">
            <span className="flex items-center gap-1.5"><span>💸</span> Chi Phí Vận Hành Tuyến</span>
            <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-bold">Chi Ra</span>
          </div>
          <p className="text-2xl font-black text-rose-600 font-mono">
            {formatMoney(totalLogisticsCost)}
          </p>
          <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Shipper + Tuyến Mega SOC:</span>
            <b className="text-rose-700 font-mono">{formatMoney(totalFirstMileCost + totalLastMileCost)}</b>
          </div>
        </div>

        {/* Lợi nhuận ròng của sàn */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/80 border border-emerald-200 p-4 rounded-2xl shadow-3xs space-y-2">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-bold">
            <span className="flex items-center gap-1.5"><span>🏆</span> Lợi Nhuận Ròng (EBITDA)</span>
            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">Margin: {netProfitMarginPercent}%</span>
          </div>
          <p className="text-2xl font-black text-emerald-700 font-mono">
            {formatMoney(netPlatformProfit)}
          </p>
          <div className="text-[11px] text-emerald-800 flex justify-between border-t border-emerald-200/60 pt-2 font-medium">
            <span>Lợi nhuận ròng/đơn:</span>
            <b className="font-mono">{formatMoney(avgProfitPerParcel)}</b>
          </div>
        </div>
      </div>

      {/* 3. Thanh Chuyển Tab Báo Cáo */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFinanceView('OVERVIEW')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeFinanceView === 'OVERVIEW'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>📈</span> Tổng Quan Kinh Tế Đơn Vị (Unit Economics)
          </button>

          <button
            onClick={() => setActiveFinanceView('BRANCH_PL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeFinanceView === 'BRANCH_PL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>🏢</span> Báo Cáo P&L Chi Nhánh Hub ({visibleBranches.length}/{destinationHubs.length})
          </button>

          <button
            onClick={() => setActiveFinanceView('LEDGER')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeFinanceView === 'LEDGER'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>📋</span> Sổ Cái Tra Cứu Vận Đơn ({filteredShipments.length})
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-medium">
          Dữ liệu tài chính hợp nhất từ mạng lưới bưu cục ZeroExpress
        </span>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: TỔNG QUAN KINH TẾ ĐƠN VỊ (UNIT ECONOMICS) */}
      {/* ========================================================================= */}
      {activeFinanceView === 'OVERVIEW' && (
        <div className="space-y-5">
          {/* Bảng phân tích kinh tế trên từng bưu kiện */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-3xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span>📐</span> Chỉ Số Kinh Tế Đơn Vị Bình Quân (Unit Economics Per Parcel)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tính toán dựa trên {validShipments.length} bưu kiện đang lưu thông thực tế trên toàn mạng lưới
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                Biên lợi nhuận ròng: {netProfitMarginPercent}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] text-slate-500 font-bold uppercase block">Doanh Thu Cước Bình Quân / Đơn</span>
                <p className="text-xl font-black text-slate-900 font-mono">{formatMoney(avgRevenuePerParcel)}</p>
                <p className="text-[10px] text-slate-400">Doanh thu thu về từ người mua hoặc tài trợ cước</p>
              </div>

              <div className="p-4 bg-rose-50/50 border border-rose-200/80 rounded-xl space-y-1">
                <span className="text-[11px] text-rose-700 font-bold uppercase block">Chi Phí Vận Tải Bình Quân / Đơn</span>
                <p className="text-xl font-black text-rose-600 font-mono">{formatMoney(avgCostPerParcel)}</p>
                <p className="text-[10px] text-rose-500">Bao gồm công lấy hàng, trung chuyển xe tải và công giao tận tay</p>
              </div>

              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                <span className="text-[11px] text-emerald-800 font-bold uppercase block">Lợi Nhuận Ròng Bình Quân / Đơn</span>
                <p className="text-xl font-black text-emerald-700 font-mono">
                  {avgProfitPerParcel >= 0 ? '+' : ''}{formatMoney(avgProfitPerParcel)}
                </p>
                <p className="text-[10px] text-emerald-600">Khoản dôi dư đóng góp trực tiếp vào lợi nhuận gộp toàn sàn</p>
              </div>
            </div>
          </div>

          {/* Cơ cấu phân bổ chi phí 3 chặng vận tải */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-3xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <span>🚛</span> Cơ Cấu Phân Bổ Chi Phí Vận Tải 3 Chặng Thực Tế
              </h3>
              <span className="text-xs font-bold font-mono text-slate-600">
                Tổng chi: {formatMoney(totalLogisticsCost)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-amber-800">1. Chặng Đầu (First-Mile)</span>
                  <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[10px]">
                    8.000đ/đơn
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Lương trả bưu tá lấy hàng từ kho Shop về bưu cục xuất phát.
                </p>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-700">
                  <span>{allPickedShipments.length} kiện đã lấy:</span>
                  <span className="font-mono text-amber-800">{formatMoney(totalFirstMileCost)}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-sky-800">2. Tuyến Mega SOC (Linehaul)</span>
                  <span className="font-mono font-bold text-sky-900 bg-sky-100 px-2 py-0.5 rounded text-[10px]">
                    7.000đ/đơn
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Xe tải thùng liên tỉnh kết nối giữa các trung tâm phân loại Bắc - Trung - Nam.
                </p>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-700">
                  <span>{middleMileShipments.length} kiện trung chuyển:</span>
                  <span className="font-mono text-sky-800">{formatMoney(totalMiddleMileCost)}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-orange-800">3. Chặng Cuối (Last-Mile)</span>
                  <span className="font-mono font-bold text-orange-900 bg-orange-100 px-2 py-0.5 rounded text-[10px]">
                    9.500đ/đơn
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Lương công phát và thưởng KPI cho bưu tá giao tận tay người mua.
                </p>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-700">
                  <span>{deliveredShipments.length} kiện thành công:</span>
                  <span className="font-mono text-orange-800">{formatMoney(totalLastMileCost)}</span>
                </div>
              </div>

              <div className="bg-rose-50/60 border border-rose-200 p-3.5 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-rose-800">4. Đơn Hoàn / Rủi Ro (RTO)</span>
                  <span className="font-mono font-bold text-rose-900 bg-rose-100 px-2 py-0.5 rounded text-[10px]">
                    10.000đ/đơn
                  </span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  Chi phí giao lại nhiều lần và vận chuyển hoàn trả bưu kiện về cho Shop.
                </p>
                <div className="border-t border-rose-200 pt-1.5 flex justify-between font-bold text-rose-800">
                  <span>{failedShipments.length} kiện hoàn:</span>
                  <span className="font-mono">{formatMoney(totalReturnCost)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: BẢNG BÁO CÁO P&L THEO TỪNG CHI NHÁNH BƯU CỤC */}
      {/* ========================================================================= */}
      {activeFinanceView === 'BRANCH_PL' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-3xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Hiệu Quả Kinh Doanh & Đóng Góp Lợi Nhuận Của Từng Chi Nhánh Hub
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Đánh giá trực tiếp hiệu quả tài chính: Doanh thu cước phát sinh trừ đi chi phí bưu tá và phân bổ vận tải.
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyActiveHubs}
                onChange={(e) => setShowOnlyActiveHubs(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <span>Chỉ hiển thị các Hub có phát sinh đơn ({visibleBranches.length})</span>
            </label>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-3xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Bưu Cục Hub & Địa Bàn</th>
                    <th className="py-3.5 px-4">Cụm Mega SOC Chủ Quản</th>
                    <th className="py-3.5 px-4 text-center">Sản Lượng Đơn</th>
                    <th className="py-3.5 px-4 text-right">Doanh Thu Cước (1)</th>
                    <th className="py-3.5 px-4 text-right">Chi Phí Vận Hành (2)</th>
                    <th className="py-3.5 px-4 text-right">Lợi Nhuận Đóng Góp (1 - 2)</th>
                    <th className="py-3.5 px-4 text-center">Tỷ Suất Margin</th>
                    <th className="py-3.5 px-4 text-center">Đánh Giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {visibleBranches.map((item) => (
                    <tr key={item.hub.id} className="hover:bg-slate-50/80 transition">
                      {/* Chi nhánh Hub */}
                      <td className="py-3.5 px-4 space-y-0.5">
                        <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                          <span>{item.hub.name}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                            {item.hub.code}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.hub.district}, {item.hub.province} • {item.driverCount} Shipper
                        </div>
                      </td>

                      {/* Mega SOC */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                          <span>🏭</span> {item.parentSoc.name.replace('Trung Tâm Phân Loại ', '')}
                        </span>
                      </td>

                      {/* Sản lượng */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md font-mono text-xs">
                          {item.shipmentCount} đơn
                        </span>
                        <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          {item.deliveredCount} đã giao
                        </div>
                      </td>

                      {/* Doanh thu cước */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                        {formatMoney(item.revenue)}
                      </td>

                      {/* Chi phí */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600">
                        {formatMoney(item.cost)}
                      </td>

                      {/* Lợi nhuận ròng */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-sm">
                        <span className={item.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {item.profit >= 0 ? '+' : ''}{formatMoney(item.profit)}
                        </span>
                      </td>

                      {/* Tỷ suất Margin */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-xs">
                        <span className={item.margin >= 15 ? 'text-emerald-600' : item.margin > 0 ? 'text-amber-600' : 'text-slate-400'}>
                          {item.margin}%
                        </span>
                      </td>

                      {/* Đánh giá hiệu quả */}
                      <td className="py-3.5 px-4 text-center">
                        {item.shipmentCount === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">
                            Chờ phát sinh
                          </span>
                        ) : item.profit > 50000 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span>🏆</span> Hiệu Quả Cao
                          </span>
                        ) : item.profit >= 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            <span>✅</span> Cân Bằng Tốt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span>⚠️</span> Chi Phí Cao
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: SỔ CÁI TRA CỨU VẬN ĐƠN CHI TIẾT */}
      {/* ========================================================================= */}
      {activeFinanceView === 'LEDGER' && (
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-3xs space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Sổ Cái Hạch Toán Từng Bưu Kiện ({filteredShipments.length} đơn)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Chi tiết cước vận chuyển, các chi phí bưu tá từng chặng và mức đóng góp lợi nhuận từng đơn
              </p>
            </div>

            {/* Tìm kiếm & Lọc trạng thái */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Tìm mã ZMX, địa chỉ, người mua..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs w-full sm:w-60 focus:outline-emerald-500"
              />

              <div className="flex items-center gap-1">
                {[
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'DELIVERED', label: 'Đã giao' },
                  { id: 'IN_TRANSIT', label: 'Trung chuyển' },
                  { id: 'PICKED_UP', label: 'Đã lấy' },
                  { id: 'FAILED', label: 'Hoàn/Thất bại' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterStatus(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      filterStatus === f.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bảng dữ liệu sổ cái */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 font-bold text-slate-600">
                <tr>
                  <th className="text-left p-3">Mã Vận Đơn</th>
                  <th className="text-left p-3">Bưu Cục Hub Phụ Trách</th>
                  <th className="text-right p-3">Cước Vận Chuyển</th>
                  <th className="text-right p-3">Công Lấy (First-Mile)</th>
                  <th className="text-right p-3">Tuyến Mega SOC</th>
                  <th className="text-right p-3">Công Giao (Last-Mile)</th>
                  <th className="text-right p-3">Lợi Nhuận Sàn</th>
                  <th className="text-center p-3">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredShipments.map((s) => {
                  const fee = s.shippingFee > 0 ? s.shippingFee : 25000
                  const isPicked = allPickedShipments.some((p) => p.id === s.id)
                  const isDelivered = deliveredShipments.some((d) => d.id === s.id)
                  const isMiddle = middleMileShipments.some((m) => m.id === s.id)

                  const firstMile = isPicked ? 8000 : 0
                  const lastMile = isDelivered ? 9500 : 0
                  const middleMile = isMiddle ? 7000 : 0
                  const profit = fee - firstMile - lastMile - middleMile
                  const matchedHub = matchShipmentToHub(s, hubs)

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-emerald-700">
                        <div>{s.trackingNumber}</div>
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          #{s.orderId}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="font-bold text-slate-800">
                          {matchedHub?.name.replace('Bưu Cục Giao Hàng ', '') || 'Bưu Cục Hub'}
                        </span>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{s.deliveryAddress}</div>
                      </td>

                      <td className="text-right p-3 font-mono font-bold text-slate-900">
                        {formatMoney(fee)}
                      </td>

                      <td className="text-right p-3 font-mono text-amber-700">
                        {firstMile > 0 ? formatMoney(firstMile) : '-'}
                      </td>

                      <td className="text-right p-3 font-mono text-sky-700">
                        {middleMile > 0 ? formatMoney(middleMile) : '-'}
                      </td>

                      <td className="text-right p-3 font-mono text-orange-700">
                        {lastMile > 0 ? formatMoney(lastMile) : '-'}
                      </td>

                      <td className="text-right p-3 font-mono font-bold">
                        <span className={profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                        </span>
                      </td>

                      <td className="text-center p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'DELIVERED' || s.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'IN_TRANSIT' || s.status === 'SORTING'
                            ? 'bg-sky-100 text-sky-800'
                            : s.status === 'PICKED_UP' || s.status === 'AT_ORIGIN_HUB'
                            ? 'bg-amber-100 text-amber-800'
                            : s.status.includes('FAIL') || s.status.includes('RETURN')
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
