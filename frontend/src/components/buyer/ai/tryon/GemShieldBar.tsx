import React from 'react'

interface GemShieldBarProps {
  tryonEngineMode?: string
  onSetEngineMode?: (mode: any) => void
  onOpenMageConfirm?: () => void
  gemBalance?: number | null
}

export const GemShieldBar: React.FC<GemShieldBarProps> = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs shrink-0">
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700">Chế độ thử đồ AI:</span>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <span>✨</span> AI Siêu Thực Ultra HD
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            • Tự động tái tạo phom dáng, nếp gấp vải & ánh sáng studio
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <div className="px-3 py-1 bg-emerald-50 border border-emerald-200/80 rounded-lg text-xs font-semibold text-emerald-700 flex items-center gap-1.5 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Động cơ AI sẵn sàng</span>
        </div>
      </div>
    </div>
  )
}
