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
  const [isClaimable, setIsClaimable] = useState<boolean>(true) // true: Săn Giờ Vàng (FCFS), false: Mã Công Khai
  const [filterType, setFilterType] = useState<'ALL' | 'GOLDEN_HOUR' | 'PUBLIC' | 'GOODWILL'>('ALL')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter vouchers on table
  const filteredVouchers = useMemo(() => {
    if (filterType === 'GOODWILL') {
      return platformVouchers.filter(v => Boolean(v.targetUserId))
    }
    if (filterType === 'GOLDEN_HOUR') {
      return platformVouchers.filter(v => v.isClaimable && !v.targetUserId)
    }
    if (filterType === 'PUBLIC') {
      return platformVouchers.filter(v => !v.isClaimable && !v.targetUserId)
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

    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/discounts?shopId=PLATFORM`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVoucherName.trim() || (isClaimable ? 'Voucher Săn Giờ Vàng ZeroMall' : 'Voucher Khuyến Mãi Toàn Sàn'),
          code,
          type: 'fixed',
          value: discountVal,
          minSpend: minSpendVal,
          usageLimit: limitVal,
          isClaimable: Boolean(isClaimable),
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000 * validDays).toISOString()
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || 'Không thể tạo voucher')
      }

      const modeText = isClaimable ? 'Săn Giờ Vàng (Lưu ví FCFS)' : 'Mã Nhập Tự Do'
      await triggerAuditLog(
        `Admin tạo voucher toàn sàn "${code}" giảm ${discountVal.toLocaleString('vi-VN')}đ (Hình thức: ${modeText}, Hạn mức: ${limitVal.toLocaleString('vi-VN')} lượt)`
      )
      fetchVouchers()
      setNewVoucherCode('')
      setNewVoucherName('')
      setNewVoucherDiscount('')
      setMinSpend(0)
      alert('Tạo voucher toàn sàn thành công!')
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
        await triggerAuditLog(`Admin xóa voucher toàn sàn "${v.code}"`)
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
      
      {/* CARD 1: FORM CẤU HÌNH VOUCHER TOÀN SÀN */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs space-y-5">
        
        {/* Header & Distribution Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <span>🎟️</span> Quản Lý Voucher Toàn Sàn (Marketing & Khuyến Mãi)
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Cấu hình các chương trình trợ giá của Sàn: Mã nhập công khai hoặc Voucher săn theo Khung Giờ Vàng
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setIsClaimable(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isClaimable
                  ? 'bg-amber-600 text-white shadow-3xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              ⚡ Săn Giờ Vàng (FCFS)
            </button>
            <button
              type="button"
              onClick={() => setIsClaimable(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isClaimable
                  ? 'bg-emerald-600 text-white shadow-3xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              🏷️ Mã Nhập Tự Do
            </button>
          </div>
        </div>

        {/* Explain Selected Distribution Mode */}
        <div className={`p-3 rounded-xl border text-xs font-medium ${
          isClaimable 
            ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
            : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
        }`}>
          {isClaimable ? (
            <p>
              ⚡ <strong>Chế độ Săn Giờ Vàng (Claimable):</strong> Mã sẽ xuất hiện trên banner Giờ Vàng (0h, 9h, 12h, 21h). Người mua bắt buộc phải bấm <strong>"Lưu Vào Ví"</strong> và áp dụng theo thứ tự ưu tiên ai chốt đơn trước thì được giảm giá trước (FCFS).
            </p>
          ) : (
            <p>
              🏷️ <strong>Chế độ Mã Nhập Tự Do (Public Code):</strong> Mã khuyến mãi công khai. Người mua chỉ cần nhập đúng mã code tại trang Giỏ hàng / Thanh toán để được giảm giá mà không cần bấm lưu ví trước.
            </p>
          )}
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

          {/* Hạn mức lượt dùng */}
          <div className="md:col-span-2 space-y-1.5 text-left">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Hạn Mức Ngân Sách
            </label>
            <input
              type="number"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs"
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

        {/* Hàng 2: Mô tả Tên Voucher & Nút Tạo */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center pt-1">
          <div className="md:col-span-9 space-y-1.5 text-left">
            <label className="text-xs font-bold text-slate-500">
              Tên Chiến Dịch / Mô Tả (hiển thị cho khách khi lưu vào ví)
            </label>
            <input
              type="text"
              placeholder={isClaimable ? 'Voucher Săn Giờ Vàng Tri Ân Khách Hàng' : 'Mã Giảm Giá Toàn Sàn ZeroMall'}
              value={newVoucherName}
              onChange={(e) => setNewVoucherName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-3xs"
            />
          </div>

          <div className="md:col-span-3 flex justify-end mt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateVoucher}
              className={`w-full py-2.5 px-4 text-white font-black rounded-xl text-xs cursor-pointer shadow-3xs transition-all flex items-center justify-center gap-2 ${
                isClaimable
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              } disabled:opacity-50`}
            >
              <span>{isClaimable ? '⚡' : '✨'}</span>
              <span>{isSubmitting ? 'Đang tạo...' : isClaimable ? 'Tạo Voucher Giờ Vàng' : 'Tạo Voucher Công Khai'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* CARD 2: BẢNG DANH SÁCH VOUCHER TOÀN SÀN */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-3xs overflow-hidden">
        
        {/* Table Filter Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Danh Sách Voucher Đang Hoạt Động
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
              onClick={() => setFilterType('GOLDEN_HOUR')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === 'GOLDEN_HOUR'
                  ? 'bg-white text-amber-700 shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ⚡ Giờ Vàng ({platformVouchers.filter(v => v.isClaimable && !v.targetUserId).length})
            </button>
            <button
              onClick={() => setFilterType('PUBLIC')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === 'PUBLIC'
                  ? 'bg-white text-emerald-700 shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🏷️ Mã Tự Do ({platformVouchers.filter(v => !v.isClaimable && !v.targetUserId).length})
            </button>
            <button
              onClick={() => setFilterType('GOODWILL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === 'GOODWILL'
                  ? 'bg-white text-purple-700 shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Voucher đền bù do đội ngũ CSKH cấp phát cho từng User"
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
                <th className="py-3.5 px-4">Hình Thức Phát Hành</th>
                <th className="py-3.5 px-5 text-right">Mức Giảm & Điều Kiện</th>
                <th className="py-3.5 px-5 text-center min-w-[140px]">Tiến Độ Lượt Dùng (FCFS)</th>
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
                          <span className={v.isClaimable ? 'text-amber-500' : 'text-emerald-600'}>
                            {v.isClaimable ? '⚡' : '🎟️'}
                          </span>
                          <span>{v.code}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-1">
                          {v.name || 'Voucher toàn sàn'}
                        </div>
                      </td>

                      {/* Cột 2: Hình Thức Phát Hành */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {v.targetUserId ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/60 font-bold text-[10px]">
                              <span>🎁</span>
                              <span>CSKH Đền Bù (User: {v.targetUserId.slice(0, 8)}...)</span>
                            </div>
                          ) : v.isClaimable ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 font-bold text-[10px]">
                              <span>⚡</span>
                              <span>Săn Giờ Vàng (Lưu Ví FCFS)</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px]">
                              <span>🏷️</span>
                              <span>Mã Nhập Tự Do (Toàn Sàn)</span>
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

                      {/* Cột 4: Lượt Dùng (Có Progress Bar FCFS) */}
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

                      {/* Cột 5: Hạn Sử Dụng */}
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
