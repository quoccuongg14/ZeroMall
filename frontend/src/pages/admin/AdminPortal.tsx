import React, { useState, useEffect } from 'react'
import { AdminPage } from './AdminPage'
import { CsSupportPage } from '../CsSupport/CsSupportPage'
import { AdminAuthForm } from '../../components/admin/AdminAuthForm'

interface AdminPortalProps {
  user: any
  onAuthSuccess?: (user: any, token: string) => void
  onLogout: () => void
  onBackToHome: () => void
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  user,
  onAuthSuccess = () => {},
  onLogout,
  onBackToHome
}) => {
  // Theo dõi đường dẫn URL hiện tại để chuyển đổi chính xác giữa Cổng Admin và Cổng CSKH
  const [pathname, setPathname] = useState(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/admin'
  })

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname)
    }
    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  const isCsRoute =
    pathname.startsWith('/cs-support') ||
    (typeof window !== 'undefined' && window.location.search.includes('portal=cs'))

  // 1. Nếu đã đăng nhập với vai trò ADMIN hoặc PLATFORM_SUPPORT
  if (user?.role === 'ADMIN' || user?.role === 'PLATFORM_SUPPORT') {
    // Nếu URL là /cs-support HOẶC người dùng là nhân viên CSKH -> Hiển thị CS Portal
    if (isCsRoute || user?.role === 'PLATFORM_SUPPORT') {
      return <CsSupportPage user={user} onLogout={onLogout} onBackToHome={onBackToHome} />
    }

    // Mặc định ADMIN truy cập Admin Portal
    return <AdminPage user={user} onLogout={onLogout} onBackToHome={onBackToHome} />
  }

  // 2. Nếu chưa đăng nhập hoặc đăng nhập vai trò khác, hiển thị form đăng nhập
  return (
    <AdminAuthForm
      onAuthSuccess={onAuthSuccess}
      onBackToHome={onBackToHome}
    />
  )
}
