import React, { useState } from 'react'
import { API_BASE_URL } from '../../../config/api.config'

interface IssueGoodwillVoucherModalProps {
  isOpen: boolean
  user: any | null
  onClose: () => void
  onSuccess: () => void
  triggerAuditLog: (action: string) => Promise<void>
}

export const IssueGoodwillVoucherModal: React.FC<IssueGoodwillVoucherModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
  triggerAuditLog
}) => {
  const [amount, setAmount] = useState<number>(20000)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [reason, setReason] = useState<string>('Bồi thường thiện chí do sự cố giao hàng chậm trễ')
  const [validDays, setValidDays] = useState<number>(30)
  const [loading, setLoading] = useState(false)

  if (!isOpen || !user) return null

  const PRESET_AMOUNTS = [
    { value: 10000, label: '10.000₫ (Giao chậm 1-2 ngày)' },
    { value: 20000, label: '20.000₫ (Đóng gói lỗi nhẹ / Thiếu quà)' },
    { value: 50000, label: '50.000₫ (Khiếu nại phức tạp / Khách VIP)' },
    { value: 100000, label: '100.000₫ (Sự cố nghiêm trọng - Hạn mức tối đa)' }
  ]

  const effectiveAmount = customAmount ? Number(customAmount) : amount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!effectiveAmount || effectiveAmount <= 0) {
      alert('Vui lòng chọn hoặc nhập số tiền bồi thường hợp lệ!')
      return
    }

    if (effectiveAmount > 100000) {
      alert('Hạn mức bồi thường của CSKH tối đa là 100.000₫! Các khoản bồi thường lớn hơn phải có Trưởng bộ phận duyệt.')
      return
    }

    if (!reason.trim()) {
      alert('Vui lòng nhập lý do bồi thường để phục vụ công tác kiểm toán (Audit)!')
      return
    }

    setLoading(true)
    try {
      // 1. Tạo mã voucher độc quyền CSKH_XXXXX cho User này
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase()
      const voucherCode = `CSKH_${randomSuffix}`

      const res = await fetch(`${API_BASE_URL}/discounts?shopId=PLATFORM`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Voucher CSKH Đền Bù: ${reason.trim()}`,
          code: voucherCode,
          type: 'fixed',
          value: effectiveAmount,
          minSpend: 0,
          usageLimit: 1,
          targetUserId: user.id,
          isClaimable: false,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000 * validDays).toISOString()
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || 'Không thể tạo voucher đền bù')
      }

      const createdVoucher = await res.json()

      // 2. Tự động nạp thẳng voucher vào ví của khách hàng đó
      try {
        await fetch(`${API_BASE_URL}/discounts/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            voucherId: createdVoucher.id
          })
        })
      } catch (claimErr) {
        console.warn('Lỗi auto-claim vào ví:', claimErr)
      }

      // 3. Ghi nhật ký kiểm toán hệ thống (Audit Log)
      await triggerAuditLog(
        `CSKH cấp Voucher đền bù thiện chí ${effectiveAmount.toLocaleString('vi-VN')}₫ (Mã: ${voucherCode}) cho khách hàng "${user.name || user.email}" (ID: ${user.id}). Lý do: ${reason.trim()}`
      )

      alert(
        ` ĐÃ CẤP VOUCHER ĐỀN BÙ THÀNH CÔNG!\n\n` +
        `• Khách hàng: ${user.name || user.email}\n` +
        `• Mã Voucher: ${voucherCode}\n` +
        `• Mức đền bù: ${effectiveAmount.toLocaleString('vi-VN')}₫ (Đơn 0đ)\n` +
        `• Hạn dùng: ${validDays} ngày\n\n` +
        `Voucher đã được chuyển thẳng vào Ví của khách hàng để sử dụng khi mua sắm.`
      )

      onSuccess()
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs text-slate-800 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200/80 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col text-left">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-indigo-800 p-5 text-white flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shrink-0">
              🎁
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight">
                Cấp Voucher Bồi Thường Thiện Chí (CSKH)
              </h3>
              <p className="text-xs text-purple-200 mt-0.5">
                Cơ chế giải quyết sự cố 1-1 theo quy chuẩn Shopee CS Operations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white font-black text-lg p-1 cursor-pointer transition"
          >
            ✕
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* User Info Card */}
          <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">
                Khách Hàng Nhận Bồi Thường
              </span>
              <div className="font-extrabold text-slate-900 text-sm">
                {user.name || 'Người dùng sàn'}
              </div>
              <div className="text-slate-500 font-mono text-[11px]">
                {user.email || user.phone} • ID: #{user.id.slice(0, 10)}...
              </div>
            </div>
            <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase bg-purple-200/70 text-purple-800">
              Khách Hàng
            </span>
          </div>

          {/* Chọn mức đền bù gợi ý */}
          <div className="space-y-1.5 text-left">
            <label className="font-black text-slate-700 uppercase tracking-wider text-[11px]">
              Mức Đền Bù Gợi Ý (Chính Sách Sàn)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_AMOUNTS.map((preset) => {
                const isSelected = !customAmount && amount === preset.value
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      setAmount(preset.value)
                      setCustomAmount('')
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/50 text-purple-900 font-bold shadow-3xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-black text-sm text-purple-700">
                      {preset.value.toLocaleString('vi-VN')}₫
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold line-clamp-1 mt-0.5">
                      {preset.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tự nhập số tiền & Thời hạn */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="space-y-1 text-left">
              <label className="font-bold text-slate-600 text-[11px]">
                Hoặc nhập số tiền khác (VNĐ)
              </label>
              <input
                type="number"
                placeholder="Tối đa 100.000₫..."
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-purple-700 focus:outline-none focus:border-purple-600 focus:bg-white shadow-3xs"
              />
            </div>

            <div className="space-y-1 text-left">
              <label className="font-bold text-slate-600 text-[11px]">
                Thời hạn hiệu lực voucher
              </label>
              <select
                value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white shadow-3xs cursor-pointer"
              >
                <option value={7}>7 Ngày</option>
                <option value={14}>14 Ngày</option>
                <option value={30}>30 Ngày (Khuyên dùng)</option>
                <option value={60}>60 Ngày</option>
              </select>
            </div>
          </div>

          {/* Lý do đền bù */}
          <div className="space-y-1 text-left">
            <label className="font-black text-slate-700 uppercase tracking-wider text-[11px]">
              Lý Do Bồi Thường (Kiểm toán Audit) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Giao hàng chậm 3 ngày do bưu cục quá tải, shipper thái độ không tốt..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600 focus:bg-white shadow-3xs resize-none"
            />
            <p className="text-[10px] text-slate-400">
              🔒 Lý do này sẽ được lưu vĩnh viễn vào Audit Log của Sàn để Ban Quản Trị đối soát ngân sách.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl transition shadow-3xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>🎁</span>
              <span>{loading ? 'Đang cấp...' : `Xác Nhận Cấp ${effectiveAmount.toLocaleString('vi-VN')}₫`}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}
