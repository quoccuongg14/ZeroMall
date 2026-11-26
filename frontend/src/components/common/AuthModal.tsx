import React, { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../../config/api.config'
import { OtpVerifyField } from './OtpVerifyField'
import { ZeroMallLogoMark } from './ZeroMallLogo'

declare global {
  interface Window {
    google?: any
  }
}

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthSuccess: (user: any, token: string) => void
  initialTab?: 'login' | 'register'
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialTab = 'login',
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>(initialTab)
  
  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'NAM' | 'NU' | 'KHAC'>('NAM')
  const googleBtnRef = useRef<HTMLDivElement | null>(null)
  
  // Status states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Sync tab state when initialTab or isOpen changes
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab)
      setOtpCode('')
      setConfirmPassword('')
      setError(null)
      setSuccessMsg(null)
    }
  }, [isOpen, initialTab])

  // Tải nút Đăng nhập Google nếu đã cấu hình VITE_GOOGLE_CLIENT_ID
  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!isOpen || !googleClientId || tab === 'forgot') return

    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (resp: { credential?: string }) => {
          if (!resp?.credential) return
          setLoading(true)
          setError(null)
          try {
            const res = await fetch(`${API_BASE_URL}/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: resp.credential }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Đăng nhập Google thất bại.')
            if (data.user?.role && data.user.role !== 'BUYER') {
              throw new Error('Tài khoản này thuộc hệ thống quản trị/bán hàng, không đăng nhập tại Sàn Khách Hàng.')
            }
            onAuthSuccess(data.user, data.accessToken)
            resetForm()
            onClose()
          } catch (err: any) {
            setError(err.message)
          } finally {
            setLoading(false)
          }
        },
      })
      googleBtnRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 340,
        text: 'continue_with',
        shape: 'pill',
      })
    }

    if (window.google?.accounts?.id) {
      initGoogle()
      return
    }
    const scriptId = 'zeromall-google-gsi'
    let script = document.getElementById(scriptId) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', initGoogle)
    return () => script?.removeEventListener('load', initGoogle)
  }, [isOpen, tab])

  if (!isOpen) return null

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setOtpCode('')
    setName('')
    setGender('NAM')
    setError(null)
    setSuccessMsg(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (tab === 'forgot') {
      if (password.length < 6) {
        setError('Mật khẩu mới phải có ít nhất 6 ký tự.')
        return
      }
      if (password !== confirmPassword) {
        setError('Mật khẩu mới và Xác nhận mật khẩu không khớp.')
        return
      }
    }

    setLoading(true)

    const endpoint =
      tab === 'login' ? 'login' : tab === 'register' ? 'register' : 'reset-password'
    const payload =
      tab === 'login'
        ? { email, password }
        : tab === 'register'
        ? {
            email,
            password,
            name,
            gender,
            otpCode,
            role: 'BUYER',
          }
        : {
            email,
            otpCode,
            newPassword: password,
          }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.')
      }

      if (tab === 'login') {
        if (data.user?.role && data.user.role !== 'BUYER') {
          const isSellerAccount = data.user.role === 'SHOP_OWNER' || data.user.role === 'SHOP_STAFF'
          throw new Error(
            isSellerAccount
              ? 'Tài khoản này là tài khoản Cửa Hàng (Kênh Người Bán), không thể dùng để đăng nhập trên Sàn TMĐT. Vui lòng đăng nhập bằng tài khoản Khách Hàng (Người Mua) khác!'
              : 'Tài khoản quản trị / vận hành nội bộ không thể đăng nhập ở đây. Vui lòng sử dụng tài khoản Khách Hàng (Người Mua)!'
          )
        }
        onAuthSuccess(data.user, data.accessToken)
        resetForm()
        onClose()
      } else if (tab === 'register') {
        setSuccessMsg('Đăng ký & xác thực Gmail thành công! Đang chuyển sang Đăng nhập...')
        setOtpCode('')
        setTimeout(() => {
          setTab('login')
          setError(null)
          setSuccessMsg(null)
        }, 1200)
      } else {
        setSuccessMsg('Đặt lại mật khẩu thành công! Đang chuyển sang Đăng nhập...')
        setOtpCode('')
        setPassword('')
        setConfirmPassword('')
        setTimeout(() => {
          setTab('login')
          setError(null)
          setSuccessMsg(null)
        }, 1200)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-200 my-auto text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút Đóng Modal */}
        <button 
          onClick={() => { resetForm(); onClose(); }}
          className="absolute right-4 top-4 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer font-bold shadow-3xs"
          title="Đóng cửa sổ"
        >
          ✕
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
          
          {/* CỘT TRÁI: Brand Hero Banner (Tương tự Seller Layout) */}
          <div className="lg:col-span-6 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
            {/* Background Radial Glow */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

            {/* Top Brand Logo */}
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <ZeroMallLogoMark size="lg" className="shadow-lg shadow-emerald-950/60" />
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black tracking-tight text-white">Zero<span className="text-emerald-400">Mall</span></span>
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-md uppercase tracking-wider">Khách Hàng</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Sàn Thương Mại Điện Tử Thông Minh</p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/15 rounded-full text-emerald-300 text-xs font-bold backdrop-blur-md">
                <span>✨</span> Mua Sắm An Tâm - Đổi Trả Dễ Dàng
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                Trải nghiệm mua sắm đỉnh cao, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">ưu đãi ngập tràn</span>
              </h2>

              <p className="text-slate-350 text-xs sm:text-sm leading-relaxed font-normal">
                Hàng triệu sản phẩm chính hãng 100%, thanh toán linh hoạt qua Ví ZeroPay / SePay và giao hàng siêu tốc ZMX.
              </p>
            </div>

            {/* 3 Value Proposition Cards */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-6">
              <div className="bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md space-y-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-bold">
                  🚚
                </div>
                <h4 className="font-extrabold text-[11px] text-white">Freeship Đơn</h4>
                <p className="text-[10px] text-slate-400 leading-tight">Miễn phí ship với voucher từ sàn & shop.</p>
              </div>

              <div className="bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md space-y-1">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center text-xs font-bold">
                  🛡️
                </div>
                <h4 className="font-extrabold text-[11px] text-white">Đổi Trả 15 Ngày</h4>
                <p className="text-[10px] text-slate-400 leading-tight">Bảo vệ quyền lợi người mua 100% Escrow.</p>
              </div>

              <div className="bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md space-y-1">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs font-bold">
                  🎁
                </div>
                <h4 className="font-extrabold text-[11px] text-white">Tích Xu Thưởng</h4>
                <p className="text-[10px] text-slate-400 leading-tight">Nhận xu đánh giá, đổi thưởng liền tay.</p>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: Form Đăng Nhập / Đăng Ký */}
          <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between bg-white">
            <div>
              {/* Tab Switcher */}
              <div className="flex border-b border-slate-100 mb-6">
                <button 
                  type="button"
                  onClick={() => { setTab('login'); setOtpCode(''); setError(null); setSuccessMsg(null); }}
                  className={`flex-1 pb-3 text-center font-black text-sm transition cursor-pointer ${
                    tab === 'login' 
                      ? 'text-emerald-600 border-b-2 border-emerald-600' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Đăng Nhập
                </button>
                <button 
                  type="button"
                  onClick={() => { setTab('register'); setOtpCode(''); setError(null); setSuccessMsg(null); }}
                  className={`flex-1 pb-3 text-center font-black text-sm transition cursor-pointer ${
                    tab === 'register' 
                      ? 'text-emerald-600 border-b-2 border-emerald-600' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Đăng Ký
                </button>
                {tab === 'forgot' && (
                  <span className="flex-1 pb-3 text-center font-black text-sm text-emerald-600 border-b-2 border-emerald-600">
                    Quên Mật Khẩu
                  </span>
                )}
              </div>

              {/* Thông báo Lỗi / Thành công */}
              {error && (
                <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-600 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <span>✅</span>
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Form Input Fields */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {tab === 'register' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Họ và Tên</label>
                      <input 
                        type="text" 
                        required
                        placeholder="VD: Nguyễn Văn A"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Giới tính (AI gợi ý phù hợp theo phong cách bạn)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setGender('NAM')}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            gender === 'NAM'
                              ? 'border-emerald-600 bg-emerald-50/80 text-emerald-700 shadow-xs ring-1 ring-emerald-500'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>👨</span>
                          <span>Nam</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGender('NU')}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            gender === 'NU'
                              ? 'border-emerald-600 bg-emerald-50/80 text-emerald-700 shadow-xs ring-1 ring-emerald-500'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>👩</span>
                          <span>Nữ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGender('KHAC')}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            gender === 'KHAC'
                              ? 'border-emerald-600 bg-emerald-50/80 text-emerald-700 shadow-xs ring-1 ring-emerald-500'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>✨</span>
                          <span>Khác</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Tài Khoản (Gmail)</label>
                  <input 
                    type="email" 
                    required
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>

                {(tab === 'register' || tab === 'forgot') && (
                  <OtpVerifyField
                    email={email}
                    otpCode={otpCode}
                    onOtpChange={setOtpCode}
                    purpose={tab === 'register' ? 'REGISTER' : 'RESET_PASSWORD'}
                    disabled={loading}
                    onFeedback={(fb) => {
                      if (!fb) {
                        setError(null)
                        setSuccessMsg(null)
                      } else if (fb.type === 'error') {
                        setError(fb.text)
                        setSuccessMsg(null)
                      } else {
                        setSuccessMsg(fb.text)
                        setError(null)
                      }
                    }}
                  />
                )}

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      {tab === 'forgot' ? 'Mật Khẩu Mới' : 'Mật Khẩu'}
                    </label>
                    {tab === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTab('forgot')
                          setOtpCode('')
                          setPassword('')
                          setConfirmPassword('')
                          setError(null)
                          setSuccessMsg(null)
                        }}
                        className="text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                      >
                        Quên mật khẩu?
                      </button>
                    )}
                  </div>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>

                {tab === 'forgot' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Xác Nhận Mật Khẩu Mới</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Nhập lại mật khẩu mới"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs transition duration-200 cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang xử lý...</span>
                    </>
                  ) : tab === 'login' ? (
                    <span>Đăng Nhập Khách Hàng</span>
                  ) : tab === 'register' ? (
                    <span>Xác Nhận OTP &amp; Đăng Ký</span>
                  ) : (
                    <span>Xác Nhận Đổi Mật Khẩu</span>
                  )}
                </button>

                {import.meta.env.VITE_GOOGLE_CLIENT_ID && tab !== 'forgot' && (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span>Hoặc</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                    <div ref={googleBtnRef} className="flex justify-center" />
                  </div>
                )}
              </form>
            </div>

            {/* Hint & Demo Account Helper */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-2">
              <p className="text-[11px] text-slate-400 font-medium">
                Tài khoản khách mẫu: <span className="font-bold text-slate-700">buyer1@zeromall.com</span> / <span className="font-bold text-slate-700">123456</span>
              </p>
              <div className="text-xs text-slate-500">
                {tab === 'login' ? (
                  <span>
                    Chưa có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => { setTab('register'); setError(null); }}
                      className="text-emerald-600 hover:text-emerald-700 font-extrabold cursor-pointer hover:underline inline"
                    >
                      Đăng ký ngay
                    </button>
                  </span>
                ) : (
                  <span>
                    Đã có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => { setTab('login'); setError(null); }}
                      className="text-emerald-600 hover:text-emerald-700 font-extrabold cursor-pointer hover:underline inline"
                    >
                      Đăng nhập
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

