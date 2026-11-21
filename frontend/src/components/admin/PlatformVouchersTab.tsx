import React, { useState, useMemo } from 'react'
import { API_BASE_URL } from '../../config/api.config'

interface PlatformVouchersTabProps {
  platformVouchers: any[]
  fetchVouchers: () => void
  triggerAuditLog: (action: string) => Promise<void>
}

export const PlatformVouchersTab: React.FC<PlatformVouchersTabProps> = ({
  platformVouchers,
  fetchVouchers,
  triggerAuditLog
}) => {
  const [newVoucherCode, setNewVoucherCode] = useState('')
  const [newVoucherName, setNewVoucherName] = useState('')
  const [newVoucherDiscount, setNewVoucherDiscount] = useState<number | ''>('')
  const [minSpend, setMinSpend] = useState<number | ''>(0)
  const [usageLimit, setUsageLimit] = useState<number | ''>(1000)
  const [validDays, setValidDays] = useState<number>(30)
  const [targetUserId, setTargetUserId] = useState('')
  const [isGoodwill, setIsGoodwill] = useState(false)
  const [isClaimable, setIsClaimable] = useState(true)
  const [filterType, setFilterType] = useState<'ALL' | 'PLATFORM' | 'GOODWILL'>('ALL')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Switch between mode
  const handleToggleMode = (goodwill: boolean) => {
    setIsGoodwill(goodwill)
    if (goodwill) {
      setUsageLimit(1)
      setNewVoucherName('Voucher CSKH Đền Bù 1-1')
    } else {
      setUsageLimit(1000)
      setNewVoucherName('Voucher Toàn Sàn ZeroMall')
      setTargetUserId('')
    }
  }

  // Filter vouchers
  const filteredVouchers = useMemo(() => {
    if (filterType === 'GOODWILL') {
      return platformVouchers.filter(v => Boolean(v.targetUserId))
    }
    if (filterType === 'PLATFORM') {
      return platformVouchers.filter(v => !v.targetUserId)
    }
    return platformVouchers
  }, [platformVouchers, filterType])

  const handleCreateVoucher = async () => {
    const code = newVoucherCode.trim().toUpperCase()
    const discountVal = Number(newVoucherDiscount)
    const minSpendVal = Number(minSpend) || 0
    const limitVal = Number(usageLimit) || 1

    if (!code) {
      alert('Vui lòng nhập Mã Voucher!')
      return
    }
    if (discountVal <= 0) {
      alert('Số tiền giảm phải lớn hơn 0đ!')
      return
    }
    if (isGoodwill && !targetUserId.trim()) {
      alert('Vui lòng nhập User ID để cấp Voucher Đền Bù CSKH!')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/discounts?shopId=PLATFORM`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVoucherName.trim() || (isGoodwill ? 'Voucher CSKH Đền Bù 1-1' : 'Voucher Toàn Sàn ZeroMall'),
          code,
          type: 'fixed',
          value: discountVal,
          minSpend: minSpendVal,
          usageLimit: limitVal,
          targetUserId: isGoodwill ? targetUserId.trim() : null,
          isClaimable: isGoodwill ? false : isClaimable,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000 * validDays).toISOString()
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || 'Không thể tạo voucher')
      }

      await triggerAuditLog(
        `Tạo voucher ${isGoodwill ? `CSKH Đền bù cho User "${targetUserId}"` : 'toàn sàn'} "${code}" giảm ${discountVal.toLocaleString('vi-VN')}đ (Đơn từ ${minSpendVal.toLocaleString('vi-VN')}đ)`
      )
      fetchVouchers()
      setNewVoucherCode('')
      setNewVoucherName('')
      setNewVoucherDiscount('')
      setMinSpend(0)
      setTargetUserId('')
      alert('Tạo voucher thành công!')
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteVoucher = async (v: any) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa voucher toàn sàn "${v.code}"?`)) {
      return
    }
    try {
      const res = await fetch(`${API_BASE_URL}/discounts/${v.id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        await triggerAuditLog(`Xóa voucher toàn sàn "${v.code}"`)
        fetchVouchers()
        alert('Đã xóa voucher thành công!')
      } else {
        alert('Không thể xóa voucher.')
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* CARD 1: FORM TẠO VOUCHER TOÀN SÀN & CSKH */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs space-y-5">
        
        {/* Header & Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <span>🎟️</span> Quản Lý Voucher Toàn Sàn & CSKH Đền Bù
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Tạo mã giảm giá do Sàn tài trợ ngân sách (Toàn sàn hoặc Đền bù sự cố cho User)
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => handleToggleMode(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isGoodwill
                  ? 'bg-emerald-600 text-white shadow-3xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              🌐 Toàn Sàn (Mọi User)
            </button>
            <button
              type="button"
              onClick={() => handleToggleMode(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isGoodwill
                  ? 'bg-purple-600 text-white shadow-3xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              🎁 CSKH Đền Bù (User 1-1)
            </button>
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          
          {/* Mã Voucher */}
          <div className="md:col-span-3 space-y-1.5 text-left">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Mã Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="VD: ZEROMALL50K..."
              value={newVoucherCode}
              onChange={(e) => setNewVoucherCode(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs"
            />
          </div>

          {/* Số tiền giảm */}
          <div className="md:col-span-3 space-y-1.5 text-left">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Số Tiền Giảm (VNĐ) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              placeholder="VD: 50000..."
              value={newVoucherDiscount}
              onChange={(e) => setNewVoucherDiscount(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-emerald-700 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs"
            />
          </div>

          {/* Đơn tối thiểu */}
          <div className="md:col-span-2 space-y-1.5 text-left">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Đơn Tối Thiểu
            </label>
            <input
              type="number"
              placeholder="0₫"
              value={minSpend}
              onChange={(e) => setMinSpend(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs"
            />
          </div>

          {/* Lượt dùng */}
          <div className="md:col-span-2 space-y-1.5 text-left">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              {isGoodwill ? 'Giới Hạn' : 'Tổng Lượt Dùng'}
            </label>
            <input
              type="number"
              disabled={isGoodwill}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          {/* Thời hạn (Số ngày) */}
          <div className="md:col-span-2 space-y-1.5 text-left">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Hiệu Lực
            </label>
            <select
              value={validDays}
              onChange={(e) => setValidDays(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs cursor-pointer"
            >
              <option value={7}>7 Ngày</option>
              <option value={14}>14 Ngày</option>
              <option value={30}>30 Ngày</option>
              <option value={90}>3 Tháng</option>
              <option value={365}>1 Năm</option>
            </select>
          </div>

        </div>

        {/* Hàng 2: Input Tên Voucher & User ID (nếu CSKH đền bù) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center pt-1">
          <div className={isGoodwill ? 'md:col-span-6 space-y-1.5 text-left' : 'md:col-span-9 space-y-1.5 text-left'}>
            <label className="text-xs font-bold text-slate-500">
              Mô tả / Tên Voucher (hiển thị cho khách khi lưu vào ví)
            </label>
            <input
              type="text"
              placeholder={isGoodwill ? 'Voucher CSKH Đền Bù Sự Cố 1-1' : 'Voucher Tri Ân Toàn Sàn ZeroMall'}
              value={newVoucherName}
              onChange={(e) => setNewVoucherName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs"
            />
          </div>

          {isGoodwill && (
            <div className="md:col-span-3 space-y-1.5 text-left">
              <label className="text-xs font-black text-purple-700 flex items-center gap-1">
                <span>🎯</span> User ID Nhận Đền Bù <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="ID User (VD: user-123...)"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full px-3.5 py-2 bg-purple-50 border border-purple-200 rounded-xl text-xs font-mono font-bold text-purple-800 focus:outline-none focus:border-purple-600 focus:bg-white shadow-3xs"
              />
            </div>
          )}

          <div className={isGoodwill ? 'md:col-span-3 flex justify-end mt-4' : 'md:col-span-3 flex justify-end mt-4'}>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateVoucher}
              className={`w-full py-2.5 px-4 text-white font-black rounded-xl text-xs cursor-pointer shadow-3xs transition-all flex items-center justify-center gap-2 ${
                isGoodwill
                  ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              } disabled:opacity-50`}
            >
              <span>{isGoodwill ? '🎁' : '✨'}</span>
              <span>{isSubmitting ? 'Đang tạo...' : isGoodwill ? 'Cấp Voucher CSKH' : 'Tạo Voucher Sàn'}</span>
            </button>
          </div>
        </div>

        {!isGoodwill && (
          <div className="flex items-center gap-2 pt-1 text-xs border-t border-slate-100">
            <input
              type="checkbox"
              id="claimableCheck"
              checked={isClaimable}
              onChange={(e) => setIsClaimable(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
            />
            <label htmlFor="claimableCheck" className="text-slate-700 font-bold cursor-pointer select-none flex items-center gap-1.5">
              <span>⚡</span>
              <span>Kích hoạt Cơ chế 1: Voucher Khung Giờ Vàng (Bắt buộc người mua bấm "Lưu vào ví" trước khi thanh toán - FCFS)</span>
            </label>
          </div>
        )}

      </div>

      {/* CARD 2: BẢNG DANH SÁCH VOUCHER TOÀN SÀN */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-3xs overflow-hidden">
        
        {/* Table Filter Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Danh Sách Voucher Hiện Có
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              {filteredVouchers.length} mã
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tất Cả ({platformVouchers.length})
            </button>
            <button
              onClick={() => setFilterType('PLATFORM')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === 'PLATFORM'
                  ? 'bg-white text-emerald-700 shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🌐 Toàn Sàn ({platformVouchers.filter(v => !v.targetUserId).length})
            </button>
            <button
              onClick={() => setFilterType('GOODWILL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === 'GOODWILL'
                  ? 'bg-white text-purple-700 shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🎁 CSKH Đền Bù ({platformVouchers.filter(v => Boolean(v.targetUserId)).length})
            </button>
          </div>
        </div>

        {/* Clean Responsive Table with explicit cell padding and clear column boundaries */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/60 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-5">Mã Voucher & Tên</th>
                <th className="py-3.5 px-4">Đối Tượng Áp Dụng</th>
                <th className="py-3.5 px-5 text-right">Mức Giảm & Điều Kiện</th>
                <th className="py-3.5 px-5 text-center min-w-[140px]">Tiến Độ Lượt Dùng</th>
                <th className="py-3.5 px-5 text-center min-w-[130px]">Hạn Sử Dụng</th>
                <th className="py-3.5 px-5 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    Chưa có voucher nào trong danh mục này.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => {
                  const isExpired = new Date(v.endDate).getTime() < Date.now()
                  const usedCount = v.usedCount || 0
                  const usagePercent = Math.min(Math.round((usedCount / (v.usageLimit || 1)) * 100), 100)
                  const isExhausted = usedCount >= v.usageLimit

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition">
                      
                      {/* Cột 1: Mã Code & Tên */}
                      <td className="py-3.5 px-5">
                        <div className="font-mono font-black text-slate-900 text-xs tracking-wider flex items-center gap-1.5">
                          <span className="text-emerald-600">🎟️</span>
                          <span>{v.code}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-1">
                          {v.name || 'Voucher toàn sàn'}
                        </div>
                      </td>

                      {/* Cột 2: Đối Tượng Áp Dụng */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {v.targetUserId ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/60 font-bold text-[10px]">
                              <span>🎁</span>
                              <span>CSKH Đền Bù:</span>
                              <span className="font-mono">{v.targetUserId.slice(0, 8)}...</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px]">
                              <span>🌐</span>
                              <span>Mọi Người Mua (Toàn Sàn)</span>
                            </div>
                          )}
                          {v.isClaimable && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 font-bold text-[9px] uppercase tracking-wider">
                              <span>⚡</span>
                              <span>Giờ Vàng (Lưu Ví FCFS)</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Cột 3: Mức Giảm */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="font-black text-emerald-600 text-sm">
                          -{Number(v.value).toLocaleString('vi-VN')}₫
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          Đơn từ: {Number(v.minSpend || 0).toLocaleString('vi-VN')}₫
                        </div>
                      </td>

                      {/* Cột 4: Lượt Dùng (Có Progress Bar riêng biệt) */}
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className={isExhausted ? 'text-rose-600 font-black' : 'text-slate-800'}>
                            {usedCount} / {v.usageLimit}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {usagePercent}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isExhausted ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Cột 5: Hạn Sử Dụng (Có khoảng cách và Badge) */}
                      <td className="py-3.5 px-5 text-center">
                        <div className="font-semibold text-slate-700 text-xs">
                          {new Date(v.endDate).toLocaleDateString('vi-VN')}
                        </div>
                        <div className="mt-1">
                          {isExpired ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200/60">
                              Hết hạn
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                              Đang hiệu lực
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 6: Thao Tác */}
                      <td className="py-3.5 px-5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteVoucher(v)}
                          className="px-3 py-1.5 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg font-bold text-xs cursor-pointer border border-slate-200 hover:border-rose-200 transition shadow-3xs"
                          title="Xóa voucher"
                        >
                          Xóa
                        </button>
                      </td>

                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  )
}
