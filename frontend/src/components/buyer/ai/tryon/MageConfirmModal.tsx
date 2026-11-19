import React from 'react'

interface MageConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  gemBalance: number | null
}

export const MageConfirmModal: React.FC<MageConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  gemBalance,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-slate-800 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl mx-auto text-amber-600">
          💎
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-base font-bold text-slate-900">
            Kích Hoạt Chế Độ Mage Ultra HD
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Chế độ này gọi trực tiếp mô hình AI Mage.space và tiêu hao khoảng <strong className="text-amber-600 font-bold">~350 Gem</strong> cho mỗi lần bạn bấm &quot;Ướm Thử&quot;.
          </p>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
          <span className="text-[11px] text-slate-500 block mb-0.5">Số dư Gem hiện tại:</span>
          <span className="text-lg font-bold text-slate-900">
            {gemBalance !== null ? gemBalance.toLocaleString('vi-VN') : '7.060'} Gems
          </span>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
          >
            Hủy (Dùng Miễn Phí)
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-[#ee4d2d] hover:bg-[#d93b1d] text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            Đồng Ý, Bật Mage
          </button>
        </div>
      </div>
    </div>
  )
}
