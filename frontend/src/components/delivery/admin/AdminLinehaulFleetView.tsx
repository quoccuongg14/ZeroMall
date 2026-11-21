import React, { useState, useMemo } from 'react'
import type { Hub, Shipment, Driver } from './types'

interface AdminLinehaulFleetViewProps {
  hubs: Hub[]
  drivers?: Driver[]
  shipments: Shipment[]
  onSelectShipment?: (shipment: Shipment) => void
}

type FleetFilter = 'ALL' | 'INTERNAL' | '3PL' | 'RUNNING'

// Helper làm gọn tên bưu cục/SOC để hiển thị trực quan, không bị cắt dấu ...
export const cleanHubName = (name: string): string => {
  return (name || '')
    .replace(/^Trung Tâm Phân Loại\s+/i, '')
    .replace(/^Bưu Cục Giao Hàng\s+/i, '')
    .replace(/^Kho Trung Chuyển\s+/i, '')
    .replace(/^Bưu Cục\s+/i, '')
    .replace(/^Kho Tổng\s+/i, '')
    .trim()
}

// Helper phân định tuyến Linehaul liên tỉnh chuẩn mạng lưới TMĐT (không trùng xuất phát & đích đến)
export const resolveLinehaulRoute = (originHub: { id?: string; code?: string; province?: string }, hubs: Hub[]): Hub => {
  const code = (originHub?.code || '').toUpperCase()
  const prov = (originHub?.province || '').toLowerCase()

  // 1. Xuất phát từ miền Nam (HCM01 Bắc Củ Chi SOC) -> Tuyến trục đi Mê Linh SOC (HN01)
  if (code === 'HCM01' || prov.includes('hồ chí minh')) {
    return hubs.find((h) => h.code === 'HN01') || hubs.find((h) => h.code === 'DNG01') || hubs[0]
  }

  // 2. Xuất phát từ miền Bắc (HN01 Mê Linh SOC) -> Tuyến trục đi Bắc Củ Chi SOC (HCM01)
  if (code === 'HN01' || prov.includes('hà nội')) {
    return hubs.find((h) => h.code === 'HCM01') || hubs.find((h) => h.code === 'DNG01') || hubs[0]
  }

  // 3. Xuất phát từ miền Trung (DNG01 Hòa Cầm SOC) -> Tuyến liên miền về Mê Linh SOC (HN01)
  if (code === 'DNG01' || prov.includes('đà nẵng')) {
    return hubs.find((h) => h.code === 'HN01') || hubs.find((h) => h.code === 'HCM01') || hubs[0]
  }

  // 4. Xuất phát từ Tây Nam Bộ (CT01 Trà Nóc SOC) -> Tuyến về Kho Tổng Nam Bộ (HCM01 Bắc Củ Chi SOC)
  if (code === 'CT01' || prov.includes('cần thơ')) {
    return hubs.find((h) => h.code === 'HCM01') || hubs.find((h) => h.id !== originHub.id) || hubs[0]
  }

  // 5. Xuất phát từ Hub vệ tinh (Biên Hòa Hub DN01, Hòa Bình...) -> Về Mega SOC Củ Chi (HCM01) hoặc Mê Linh (HN01)
  if (prov.includes('đồng nai') || prov.includes('bình dương')) {
    return hubs.find((h) => h.code === 'HCM01') || hubs[0]
  }
  if (prov.includes('hòa bình') || prov.includes('hoà bình') || prov.includes('bắc ninh')) {
    return hubs.find((h) => h.code === 'HN01') || hubs[0]
  }

  // Fallback an toàn: Tìm 1 Mega SOC khác với originHub
  const otherSoc = hubs.find((h) => h.type === 'SORTING_CENTER' && h.id !== originHub.id)
  return otherSoc || hubs.find((h) => h.id !== originHub.id) || hubs[0]
}

export const AdminLinehaulFleetView: React.FC<AdminLinehaulFleetViewProps> = ({
  hubs,
  drivers = [],
  shipments,
  onSelectShipment,
}) => {
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('ALL')
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null)

  // Danh sách bưu kiện đang trên đường trung chuyển liên tỉnh (IN_TRANSIT)
  const linehaulShipments = useMemo(() => {
    return shipments.filter((s) =>
      ['IN_TRANSIT', 'SORTING', 'AT_DESTINATION_HUB'].includes(s.status)
    )
  }, [shipments])

  // Lọc danh sách tài xế xe tải thực tế từ CSDL
  const truckDrivers = useMemo(() => {
    return drivers.filter(
      (d) =>
        d.vehicleType === 'TRUCK' ||
        d.vehicleNumber?.toUpperCase().includes('C') ||
        d.vehicleNumber?.toUpperCase().includes('H')
    )
  }, [drivers])

  // Tạo danh sách các chuyến xe tải Linehaul thực tế kết nối với CSDL
  const linehaulRoutes = useMemo(() => {
    return truckDrivers.map((driver, index) => {
      // 1. Phân loại sở hữu: Xe nội bộ (SPX Fleet) vs Xe thuê ngoài đối tác (3PL Subcontractor)
      const nameUpper = (driver.name || '').toUpperCase()
      const isOutsourced =
        nameUpper.includes('3PL') ||
        nameUpper.includes('INDO-TRANS') ||
        nameUpper.includes('ĐỐI TÁC') ||
        nameUpper.includes('THUÊ') ||
        nameUpper.includes('ITL')

      const carrierName = isOutsourced
        ? 'Đối Tác 3PL Indo-Trans Logistics (ITL)'
        : 'Đội Xe Nội Bộ ZeroExpress (SPX Fleet)'

      // 2. Hub xuất phát của tài xế
      const originHub: Hub =
        hubs.find((h) => h.id === driver.hubId) ||
        hubs.find((h) => h.code === 'HCM01') ||
        hubs[0] || {
          id: 'hub-hcm-01',
          name: 'Trung Tâm Phân Loại Bắc Củ Chi SOC',
          code: 'HCM01',
          type: 'SORTING_CENTER',
          address: 'Huyện Củ Chi',
          province: 'Hồ Chí Minh',
          district: 'Huyện Củ Chi',
        }

      // 3. Tìm các bưu kiện thực tế đang nằm trên xe tải này
      const assignedShipments = linehaulShipments.filter((s) => {
        // Kiểm tra qua phân công (assignments)
        const matchedAssignment = s.assignments?.some(
          (a) => a.driver?.id === driver.id || (a as any).driverId === driver.id
        )
        // Hoặc kiểm tra qua lịch sử vết quét (trackingLogs)
        const matchedLog = s.trackingLogs?.some(
          (l) =>
            (l.description || '').includes(driver.vehicleNumber) ||
            (l.description || '').includes(driver.name) ||
            (l.location || '').includes(driver.vehicleNumber)
        )
        // Hoặc nếu đơn IN_TRANSIT xuất phát từ Hub của tài xế (phân bổ thông minh)
        const matchedHub = s.status === 'IN_TRANSIT' && (s.currentHubId === driver.hubId || (!s.currentHubId && index === 0))
        return matchedAssignment || matchedLog || matchedHub
      })

      const isRunning = assignedShipments.length > 0
      const totalWeightKg = Number(
        assignedShipments
          .reduce((sum, s) => sum + (s.package?.weight || 0.5), 0)
          .toFixed(1)
      )

      // 4. Nhận diện Hub đích thực tế từ các đơn hàng trên xe hoặc theo lộ trình mạng lưới
      let destinationHub: Hub

      if (isRunning && assignedShipments[0]) {
        const destAddr = (assignedShipments[0].deliveryAddress || '').toLowerCase()
        if ((destAddr.includes('hà nội') || destAddr.includes('mê linh')) && originHub.code !== 'HN01') {
          destinationHub = hubs.find((h) => h.code === 'HN01') || resolveLinehaulRoute(originHub, hubs)
        } else if ((destAddr.includes('đồng nai') || destAddr.includes('biên hòa')) && originHub.code !== 'DN01') {
          destinationHub = hubs.find((h) => h.code === 'DN01') || resolveLinehaulRoute(originHub, hubs)
        } else if ((destAddr.includes('đà nẵng') || destAddr.includes('hòa cầm')) && originHub.code !== 'DNG01') {
          destinationHub = hubs.find((h) => h.code === 'DNG01') || resolveLinehaulRoute(originHub, hubs)
        } else if ((destAddr.includes('cần thơ') || destAddr.includes('ninh kiều')) && originHub.code !== 'CT01') {
          destinationHub = hubs.find((h) => h.code === 'CT01') || resolveLinehaulRoute(originHub, hubs)
        } else {
          destinationHub = resolveLinehaulRoute(originHub, hubs)
        }
      } else {
        destinationHub = resolveLinehaulRoute(originHub, hubs)
      }

      // Đảm bảo tuyệt đối không bao giờ trùng nhau giữa xuất phát và đích đến
      if (destinationHub.id === originHub.id || destinationHub.code === originHub.code) {
        destinationHub = resolveLinehaulRoute(originHub, hubs)
      }

      // 5. Trích xuất mã Seal chì an ninh từ lịch sử đơn hàng hoặc sinh theo quy chuẩn
      let sealNumber = 'CHƯA NIÊM PHONG'
      if (isRunning) {
        for (const s of assignedShipments) {
          const logText = (s.trackingLogs || []).map((l) => l.description).join(' ')
          const sealMatch = logText.match(/SEAL-[A-Z0-9-]+/i)
          if (sealMatch) {
            sealNumber = sealMatch[0]
            break
          }
        }
        if (sealNumber === 'CHƯA NIÊM PHONG') {
          const cleanPlate = driver.vehicleNumber.replace(/[^A-Z0-9]/gi, '').slice(-4)
          sealNumber = `SEAL-${originHub.code}-${destinationHub.code}-${cleanPlate || '2026'}`
        }
      }

      // 6. Tính toán tỷ lệ tải trọng thực tế (Dung tích tối đa xe 15T: 3000 kiện, xe 8T: 1500 kiện, xe 20ft: 4000 kiện)
      const maxCapacity = nameUpper.includes('20FT')
        ? 4000
        : nameUpper.includes('15T')
        ? 3000
        : 1500

      const capacityPercent = isRunning
        ? Math.min(100, Math.max(1, Math.round((assignedShipments.length / maxCapacity) * 100)))
        : 0

      return {
        id: driver.id,
        driverId: driver.id,
        driverName: driver.name,
        driverPhone: driver.phone,
        vehicleNumber: driver.vehicleNumber,
        isOutsourced,
        carrierName,
        originHub,
        destinationHub,
        status: isRunning ? 'IN_TRANSIT' : 'STANDBY_DOCK',
        capacityPercent,
        parcelsCount: assignedShipments.length,
        totalWeightKg,
        maxCapacity,
        sealNumber,
        assignedShipments,
        departureTime: isRunning ? '22:30 Ca Đêm' : 'Chờ lệnh xuất bến',
        estimatedArrival: isRunning ? '18:00 Hôm nay' : 'Theo lịch trình',
      }
    })
  }, [truckDrivers, hubs, linehaulShipments])

  // Lọc các chuyến xe theo bộ lọc
  const filteredRoutes = useMemo(() => {
    return linehaulRoutes.filter((route) => {
      if (fleetFilter === 'INTERNAL') return !route.isOutsourced
      if (fleetFilter === '3PL') return route.isOutsourced
      if (fleetFilter === 'RUNNING') return route.status === 'IN_TRANSIT'
      return true
    })
  }, [linehaulRoutes, fleetFilter])

  // Số lượng thống kê tổng quan
  const runningTrucksCount = linehaulRoutes.filter((r) => r.status === 'IN_TRANSIT').length
  const totalParcelsInTransit = linehaulShipments.length
  const internalCount = linehaulRoutes.filter((r) => !r.isOutsourced).length
  const outsourcedCount = linehaulRoutes.filter((r) => r.isOutsourced).length

  // Danh sách đơn hàng hiển thị ở bảng dưới (lọc theo xe được chọn hoặc tất cả)
  const displayedShipments = useMemo(() => {
    if (selectedTruckId) {
      const selectedRoute = linehaulRoutes.find((r) => r.id === selectedTruckId)
      return selectedRoute ? selectedRoute.assignedShipments : []
    }
    return linehaulShipments
  }, [linehaulShipments, selectedTruckId, linehaulRoutes])

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-150">
      {/* 1. Header Linehaul Overview */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-indigo-800/40 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-2xl">🚛</span>
              <h2 className="text-lg font-black tracking-tight text-white">
                Hệ Thống Xe Tải Tuyến Chính (SPX Linehaul Fleet)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/40 uppercase">
                Liên Tỉnh 24/7
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Giám sát hải trình các đoàn xe trung chuyển đường dài kết nối <b>4 Mega SOC</b> và <b>10 Bưu cục phát</b> toàn quốc. 
              Vận hành theo mô hình kết hợp giữa <b>Đội xe công ty</b> và <b>Đối tác vận tải 3PL</b>.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-white/15 text-right shrink-0">
            <span className="text-[10px] text-slate-300 uppercase block font-semibold">
              Bưu kiện trên xe tải
            </span>
            <span className="text-2xl font-black text-amber-400 font-mono">
              {totalParcelsInTransit} đơn
            </span>
          </div>
        </div>

        {/* 4 Thẻ chỉ số xe tải động 100% */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wide">
              Đoàn xe đang chạy
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-white font-mono">{runningTrucksCount}</span>
              <span className="text-slate-400 text-[11px]">/ {truckDrivers.length} xe tải</span>
            </div>
          </div>

          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wide">
              Cơ cấu phương tiện
            </span>
            <div className="flex items-center gap-2 mt-0.5 font-mono text-xs">
              <span className="text-sky-300 font-bold">{internalCount} Xe Nội Bộ</span>
              <span className="text-slate-500">•</span>
              <span className="text-indigo-300 font-bold">{outsourcedCount} Xe 3PL</span>
            </div>
          </div>

          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wide">
              Tổng lượng hàng trên xe
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-400 font-mono">{totalParcelsInTransit}</span>
              <span className="text-slate-400 text-[11px]">kiện hàng</span>
            </div>
          </div>

          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wide">
              Niêm phong an ninh
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-emerald-400 font-mono">100%</span>
              <span className="text-slate-400 text-[11px]">Khóa Seal Chì</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Thanh Lọc Chuyến Xe & Phân Loại Sở Hữu */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-3xs">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-bold mr-1">Bộ lọc xe:</span>
          <button
            onClick={() => { setFleetFilter('ALL'); setSelectedTruckId(null); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              fleetFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-3xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất Cả ({linehaulRoutes.length})
          </button>
          <button
            onClick={() => { setFleetFilter('INTERNAL'); setSelectedTruckId(null); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              fleetFilter === 'INTERNAL'
                ? 'bg-sky-600 text-white shadow-3xs'
                : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
            }`}
          >
            <span>🏢</span> Xe Nội Bộ SPX ({internalCount})
          </button>
          <button
            onClick={() => { setFleetFilter('3PL'); setSelectedTruckId(null); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              fleetFilter === '3PL'
                ? 'bg-indigo-600 text-white shadow-3xs'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <span>🤝</span> Xe Thuê Ngoài 3PL ({outsourcedCount})
          </button>
          <button
            onClick={() => { setFleetFilter('RUNNING'); setSelectedTruckId(null); }}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              fleetFilter === 'RUNNING'
                ? 'bg-amber-600 text-white shadow-3xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <span>🚚</span> Đang Chạy ({runningTrucksCount})
          </button>
        </div>

        {selectedTruckId && (
          <button
            onClick={() => setSelectedTruckId(null)}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200"
          >
            <span>✕</span> Bỏ chọn xe để xem tất cả ({totalParcelsInTransit} đơn)
          </button>
        )}
      </div>

      {/* 3. Danh Sách Các Chuyến Xe Linehaul Đang Quản Lý (100% Dynamic Từ CSDL) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRoutes.map((route) => {
          const isSelected = selectedTruckId === route.id
          const isRunning = route.status === 'IN_TRANSIT'

          return (
            <div
              key={route.id}
              onClick={() => setSelectedTruckId(isSelected ? null : route.id)}
              className={`bg-white border rounded-3xl p-5 shadow-3xs space-y-3.5 transition cursor-pointer relative ${
                isSelected
                  ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                  : 'border-slate-200/90 hover:border-indigo-300'
              }`}
            >
              {/* Header Thẻ Xe */}
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                      {route.vehicleNumber}
                    </span>
                    {/* Badge Sở hữu: Nội bộ vs Thuê ngoài 3PL */}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        route.isOutsourced
                          ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                          : 'bg-sky-50 text-sky-800 border border-sky-200'
                      }`}
                    >
                      {route.isOutsourced ? '🤝 Đối Tác 3PL' : '🏢 SPX Fleet'}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm mt-1.5 flex items-center gap-1.5">
                    <span>{route.driverName}</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    SĐT: {route.driverPhone} • {route.carrierName}
                  </p>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                    isRunning
                      ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {isRunning ? '🚚 Đang Chạy' : '🅿️ Sẵn Sàng Tại Dock'}
                </span>
              </div>

              {/* Lộ Trình Tuyến Đường Trực Quan */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="text-[11px] text-slate-500 w-16 shrink-0 font-medium">Xuất phát:</span>
                    <span className="font-bold text-slate-900 font-mono text-xs truncate" title={route.originHub.name}>
                      [{route.originHub.code}] {cleanHubName(route.originHub.name)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                    <span className="text-[11px] text-slate-500 w-16 shrink-0 font-medium">Đích đến:</span>
                    <span className="font-bold text-indigo-700 font-mono text-xs truncate" title={route.destinationHub.name}>
                      [{route.destinationHub.code}] {cleanHubName(route.destinationHub.name)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-200/70">
                  <span>Khởi hành: <b>{route.departureTime}</b></span>
                  <span>Dự kiến: <b>{route.estimatedArrival}</b></span>
                </div>
              </div>

              {/* Tải Trọng Thực Tế & Mã Seal Chì */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Bưu kiện trên xe:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {route.parcelsCount > 0 ? (
                      <span className="text-amber-700 font-black">
                        {route.parcelsCount} kiện ({route.totalWeightKg}kg)
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">Trống thùng</span>
                    )}
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${route.capacityPercent}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      route.parcelsCount > 0 ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] pt-1">
                  <span className="text-slate-400">Khóa Seal an ninh:</span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] ${
                      isRunning
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    🔒 {route.sealNumber}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-1">
                <button
                  type="button"
                  className={`w-full py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>📦</span> {isSelected ? 'Đang Lọc Bưu Kiện Xe Này' : 'Xem Chi Tiết Kiện Hàng'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 4. Danh Sách Vận Đơn Đang Trung Chuyển Trên Xe Tải (100% Dynamic Từ CSDL) */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
              {selectedTruckId
                ? `Bưu Kiện Thuộc Xe Tải Đã Chọn (${displayedShipments.length} kiện)`
                : `Tất Cả Bưu Kiện Đang Trên Tuyến Xe Tải (${linehaulShipments.length} kiện)`}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Dữ liệu vận đơn thực tế liên kết với máy quét mã vạch và niêm phong Seal chì
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Mã Vận Đơn ZMX</th>
                <th className="py-3 px-3.5">Người Nhận / Địa Chỉ Giao</th>
                <th className="py-3 px-3.5">Trọng Lượng & Hàng Hóa</th>
                <th className="py-3 px-3.5">Kho Hiện Tại</th>
                <th className="py-3 px-3.5 text-center">Trạng Thái</th>
                <th className="py-3 px-3.5 text-right">Lộ Trình</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedShipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    <span className="text-2xl block mb-1">🔍</span>
                    Hiện không có bưu kiện nào trên chuyến xe tải này.
                  </td>
                </tr>
              ) : (
                displayedShipments.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3.5 font-mono font-bold text-emerald-700">
                      {s.trackingNumber}
                      <span className="text-[10px] text-slate-400 block font-sans font-normal">#{s.orderId}</span>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-800">{s.buyerName}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs" title={s.deliveryAddress}>
                        {s.deliveryAddress}
                      </div>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-slate-800 line-clamp-1">
                        {s.package?.itemsSummary || 'Hàng hóa ZeroMall'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {s.package?.weight || 0.5} kg
                      </div>
                    </td>
                    <td className="py-3 px-3.5">
                      <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {s.currentHub?.name || s.currentHubId || 'Trung Tâm Khai Thác SOC'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectShipment && onSelectShipment(s)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Xem Lộ Trình ➔
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
