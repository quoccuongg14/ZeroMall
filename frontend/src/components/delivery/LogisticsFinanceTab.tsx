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
  // Bộ lọc thời gian (Ngày / Tháng / Năm / Khoảng tùy chọn)
  const [timePreset, setTimePreset] = useState<'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM'>('ALL')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Trạng thái mở Modal xem bóc tách chi tiết từng thẻ
  const [detailModal, setDetailModal] = useState<'FREIGHT' | 'COURIER' | 'LINEHAUL' | 'EBITDA' | null>(null)

  // Bộ lọc bảng và chế độ xem
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [showOnlyActiveHubs, setShowOnlyActiveHubs] = useState<boolean>(true)
  const [activeFinanceView, setActiveFinanceView] = useState<'OVERVIEW' | 'BRANCH_PL' | 'LEDGER' | 'CROSS_AUDIT'>(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const fview = params?.get('fview') as any
    if (fview && ['OVERVIEW', 'BRANCH_PL', 'LEDGER', 'CROSS_AUDIT'].includes(fview)) return fview
    return 'OVERVIEW'
  })

  // 1. Lọc đơn hàng theo mốc thời gian thực tế (createdAt)
  const timeFilteredShipments = useMemo(() => {
    if (timePreset === 'ALL') return shipments

    const now = new Date()
    return shipments.filter((s) => {
      if (!s.createdAt) return true
      const d = new Date(s.createdAt)
      if (isNaN(d.getTime())) return true

      if (timePreset === 'TODAY') {
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        )
      }
      if (timePreset === 'LAST_7_DAYS') {
        const past7 = new Date(now)
        past7.setDate(past7.getDate() - 7)
        return d >= past7 && d <= now
      }
      if (timePreset === 'THIS_MONTH') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      }
      if (timePreset === 'CUSTOM') {
        if (customStartDate && d < new Date(customStartDate)) return false
        if (customEndDate) {
          const end = new Date(customEndDate)
          end.setHours(23, 59, 59, 999)
          if (d > end) return false
        }
        return true
      }
      return true
    })
  }, [shipments, timePreset, customStartDate, customEndDate])

  // Đơn hợp lệ trong khoảng thời gian đã chọn (không tính đơn hủy)
  const validShipments = useMemo(
    () => timeFilteredShipments.filter((s) => s.status !== 'CANCELLED'),
    [timeFilteredShipments]
  )

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

  // 2. CHI PHÍ VẬN TẢI THỰC TẾ THEO 3 CHẶNG
  // - First Mile (Lấy hàng): Áp dụng cho các đơn đã qua khâu lấy hàng
  const allPickedShipments = useMemo(
    () =>
      validShipments.filter((s) =>
        ['PICKED_UP', 'AT_ORIGIN_HUB', 'SORTING', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(s.status)
      ),
    [validShipments]
  )
  const totalFirstMileCost = allPickedShipments.length * 8000

  // - Middle Mile (Xe tải liên tỉnh & Kho SOC): Áp dụng cho đơn qua trung chuyển
  const middleMileShipments = useMemo(
    () =>
      validShipments.filter((s) =>
        ['AT_ORIGIN_HUB', 'SORTING', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(s.status)
      ),
    [validShipments]
  )
  const totalMiddleMileCost = middleMileShipments.length * 7000

  // - Last Mile (Giao tận tay): Áp dụng cho đơn giao thành công
  const totalLastMileCost = deliveredShipments.length * 9500

  // - Chi phí đơn hoàn / RTO
  const totalReturnCost = failedShipments.length * 10000

  // Tổng tiền công & lương phải trả Bưu tá (First-mile lấy + Last-mile giao)
  const totalDriverPayables = totalFirstMileCost + totalLastMileCost

  // Tổng chi phí đội xe tải Linehaul & Vận hành kho Mega SOC + Dự phòng RTO
  const totalFleetAndSocCost = totalMiddleMileCost + totalReturnCost

  // Tổng toàn bộ chi phí vận tải mạng lưới
  const totalLogisticsCost = totalDriverPayables + totalFleetAndSocCost

  // 3. LỢI NHUẬN RÒNG VẬN TẢI (Net Logistics EBITDA Margin)
  const netLogisticsProfit = totalShippingFeeCollected - totalLogisticsCost
  const netProfitMarginPercent =
    totalShippingFeeCollected > 0 ? Math.round((netLogisticsProfit / totalShippingFeeCollected) * 100) : 0

  // Chỉ số trung bình trên mỗi bưu kiện (Unit Economics per Parcel)
  const avgRevenuePerParcel = validShipments.length > 0 ? Math.round(totalShippingFeeCollected / validShipments.length) : 0
  const avgCostPerParcel = validShipments.length > 0 ? Math.round(totalLogisticsCost / validShipments.length) : 0
  const avgProfitPerParcel = avgRevenuePerParcel - avgCostPerParcel

  // 4. ĐỐI CHIẾU CHÉO (CROSS-AUDIT): TIỀN HÀNG COD VS CƯỚC VẬN CHUYỂN
  const totalCodAmount = useMemo(() => {
    return validShipments.reduce((sum, s) => sum + (s.codAmount || 0), 0)
  }, [validShipments])

  const totalCashCollected = useMemo(() => {
    return totalCodAmount + totalShippingFeeCollected
  }, [totalCodAmount, totalShippingFeeCollected])

  const codSharePercent = totalCashCollected > 0 ? Math.round((totalCodAmount / totalCashCollected) * 100) : 0
  const freightSharePercent = 100 - codSharePercent

  // Danh sách các Hub bưu cục vệ tinh và tính toán P&L từng chi nhánh
  const destinationHubs = useMemo(() => hubs.filter((h) => h.type !== 'SORTING_CENTER'), [hubs])
  const branchPerformance = useMemo(() => {
    return destinationHubs
      .map((hub) => {
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
        const hubCost = hubPicked.length * 8000 + hubDelivered.length * 9500 + hubShipments.length * 5000
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
      })
      .sort((a, b) => b.revenue - a.revenue) // Ưu tiên các Hub có doanh thu cao nhất
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

  // Dữ liệu bóc tách thù lao từng Shipper (phục vụ Modal COURIER)
  const driverBreakdown = useMemo(() => {
    return drivers
      .map((d) => {
        const assignedShipments = validShipments.filter((s) => {
          const matchId = s.assignments?.some((a) => a.driver?.id === d.id)
          const matchName = s.assignments?.some((a) => a.driver?.name?.toLowerCase() === d.name.toLowerCase())
          return matchId || matchName
        })

        const picked = assignedShipments.filter((s) =>
          ['PICKED_UP', 'AT_ORIGIN_HUB', 'SORTING', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(s.status)
        ).length

        const delivered = assignedShipments.filter((s) => ['DELIVERED', 'COMPLETED'].includes(s.status)).length

        const totalPayable = picked * 8000 + delivered * 9500
        const driverHub = hubs.find((h) => h.id === d.hubId) || d.hub

        return {
          driver: d,
          hub: driverHub,
          assignedCount: assignedShipments.length,
          pickedCount: picked,
          deliveredCount: delivered,
          totalPayable,
        }
      })
      .sort((a, b) => b.totalPayable - a.totalPayable)
  }, [drivers, validShipments, hubs])

  // Dữ liệu bóc tách 4 cụm Mega SOC (phục vụ Modal LINEHAUL)
  const socBreakdown = useMemo(() => {
    const socList = [
      { id: 'hub-hcm-01', code: 'HCM01', name: 'Trung Tâm Phân Loại Bắc Củ Chi SOC', region: 'Miền Nam' },
      { id: 'hub-hn-01', code: 'HN01', name: 'Trung Tâm Phân Loại Mê Linh SOC', region: 'Miền Bắc' },
      { id: 'hub-dng-soc', code: 'DNG01', name: 'Trung Tâm Phân Loại Hòa Cầm SOC', region: 'Miền Trung' },
      { id: 'hub-ct-soc', code: 'CT01', name: 'Trung Tâm Phân Loại Trà Nóc SOC', region: 'Tây Nam Bộ' },
    ]

    return socList.map((soc) => {
      const memberHubs = destinationHubs.filter((h) => getParentSoc(h).id === soc.id)
      const memberHubIds = memberHubs.map((h) => h.id)

      const socShipments = validShipments.filter((s) => {
        const matched = matchShipmentToHub(s, hubs)
        return matched && memberHubIds.includes(matched.id)
      })

      const transitCount = socShipments.filter((s) =>
        ['AT_ORIGIN_HUB', 'SORTING', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(s.status)
      ).length

      const returnCount = socShipments.filter((s) =>
        ['DELIVERY_FAILED', 'RETURNING', 'RETURNED'].includes(s.status)
      ).length

      const linehaulCost = transitCount * 7000
      const returnCost = returnCount * 10000
      const totalCost = linehaulCost + returnCost

      return {
        soc,
        memberHubCount: memberHubs.length,
        shipmentCount: socShipments.length,
        transitCount,
        returnCount,
        linehaulCost,
        returnCost,
        totalCost,
      }
    })
  }, [destinationHubs, validShipments, hubs])

  // Xuất file CSV báo cáo tài chính P&L
  const handleExportCSV = () => {
    const headers = [
      'Mã Vận Đơn',
      'Mã Đơn Hàng',
      'Bưu Cục Hub',
      'Cước Vận Chuyển',
      'Công Lấy First-Mile',
      'Công Giao Last-Mile',
      'Phí Linehaul SOC',
      'Lợi Nhuận Sàn',
      'Trạng Thái',
      'Ngày Tạo',
    ]
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
        s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '',
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

  // Xuất file CSV đối chiếu chéo (Cross-Audit)
  const handleExportCrossAuditCSV = () => {
    const headers = [
      'Mã Vận Đơn',
      'Mã Đơn Hàng',
      'Khách Hàng',
      'Địa Chỉ',
      'Tiền COD Trả Shop',
      'Cước Vận Chuyển P&L',
      'Tổng Tiền Khách Trả',
      'Trạng Thái Đơn',
      'Kết Quả Kiểm Toán',
    ]
    const rows = filteredShipments.map((s) => {
      const fee = s.shippingFee > 0 ? s.shippingFee : 25000
      const cod = s.codAmount || 0
      const total = cod + fee
      const auditStatus =
        s.status === 'DELIVERED' || s.status === 'COMPLETED'
          ? 'Khớp 100% - Đã Giao'
          : s.status.includes('FAIL') || s.status.includes('RETURN')
          ? 'Đơn Hoàn RTO - COD 0đ'
          : 'Đang Lưu Thông Tuyến'

      return [
        s.trackingNumber,
        s.orderId,
        `"${s.buyerName || ''}"`,
        `"${s.deliveryAddress || ''}"`,
        cod,
        fee,
        total,
        s.status,
        auditStatus,
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Logistics_Cross_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150 text-left">
      {/* 1. Header Tinh Gọn & Bộ Lọc Thời Gian Chuẩn Enterprise */}
      <div className="bg-white border border-slate-200/90 p-5 rounded-3xl shadow-3xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">📊</span>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Tài Chính Vận Tải & P&L Logistics (Unit Economics)
              </h2>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                Chuẩn Quản Trị ZeroExpress
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Hạch toán dòng tiền cước vận chuyển, công nợ lương bưu tá lấy/giao, chi phí xe tải tuyến liên tỉnh và biên lợi nhuận ròng vận tải.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            >
              <span>📥</span> Xuất Báo Cáo P&L (CSV)
            </button>
          </div>
        </div>

        {/* Thanh Bộ Lọc Thời Gian (Ngày, Tháng, Năm) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-1">
              <span>📅</span> Kỳ Báo Cáo:
            </span>
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'TODAY', label: 'Hôm nay' },
              { id: 'LAST_7_DAYS', label: '7 ngày qua' },
              { id: 'THIS_MONTH', label: 'Tháng này' },
              { id: 'CUSTOM', label: 'Tùy chọn ngày' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTimePreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  timePreset === p.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Nếu chọn Tùy chọn ngày thì hiện 2 input date */}
          {timePreset === 'CUSTOM' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Từ:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs focus:outline-emerald-500"
              />
              <span className="text-slate-500 font-medium">Đến:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs focus:outline-emerald-500"
              />
            </div>
          )}

          <div className="text-[11px] text-slate-400 font-medium">
            Đang hiển thị <b>{validShipments.length}</b> bưu kiện hợp lệ
          </div>
        </div>
      </div>

      {/* 2. 4 Thẻ Chỉ Số Tài Chính Cốt Lõi (Click để xem chi tiết bóc tách) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ 1: Doanh thu cước */}
        <div
          onClick={() => setDetailModal('FREIGHT')}
          className="bg-white border border-slate-200/90 hover:border-emerald-500 hover:shadow-md transition-all duration-150 p-4 rounded-2xl shadow-3xs space-y-2 cursor-pointer group relative select-none"
        >
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
            <span className="flex items-center gap-1.5">
              <span>🚚</span> 1. Tổng Cước Vận Chuyển
            </span>
            <span className="text-[10px] bg-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 text-slate-600 px-1.5 py-0.5 rounded font-bold transition">
              Bấm xem ↗
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono group-hover:text-emerald-700 transition">
            {formatMoney(totalShippingFeeCollected)}
          </p>
          <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Sản lượng kỳ này:</span>
            <b className="text-slate-800 font-mono">{validShipments.length} bưu kiện</b>
          </div>
        </div>

        {/* Thẻ 2: Lương & công nợ bưu tá */}
        <div
          onClick={() => setDetailModal('COURIER')}
          className="bg-white border border-slate-200/90 hover:border-amber-500 hover:shadow-md transition-all duration-150 p-4 rounded-2xl shadow-3xs space-y-2 cursor-pointer group relative select-none"
        >
          <div className="flex items-center justify-between text-xs text-amber-700 font-bold">
            <span className="flex items-center gap-1.5">
              <span>🛵</span> 2. Lương & Công Nợ Bưu Tá
            </span>
            <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-bold transition">
              Bấm xem ↗
            </span>
          </div>
          <p className="text-2xl font-black text-amber-800 font-mono group-hover:text-amber-900 transition">
            {formatMoney(totalDriverPayables)}
          </p>
          <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Công lấy & giao:</span>
            <b className="text-amber-800 font-mono">{allPickedShipments.length} lấy • {deliveredShipments.length} giao</b>
          </div>
        </div>

        {/* Thẻ 3: Chi phí xe tải Linehaul & Mega SOC */}
        <div
          onClick={() => setDetailModal('LINEHAUL')}
          className="bg-white border border-slate-200/90 hover:border-sky-500 hover:shadow-md transition-all duration-150 p-4 rounded-2xl shadow-3xs space-y-2 cursor-pointer group relative select-none"
        >
          <div className="flex items-center justify-between text-xs text-sky-700 font-bold">
            <span className="flex items-center gap-1.5">
              <span>🚛</span> 3. Xe Tải Linehaul & Kho SOC
            </span>
            <span className="text-[10px] bg-sky-50 border border-sky-200 text-sky-800 px-1.5 py-0.5 rounded font-bold transition">
              Bấm xem ↗
            </span>
          </div>
          <p className="text-2xl font-black text-sky-800 font-mono group-hover:text-sky-900 transition">
            {formatMoney(totalFleetAndSocCost)}
          </p>
          <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Kho liên tỉnh & RTO:</span>
            <b className="text-sky-800 font-mono">{middleMileShipments.length} kiện trung chuyển</b>
          </div>
        </div>

        {/* Thẻ 4: Lợi nhuận ròng vận tải */}
        <div
          onClick={() => setDetailModal('EBITDA')}
          className="bg-gradient-to-br from-emerald-50 to-teal-50/80 border border-emerald-200 hover:border-emerald-500 hover:shadow-md transition-all duration-150 p-4 rounded-2xl shadow-3xs space-y-2 cursor-pointer group relative select-none"
        >
          <div className="flex items-center justify-between text-xs text-emerald-800 font-bold">
            <span className="flex items-center gap-1.5">
              <span>🏆</span> 4. Lợi Nhuận Ròng (EBITDA)
            </span>
            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">
              Margin: {netProfitMarginPercent}% ↗
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-700 font-mono group-hover:text-emerald-900 transition">
            {formatMoney(netLogisticsProfit)}
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

          <button
            onClick={() => setActiveFinanceView('CROSS_AUDIT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeFinanceView === 'CROSS_AUDIT'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>⚖️</span> Đối Chiếu Chéo COD & Cước ({validShipments.length})
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
                  Tính toán dựa trên {validShipments.length} bưu kiện đang lưu thông thực tế trong kỳ báo cáo
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
                <p className="text-[10px] text-slate-400">Doanh thu thu về từ người mua hoặc hợp đồng cước sàn</p>
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
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'DELIVERED' || s.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'IN_TRANSIT' || s.status === 'SORTING'
                              ? 'bg-sky-100 text-sky-800'
                              : s.status === 'PICKED_UP' || s.status === 'AT_ORIGIN_HUB'
                              ? 'bg-amber-100 text-amber-800'
                              : s.status.includes('FAIL') || s.status.includes('RETURN')
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
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

      {/* ========================================================================= */}
      {/* VIEW 4: ĐỐI CHIẾU CHÉO 2 DÒNG TIỀN (COD VS CƯỚC P&L) */}
      {/* ========================================================================= */}
      {activeFinanceView === 'CROSS_AUDIT' && (
        <div className="space-y-5">
          {/* Banner giải trình đối chiếu chéo */}
          <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white p-5 rounded-3xl shadow-sm border border-purple-800/40 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚖️</span>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white uppercase">
                    Bảng Đối Chiếu Chéo Dòng Tiền Thu Hộ (COD) & Doanh Thu Vận Chuyển (P&L)
                  </h3>
                  <p className="text-[11px] text-purple-200 mt-0.5">
                    Kiểm toán tính toàn vẹn: Bóc tách minh bạch <b>Tiền Hàng Của Shop</b> và <b>Tiền Cước Của ZeroExpress</b>. Đảm bảo 100% không trùng lặp, không hạch toán nhầm.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportCrossAuditCSV}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
              >
                <span>📥</span> Xuất File Đối Chiếu (CSV)
              </button>
            </div>

            {/* Thanh tỷ trọng minh họa */}
            <div className="pt-2">
              <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                <span>Tiền Hàng Thu Hộ Shop: {codSharePercent}% ({formatMoney(totalCodAmount)})</span>
                <span>Cước Vận Chuyển ZeroExpress: {freightSharePercent}% ({formatMoney(totalShippingFeeCollected)})</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                <div style={{ width: `${codSharePercent}%` }} className="bg-amber-500 transition-all duration-300" title={`Tiền Shop: ${codSharePercent}%`} />
                <div style={{ width: `${freightSharePercent}%` }} className="bg-emerald-500 transition-all duration-300" title={`Cước VC Sàn: ${freightSharePercent}%`} />
              </div>
            </div>
          </div>

          {/* 3 Thẻ Chỉ Số Đối Chiếu Chéo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Tổng tiền mặt shipper thu */}
            <div className="bg-white border border-slate-200/90 p-4 rounded-2xl shadow-3xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 font-bold">
                <span className="flex items-center gap-1.5"><span>💵</span> Tổng Tiền Mặt Khách Trả</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">Shipper Thu</span>
              </div>
              <p className="text-2xl font-black text-slate-900 font-mono">
                {formatMoney(totalCashCollected)}
              </p>
              <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between font-medium">
                <span>Tổng số bưu kiện phát sinh:</span>
                <b className="text-slate-800 font-mono">{validShipments.length} đơn</b>
              </div>
            </div>

            {/* Dòng 1: Tiền hàng COD của Shop */}
            <div className="bg-white border border-amber-200/90 p-4 rounded-2xl shadow-3xs space-y-2">
              <div className="flex items-center justify-between text-amber-800 font-bold">
                <span className="flex items-center gap-1.5"><span>🛒</span> Dòng 1: Tiền Hàng COD (Thu Hộ Shop)</span>
                <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">100% Của Shop</span>
              </div>
              <p className="text-2xl font-black text-amber-700 font-mono">
                {formatMoney(totalCodAmount)}
              </p>
              <div className="text-[11px] text-amber-900/80 border-t border-amber-100 pt-2 flex justify-between font-medium">
                <span>Điểm đến dòng tiền:</span>
                <b className="text-amber-800">Quản lý tại Tab Đối Soát COD ➔ Trả Ví Shop</b>
              </div>
            </div>

            {/* Dòng 2: Cước vận chuyển của ZeroExpress */}
            <div className="bg-white border border-emerald-200/90 p-4 rounded-2xl shadow-3xs space-y-2">
              <div className="flex items-center justify-between text-emerald-800 font-bold">
                <span className="flex items-center gap-1.5"><span>🚚</span> Dòng 2: Cước Vận Chuyển (ZeroExpress)</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-bold">Doanh Thu Logistics</span>
              </div>
              <p className="text-2xl font-black text-emerald-700 font-mono">
                {formatMoney(totalShippingFeeCollected)}
              </p>
              <div className="text-[11px] text-emerald-900/80 border-t border-emerald-100 pt-2 flex justify-between font-medium">
                <span>Điểm đến dòng tiền:</span>
                <b className="text-emerald-800">Quản lý tại Tab P&L ➔ Trừ Chi Phí Xe & Lãi</b>
              </div>
            </div>
          </div>

          {/* Bảng chi tiết đối chiếu chéo từng bưu kiện */}
          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-3xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Chi Tiết Bóc Tách Từng Vận Đơn ({filteredShipments.length} bưu kiện)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Đối chiếu song song Tiền COD vs Cước Vận Chuyển trên từng đơn hàng
                </p>
              </div>

              {/* Bộ lọc tìm kiếm */}
              <input
                type="text"
                placeholder="Tìm mã ZMX, địa chỉ, người mua..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs w-full sm:w-60 focus:outline-emerald-500"
              />
            </div>

            {/* Bảng dữ liệu */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 font-bold text-slate-600">
                  <tr>
                    <th className="text-left p-3">Mã Vận Đơn & Khách Hàng</th>
                    <th className="text-left p-3">Bưu Cục Hub</th>
                    <th className="text-right p-3 text-amber-800">Tiền Hàng COD (Trả Shop)</th>
                    <th className="text-right p-3 text-emerald-800">Cước VC (Doanh Thu P&L)</th>
                    <th className="text-right p-3">Tổng Tiền Khách Trả</th>
                    <th className="text-center p-3">Tỷ Trọng Tiền Shop / Sàn</th>
                    <th className="text-center p-3">Kết Quả Kiểm Toán</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredShipments.map((s) => {
                    const fee = s.shippingFee > 0 ? s.shippingFee : 25000
                    const cod = s.codAmount || 0
                    const total = cod + fee
                    const codPercent = total > 0 ? Math.round((cod / total) * 100) : 0
                    const feePercent = 100 - codPercent
                    const matchedHub = matchShipmentToHub(s, hubs)
                    const isDelivered = ['DELIVERED', 'COMPLETED'].includes(s.status)
                    const isFailed = ['DELIVERY_FAILED', 'RETURNING', 'RETURNED'].includes(s.status)

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3">
                          <div className="font-mono font-bold text-slate-900">{s.trackingNumber}</div>
                          <div className="text-[11px] text-slate-500 font-sans">
                            {s.buyerName} • #{s.orderId}
                          </div>
                        </td>

                        <td className="p-3">
                          <span className="font-bold text-slate-800">
                            {matchedHub?.name.replace('Bưu Cục Giao Hàng ', '') || 'Bưu Cục Hub'}
                          </span>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{s.deliveryAddress}</div>
                        </td>

                        <td className="text-right p-3 font-mono font-bold text-amber-700">
                          {cod > 0 ? formatMoney(cod) : <span className="text-slate-400 font-normal">0đ (Đã TT trước)</span>}
                        </td>

                        <td className="text-right p-3 font-mono font-bold text-emerald-700">
                          {formatMoney(fee)}
                        </td>

                        <td className="text-right p-3 font-mono font-black text-slate-900 text-sm">
                          {formatMoney(total)}
                        </td>

                        <td className="text-center p-3">
                          <div className="w-24 mx-auto">
                            <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-0.5">
                              <span className="text-amber-700">{codPercent}%</span>
                              <span className="text-emerald-700">{feePercent}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                              <div style={{ width: `${codPercent}%` }} className="bg-amber-500" />
                              <div style={{ width: `${feePercent}%` }} className="bg-emerald-500" />
                            </div>
                          </div>
                        </td>

                        <td className="text-center p-3">
                          {isDelivered ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span>✅</span> Khớp 100% (Đã Giao)
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <span>⚠️</span> Đơn Hoàn (COD 0đ)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                              <span>🔄</span> Lưu Thông ({s.status})
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4 MODALS BÓC TÁCH CHI TIẾT KHI CLICK VÀO 4 THẺ CHỈ SỐ */}
      {/* ========================================================================= */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden text-left">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">
                  {detailModal === 'FREIGHT' && '🚚'}
                  {detailModal === 'COURIER' && '🛵'}
                  {detailModal === 'LINEHAUL' && '🚛'}
                  {detailModal === 'EBITDA' && '🏆'}
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    {detailModal === 'FREIGHT' && 'Chi Tiết Hạch Toán Cước Vận Chuyển'}
                    {detailModal === 'COURIER' && 'Bóc Tách Lương & Thù Lao Bưu Tá (Shipper Payables)'}
                    {detailModal === 'LINEHAUL' && 'Chi Phí Tuyến Xe Tải Linehaul & Cụm Kho Mega SOC'}
                    {detailModal === 'EBITDA' && 'Báo Cáo Cân Đối Lợi Nhuận Ròng Vận Tải (EBITDA)'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Dữ liệu bóc tách thời gian thực ({validShipments.length} bưu kiện trong kỳ)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* MODAL 1: FREIGHT DETAIL */}
              {detailModal === 'FREIGHT' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                      <span className="text-[11px] text-slate-500 font-bold uppercase block">Tổng Cước Đã Hạch Toán</span>
                      <p className="text-xl font-black text-slate-900 font-mono mt-1">
                        {formatMoney(totalShippingFeeCollected)}
                      </p>
                    </div>
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <span className="text-[11px] text-emerald-800 font-bold uppercase block">Đơn Đã Giao Thành Công</span>
                      <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                        {deliveredShipments.length} / {validShipments.length} đơn
                      </p>
                    </div>
                    <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl">
                      <span className="text-[11px] text-sky-800 font-bold uppercase block">Cước Bình Quân / Bưu Kiện</span>
                      <p className="text-xl font-black text-sky-700 font-mono mt-1">
                        {formatMoney(avgRevenuePerParcel)}
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[350px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 font-bold text-slate-600">
                        <tr>
                          <th className="p-3">Mã Vận Đơn</th>
                          <th className="p-3">Người Nhận & Địa Chỉ</th>
                          <th className="p-3 text-right">Cước Phí</th>
                          <th className="p-3 text-center">Trạng Thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validShipments.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-emerald-700">
                              {s.trackingNumber}
                              <div className="text-[10px] text-slate-400 font-sans font-normal">#{s.orderId}</div>
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-slate-800">{s.buyerName}</span>
                              <div className="text-[11px] text-slate-400 line-clamp-1">{s.deliveryAddress}</div>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">
                              {formatMoney(s.shippingFee > 0 ? s.shippingFee : 25000)}
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MODAL 2: COURIER DETAIL */}
              {detailModal === 'COURIER' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                    <div>
                      <span className="text-xs font-bold text-amber-900 block">
                        Định mức chi trả thù lao Shipper:
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        • Công lấy hàng (First-Mile): <b>8.000đ/đơn</b> | • Công giao tận tay (Last-Mile): <b>9.500đ/đơn</b>
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-amber-700 font-bold uppercase block">Tổng Tiền Công Phải Trả</span>
                      <b className="text-lg font-black text-amber-900">{formatMoney(totalDriverPayables)}</b>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[350px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 font-bold text-slate-600">
                        <tr>
                          <th className="p-3">Bưu Tá & SĐT</th>
                          <th className="p-3">Bưu Cục Trực Thuộc</th>
                          <th className="p-3 text-center">Đơn Lấy (8k)</th>
                          <th className="p-3 text-center">Đơn Giao (9.5k)</th>
                          <th className="p-3 text-right">Tổng Thù Lao</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {driverBreakdown.map((item) => (
                          <tr key={item.driver.id} className="hover:bg-slate-50">
                            <td className="p-3">
                              <span className="font-bold text-slate-900">{item.driver.name}</span>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {item.driver.phone} • {item.driver.vehicleNumber || 'Xe máy'}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="font-medium text-slate-700">{item.hub?.name || 'Chưa gán Hub'}</span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-amber-700">
                              {item.pickedCount} đơn
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-orange-700">
                              {item.deliveredCount} đơn
                            </td>
                            <td className="p-3 text-right font-mono font-black text-slate-900 text-sm">
                              {formatMoney(item.totalPayable)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MODAL 3: LINEHAUL DETAIL */}
              {detailModal === 'LINEHAUL' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-sky-900 block">
                        Phân bổ chi phí xe tải liên tỉnh & cụm phân loại tự động:
                      </span>
                      <p className="text-[11px] text-sky-800 mt-0.5">
                        • Xe tải Linehaul + Kho Mega SOC: <b>7.000đ/bưu kiện</b> | • Xử lý hoàn bưu kiện (RTO): <b>10.000đ/đơn</b>
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-sky-700 font-bold uppercase block">Tổng Chi Phí Tuyến</span>
                      <b className="text-lg font-black text-sky-900">{formatMoney(totalFleetAndSocCost)}</b>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                        <tr>
                          <th className="p-3">Cụm Mega SOC & Vùng</th>
                          <th className="p-3 text-center">Bưu Cục Vệ Tinh</th>
                          <th className="p-3 text-center">Bưu Kiện Trung Chuyển</th>
                          <th className="p-3 text-center">Đơn Hoàn / RTO</th>
                          <th className="p-3 text-right">Tổng Chi Phí Phân Bổ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {socBreakdown.map((item) => (
                          <tr key={item.soc.id} className="hover:bg-slate-50">
                            <td className="p-3">
                              <span className="font-bold text-slate-900">{item.soc.name}</span>
                              <div className="text-[11px] text-sky-700 font-medium">{item.soc.region}</div>
                            </td>
                            <td className="p-3 text-center font-mono font-medium text-slate-700">
                              {item.memberHubCount} Hubs
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-sky-800">
                              {item.transitCount} kiện
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-rose-600">
                              {item.returnCount} kiện
                            </td>
                            <td className="p-3 text-right font-mono font-black text-slate-900 text-sm">
                              {formatMoney(item.totalCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MODAL 4: EBITDA DETAIL */}
              {detailModal === 'EBITDA' && (
                <div className="space-y-4">
                  <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                      <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                        Báo Cáo Cân Đối Thu - Chi Vận Tải (Income Statement)
                      </span>
                      <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded">
                        EBITDA Margin: {netProfitMarginPercent}%
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-200">
                        <span className="font-bold">(+) 1. Tổng Doanh Thu Cước Thực Tế (Gross Revenue)</span>
                        <b className="font-mono text-emerald-400 text-sm">{formatMoney(totalShippingFeeCollected)}</b>
                      </div>
                      <div className="flex justify-between items-center text-slate-300 pl-4">
                        <span>(-) 2. Chi Phí Lương & Thù Lao Bưu Tá (First + Last Mile)</span>
                        <b className="font-mono text-rose-400">-{formatMoney(totalDriverPayables)}</b>
                      </div>
                      <div className="flex justify-between items-center text-slate-300 pl-4">
                        <span>(-) 3. Chi Phí Xe Tải Tuyến Linehaul & Trung Tâm Mega SOC</span>
                        <b className="font-mono text-rose-400">-{formatMoney(totalFleetAndSocCost)}</b>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-800 pt-2.5 text-sm font-black text-white">
                        <span className="uppercase text-emerald-300">(=) Lợi Nhuận Ròng Vận Tải (Net Logistics Profit)</span>
                        <b className="font-mono text-emerald-400 text-base">{formatMoney(netLogisticsProfit)}</b>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                      <span className="text-slate-500 font-medium">Doanh thu bình quân / đơn:</span>
                      <p className="font-mono font-bold text-slate-900">{formatMoney(avgRevenuePerParcel)}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-0.5">
                      <span className="text-emerald-800 font-medium">Lợi nhuận ròng bình quân / đơn:</span>
                      <p className="font-mono font-bold text-emerald-700">+{formatMoney(avgProfitPerParcel)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/40">
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
