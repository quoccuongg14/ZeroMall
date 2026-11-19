import React, { useState } from 'react'

interface ResetBannerModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  shopName: string
  isLoading: boolean
}

export const ResetBannerModal: React.FC<ResetBannerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  shopName,
  isLoading,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('Quảng cáo giao dịch chuyển khoản ngoài sàn')
  const [customReason, setCustomReason] = useState('')

  if (!isOpen) return null

  const presetReasons = [
    'Quảng cáo giao dịch chuyển khoản ngoài sàn',
    'Hình ảnh khiêu dâm / không phù hợp chuẩn mực',
    'Nội dung cờ bạc, cá độ trái quy định',
    'Hình ảnh mạo danh thương hiệu / nhãn hiệu bảo hộ',
    'Nội dung xúc phạm hoặc gây hiểu lầm cho người tiêu dùng',
    'Khác (tự nhập lý do bên dưới)',
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalReason = selectedReason.startsWith('Khác') ? customReason.trim() : selectedReason
    if (!finalReason) return
    await onConfirm(finalReason)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-left space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl text-xl">⚠️</span>
            <div>
              <h3 className="font-extrabold text-base text-slate-800">Cưỡng Chế Gỡ Banner Vi Phạm</h3>
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

        {/* Warning Callout */}
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3.5 text-xs text-rose-800 leading-relaxed space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-rose-900">
            <span>🛡️</span> Cơ chế can thiệp khẩn cấp của Sàn
          </p>
          <p>
            Hành động này sẽ <strong>xóa ngay lập tức logo và banner trang trí</strong> của gian hàng, khôi phục về giao diện mặc định chuẩn của ZeroMall.
          </p>
          <p className="text-[11px] text-rose-700">
            Hệ thống sẽ tự động gửi thông báo vi phạm về Kênh Người Bán và ghi nhận vết thao tác vào Nhật ký Hệ thống (Audit Trail).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Lý do cưỡng chế gỡ bỏ *</label>
            <div className="space-y-2">
              {presetReasons.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                    selectedReason === reason
                      ? 'border-rose-500 bg-rose-50/50 font-bold text-rose-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reasonPreset"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="accent-rose-600"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason.startsWith('Khác') && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Chi tiết lý do vi phạm *</label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Nhập mô tả chi tiết lỗi vi phạm giao diện..."
                rows={3}
                required
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}

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
              disabled={isLoading || (selectedReason.startsWith('Khác') && !customReason.trim())}
              className="px-5 py-2 text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <span>⚠️</span> Xác Nhận Gỡ Banner
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
