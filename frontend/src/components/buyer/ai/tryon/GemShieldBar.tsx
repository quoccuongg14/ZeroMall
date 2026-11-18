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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 text-white shadow-md shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-lg shrink-0">
          🛡️
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wide text-white">CHẾ ĐỘ THỬ ĐỒ:</span>
            <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
              tryonEngineMode === 'free'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
            }`}>
              {tryonEngineMode === 'free' ? '✨ MIỄN PHÍ (0 Gem • Bảo vệ tài khoản)' : '💎 MAGE ULTRA HD (~350 Gem/lần)'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {tryonEngineMode === 'free'
              ? 'AI Local đa tầng bóc tách vải & ướm đồ siêu tốc. 0 Gem, không tiêu tốn tài khoản Mage.space của bạn.'
              : 'Mô hình Mage Mango 3 Turbo Studio AI. Tiêu hao ~350 Gem mỗi khi bấm Ướm Cả Bộ.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 ml-auto">
        <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => onSetEngineMode('free')}
            className={`px-3 py-1.5 rounded-lg font-black transition cursor-pointer flex items-center gap-1.5 ${
              tryonEngineMode === 'free'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>⚡</span> Local AI (0 Gem)
          </button>
          <button
            type="button"
            onClick={() => {
              if (tryonEngineMode === 'free') {
                onOpenMageConfirm()
              }
            }}
            className={`px-3 py-1.5 rounded-lg font-black transition cursor-pointer flex items-center gap-1.5 ${
              tryonEngineMode === 'mage'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>💎</span> Mage Ultra HD
          </button>
        </div>

        <div className="px-3 py-1.5 bg-slate-800/90 border border-white/10 rounded-xl text-xs flex items-center gap-1.5 font-bold text-slate-300">
          <span className="text-amber-400">💎</span> Số dư: <span className="font-black text-white">{gemBalance !== null ? gemBalance.toLocaleString('vi-VN') : '7.060'} Gem</span>
        </div>
      </div>
    </div>
  )
}
