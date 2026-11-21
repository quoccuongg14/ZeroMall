import React, { useState, useMemo } from 'react'
import { API_BASE_URL } from '../../../config/api.config'
import type { Hub } from './types'

export interface HubDriversManageModalProps {
  isOpen: boolean
  onClose: () => void
  currentHub: Hub | null
  drivers: any[]
  onRefresh: () => void
  onAddDriver: () => void
}

export const HubDriversManageModal: React.FC<HubDriversManageModalProps> = ({
  isOpen,
  onClose,
  currentHub,
  drivers = [],
  onRefresh,
  onAddDriver,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingDriver, setEditingDriver] = useState<any | null>(null)
  const [viewingDriver, setViewingDriver] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Edit Form State
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    vehicleNumber: '',
    vehicleType: 'MOTORBIKE',
    operatingArea: '',
    newPassword: '',
  })

  // Lọc danh sách tài xế trực thuộc bưu cục này
  const hubDrivers = useMemo(() => {
    if (!currentHub) return []
    return drivers.filter(
      (d) => d.hubId === currentHub.id || d.hub?.id === currentHub.id
    )
  }, [drivers, currentHub])

  // Lọc theo từ khóa tìm kiếm
  const filteredDrivers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return hubDrivers
    return hubDrivers.filter((d) => {
      const name = (d.name || '').toLowerCase()
      const phone = (d.phone || '').toLowerCase()
      const vehicle = (d.vehicleNumber || '').toLowerCase()
      const area = (d.operatingArea || '').toLowerCase()
      return name.includes(q) || phone.includes(q) || vehicle.includes(q) || area.includes(q)
    })
  }, [hubDrivers, searchQuery])

  // Mở form chỉnh sửa
  const handleStartEdit = (driver: any) => {
    setEditingDriver(driver)
    setEditForm({
      name: driver.name || '',
      phone: driver.phone || '',
      vehicleNumber: driver.vehicleNumber || '',
      vehicleType: driver.vehicleType || 'MOTORBIKE',
      operatingArea: driver.operatingArea || '',
      newPassword: '',
    })
  }

  // Lưu chỉnh sửa tài xế
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDriver) return

    setSubmitting(true)
    try {
      // 1. Cập nhật thông tin tài xế trong delivery-service
      const res = await fetch(`${API_BASE_URL}/delivery/drivers/${editingDriver.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          vehicleNumber: editForm.vehicleNumber.trim().toUpperCase(),
          vehicleType: editForm.vehicleType,
          operatingArea: editForm.operatingArea.trim(),
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || 'Không thể cập nhật tài xế')
      }

      // 2. Nếu có đặt lại mật khẩu mới, cập nhật bên auth-service
      if (editForm.newPassword.trim() && editingDriver.userId) {
        try {
          await fetch(`${API_BASE_URL}/auth/users/${editingDriver.userId}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              newPassword: editForm.newPassword.trim(),
            }),
          })
        } catch (pwErr) {
          console.warn('Cannot update password in auth-service:', pwErr)
        }
      }

      alert(`Cập nhật thông tin tài xế [${editForm.name}] thành công!`)
      setEditingDriver(null)
      onRefresh()
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Đã có lỗi xảy ra khi cập nhật tài xế'))
    } finally {
      setSubmitting(false)
    }
  }

  // Xóa tài xế khỏi bưu cục
  const handleDeleteDriver = async (driver: any) => {
    const confirmMsg = `Bạn có chắc chắn muốn xóa tài xế [${driver.name}] (${driver.vehicleNumber || driver.phone}) khỏi bưu cục ${currentHub?.name}?\n\nLưu ý: Hành động này sẽ gỡ bỏ tài xế khỏi danh sách trực vận hành.`
    if (!window.confirm(confirmMsg)) return

    try {
      const res = await fetch(`${API_BASE_URL}/delivery/drivers/${driver.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || 'Không thể xóa tài xế')
      }

      alert(`Đã xóa tài xế [${driver.name}] thành công!`)
      if (viewingDriver?.id === driver.id) setViewingDriver(null)
      if (editingDriver?.id === driver.id) setEditingDriver(null)
      onRefresh()
    } catch (err: any) {
      alert('Lỗi xóa tài xế: ' + (err.message || 'Đã có lỗi xảy ra'))
    }
  }

  // Đổi trạng thái hoạt động (Khóa / Mở Khóa)
  const handleToggleDriverStatus = async (driver: any) => {
    const isCurrentlySuspended = driver.status === 'SUSPENDED'
    const newStatus = isCurrentlySuspended ? 'AVAILABLE' : 'SUSPENDED'
    const confirmMsg = isCurrentlySuspended
      ? `Mở khóa và kích hoạt lại tài xế [${driver.name}]?`
      : `Tạm khóa tài xế [${driver.name}]? Tài xế sẽ không thể nhận đơn mới.`

    if (!window.confirm(confirmMsg)) return

    try {
      const res = await fetch(`${API_BASE_URL}/delivery/drivers/${driver.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || 'Không thể đổi trạng thái tài xế')
      }

      onRefresh()
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Đã có lỗi xảy ra'))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs text-left animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛵</span>
              <h2 className="text-base font-black text-slate-900">
                Đội Ngũ Shipper Trực Thuộc ({hubDrivers.length} Tài Xế)
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Đơn vị quản lý: <span className="font-bold text-emerald-700">{currentHub?.name}</span>{' '}
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                {currentHub?.code}
              </span>{' '}
              • {currentHub?.district}, {currentHub?.province}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onAddDriver()
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>➕</span> Tuyển Shipper Mới
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* SEARCH BAR & METRICS */}
        <div className="py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 shrink-0">
          <div className="relative w-full sm:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, SĐT, biển số xe, tuyến..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-600 transition"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              🟢 Sẵn sàng:{' '}
              {hubDrivers.filter((d) => d.status === 'AVAILABLE' || !d.status).length}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              ⚡ Đang giao: {hubDrivers.filter((d) => d.status === 'BUSY').length}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
              🔒 Đã khóa: {hubDrivers.filter((d) => d.status === 'SUSPENDED').length}
            </span>
          </div>
        </div>

        {/* DRIVERS LIST CONTAINER */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
          {filteredDrivers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <span className="text-4xl block">🛵</span>
              <p className="text-xs font-bold text-slate-600">
                {searchQuery ? 'Không tìm thấy tài xế phù hợp từ khóa' : 'Bưu cục này chưa có tài xế nào trực thuộc'}
              </p>
              <p className="text-[11px] text-slate-400">
                Bấm &ldquo;Tuyển Shipper Mới&rdquo; để đăng ký tài xế và phân tuyến giao hàng.
              </p>
              <button
                onClick={onAddDriver}
                className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700 transition cursor-pointer"
              >
                ➕ Tuyển Shipper Đầu Tiên
              </button>
            </div>
          ) : (
            filteredDrivers.map((driver) => {
              const isSuspended = driver.status === 'SUSPENDED'
              const isVan = driver.vehicleType === 'VAN'
              const isTruck = driver.vehicleType === 'TRUCK'

              return (
                <div
                  key={driver.id}
                  className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isSuspended
                      ? 'bg-rose-50/40 border-rose-200'
                      : 'bg-slate-50/70 hover:bg-emerald-50/30 border-slate-200 hover:border-emerald-200'
                  }`}
                >
                  {/* CỘT 1: THÔNG TIN TÀI XẾ & XE */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${
                        isSuspended
                          ? 'bg-rose-100 text-rose-700'
                          : isTruck
                          ? 'bg-indigo-100 text-indigo-700'
                          : isVan
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isTruck ? '🚛' : isVan ? '🚐' : '🛵'}
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900">{driver.name}</span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-white text-slate-700 border border-slate-200">
                          {driver.vehicleNumber || 'Chưa biển số'}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                            isSuspended
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : driver.status === 'BUSY'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isSuspended
                            ? 'Đã Khóa'
                            : driver.status === 'BUSY'
                            ? 'Đang Giao'
                            : 'Sẵn Sàng'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium flex-wrap">
                        <span>📞 {driver.phone}</span>
                        <span>•</span>
                        <span>
                          Loại xe:{' '}
                          <b className="text-slate-700">
                            {isTruck ? 'Xe tải Linehaul' : isVan ? 'Xe Van / Bán tải' : 'Xe máy'}
                          </b>
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 font-medium truncate max-w-md">
                        📍 Tuyến: <b>{driver.operatingArea || 'Chưa thiết lập tuyến phụ trách'}</b>
                      </p>
                    </div>
                  </div>

                  {/* CỘT 2: NÚT THAO TÁC XEM, SỬA, KHÓA, XÓA */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => setViewingDriver(driver)}
                      title="Xem chi tiết hồ sơ tài xế"
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>👁️</span> Xem
                    </button>

                    <button
                      onClick={() => handleStartEdit(driver)}
                      title="Sửa thông tin hoặc cấp lại mật khẩu"
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>✏️</span> Sửa
                    </button>

                    <button
                      onClick={() => handleToggleDriverStatus(driver)}
                      title={isSuspended ? 'Mở khóa tài xế' : 'Khóa tạm thời'}
                      className={`px-2.5 py-1.5 font-bold text-xs rounded-xl border transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                        isSuspended
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>{isSuspended ? '🔓 Mở' : '🔒 Khóa'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteDriver(driver)}
                      title="Xóa tài xế khỏi bưu cục"
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>🗑️</span> Xóa
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* MODAL CON 1: XEM CHI TIẾT TÀI XẾ */}
        {viewingDriver && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs z-20 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛵</span>
                  <h3 className="font-black text-sm text-slate-900">Chi Tiết Hồ Sơ Tài Xế</h3>
                </div>
                <button
                  onClick={() => setViewingDriver(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Họ Và Tên:</span>
                  <span className="font-black text-slate-900">{viewingDriver.name}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Số Điện Thoại:</span>
                  <span className="font-bold font-mono text-slate-900">{viewingDriver.phone}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Biển Số Xe:</span>
                  <span className="font-bold font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {viewingDriver.vehicleNumber || 'Chưa cập nhật'}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Loại Phương Tiện:</span>
                  <span className="font-bold text-slate-800">
                    {viewingDriver.vehicleType === 'TRUCK'
                      ? '🚛 Xe tải Linehaul'
                      : viewingDriver.vehicleType === 'VAN'
                      ? '🚐 Xe Van / Bán tải'
                      : '🛵 Xe máy'}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Bưu Cục Quản Lý:</span>
                  <span className="font-bold text-slate-800">{currentHub?.name}</span>
                </div>

                <div className="py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium block mb-0.5">Tuyến Địa Bàn Phụ Trách:</span>
                  <span className="font-semibold text-slate-800 leading-relaxed block bg-slate-50 p-2 rounded-xl border border-slate-200">
                    {viewingDriver.operatingArea || 'Chưa thiết lập tuyến phụ trách'}
                  </span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Trạng Thái:</span>
                  <span className="font-bold text-emerald-700">{viewingDriver.status || 'AVAILABLE'}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    handleStartEdit(viewingDriver)
                    setViewingDriver(null)
                  }}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  ✏️ Chỉnh Sửa
                </button>
                <button
                  onClick={() => setViewingDriver(null)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CON 2: FORM CHỈNH SỬA TÀI XẾ */}
        {editingDriver && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs z-30 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✏️</span>
                  <h3 className="font-black text-sm text-slate-900">
                    Chỉnh Sửa Hồ Sơ Tài Xế [{editingDriver.name}]
                  </h3>
                </div>
                <button
                  onClick={() => setEditingDriver(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Họ Và Tên:
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Số Điện Thoại:
                    </label>
                    <input
                      type="tel"
                      required
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Biển Số Xe:
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.vehicleNumber}
                      onChange={(e) => setEditForm({ ...editForm, vehicleNumber: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Loại Xe:
                    </label>
                    <select
                      value={editForm.vehicleType}
                      onChange={(e) => setEditForm({ ...editForm, vehicleType: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                    >
                      <option value="MOTORBIKE">🛵 Xe máy (Nội thành)</option>
                      <option value="VAN">🚐 Xe Van / Bán tải</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tuyến Đường / Địa Bàn Phụ Trách:
                  </label>
                  <input
                    type="text"
                    value={editForm.operatingArea}
                    onChange={(e) => setEditForm({ ...editForm, operatingArea: e.target.value })}
                    placeholder="VD: Phường Hoàng Văn Thụ, Quận Hồng Bàng, Hải Phòng"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Đặt Lại Mật Khẩu Mới Cho Tài Xế (Để trống nếu không đổi):
                  </label>
                  <input
                    type="text"
                    value={editForm.newPassword}
                    onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                    placeholder="Nhập mật khẩu mới nếu cần cấp lại..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingDriver(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs shadow-sm transition cursor-pointer"
                  >
                    {submitting ? 'Đang lưu...' : '✓ Lưu Thay Đổi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
