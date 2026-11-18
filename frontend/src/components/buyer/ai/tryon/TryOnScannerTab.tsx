import React from 'react'
import type { Product } from '../../FlashSale'
import type { ExtractedGarment } from './types'

interface TryOnScannerTabProps {
  selectedPant: Product | null
  extractedGarment: ExtractedGarment | null
  isScanningGarment: boolean
  onScanGarment: () => void
  onAnchorItemTo100Sets: (item: Product) => void
}

export const TryOnScannerTab: React.FC<TryOnScannerTabProps> = ({
  selectedPant,
  extractedGarment,
  isScanningGarment,
  onScanGarment,
  onAnchorItemTo100Sets,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 text-white shadow-xl space-y-3.5">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div>
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <span>🔬</span> Bộ Bóc Tách Trang Phục Từng Lớp (FashnHumanParser AI)
          </h4>
          <p className="text-[11px] text-slate-400">
            Bóc tách vải, khử nền sạch 100%, tạo Alpha Matte & trích xuất bảng màu
          </p>
        </div>
        <button
          type="button"
          onClick={onScanGarment}
          disabled={isScanningGarment}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
        >
          <span>⚡</span> {isScanningGarment ? 'Đang Quét...' : 'Quét Lại Món Này'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-950 rounded-xl p-2.5 border border-white/10 flex flex-col items-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 self-start">
            1. Ảnh Gốc Món Đồ
          </span>
          <div className="w-full h-44 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center border border-white/5">
            <img
              src={selectedPant?.image || ''}
              alt="Garment Original"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <span className="text-[10px] text-slate-400 mt-1.5 text-center truncate max-w-full">
            {selectedPant?.name}
          </span>
        </div>

        <div className="bg-slate-950 rounded-xl p-2.5 border border-white/10 flex flex-col items-center">
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5 self-start flex items-center gap-1">
            <span>🎭</span> 2. Mặt Nạ Phân Đoạn AI
          </span>
          <div className="w-full h-44 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-white/5 relative">
            {extractedGarment?.mask_url ? (
              <img
                src={extractedGarment.mask_url}
                alt="AI Garment Mask"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-center p-4">
                <span className="text-xs text-slate-400">Mặt nạ nhị phân 0/1</span>
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-1.5">
            Nhãn: {extractedGarment?.detected_category?.toUpperCase() || 'TRANG PHỤC'}
          </span>
        </div>

        <div className="bg-slate-950 rounded-xl p-2.5 border border-white/10 flex flex-col items-center">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 self-start flex items-center gap-1">
            <span>✨</span> 3. Đồ Bóc Tách Sạch Nền
          </span>
          <div 
            className="w-full h-44 rounded-lg overflow-hidden flex items-center justify-center border border-white/5 relative"
            style={{
              backgroundImage: `linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)`,
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
            }}
          >
            {extractedGarment?.extracted_garment_url ? (
              <img
                src={extractedGarment.extracted_garment_url}
                alt="Isolated Garment"
                className="max-h-full max-w-full object-contain drop-shadow-2xl"
              />
            ) : (
              <img
                src={selectedPant?.image || ''}
                alt="Isolated Garment"
                className="max-h-full max-w-full object-contain opacity-70"
              />
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-1.5">Alpha PNG 100%</span>
        </div>
      </div>

      {selectedPant && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => onAnchorItemTo100Sets(selectedPant)}
            className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 transition flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <span>🎯</span> Phối 100 Set Với Món Vừa Quét ➔
          </button>
        </div>
      )}
    </div>
  )
}
