import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { API_BASE_URL } from '../../../config/api.config'
import type { Hub } from './types'

export interface TripShipmentItem {
  id: string
  trackingNumber: string
  orderId: string
  buyerName: string
  buyerPhone: string
  deliveryAddress: string
  status: string
  codAmount: number
  weight: number
  dimensions?: string
}

export interface LinehaulHistoryTrip {
  tripId: string
  tripKey: string
  tripType: 'OUTBOUND' | 'INBOUND'
  truckNumber: string
  sealNumber: string
  truckDriver: string
  truckDriverPhone: string
  originHubId: string
  originHubName: string
  originHubCode?: string
  destinationHubId?: string | null
  destinationHubName: string
  destinationHubCode?: string
  status: 'IN_TRANSIT' | 'ARRIVED' | string
  departedAt: string
  arrivedAt?: string
  totalParcels: number
  totalWeight: number
  shipments: TripShipmentItem[]
}

interface SocTruckTripHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  currentHub: Hub
}

export const SocTruckTripHistoryModal: React.FC<SocTruckTripHistoryModalProps> = ({
  isOpen,
  onClose,
  currentHub,
}) => {
  const [loading, setLoading] = useState(false)
  const [tripsData, setTripsData] = useState<{
    outbound: LinehaulHistoryTrip[]
    inbound: LinehaulHistoryTrip[]
    all: LinehaulHistoryTrip[]
  }>({ outbound: [], inbound: [], all: [] })

  const [activeTab, setActiveTab] = useState<'ALL' | 'OUTBOUND' | 'INBOUND'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTripForDetail, setSelectedTripForDetail] = useState<LinehaulHistoryTrip | null>(null)
  const [printingTrip, setPrintingTrip] = useState<LinehaulHistoryTrip | null>(null)

  const isSoc = currentHub?.type === 'SORTING_CENTER'

  // 1. Tải dữ liệu lịch sử các chuyến xe từ Backend API thực tế
  const fetchTripHistory = useCallback(async () => {
    if (!currentHub?.id) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/hubs/${currentHub.id}/linehaul-trips/history`)
      if (res.ok) {
        const data = await res.json()
        setTripsData({
          outbound: Array.isArray(data.outbound) ? data.outbound : [],
          inbound: Array.isArray(data.inbound) ? data.inbound : [],
          all: Array.isArray(data.all) ? data.all : [],
        })
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử xe tải:', err)
    } finally {
      setLoading(false)
    }
  }, [currentHub?.id])

  useEffect(() => {
    if (isOpen) {
      fetchTripHistory()
    }
  }, [isOpen, fetchTripHistory])

  // 2. Bộ lọc chuyến xe
  const filteredTrips = useMemo(() => {
    let list: LinehaulHistoryTrip[] = []
    if (activeTab === 'OUTBOUND') list = tripsData.outbound
    else if (activeTab === 'INBOUND') list = tripsData.inbound
    else list = tripsData.all

    if (!searchTerm.trim()) return list

    const s = searchTerm.trim().toLowerCase()
    return list.filter((t) => {
      return (
        t.tripId.toLowerCase().includes(s) ||
        t.truckNumber.toLowerCase().includes(s) ||
        t.sealNumber.toLowerCase().includes(s) ||
        t.truckDriver.toLowerCase().includes(s) ||
        t.truckDriverPhone.includes(s) ||
        t.destinationHubName.toLowerCase().includes(s) ||
        t.originHubName.toLowerCase().includes(s) ||
        t.shipments.some(
          (item) =>
            item.trackingNumber.toLowerCase().includes(s) ||
            item.orderId.toLowerCase().includes(s) ||
            item.buyerName.toLowerCase().includes(s) ||
            item.deliveryAddress.toLowerCase().includes(s)
        )
      )
    })
  }, [tripsData, activeTab, searchTerm])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80 backdrop-blur-xs text-left animate-in fade-in-50 duration-200">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-start justify-between gap-4 shrink-0 border-b border-indigo-900/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
              🚛
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {isSoc ? 'Hệ Thống Quản Lý Vận Tải Tuyến (SPX Linehaul TMS)' : 'Quản Lý Xe Tuyến Trung Chuyển Bưu Cục (HUD TMS)'}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {currentHub.name} ({currentHub.code})
                </span>
              </div>
              <h2 className="text-lg font-black text-white mt-1">
                {isSoc ? 'Lịch Sử Xe Tải Ra Hàng & Vào Hàng (Manifest Archive)' : 'Lịch Sử Xe Tải & Trung Chuyển Tuyến (HUD ↔ SOC)'}
              </h2>
              <p className="text-xs text-slate-300">
                {isSoc 
                  ? 'Tra cứu hồ sơ chuyến xe, niêm phong Seal chì, chi tiết kiện hàng trong thùng xe và in bảng kê bàn giao'
                  : 'Tra cứu các chuyến xe bàn giao về SOC, xe nhận từ SOC cập bến bưu cục và in biên bản giao nhận'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchTripHistory}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Tải lại danh sách từ CSDL"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span>Làm mới</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-400 flex items-center justify-center text-base font-bold transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* TOOLBAR & TABS */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>📋 Tất Cả</span>
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-[10px] font-mono">
                {tripsData.all.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('OUTBOUND')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'OUTBOUND'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{isSoc ? '📤 Xe Ra Hàng (Xuất Bến)' : '📤 Xe Bàn Giao Về SOC'}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-[10px] font-mono">
                {tripsData.outbound.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('INBOUND')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'INBOUND'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{isSoc ? '📥 Xe Vào Hàng (Cập Bến)' : '📥 Xe Nhận Từ SOC'}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-[10px] font-mono">
                {tripsData.inbound.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm biển số xe, seal, mã đơn..."
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* BODY LIST OF TRIPS */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 bg-slate-100/60">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-bold text-slate-500">Đang truy vấn lịch sử các chuyến xe tải từ cơ sở dữ liệu...</p>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-2">
              <span className="text-4xl block mb-2">🚛</span>
              <p className="text-sm font-black text-slate-700">Chưa có lịch sử chuyến xe nào</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Khi bưu cục hoặc trung tâm SOC thực hiện thao tác &ldquo;Niêm phong Seal chì & Xuất bến&rdquo; xe tải tại cửa Dock, toàn bộ bảng kê và danh sách kiện hàng sẽ được lưu trữ tự động tại đây.
              </p>
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const isOutbound = trip.tripType === 'OUTBOUND'
              return (
                <div
                  key={trip.tripKey}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition p-4 sm:p-5 space-y-3"
                >
                  {/* Dòng 1: Header chuyến xe */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                          isOutbound
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        <span>
                          {isOutbound
                            ? isSoc
                              ? '📤 XE RA HÀNG'
                              : '📤 XE BÀN GIAO SOC'
                            : isSoc
                            ? '📥 XE VÀO HÀNG'
                            : '📥 XE NHẬN TỪ SOC'}
                        </span>
                      </span>

                      <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {trip.tripId}
                      </span>

                      <span className="text-xs font-mono font-bold text-slate-500">
                        🕒 {new Date(trip.departedAt).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                          trip.status === 'IN_TRANSIT'
                            ? 'bg-sky-100 text-sky-800 border border-sky-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {trip.status === 'IN_TRANSIT' ? '🚚 ĐANG DI CHUYỂN' : '✓ ĐÃ CẬP BẾN'}
                      </span>
                    </div>
                  </div>

                  {/* Dòng 2: Chi tiết lộ trình & Xe */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Phương Tiện & Tài Xế</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-base">🚛</span>
                        <span className="font-mono font-black text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {trip.truckNumber}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 font-bold mt-1">
                        {trip.truckDriver} {trip.truckDriverPhone && <span className="font-mono text-slate-500">({trip.truckDriverPhone})</span>}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Niêm Phong Seal Chì</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-mono font-black text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                          🔒 {trip.sealNumber}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Kẹp seal bảo mật chống thất lạc</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Tuyến Vận Chuyển</p>
                      <p className="text-xs font-black text-slate-900 mt-0.5 flex items-center gap-1">
                        <span>{trip.originHubName}</span>
                        <span className="text-indigo-600">➔</span>
                        <span className="text-indigo-700">{trip.destinationHubName}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {isOutbound ? 'Xuất phát từ kho hiện tại' : 'Chuyển về kho hiện tại'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Quy Mô Thùng Xe</p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-lg font-black text-indigo-700 font-mono">{trip.totalParcels}</span>
                        <span className="text-xs font-bold text-slate-700">kiện hàng</span>
                        <span className="text-[11px] font-mono text-slate-500">({trip.totalWeight} kg)</span>
                      </div>
                    </div>
                  </div>

                  {/* Dòng 3: Nút Thao Tác Chi Tiết */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="text-[11px] text-slate-500 font-medium">
                      Bao gồm <b>{trip.shipments.length} bưu kiện</b> đã được quét barcode xác thực đóng thùng
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTripForDetail(trip)}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <span>👁️</span>
                        <span>Xem Chi Tiết {trip.totalParcels} Kiện Hàng</span>
                      </button>

                      <button
                        onClick={() => setPrintingTrip(trip)}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <span>🖨️</span>
                        <span>In Bảng Kê Bàn Giao</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL CON 1: XEM CHI TIẾT DANH SÁCH KIỆN HÀNG TRONG XE TẢI */}
      {/* ============================================================== */}
      {selectedTripForDetail && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs text-left animate-in fade-in-50 duration-150">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header Modal Con */}
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📦</span>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Danh Sách Kiện Hàng Trong Xe Tải [{selectedTripForDetail.truckNumber}]</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono text-xs font-black">
                      Seal: {selectedTripForDetail.sealNumber}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mã bảng kê: <b>{selectedTripForDetail.tripId}</b> • Đi: <b>{selectedTripForDetail.destinationHubName}</b> • Quy mô: <b>{selectedTripForDetail.totalParcels} kiện (~{selectedTripForDetail.totalWeight} kg)</b>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTripForDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Bảng chi tiết kiện hàng */}
            <div className="p-5 overflow-y-auto flex-1">
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">STT</th>
                      <th className="py-3 px-3">Mã Vận Đơn</th>
                      <th className="py-3 px-3">Người Nhận & SĐT</th>
                      <th className="py-3 px-3">Địa Chỉ Giao Hàng</th>
                      <th className="py-3 px-3 text-right">Khối Lượng</th>
                      <th className="py-3 px-3 text-right">Thu Hộ COD</th>
                      <th className="py-3 px-3 text-center">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800 bg-white">
                    {selectedTripForDetail.shipments.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-indigo-50/40 transition">
                        <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {item.trackingNumber}
                          </span>
                          <p className="font-mono text-[10px] text-slate-400 mt-0.5">Đơn: #{item.orderId}</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{item.buyerName}</p>
                          <p className="font-mono text-[11px] text-slate-500">{item.buyerPhone}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-700 max-w-xs truncate" title={item.deliveryAddress}>
                          📍 {item.deliveryAddress}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          {item.weight} kg
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-700">
                          {Number(item.codAmount || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Modal Con */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Tổng cộng: <b>{selectedTripForDetail.totalParcels} kiện hàng</b> | Tổng tải trọng: <b>{selectedTripForDetail.totalWeight} kg</b>
              </span>
              <button
                onClick={() => {
                  const trip = selectedTripForDetail
                  setSelectedTripForDetail(null)
                  setPrintingTrip(trip)
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>🖨️</span>
                <span>In Bảng Kê Chuyến Xe Này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL CON 2: PHIẾU BÀN GIAO XE TẢI CHUẨN IN ẤN (SPX MANIFEST SLIP) */}
      {/* ============================================================== */}
      {printingTrip && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs text-left animate-in fade-in-50 duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header thanh công cụ in */}
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between shrink-0">
              <span className="text-xs font-black uppercase text-indigo-300">
                Xem Trước Bản In Bảng Kê Vận Chuyển Xe Tải (A4)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>🖨️</span>
                  <span>In Phiếu (Ctrl + P)</span>
                </button>
                <button
                  onClick={() => setPrintingTrip(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Nội dung phiếu in chuẩn khổ giấy */}
            <div className="p-8 overflow-y-auto flex-1 bg-white text-slate-900 print:p-0" id="linehaul-manifest-print-area">
              {/* Header phiếu */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start gap-4">
                <div>
                  <h1 className="text-lg font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span>📦 ZEROMALL EXPRESS LOGISTICS (ZMX / SPX)</span>
                  </h1>
                  <p className="text-xs font-bold text-slate-700 mt-1">
                    TRUNG TÂM PHÂN LOẠI & VẬN HÀNH: {currentHub.name} ({currentHub.code})
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Địa chỉ: {currentHub.address ? `${currentHub.address}, ` : ''}{currentHub.district}, {currentHub.province}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-sm px-2.5 py-1 bg-slate-100 border border-slate-300 rounded inline-block">
                    {printingTrip.tripId}
                  </span>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    Ngày lập: {new Date(printingTrip.departedAt).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>

              {/* Tên biểu mẫu */}
              <div className="text-center my-6 space-y-1">
                <h2 className="text-base font-black uppercase tracking-wide text-slate-950">
                  BIÊN BẢN BÀN GIAO HÀNG HÓA VẬN TẢI ĐƯỜNG DÀI
                </h2>
                <p className="text-xs italic text-slate-600">
                  (Linehaul Truck Transport Handover Manifest & Security Seal Verification)
                </p>
              </div>

              {/* Khối thông tin chuyến xe */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-300 bg-slate-50/60 text-xs mb-6">
                <div className="space-y-1.5">
                  <p>
                    <span className="font-bold text-slate-600">Biển số xe tải:</span>{' '}
                    <b className="font-mono text-sm text-slate-950 font-black">[{printingTrip.truckNumber}]</b>
                  </p>
                  <p>
                    <span className="font-bold text-slate-600">Lái xe phụ trách:</span>{' '}
                    <b className="text-slate-900">{printingTrip.truckDriver}</b>
                  </p>
                  <p>
                    <span className="font-bold text-slate-600">Số điện thoại:</span>{' '}
                    <b className="font-mono text-slate-900">{printingTrip.truckDriverPhone || 'Chưa cập nhật'}</b>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p>
                    <span className="font-bold text-slate-600">Số niêm phong Seal chì:</span>{' '}
                    <b className="font-mono text-sm text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      🔒 {printingTrip.sealNumber}
                    </b>
                  </p>
                  <p>
                    <span className="font-bold text-slate-600">Tuyến vận chuyển:</span>{' '}
                    <b>{printingTrip.originHubName} ➔ {printingTrip.destinationHubName}</b>
                  </p>
                  <p>
                    <span className="font-bold text-slate-600">Tổng sản lượng:</span>{' '}
                    <b>{printingTrip.totalParcels} kiện hàng</b> (~{printingTrip.totalWeight} kg)
                  </p>
                </div>
              </div>

              {/* Bảng danh sách kiện hàng */}
              <div className="border border-slate-300 rounded-lg overflow-hidden mb-8">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-900 font-black text-[11px] border-b border-slate-300">
                    <tr>
                      <th className="p-2 w-10 text-center border-r border-slate-300">STT</th>
                      <th className="p-2 border-r border-slate-300">Mã Vận Đơn</th>
                      <th className="p-2 border-r border-slate-300">Người Nhận & SĐT</th>
                      <th className="p-2 border-r border-slate-300">Địa Chỉ Nhận Hàng</th>
                      <th className="p-2 text-right border-r border-slate-300">Khối Lượng</th>
                      <th className="p-2 text-right">Thu Hộ COD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printingTrip.shipments.map((s, idx) => (
                      <tr key={s.id}>
                        <td className="p-2 text-center font-mono text-slate-500 border-r border-slate-200">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold text-slate-900 border-r border-slate-200">
                          {s.trackingNumber}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <p className="font-bold text-slate-900">{s.buyerName}</p>
                          <p className="font-mono text-[10px] text-slate-500">{s.buyerPhone}</p>
                        </td>
                        <td className="p-2 text-[11px] text-slate-700 border-r border-slate-200">
                          {s.deliveryAddress}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                          {s.weight} kg
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {Number(s.codAmount || 0).toLocaleString('vi-VN')}đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phần ký nhận 3 bên */}
              <div className="grid grid-cols-3 gap-4 text-center text-xs mt-10 pt-4 border-t border-slate-300">
                <div className="space-y-16">
                  <div>
                    <p className="font-black uppercase text-slate-900">ĐẠI DIỆN KHO XUẤT</p>
                    <p className="text-[10px] text-slate-500">(Ký, ghi rõ họ tên & đóng dấu)</p>
                  </div>
                  <p className="font-bold text-slate-700">................................................</p>
                </div>

                <div className="space-y-16">
                  <div>
                    <p className="font-black uppercase text-slate-900">LÁI XE VẬN TẢI</p>
                    <p className="text-[10px] text-slate-500">(Đã kiểm tra Seal & ký nhận đủ hàng)</p>
                  </div>
                  <p className="font-bold text-slate-700">{printingTrip.truckDriver}</p>
                </div>

                <div className="space-y-16">
                  <div>
                    <p className="font-black uppercase text-slate-900">ĐẠI DIỆN KHO NHẬN</p>
                    <p className="text-[10px] text-slate-500">(Xác nhận Seal nguyên vẹn & nhận bàn giao)</p>
                  </div>
                  <p className="font-bold text-slate-700">................................................</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
