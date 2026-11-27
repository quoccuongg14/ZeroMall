import React, { useState } from 'react'
import type { Hub, LinehaulTrip } from './types'
import { DemoNextStepButton } from '../../common/DemoNextStepButton'

interface HubLinehaulTripsBannerProps {
  linehaulTrips: LinehaulTrip[]
  inTransitTotalCount: number
  currentHub?: Hub | null
  actionLoading?: boolean
  onOpenReconciliation: (trip: LinehaulTrip) => void
  onQuickReceiveTrip?: (shipmentIds: string[]) => Promise<void>
  onOpenTripHistory?: () => void
}

export const HubLinehaulTripsBanner: React.FC<HubLinehaulTripsBannerProps> = ({
  linehaulTrips,
  inTransitTotalCount,
  currentHub,
  actionLoading = false,
  onOpenReconciliation,
  onQuickReceiveTrip,
  onOpenTripHistory,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [collapsedTrips, setCollapsedTrips] = useState<Record<string, boolean>>({})

  const query = searchTerm.trim().toLowerCase()
  const filteredTrips = linehaulTrips.filter((trip) => {
    if (!query) return true
    return (
      trip.truckNumber.toLowerCase().includes(query) ||
      trip.sealNumber.toLowerCase().includes(query) ||
      (trip.originHubName || '').toLowerCase().includes(query) ||
      trip.truckDriver.toLowerCase().includes(query) ||
      trip.shipments.some(
        (s) =>
          s.trackingNumber.toLowerCase().includes(query) ||
          s.buyerName.toLowerCase().includes(query) ||
          (s.package?.itemsSummary || '').toLowerCase().includes(query)
      )
    )
  })

  const toggleExpand = (tripKey: string) => {
    setCollapsedTrips((prev) => ({ ...prev, [tripKey]: !prev[tripKey] }))
  }

  return (
    <div className="divide-y divide-slate-200">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/60 border border-indigo-400/40 flex items-center justify-center text-lg">
              🚛
            </div>
            <div>
              <h4 className="font-black text-sm text-white">
                Chuyến Xe Tải Tuyến Đang Cập Bến ({linehaulTrips.length} chuyến • {inTransitTotalCount} kiện)
              </h4>
              <p className="text-[11px] text-slate-300">
                Xem thông tin từng chuyến xe, mặt hàng bên trong và đối soát Seal chì khi xe tới kho
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm biển số, Seal, mã vận đơn..."
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
            />
            {onOpenTripHistory && (
              <button
                type="button"
                onClick={onOpenTripHistory}
                className="px-3 py-1.5 bg-indigo-800/80 hover:bg-indigo-700 text-indigo-200 hover:text-white border border-indigo-400/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>📜</span>
                <span>Lịch Sử Xe Vào Hàng</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Trip Cards with Inline Cargo Manifest */}
      <div className="p-5 bg-slate-50/70 space-y-4">
        {filteredTrips.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 space-y-1.5">
            <span className="text-3xl block">🚛</span>
            <p className="font-bold text-slate-600">
              {linehaulTrips.length === 0
                ? 'Chưa có chuyến xe tải nào đang trung chuyển đến trạm này.'
                : 'Không tìm thấy chuyến xe phù hợp với từ khóa lọc.'}
            </p>
          </div>
        ) : (
          filteredTrips.map((trip) => {
            const totalWeight = trip.shipments.reduce((acc, s) => acc + (s.package?.weight || 0.5), 0)
            const isExpanded = !collapsedTrips[trip.tripKey]

            return (
              <div
                key={trip.tripKey}
                className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
              >
                {/* Trip Summary Bar */}
                <div className="p-4 bg-slate-900/3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-sky-300 font-mono font-black text-xs flex items-center gap-1.5">
                        <span>🚛</span>
                        <span>{trip.truckNumber}</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 font-mono font-bold text-xs">
                        🔒 {trip.sealNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold">
                        {trip.shipments.length} kiện • {totalWeight.toFixed(1)} kg
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span>
                        📍 Tuyến: <b className="text-slate-900">{trip.originHubName || 'Kho gửi'}</b>{' '}
                        <span className="text-indigo-600 font-black">➔</span>{' '}
                        <b className="text-indigo-700">{currentHub?.name || 'Kho nhận'}</b>
                      </span>
                      <span>
                        👨‍✈️ Tài xế: <b className="text-slate-800">{trip.truckDriver}</b>
                        {trip.truckDriverPhone ? ` (${trip.truckDriverPhone})` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleExpand(trip.tripKey)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition"
                    >
                      {isExpanded ? `▲ Ẩn hàng (${trip.shipments.length})` : `▼ Xem hàng trong xe (${trip.shipments.length})`}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenReconciliation(trip)}
                      disabled={actionLoading}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      <span>📋</span>
                      <span>Đối Soát Chuyến</span>
                    </button>

                    {onQuickReceiveTrip && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => onQuickReceiveTrip(trip.shipments.map((s) => s.id))}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        📥 Nhập Nhanh Cả Xe
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Cargo List Inside This Truck */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-4">Mã Vận Đơn</th>
                          <th className="py-2.5 px-4">Hàng Hóa Trong Xe</th>
                          <th className="py-2.5 px-4">Người Nhận / Địa Chỉ Đích</th>
                          <th className="py-2.5 px-4 text-right">Thu Hộ COD</th>
                          <th className="py-2.5 px-4 text-right">Hỗ Trợ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {trip.shipments.map((s) => (
                          <tr key={s.id} className="hover:bg-indigo-50/30 transition">
                            <td className="py-2.5 px-4 font-mono font-black text-indigo-700">
                              {s.trackingNumber}
                              <div className="text-[10px] font-normal text-slate-400">#{s.orderId.slice(0, 10)}</div>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-semibold text-slate-800">
                                {s.package?.itemsSummary || 'Kiện hàng tiêu chuẩn'}
                              </div>
                              <div className="text-[10px] text-slate-400">{s.package?.weight || 0.5} kg</div>
                            </td>
                            <td className="py-2.5 px-4 max-w-xs">
                              <div className="font-bold text-slate-800">{s.buyerName} ({s.buyerPhone})</div>
                              <div className="text-[10px] text-slate-500 truncate" title={s.deliveryAddress}>
                                📍 {s.deliveryAddress}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-700">
                              {Number(s.codAmount || 0) > 0
                                ? `${Number(s.codAmount).toLocaleString('vi-VN')}đ`
                                : '0đ'}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <DemoNextStepButton
                                identifier={s.trackingNumber || s.orderId}
                                portal="delivery"
                                hubId={currentHub?.id}
                                compact
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
