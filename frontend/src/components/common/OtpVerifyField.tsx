import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'

export type OtpPurpose = 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_PASSWORD'

interface OtpVerifyFieldProps {
  email: string
  otpCode: string
  onOtpChange: (value: string) => void
  purpose: OtpPurpose
  onFeedback?: (msg: { type: 'success' | 'error'; text: string } | null) => void
  disabled?: boolean
}

export const OtpVerifyField: React.FC<OtpVerifyFieldProps> = ({
  email,
  otpCode,
  onOtpChange,
  purpose,
  onFeedback,
  disabled = false,
}) => {
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // Reset cooldown khi đổi email khác
  useEffect(() => {
    setCooldown(0)
  }, [email, purpose])

  const handleSendOtp = async () => {
    const cleanEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      onFeedback?.({ type: 'error', text: 'Vui lòng nhập đúng địa chỉ Email trước khi lấy mã OTP.' })
      return
    }

    setSending(true)
    onFeedback?.(null)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, purpose }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || 'Không thể gửi mã OTP. Vui lòng thử lại.')
      }
      setCooldown(Number(data.cooldownSeconds) || 60)
      onFeedback?.({
        type: 'success',
        text: data.message || 'Mã OTP 6 số đã được gửi về Email của bạn!',
      })
    } catch (err: any) {
      onFeedback?.({ type: 'error', text: err.message || 'Lỗi kết nối khi gửi mã OTP.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700">
          Mã Xác Thực Email (OTP 6 số)
        </label>
        <span className="text-[10px] text-slate-400">Hiệu lực 5 phút</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          disabled={disabled}
          placeholder="Nhập 6 chữ số"
          value={otpCode}
          onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold tracking-[0.25em] text-slate-800 placeholder-slate-400 placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition"
        />
        <button
          type="button"
          onClick={handleSendOtp}
          disabled={sending || cooldown > 0 || disabled}
          className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-extrabold text-xs whitespace-nowrap transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? 'Đang gửi...' : cooldown > 0 ? `Gửi lại (${cooldown}s)` : 'Gửi Mã OTP'}
        </button>
      </div>
      <p className="text-[10px] text-slate-400">
        Kiểm tra Hộp thư đến (hoặc mục Thư rác/Spam) của Gmail để lấy mã 6 số.
      </p>
    </div>
  )
}
