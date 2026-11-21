import React, { useMemo } from 'react'
import type { Hub, Shipment, LinehaulTrip, DockTruck } from './types'

interface SocDashboardProps {
  currentHub: Hub
  hubs: Hub[]
  sortingList: Shipment[]
  inTransitList: Shipment[]
  linehaulTrips: LinehaulTrip[]
  dockTrucks: DockTruck[]
  onRefresh: () => void
}

export const SocDashboard: React.FC<SocDashboardProps> = ({
  currentHub,
  hubs,
  sortingList,
  inTransitList,
  linehaulTrips,
  dockTrucks,
  onRefresh,
}) => {
  // 1. Phân luồng kiện theo Hub đích
  const routeDistribution = useMemo(() => {
    const map = new Map<string, { hub: Hub; count: number; totalWeight: number }>()

    sortingList.forEach((s) => {
      const addr = (s.deliveryAddress || '').toLowerCase()
      // Tìm Hub phù hợp nhất theo địa chỉ
      let matchedHub = hubs.find((h) => {
        if (h.type === 'SORTING_CENTER') return false
        const prov = (h.province || '').toLowerCase()
        const dist = (h.district || '').toLowerCase()
        return (prov && addr.includes(prov)) || (dist && addr.includes(dist))
      })

      if (!matchedHub) {
        matchedHub = hubs.find((h) => h.id !== currentHub.id && h.type === 'SORTING_CENTER') || hubs[0]
      }

      const key = matchedHub.id
      const current = map.get(key) || { hub: matchedHub, count: 0, totalWeight: 0 }
      current.count += 1
      current.totalWeight += s.package?.weight || 0.5
      map.set(key, current)
    })

    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [sortingList, hubs, currentHub])

  // 2. Thống kê xe tại các cửa Dock
  const dockStats = useMemo(() => {
    const activeTrucks = dockTrucks.filter((t) => t.shipments.length > 0)
    const totalParcelsInDocks = dockTrucks.reduce((acc, t) => acc + t.shipments.length, 0)
    return {
      totalDocks: dockTrucks.length,
      activeTrucks: activeTrucks.length,
      totalParcelsInDocks,
    }
  }, [dockTrucks])

  // 3. Tỷ lệ phân loại hoàn thành
  const totalVolume = inTransitList.length + sortingList.length
  const sortedRate = totalVolume > 0 ? Math.round((dockStats.totalParcelsInDocks / totalVolume) * 100) : 100

  return (
    <div className="space-y-6 text-left animate-in fade-in-50 duration-200">
      {/* HEADER BANNER SOC */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 p-6 rounded-3xl text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Trung Tâm Vận Hành & Băng Chuyền SOC
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Băng chuyền tự động hoạt động
            </span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            🏭 {currentHub.name} ({currentHub.code})
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            📍 {currentHub.address ? `${currentHub.address}, ` : ''}{currentHub.district}, {currentHub.province}
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <span>🔄</span> Cập Nhật Dữ Liệu Phân Loại
        </button>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Tiếp Nhận Inbound</span>
            <span className="text-base">🚛</span>
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{inTransitList.length}</span>
            <span className="text-xs text-slate-500 font-bold">kiện cập bến</span>
          </div>
          <p className="text-[11px] text-indigo-600 font-medium">
            Từ {linehaulTrips.length} chuyến xe tải đang đến
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Đang Phân Loại DWS</span>
            <span className="text-base">⚡</span>
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{sortingList.length}</span>
            <span className="text-xs text-slate-500 font-bold">kiện trên sàn</span>
          </div>
          <p className="text-[11px] text-amber-600 font-medium">
            Chờ quét barcode & phân tuyến
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Đã Xếp Cửa Dock</span>
            <span className="text-base">📦</span>
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{dockStats.totalParcelsInDocks}</span>
            <span className="text-xs text-slate-500 font-bold">kiện lên thùng xe</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium">
            {dockStats.activeTrucks}/{dockStats.totalDocks} xe tải đang bốc dỡ
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Tiến Độ Phân Tuyến</span>
            <span className="text-base">📈</span>
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600">{sortedRate}%</span>
            <span className="text-xs text-slate-500 font-bold">hoàn thành</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, sortedRate)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* TWO COLUMNS: DOCK DOORS & ROUTING MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CỬA DOCK TIẾP NHẬN & XUẤT HÀNG */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>🚪</span> Tình Trạng Cửa Dock (Truck Docks)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Vị trí đỗ xe tải bốc xếp và niêm phong Seal chì trung chuyển
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl">
              {dockTrucks.length} Cửa Dock
            </span>
          </div>

          <div className="space-y-3">
            {dockTrucks.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span className="text-3xl block mb-2">🚛</span>
                <p className="text-xs font-medium">Chưa có xe tải nào neo tại cửa Dock.</p>
              </div>
            ) : (
              dockTrucks.map((truck, idx) => (
                <div
                  key={truck.id}
                  className={`p-3.5 rounded-2xl border transition ${
                    truck.shipments.length > 0
                      ? 'bg-sky-50/50 border-sky-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">🚛</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">DOCK-0{idx + 1}</span>
                          <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                            {truck.truckNumber}
                          </span>
                          {truck.shipments.length > 0 ? (
                            <span className="text-[9px] font-black bg-sky-600 text-white px-2 py-0.5 rounded-full">
                              📦 ĐANG XẾP HÀNG
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                              Xe Rỗng
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                          Tuyến: <b>{truck.targetHubName}</b> • Bác tài: {truck.truckDriver} ({truck.truckDriverPhone})
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-slate-900">{truck.shipments.length}</span>
                      <span className="text-[11px] text-slate-500"> kiện</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PHÂN BỔ TUYẾN ĐÍCH (ROUTING MATRIX) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>🔀</span> Ma Trận Luồng Hàng Đến Bưu Cục / SOC Đích
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Sản lượng hàng cần xuất theo các tuyến liên tỉnh & nội vùng
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl">
              {routeDistribution.length} Tuyến
            </span>
          </div>

          {routeDistribution.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <span className="text-3xl block mb-2">📦</span>
              <p className="text-xs font-medium">Hiện không có bưu kiện nào chờ phân tuyến xuất xe tại SOC.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {routeDistribution.map(({ hub, count, totalWeight }) => (
                <div
                  key={hub.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-mono font-black text-xs">
                      {hub.code}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{hub.name}</h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        📍 {hub.district}, {hub.province} • {hub.type === 'SORTING_CENTER' ? 'Trung Tâm SOC' : 'Bưu Cục Phát'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-black text-indigo-700">{count} kiện</div>
                    <div className="text-[10px] text-slate-500 font-mono font-medium">~{totalWeight.toFixed(1)} kg</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
