import React, { useState } from 'react'
import { API_BASE_URL } from '../../../config/api.config'
import { ResetBannerModal } from './ResetBannerModal'
import { SuspendShopModal } from './SuspendShopModal'

interface StorefrontGovernanceBarProps {
  shop: any
  user: any
  onShopUpdated: () => void
}

export const StorefrontGovernanceBar: React.FC<StorefrontGovernanceBarProps> = ({
  shop,
  user,
  onShopUpdated,
}) => {
  const isSuperAdmin = user?.role === 'ADMIN'
  const isCsStaff = user?.role === 'PLATFORM_SUPPORT'
  const hasGovernanceAccess = isSuperAdmin || isCsStaff

  const [isMinimized, setIsMinimized] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  if (!hasGovernanceAccess || !shop) {
    return null
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setFeedbackToast({ message, type })
    setTimeout(() => setFeedbackToast(null), 4000)
  }

  // Action 1: Reset Storefront / Banner
  const handleConfirmReset = async (reason: string) => {
    setLoadingAction('RESET')
    try {
      const res = await fetch(`${API_BASE_URL}/auth/shops/${shop.id}/reset-storefront`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorEmail: user.email,
          operatorRole: user.role,
          reason,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.message || 'Không thể gỡ banner của gian hàng')
      }

      showToast('Đã cưỡng chế gỡ banner vi phạm và gửi cảnh báo đến Shop!', 'success')
      setIsResetModalOpen(false)
      onShopUpdated()
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi gỡ banner', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  // Action 2: Lock Shop
  const handleConfirmSuspend = async (durationHours: number | null, reason: string) => {
    setLoadingAction('SUSPEND')
    try {
      let blockedUntil: string | null = null
      if (durationHours !== null) {
        blockedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
      }

      const res = await fetch(`${API_BASE_URL}/auth/shops/${shop.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'BLOCKED',
          blockedUntil,
          blockReason: reason,
          operatorEmail: user.email,
          operatorRole: user.role,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.message || 'Không thể khóa gian hàng')
      }

      showToast(
        durationHours
          ? `Đã tạm khóa gian hàng trong ${durationHours} giờ!`
          : 'Đã đình chỉ hoạt động vĩnh viễn gian hàng!',
        'success',
      )
      setIsSuspendModalOpen(false)
      onShopUpdated()
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi khóa shop', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  // Action 2b: Unlock Shop
  const handleUnlockShop = async () => {
    if (!window.confirm(`Xác nhận mở khóa hoạt động lại cho gian hàng "${shop.name}"?`)) {
      return
    }

    setLoadingAction('UNLOCK')
    try {
      const res = await fetch(`${API_BASE_URL}/auth/shops/${shop.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'APPROVED',
          operatorEmail: user.email,
          operatorRole: user.role,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.message || 'Không thể mở khóa gian hàng')
      }

      showToast('Đã mở khóa hoạt động gian hàng thành công!', 'success')
      onShopUpdated()
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi mở khóa shop', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  // Action 3: Ghost Login / Impersonate Shop
  const handleGhostLogin = async () => {
    const accessDesc = isCsStaff ? 'Chỉ Xem (Read-Only)' : 'Toàn Quyền Quản Trị'
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn đăng nhập đại diện vào Kênh Người Bán của Shop "${shop.name}"?\nChế độ: ${accessDesc}`,
      )
    ) {
      return
    }

    setLoadingAction('IMPERSONATE')
    try {
      const res = await fetch(`${API_BASE_URL}/auth/admin/impersonate-shop/${shop.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorEmail: user.email,
          operatorRole: user.role,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.message || 'Không thể kích hoạt phiên đại diện shop')
      }

      const data = await res.json()

      // Lưu phiên gốc của Admin/CSKH vào sessionStorage để khôi phục
      const originalSession = {
        user,
        token: localStorage.getItem('zm_token') || '',
        returnUrl: window.location.pathname,
      }
      sessionStorage.setItem('zm_impersonation_original_session', JSON.stringify(originalSession))

      // Cập nhật phiên đăng nhập đại diện mới
      localStorage.setItem('zm_user', JSON.stringify(data.user))
      localStorage.setItem('zm_token', data.accessToken)

      // Chuyển hướng sang Kênh Người Bán
      window.location.href = '/seller'
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi kích hoạt chế độ đại diện', 'error')
      setLoadingAction(null)
    }
  }

  const isBlocked = shop.status === 'BLOCKED'

  if (isMinimized) {
    return (
      <div className="fixed top-3 right-4 z-50 animate-in fade-in">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-slate-900/95 hover:bg-black text-white text-xs font-black px-4 py-2 rounded-2xl shadow-xl border border-slate-700/80 backdrop-blur-md flex items-center gap-2 cursor-pointer transition hover:scale-105"
        >
          <span>🛡️</span>
          <span>Zero Control Bar</span>
          <span className="text-[10px] bg-emerald-500 text-black font-extrabold px-1.5 py-0.5 rounded-md uppercase">
            {isSuperAdmin ? 'Admin' : 'CSKH'}
          </span>
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Toast Feedback */}
      {feedbackToast && (
        <div
          className={`fixed top-16 right-4 z-[999] px-4 py-2.5 rounded-2xl shadow-xl text-xs font-extrabold flex items-center gap-2 border animate-in slide-in-from-top-2 duration-200 ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-rose-600 text-white border-rose-400'
          }`}
        >
          <span>{feedbackToast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Floating Governance Sticky Header */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 shadow-xl px-4 py-2.5 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          
          {/* Left: Identity & Target Shop */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-black text-emerald-400 uppercase tracking-wider text-[11px] bg-slate-800/90 px-2.5 py-1 rounded-xl border border-slate-700">
              <span className="text-sm">🛡️</span> ZERO CONTROL
            </div>

            <span className="text-slate-500 font-bold hidden sm:inline">|</span>

            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-slate-400 font-semibold">Đang xem:</span>
              <span className="font-extrabold text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/15">
                {shop.name}
              </span>
              <span className="text-[10px] font-mono text-slate-400">({shop.id.slice(0, 8)})</span>
            </div>

            {/* Shop Status Badge */}
            {isBlocked ? (
              <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 animate-pulse">
                <span>🔴</span> ĐANG BỊ KHÓA
                {shop.blockedUntil && (
                  <span className="text-rose-300 font-mono text-[9px]">
                    (đến {new Date(shop.blockedUntil).toLocaleDateString('vi-VN')})
                  </span>
                )}
              </span>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                <span>🟢</span> ĐANG HOẠT ĐỘNG
              </span>
            )}

            {/* Operator Role Badge */}
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                isSuperAdmin
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-teal-500/20 text-teal-300 border-teal-500/40'
              }`}
            >
              {isSuperAdmin ? '🛡️ Admin Sàn' : '🎧 CSKH Sàn'}
            </span>
          </div>

          {/* Right: Governance Actions */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Action 1: Gỡ Banner Vi Phạm */}
            <button
              onClick={() => setIsResetModalOpen(true)}
              disabled={loadingAction !== null}
              className="bg-rose-600/90 hover:bg-rose-600 text-white font-extrabold px-3 py-1.5 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 border border-rose-500/50 hover:scale-102"
              title="Cưỡng chế xóa banner & logo vi phạm đưa về mặc định"
            >
              <span>⚠️</span>
              <span>Gỡ Banner Vi Phạm</span>
            </button>

            {/* Action 2: Khóa / Mở Khóa */}
            {isBlocked ? (
              <button
                onClick={handleUnlockShop}
                disabled={loadingAction !== null}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3 py-1.5 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 border border-emerald-400"
              >
                <span>🔓</span>
                <span>Mở Khóa Shop</span>
              </button>
            ) : (
              <button
                onClick={() => setIsSuspendModalOpen(true)}
                disabled={loadingAction !== null}
                className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-3 py-1.5 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 border border-amber-500"
              >
                <span>🔒</span>
                <span>{isCsStaff ? 'Tạm Khóa 24h' : 'Khóa Shop'}</span>
              </button>
            )}

            {/* Action 3: Đăng Nhập Đại Diện Shop (Ghost Login) */}
            <button
              onClick={handleGhostLogin}
              disabled={loadingAction !== null}
              className={`font-black px-3 py-1.5 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 border ${
                isCsStaff
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400'
              }`}
              title={isCsStaff ? 'Vào xem kênh người bán (Chế độ Chỉ Xem - bảo vệ số dư)' : 'Vào kênh người bán với toàn quyền'}
            >
              <span>{isCsStaff ? '👁️' : '🔑'}</span>
              <span>{isCsStaff ? 'Vào Kênh Shop (Chỉ Xem)' : 'Vào Kênh Shop (Toàn Quyền)'}</span>
            </button>

            {/* Minimize Toggle */}
            <button
              onClick={() => setIsMinimized(true)}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Thu nhỏ thanh điều hành"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ResetBannerModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmReset}
        shopName={shop.name}
        isLoading={loadingAction === 'RESET'}
      />

      <SuspendShopModal
        isOpen={isSuspendModalOpen}
        onClose={() => setIsSuspendModalOpen(false)}
        onConfirm={handleConfirmSuspend}
        shopName={shop.name}
        operatorRole={user?.role}
        isLoading={loadingAction === 'SUSPEND'}
      />
    </>
  )
}
