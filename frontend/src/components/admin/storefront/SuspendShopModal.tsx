import React, { useState } from 'react'

interface SuspendShopModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (durationHours: number | null, reason: string) => Promise<void>
  shopName: string
  operatorRole: 'ADMIN' | 'PLATFORM_SUPPORT'
  isLoading: boolean
}

export const SuspendShopModal: React.FC<SuspendShopModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  shopName,
  operatorRole,
  isLoading,
}) => {
  const isCs = operatorRole === 'PLATFORM_SUPPORT'

  const [durationHours, setDurationHours] = useState<number | null>(24)
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  const adminOptions = [
    { value: 24, label: 'Tạm khóa khẩn cấp 24 giờ' },
    { value: 72, label: 'Tạm khóa 3 ngày (Phạt sao quả tạ)' },
    { value: 168, label: 'Tạm khóa 7 ngày' },
    { value: 720, label: 'Tạm khóa 30 ngày' },
    { value: -1, label: 'Khóa vĩnh viễn (Chấm dứt hoạt động)' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return

    const effectiveHours = isCs ? 24 : durationHours === -1 ? null : durationHours
    await onConfirm(effectiveHours, reason.trim())
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-left space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl text-xl">🔒</span>
            <div>
              <h3 className="font-extrabold text-base text-slate-800">
                {isCs ? 'Tạm Khóa Gian Hàng Khẩn Cấp (24h)' : 'Khóa Hoạt Động Gian Hàng'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Gian hàng: <strong className="text-slate-700">{shopName}</strong></p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Info Callout */}
        <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed space-y-1 ${
          isCs
            ? 'bg-amber-50/80 border-amber-200 text-amber-900'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          {isCs ? (
            <>
              <p className="font-bold flex items-center gap-1.5 text-amber-950">
                <span>🎧</span> Giới hạn thẩm quyền CSKH: Tạm khóa tối đa 24 Giờ
              </p>
              <p>
                Nhân viên CSKH chỉ được áp dụng tạm khóa khẩn cấp tối đa <strong>24 giờ</strong> để phong tỏa gian hàng khi có khiếu nại lừa đảo hoặc vi phạm nghiêm trọng cần xác minh.
              </p>
              <p className="text-[11px] text-amber-800">
                Sau 24h, gian hàng sẽ tự động khôi phục nếu Quản trị viên sàn không có quyết định gia hạn thêm.
              </p>
            </>
          ) : (
            <>
              <p className="font-bold flex items-center gap-1.5 text-slate-900">
                <span>🛡️</span> Thẩm quyền Quản trị viên Sàn (ADMIN)
              </p>
              <p>
                Admin có quyền đình chỉ hoạt động gian hàng theo các khung thời gian linh hoạt hoặc <strong>khóa vĩnh viễn</strong> nếu vi phạm nghiêm trọng chính sách vận hành của ZeroMall.
              </p>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Duration selection (Admin only) */}
          {!isCs && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Thời hạn khóa *</label>
              <select
                value={durationHours === null ? -1 : durationHours}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  setDurationHours(val === -1 ? null : val)
                }}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-semibold text-slate-800"
              >
                {adminOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isCs && (
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="font-bold text-slate-600">Thời hạn áp dụng:</span>
              <span className="font-black text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-md">
                ⏱️ 24 Giờ (Khẩn cấp)
              </span>
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 block">
                Biên bản lý do khóa *
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Tối thiểu {isCs ? '15' : '5'} ký tự
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isCs ? 'Nhập rõ nội dung khiếu nại của khách hoặc dấu hiệu lừa đảo cần tạm khóa xác minh...' : 'Nhập căn cứ xử lý vi phạm của gian hàng...'}
              rows={4}
              required
              minLength={isCs ? 15 : 5}
              className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              disabled={isLoading || reason.trim().length < (isCs ? 15 : 5)}
              className="px-5 py-2 text-xs font-extrabold bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <span>🔒</span> {isCs ? 'Xác Nhận Tạm Khóa 24h' : 'Xác Nhận Khóa Shop'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
