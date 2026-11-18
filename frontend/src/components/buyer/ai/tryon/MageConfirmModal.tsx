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
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl mx-auto">
          ⚠️
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-base font-black text-amber-400">
            Xác Nhận Kích Hoạt Mage Ultra HD
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Chế độ này sẽ gọi trực tiếp mô hình AI của Mage.space và tiêu hao khoảng <strong className="text-amber-300 font-bold">~350 Gem</strong> cho mỗi lần bạn bấm &quot;Ướm Cả Bộ&quot;.
          </p>
        </div>
        <div className="bg-slate-950 p-3 rounded-xl border border-white/10 text-center">
          <span className="text-[11px] text-slate-400 block mb-0.5">Số dư Gem hiện tại của bạn:</span>
          <span className="text-lg font-black text-amber-400">
            {gemBalance !== null ? gemBalance.toLocaleString('vi-VN') : '7.060'} Gems
          </span>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
          >
            Hủy (Dùng 0 Gem)
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg transition cursor-pointer"
          >
            Tôi Hiểu, Bật Mage
          </button>
        </div>
      </div>
    </div>
  )
}
