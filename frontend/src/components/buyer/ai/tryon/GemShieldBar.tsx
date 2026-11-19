import React from 'react'
import type { TryonEngineMode } from './types'

interface GemShieldBarProps {
  tryonEngineMode: TryonEngineMode
  onSetEngineMode: (mode: TryonEngineMode) => void
  onOpenMageConfirm: () => void
  gemBalance: number | null
}

export const GemShieldBar: React.FC<GemShieldBarProps> = ({
  tryonEngineMode,
  onSetEngineMode,
  onOpenMageConfirm,
  gemBalance,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs shrink-0">
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700">Chế độ thử đồ AI:</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            tryonEngineMode === 'free'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {tryonEngineMode === 'free' ? '✨ Miễn phí (0 Gem)' : '💎 Mage Ultra HD (~350 Gem)'}
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">• Thử đồ không giới hạn, an toàn số dư Gem</span>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => onSetEngineMode('free')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              tryonEngineMode === 'free'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Local AI (0 Gem)
          </button>
          <button
            type="button"
            onClick={() => {
              if (tryonEngineMode === 'free') {
                onOpenMageConfirm()
              }
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              tryonEngineMode === 'mage'
                ? 'bg-[#ee4d2d] text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Mage Ultra HD
          </button>
        </div>

        <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 flex items-center gap-1">
          <span>💎</span>
          <span>{gemBalance !== null ? gemBalance.toLocaleString('vi-VN') : '7.060'} Gem</span>
        </div>
      </div>
    </div>
  )
}
