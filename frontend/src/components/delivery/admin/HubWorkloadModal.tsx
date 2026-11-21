import React, { useState, useMemo } from 'react'

interface Hub {
  id: string
  code: string
  name: string
  type: string
  address?: string
  province?: string
  district?: string
}

interface Shipment {
  id: string
  status: string
  currentHubId?: string
  currentHub?: { id?: string; code?: string; name?: string }
}

interface Driver {
  id: string
  hubId?: string
  hub?: { id?: string; code?: string }
}

interface HubWorkloadModalProps {
  isOpen: boolean
  onClose: () => void
  hubs: Hub[]
  shipments: Shipment[]
  drivers: Driver[]
}

export const HubWorkloadModal: React.FC<HubWorkloadModalProps> = ({
  isOpen,
  onClose,
  hubs,
  shipments,
  drivers,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'SORTING_CENTER' | 'DESTINATION_HUB'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Thống kê tổng hợp toàn mạng lưới
  const networkMetrics = useMemo(() => {
    const totalInStock = shipments.filter((s) =>
      ['AT_ORIGIN_HUB', 'SORTING', 'AT_DESTINATION_HUB'].includes(s.status)
    ).length
    const totalDelivering = shipments.filter((s) => s.status === 'OUT_FOR_DELIVERY').length
    const socCount = hubs.filter((h) => h.type === 'SORTING_CENTER').length
    const hubCount = hubs.filter((h) => h.type === 'DESTINATION_HUB').length

    return { totalInStock, totalDelivering, socCount, hubCount }
  }, [shipments, hubs])

  // 2. Lọc danh sách bưu cục
  const filteredHubs = useMemo(() => {
    return hubs.filter((h) => {
      if (filterType !== 'ALL' && h.type !== filterType) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        h.name.toLowerCase().includes(q) ||
        h.code.toLowerCase().includes(q) ||
        (h.province && h.province.toLowerCase().includes(q)) ||
        (h.district && h.district.toLowerCase().includes(q)) ||
        (h.address && h.address.toLowerCase().includes(q))
      )
    })
  }, [hubs, filterType, searchQuery])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden text-left">
        {/* HEADER MODAL */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🏢</span>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Tải Trọng & Tình Trạng Khai Thác Toàn Mạng Lưới
              </h2>
              <span className="text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                {hubs.length} HUBS & MEGA SOC
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Theo dõi tải trọng lưu kho, tiến độ giao hàng và phân bổ lực lượng shipper trên toàn hệ thống
            </p>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* METRICS SUMMARY BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
              Tồn Kho Toàn Mạng
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-sky-700">{networkMetrics.totalInStock}</span>
              <span className="text-[10px] text-slate-500 font-medium">kiện</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
              Đang Đi Giao (Last-Mile)
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-600">{networkMetrics.totalDelivering}</span>
              <span className="text-[10px] text-slate-500 font-medium">kiện</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
              Trung Tâm Phân Loại
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-indigo-700">{networkMetrics.socCount}</span>
              <span className="text-[10px] text-slate-500 font-medium">Mega SOC</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
              Bưu Cục Giao Hàng
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-emerald-700">{networkMetrics.hubCount}</span>
              <span className="text-[10px] text-slate-500 font-medium">Hubs phát</span>
            </div>
          </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                filterType === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất Cả ({hubs.length})
            </button>
            <button
              onClick={() => setFilterType('SORTING_CENTER')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                filterType === 'SORTING_CENTER'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <span>🏭</span> Trung Tâm SOC ({networkMetrics.socCount})
            </button>
            <button
              onClick={() => setFilterType('DESTINATION_HUB')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                filterType === 'DESTINATION_HUB'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span>🏢</span> Bưu Cục Phát ({networkMetrics.hubCount})
            </button>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Tìm mã hub, tên, tỉnh thành..."
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>
        </div>

        {/* HUBS GRID CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredHubs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <span className="text-3xl block mb-2">🔍</span>
              <p className="text-xs font-medium">Không tìm thấy bưu cục nào phù hợp với bộ lọc hiện tại.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredHubs.map((hub) => {
                const isSoc = hub.type === 'SORTING_CENTER'
                const hubParcels = shipments.filter(
                  (s) => s.currentHubId === hub.id || s.currentHub?.code === hub.code
                )
                const inStockCount = hubParcels.filter((s) =>
                  ['AT_ORIGIN_HUB', 'SORTING', 'AT_DESTINATION_HUB'].includes(s.status)
                ).length
                const deliveringCount = hubParcels.filter((s) => s.status === 'OUT_FOR_DELIVERY').length
                const hubDrivers = drivers.filter((d) => d.hubId === hub.id || d.hub?.code === hub.code)

                return (
                  <div
                    key={hub.id}
                    className={`p-4 rounded-2xl border transition space-y-2.5 ${
                      isSoc
                        ? 'bg-indigo-50/30 border-indigo-200/80 hover:border-indigo-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded ${
                              isSoc
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {hub.code}
                          </span>
                          <span className="text-sm">{isSoc ? '🏭' : '🏢'}</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 mt-1">{hub.name}</h4>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          📍 {hub.address ? `${hub.address}, ` : ''}{hub.district}, {hub.province}
                        </p>
                      </div>

                      <span
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                          isSoc
                            ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        {isSoc ? 'MEGA SOC' : 'HUB PHÁT'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 text-center">
                      <div className="p-1.5 bg-slate-50/80 rounded-xl">
                        <span className="text-[9px] text-slate-400 block font-medium">Tồn kho</span>
                        <span className="font-mono font-black text-xs text-sky-700">
                          {inStockCount || hubParcels.length}
                        </span>
                      </div>
                      <div className="p-1.5 bg-slate-50/80 rounded-xl">
                        <span className="text-[9px] text-slate-400 block font-medium">Đang giao</span>
                        <span className="font-mono font-black text-xs text-orange-600">
                          {deliveringCount}
                        </span>
                      </div>
                      <div className="p-1.5 bg-slate-50/80 rounded-xl">
                        <span className="text-[9px] text-slate-400 block font-medium">
                          {isSoc ? 'Cửa Dock' : 'Shipper'}
                        </span>
                        <span className="font-mono font-black text-xs text-indigo-700">
                          {isSoc ? '4 Docks' : hubDrivers.length}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* FOOTER MODAL */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 sm:px-6 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-500 font-medium">
            Đang hiển thị <b>{filteredHubs.length}</b> / {hubs.length} bưu cục & trung tâm phân loại
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Đóng Cửa Sổ
          </button>
        </div>
      </div>
    </div>
  )
}
