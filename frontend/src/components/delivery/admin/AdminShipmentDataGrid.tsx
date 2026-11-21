import React, { useState, useMemo } from 'react'
import type { Shipment } from './types'

interface AdminShipmentDataGridProps {
  shipments: Shipment[]
  onSelectShipment: (shipment: Shipment) => void
  initialStatusFilter?: string
  loading?: boolean
}

const formatMoney = (val: number) => (val || 0).toLocaleString('vi-VN') + 'đ'

type TimePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM'

export const AdminShipmentDataGrid: React.FC<AdminShipmentDataGridProps> = ({
  shipments,
  onSelectShipment,
  initialStatusFilter = 'ALL',
  loading = false,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter)
  const [codFilter, setCodFilter] = useState<'ALL' | 'COD_ONLY' | 'PREPAID'>('ALL')
  const [timePreset, setTimePreset] = useState<TimePreset>('ALL')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [search, setSearch] = useState('')

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 1. Lọc dữ liệu theo trạng thái, COD, thời gian & từ khóa
  const filtered = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()

    const yesterdayStart = todayStart - 24 * 3600 * 1000
    const yesterdayEnd = todayStart - 1

    const sevenDaysAgoStart = todayStart - 6 * 24 * 3600 * 1000
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime()

    const customStart = customStartDate ? new Date(customStartDate + 'T00:00:00').getTime() : null
    const customEnd = customEndDate ? new Date(customEndDate + 'T23:59:59.999').getTime() : null

    return shipments.filter((s) => {
      if (s.status === 'CANCELLED') return false

      // A. Lọc theo trạng thái phễu
      if (statusFilter === 'PICKUP') {
        if (!['CREATED', 'WAITING_PICKUP', 'PICKUP_ASSIGNED'].includes(s.status)) return false
      } else if (statusFilter === 'SORTING') {
        if (!['PICKED_UP', 'AT_ORIGIN_HUB', 'SORTING'].includes(s.status)) return false
      } else if (statusFilter === 'LINEHAUL') {
        if (!['IN_TRANSIT', 'AT_DESTINATION_HUB', 'DELIVERY_ASSIGNED'].includes(s.status)) return false
      } else if (statusFilter === 'DELIVERING') {
        if (s.status !== 'OUT_FOR_DELIVERY') return false
      } else if (statusFilter === 'DELIVERED') {
        if (!['DELIVERED', 'COMPLETED'].includes(s.status)) return false
      } else if (statusFilter === 'FAILED') {
        if (!['DELIVERY_FAILED', 'RETURNING', 'RETURNED'].includes(s.status)) return false
      }

      // B. Lọc theo COD
      if (codFilter === 'COD_ONLY' && (s.codAmount || 0) <= 0) return false
      if (codFilter === 'PREPAID' && (s.codAmount || 0) > 0) return false

      // C. Lọc theo thời gian (dựa trên createdAt hoặc thời điểm cập nhật mới nhất)
      if (timePreset !== 'ALL') {
        const itemTime = new Date(s.createdAt).getTime()
        if (isNaN(itemTime)) return false

        if (timePreset === 'TODAY') {
          if (itemTime < todayStart || itemTime > todayEnd) return false
        } else if (timePreset === 'YESTERDAY') {
          if (itemTime < yesterdayStart || itemTime > yesterdayEnd) return false
        } else if (timePreset === 'LAST_7_DAYS') {
          if (itemTime < sevenDaysAgoStart) return false
        } else if (timePreset === 'THIS_MONTH') {
          if (itemTime < monthStart) return false
        } else if (timePreset === 'CUSTOM') {
          if (customStart && itemTime < customStart) return false
          if (customEnd && itemTime > customEnd) return false
        }
      }

      // D. Lọc theo từ khóa tìm kiếm
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          s.trackingNumber.toLowerCase().includes(q) ||
          s.orderId.toLowerCase().includes(q) ||
          (s.buyerName && s.buyerName.toLowerCase().includes(q)) ||
          (s.buyerPhone && s.buyerPhone.includes(q)) ||
          (s.deliveryAddress && s.deliveryAddress.toLowerCase().includes(q))
        )
      }

      return true
    })
  }, [shipments, statusFilter, codFilter, timePreset, customStartDate, customEndDate, search])

  // Reset trang về 1 khi bộ lọc thay đổi
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPageSafe = Math.min(currentPage, totalPages)

  const paginatedShipments = useMemo(() => {
    const startIdx = (currentPageSafe - 1) * pageSize
    return filtered.slice(startIdx, startIdx + pageSize)
  }, [filtered, currentPageSafe, pageSize])

  const statusPills = [
    { id: 'ALL', label: 'Tất Cả', count: shipments.filter((s) => s.status !== 'CANCELLED').length },
    { id: 'PICKUP', label: '1. Chờ Lấy Hàng', count: shipments.filter((s) => ['CREATED', 'WAITING_PICKUP', 'PICKUP_ASSIGNED'].includes(s.status)).length },
    { id: 'SORTING', label: '2. Tại Hub/SOC', count: shipments.filter((s) => ['PICKED_UP', 'AT_ORIGIN_HUB', 'SORTING'].includes(s.status)).length },
    { id: 'LINEHAUL', label: '3. Xe Tải Tuyến', count: shipments.filter((s) => ['IN_TRANSIT', 'AT_DESTINATION_HUB', 'DELIVERY_ASSIGNED'].includes(s.status)).length },
    { id: 'DELIVERING', label: '4. Đang Đi Giao', count: shipments.filter((s) => s.status === 'OUT_FOR_DELIVERY').length },
    { id: 'DELIVERED', label: '5. Đã Giao Xong', count: shipments.filter((s) => ['DELIVERED', 'COMPLETED'].includes(s.status)).length },
    { id: 'FAILED', label: '⚠️ Thất Bại / Hoàn', count: shipments.filter((s) => ['DELIVERY_FAILED', 'RETURNING', 'RETURNED'].includes(s.status)).length },
  ]

  const timePillConfigs: Array<{ id: TimePreset; label: string }> = [
    { id: 'ALL', label: 'Toàn Thời Gian' },
    { id: 'TODAY', label: 'Hôm Nay' },
    { id: 'YESTERDAY', label: 'Hôm Qua' },
    { id: 'LAST_7_DAYS', label: '7 Ngày Qua' },
    { id: 'THIS_MONTH', label: 'Tháng Này' },
    { id: 'CUSTOM', label: '📅 Tùy Chọn Khoảng Ngày' },
  ]

  return (
    <div className="space-y-4 text-left animate-in fade-in duration-150">
      {/* 1. Header Toolbar: Filters & Search */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4.5 shadow-sm space-y-3.5">
        {/* ROW 1: Quick Filter Status Pills */}
        <div className="flex flex-wrap gap-1.5 w-full">
          {statusPills.map((pill) => {
            const active = statusFilter === pill.id
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setStatusFilter(pill.id)
                  setCurrentPage(1)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* ROW 2: TIME FILTER & SEARCH & COD */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pt-2 border-t border-slate-100">
          {/* Bộ lọc thời gian nhanh (Quick Time Presets) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wide mr-1">
              Thời Gian:
            </span>
            {timePillConfigs.map((t) => {
              const active = timePreset === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTimePreset(t.id)
                    setCurrentPage(1)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Search box & COD filter */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
            <select
              value={codFilter}
              onChange={(e) => {
                setCodFilter(e.target.value as any)
                setCurrentPage(1)
              }}
              aria-label="Lọc theo hình thức thanh toán"
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="ALL">💵 Tất Cả COD</option>
              <option value="COD_ONLY">Thu Tiền COD</option>
              <option value="PREPAID">Đã Thanh Toán Trước</option>
            </select>

            <div className="w-full sm:w-64 relative">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Lọc mã đơn, người nhận, SĐT..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ROW 3: Custom Date Range Inputs (khi chọn CUSTOM) */}
        {timePreset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-900">Từ Ngày:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-900">Đến Ngày:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>

            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('')
                  setCustomEndDate('')
                  setCurrentPage(1)
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold ml-auto cursor-pointer"
              >
                Xóa khoảng ngày
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Data Grid (Bảng dữ liệu mật độ cao chuẩn Enterprise) */}
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Mã Vận Đơn</th>
                <th className="py-3 px-4">Người Nhận / Địa Chỉ</th>
                <th className="py-3 px-4">Kiện Hàng / Cước</th>
                <th className="py-3 px-4">Tiền COD</th>
                <th className="py-3 px-4">Trạng Thái & Shipper</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                    Đang tải danh sách bưu kiện...
                  </td>
                </tr>
              ) : paginatedShipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                    Không tìm thấy vận đơn nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                paginatedShipments.map((s) => {
                  const latestAssignment = s.assignments && s.assignments[0]
                  return (
                    <tr
                      key={s.id}
                      onClick={() => onSelectShipment(s)}
                      className="hover:bg-slate-50/90 transition cursor-pointer group"
                    >
                      {/* Cột 1: Mã Vận Đơn */}
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700 space-y-0.5">
                        <div className="text-sm group-hover:underline">{s.trackingNumber}</div>
                        <div className="text-[11px] text-slate-400 font-normal font-sans">
                          Đơn: #{s.orderId}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal font-sans">
                          {new Date(s.createdAt).toLocaleString('vi-VN')}
                        </div>
                      </td>

                      {/* Cột 2: Người Nhận */}
                      <td className="py-3 px-4 space-y-0.5 max-w-xs">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{s.buyerName}</span>
                          <span className="text-slate-500 font-normal text-xs">({s.buyerPhone})</span>
                        </div>
                        <div className="text-xs text-slate-600 line-clamp-1 leading-relaxed">
                          {s.deliveryAddress}
                        </div>
                      </td>

                      {/* Cột 3: Kiện hàng & Cước */}
                      <td className="py-3 px-4 space-y-0.5">
                        <div className="text-slate-800 font-semibold line-clamp-1">
                          {s.package?.itemsSummary || 'Sản phẩm ZeroMall'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.package?.weight || 0.5}kg • Cước: {formatMoney(s.shippingFee || 30000)}
                        </div>
                      </td>

                      {/* Cột 4: COD */}
                      <td className="py-3 px-4 font-mono font-bold text-sm">
                        {s.codAmount > 0 ? (
                          <span className="text-emerald-700">{formatMoney(s.codAmount)}</span>
                        ) : (
                          <span className="text-slate-400 text-xs font-normal">Đã TT</span>
                        )}
                      </td>

                      {/* Cột 5: Trạng Thái */}
                      <td className="py-3 px-4 space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            s.status.includes('PICK')
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : s.status.includes('HUB') || s.status.includes('SORT')
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : s.status === 'IN_TRANSIT'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : s.status === 'OUT_FOR_DELIVERY'
                              ? 'bg-orange-50 text-orange-700 border border-orange-200 animate-pulse'
                              : s.status === 'DELIVERED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {s.status === 'CREATED' && 'Mới Tạo'}
                          {s.status === 'WAITING_PICKUP' && 'Chờ Lấy Hàng'}
                          {s.status === 'PICKUP_ASSIGNED' && 'Đã Gán Lấy Hàng'}
                          {s.status === 'PICKED_UP' && 'Đã Lấy Hàng'}
                          {s.status === 'AT_ORIGIN_HUB' && 'Tại Kho Xuất Phát'}
                          {s.status === 'SORTING' && 'Đang Phân Loại'}
                          {s.status === 'IN_TRANSIT' && 'Đang Trung Chuyển'}
                          {s.status === 'AT_DESTINATION_HUB' && 'Đã Đến Kho Phát'}
                          {s.status === 'DELIVERY_ASSIGNED' && 'Chờ Shipper Nhận'}
                          {s.status === 'OUT_FOR_DELIVERY' && 'Đang Giao Hàng'}
                          {s.status === 'DELIVERED' && 'Giao Thành Công'}
                          {s.status === 'DELIVERY_FAILED' && 'Giao Thất Bại'}
                        </span>

                        {latestAssignment && (
                          <div className="text-[11px] text-slate-500">
                            🛵 Shipper: <b>{latestAssignment.driver.name}</b> ({latestAssignment.driver.vehicleNumber})
                          </div>
                        )}
                      </td>

                      {/* Cột 6: Thao Tác */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectShipment(s)
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          Lộ Trình ➔
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer phân trang & số lượng */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <span>
              Hiển thị{' '}
              <b>
                {filtered.length === 0
                  ? 0
                  : `${(currentPageSafe - 1) * pageSize + 1} - ${Math.min(
                      currentPageSafe * pageSize,
                      filtered.length
                    )}`}
              </b>{' '}
              / <b>{filtered.length}</b> bưu kiện
            </span>

            {/* Dropdown Page Size */}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-slate-400">Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value={20}>20 đơn/trang</option>
                <option value={50}>50 đơn/trang</option>
                <option value={100}>100 đơn/trang</option>
              </select>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPageSafe <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={`px-3 py-1 rounded-lg font-bold border transition cursor-pointer ${
                  currentPageSafe <= 1
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                ◀ Trước
              </button>

              <span className="px-3 py-1 text-xs font-mono font-bold text-slate-700">
                Trang {currentPageSafe} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPageSafe >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={`px-3 py-1 rounded-lg font-bold border transition cursor-pointer ${
                  currentPageSafe >= totalPages
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                Sau ▶
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
