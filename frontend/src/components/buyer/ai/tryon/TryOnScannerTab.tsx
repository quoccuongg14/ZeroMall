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
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 text-slate-800 shadow-2xs space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>🔬</span> Phân Tích & Bóc Tách Trang Phục (AI Parser)
          </h4>
          <p className="text-[11px] text-slate-500">
            Tự động bóc tách vải, khử nền sạch và trích xuất bảng màu trang phục
          </p>
        </div>
        <button
          type="button"
          onClick={onScanGarment}
          disabled={isScanningGarment}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <span>⚡</span> {isScanningGarment ? 'Đang Quét...' : 'Quét Lại Món Này'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex flex-col items-center">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 self-start">
            1. Ảnh Gốc Món Đồ
          </span>
          <div className="w-full h-44 rounded-lg overflow-hidden bg-white flex items-center justify-center border border-slate-200">
            <img
              src={selectedPant?.image || ''}
              alt="Garment Original"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <span className="text-[10px] text-slate-600 mt-1.5 text-center truncate max-w-full">
            {selectedPant?.name}
          </span>
        </div>

        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex flex-col items-center">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 self-start flex items-center gap-1">
            <span>🎭</span> 2. Mặt Nạ Phân Đoạn AI
          </span>
          <div className="w-full h-44 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-800 relative">
            {extractedGarment?.mask_url ? (
              <img
                src={extractedGarment.mask_url}
                alt="AI Garment Mask"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-center p-4">
                <span className="text-xs text-slate-400">Mặt nạ nhị phân</span>
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-600 mt-1.5">
            Phân loại: {extractedGarment?.detected_category?.toUpperCase() || 'TRANG PHỤC'}
          </span>
        </div>

        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex flex-col items-center">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 self-start flex items-center gap-1">
            <span>✨</span> 3. Bóc Tách Khử Nền
          </span>
          <div 
            className="w-full h-44 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200 bg-white relative"
            style={{
              backgroundImage: `linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)`,
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
            }}
          >
            {extractedGarment?.extracted_garment_url ? (
              <img
                src={extractedGarment.extracted_garment_url}
                alt="Isolated Garment"
                className="max-h-full max-w-full object-contain drop-shadow-sm"
              />
            ) : (
              <img
                src={selectedPant?.image || ''}
                alt="Isolated Garment"
                className="max-h-full max-w-full object-contain opacity-70"
              />
            )}
          </div>
          <span className="text-[10px] text-slate-600 mt-1.5">
            {extractedGarment?.dimensions?.width || 0} × {extractedGarment?.dimensions?.height || 0} px
          </span>
        </div>
      </div>

      {/* Bảng màu vải chủ đạo */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-700">Màu sắc chủ đạo:</span>
          <div className="flex items-center gap-1.5">
            {(extractedGarment?.dominant_colors || ['#3b82f6', '#1e293b']).map((c, i) => (
              <div key={i} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: c }}></span>
                <span className="font-mono text-[10px] text-slate-600">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
