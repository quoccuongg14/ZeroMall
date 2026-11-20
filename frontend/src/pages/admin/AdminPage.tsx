import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'
import { useSearchParams } from 'react-router-dom'
import { UsersTab } from '../../components/admin/UsersTab'
import { ShopsTab } from '../../components/admin/ShopsTab'
import { CategoriesTab } from '../../components/admin/CategoriesTab'
import { ProductModerationTab } from '../../components/admin/ProductModerationTab'
import { PlatformVouchersTab } from '../../components/admin/PlatformVouchersTab'
import { FlashSaleTab } from '../../components/admin/FlashSaleTab'
import { CsStaffTab } from '../../components/admin/CsStaffTab'
import { SystemReportsTab } from '../../components/admin/SystemReportsTab'
import { CommissionSettingTab } from '../../components/admin/CommissionSettingTab'
import { AuditLogsTab } from '../../components/admin/AuditLogsTab'
import AdminPriceAnalyticsTab from '../../components/admin/AdminPriceAnalyticsTab'
import { CsLiveChatTab } from '../../components/admin/CsLiveChatTab'
import { AiEvaluationStudioTab } from '../../components/admin/AiEvaluationStudioTab'
import { BannersTab } from '../../components/admin/banners/BannersTab'

interface AdminPageProps {
  user: any
  onLogout: () => void
  onBackToHome: () => void
}

export const AdminPage: React.FC<AdminPageProps> = ({
  user,
  onLogout,
  onBackToHome
}) => {
  const [shops, setShops] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [platformVouchers, setPlatformVouchers] = useState<any[]>([])
  const [flashSales, setFlashSales] = useState<any[]>([])
  const [csStaff, setCsStaff] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [commissionRate, setCommissionRate] = useState<number>(5)
  const [_loading, setLoading] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const getTabFromParam = (param: string | null): any => {
    if (!param) return null;
    switch (param.toLowerCase()) {
      case 'users': return 'USERS';
      case 'manage-shops': return 'MANAGE_SHOPS';
      case 'categories': return 'CATEGORIES';
      case 'violations': return 'VIOLATIONS';
      case 'vouchers': return 'PLATFORM_VOUCHERS';
      case 'flash-sale': return 'FLASH_SALE';
      case 'cs-staff': return 'MANAGE_CS_STAFF';
      case 'live-chat': return 'LIVE_CHAT';
      case 'reports': return 'SYSTEM_REPORTS';
      case 'commission-setting': return 'COMMISSION_SETTING';
      case 'audit-logs': return 'AUDIT_LOGS';
      case 'price-analytics': return 'PRICE_ANALYTICS';
      case 'ai-evaluation':
      case 'ai-studio': return 'AI_EVALUATION';
      case 'banners': return 'BANNERS';
      default: return null;
    }
  }

  const getParamFromTab = (tab: string): string => {
    switch (tab) {
      case 'USERS': return 'users';
      case 'MANAGE_SHOPS': return 'manage-shops';
      case 'CATEGORIES': return 'categories';
      case 'VIOLATIONS': return 'violations';
      case 'PLATFORM_VOUCHERS': return 'vouchers';
      case 'FLASH_SALE': return 'flash-sale';
      case 'MANAGE_CS_STAFF': return 'cs-staff';
      case 'LIVE_CHAT': return 'live-chat';
      case 'SYSTEM_REPORTS': return 'reports';
      case 'COMMISSION_SETTING': return 'commission-setting';
      case 'AUDIT_LOGS': return 'audit-logs';
      case 'PRICE_ANALYTICS': return 'price-analytics';
      case 'AI_EVALUATION': return 'ai-evaluation';
      case 'BANNERS': return 'banners';
      default: return 'users';
    }
  }

  const [activePortalTab, setActivePortalTab] = useState<
    'USERS' | 'MANAGE_SHOPS' | 'CATEGORIES' | 'VIOLATIONS' | 'PLATFORM_VOUCHERS' | 'FLASH_SALE' | 'MANAGE_CS_STAFF' | 'LIVE_CHAT' | 'SYSTEM_REPORTS' | 'AUDIT_LOGS' | 'COMMISSION_SETTING' | 'PRICE_ANALYTICS' | 'AI_EVALUATION' | 'BANNERS'
  >(() => {
    const searchParamsLocal = new URLSearchParams(window.location.search);
    const param = searchParamsLocal.get('tab');
    if (param) {
      const parsed = getTabFromParam(param);
      if (parsed) return parsed;
    }
    return 'USERS';
  })

  const triggerAuditLog = async (action: string) => {
    try {
      await fetch(`${API_BASE_URL}/auth/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user?.email || 'Unknown Admin', action })
      })
    } catch (err) {
      console.error(err)
    }
  }

  const fetchShops = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/shops`)
      if (!response.ok) throw new Error('Không thể tải danh sách cửa hàng')
      const data = await response.json()
      setShops(data)
    } catch (err: any) {
      console.error(err)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/users`)
      if (res.ok) setUsers(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/products/categories`)
      const data = await res.json()
      setCategories(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadVouchers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/discounts?shopId=PLATFORM`)
      const data = await res.json()
      setPlatformVouchers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchFlashSales = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products/flash-sales`)
      if (res.ok) setFlashSales(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const fetchCsStaff = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/cs-staff`)
      if (res.ok) setCsStaff(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const loadAuditLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/audit-logs`)
      const data = await res.json()
      setAuditLogs(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadRevenue = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/orders`)
      if (response.ok) {
        const data = await response.json()
        setAllOrders(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadCommissionRate = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/payments/commission-rate`)
      if (res.ok) {
        const data = await res.json()
        setCommissionRate(data.rate)
      }
    } catch (err) {
      console.error('Error fetching commission rate:', err)
    }
  }

  useEffect(() => {
    if (activePortalTab === 'MANAGE_SHOPS') {
      fetchShops()
    } else if (activePortalTab === 'USERS') {
      fetchUsers()
    } else if (activePortalTab === 'CATEGORIES') {
      fetchCategories()
    } else if (activePortalTab === 'PLATFORM_VOUCHERS') {
      loadVouchers()
    } else if (activePortalTab === 'FLASH_SALE') {
      fetchFlashSales()
    } else if (activePortalTab === 'MANAGE_CS_STAFF') {
      fetchCsStaff()
    } else if (activePortalTab === 'AUDIT_LOGS') {
      loadAuditLogs()
    } else if (activePortalTab === 'SYSTEM_REPORTS') {
      fetchShops()
      fetchUsers()
      loadRevenue()
      loadCommissionRate()
    } else if (activePortalTab === 'COMMISSION_SETTING') {
      loadCommissionRate()
    }
  }, [activePortalTab])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      const parsed = getTabFromParam(tabParam)
      if (parsed) {
        setActivePortalTab(parsed)
      }
    }
  }, [searchParams])

  useEffect(() => {
    setSearchParams({ tab: getParamFromTab(activePortalTab) }, { replace: true })
  }, [activePortalTab, setSearchParams])

  const menuGroups = [
    {
      groupTitle: '🛡️ Bảo Mật & Phân Quyền',
      items: [
        { id: 'MANAGE_CS_STAFF', label: 'Nhân viên Platform CS', icon: '🎧' },
        { id: 'AUDIT_LOGS', label: 'Lịch sử thao tác (Audit)', icon: '📜' },
      ],
    },
    {
      groupTitle: '💰 Tài Chính & Doanh Thu Sàn',
      items: [
        { id: 'SYSTEM_REPORTS', label: 'Báo cáo hệ thống & GMV', icon: '📊' },
        { id: 'PRICE_ANALYTICS', label: 'Biến động & Giá vốn', icon: '📈' },
        { id: 'COMMISSION_SETTING', label: 'Cài đặt chiết khấu sàn', icon: '⚙️' },
      ],
    },
    {
      groupTitle: '⚙️ Thiết Lập Nền Tảng',
      items: [
        { id: 'CATEGORIES', label: 'Cây danh mục sàn', icon: '🗂️' },
        { id: 'PLATFORM_VOUCHERS', label: 'Voucher toàn sàn', icon: '🎟️' },
        { id: 'FLASH_SALE', label: 'Cấu hình giờ vàng Flash Sale', icon: '⚡' },
        { id: 'BANNERS', label: 'Quản Lý Banner Sàn', icon: '🖼️' },
        { id: 'MANAGE_SHOPS', label: 'Giám sát Shop cấp cao', icon: '🏪' },
        { id: 'USERS', label: 'Giám sát User cấp cao', icon: '👥' },
        { id: 'VIOLATIONS', label: 'Kiểm duyệt SP (Tổng quan)', icon: '📦' },
      ],
    },
    {
      groupTitle: '🔬 Phòng Thí Nghiệm AI',
      items: [
        { id: 'AI_EVALUATION', label: 'Đánh giá AI NCKH (Likert)', icon: '🔬' },
      ],
    },
  ]

  const menuItems = menuGroups.flatMap((g) => g.items)

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800 font-sans text-left selection:bg-emerald-600 selection:text-white">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 sticky top-0 h-screen z-20">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Logo Header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3 bg-white shrink-0">
            <span className="text-2xl">🛡️</span>
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-slate-800">
                Zero<span className="text-emerald-600">Mall</span>
              </span>
              <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase leading-none mt-0.5">
                Admin Control
              </span>
            </div>
          </div>

          {/* Navigation Links Grouped */}
          <div className="p-3 space-y-3 overflow-y-auto flex-1">
            {menuGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-0.5">
                <div className="px-3 py-1 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  {group.groupTitle}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActivePortalTab(item.id as any)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-extrabold transition cursor-pointer select-none ${
                      activePortalTab === item.id 
                        ? 'bg-emerald-50 text-emerald-700 font-black' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <span className="text-sm shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Account Info */}
        <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-emerald-600 text-xs shadow-3xs shrink-0">
              AD
            </div>
            <div className="flex flex-col overflow-hidden text-left">
              <span className="text-xs font-bold text-slate-800 truncate">{user?.name || 'Administrator'}</span>
              <span className="text-[10px] text-slate-400 font-semibold truncate">{user?.email || 'admin@zeromall.vn'}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full py-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 font-bold text-xs rounded-md transition shadow-3xs cursor-pointer"
          >
            Đăng xuất portal
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header Bar */}
        <header className="bg-white border-b border-slate-200/80 h-16 flex items-center justify-between px-8 z-10 sticky top-0 shadow-3xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trang quản trị /</span>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              {menuItems.find(m => m.id === activePortalTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const isSubdomain = window.location.hostname.endsWith('.zeromall.local')
                const buyerPort = window.location.port ? `:${window.location.port}` : ''
                const rawUser = localStorage.getItem('zm_user') || ''
                const rawToken = localStorage.getItem('zm_token') || ''
                const testShopId = '2ed31737-7ce2-4ed1-b32c-97f2c21d9988'
                if (isSubdomain) {
                  window.open(`${window.location.protocol}//zeromall.local${buyerPort}/shop/${testShopId}?sso_user=${encodeURIComponent(rawUser)}&sso_token=${encodeURIComponent(rawToken)}`, '_blank')
                } else {
                  window.open(`/shop/${testShopId}`, '_blank')
                }
              }}
              className="text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center gap-1.5 cursor-pointer px-3.5 py-1.5 rounded-lg shadow-3xs"
              title="Mở trực tiếp gian hàng ngoài Chợ kèm Thanh Điều Hành ZERO CONTROL"
            >
              <span>⚡</span> Trải nghiệm Thanh ZERO CONTROL
            </button>
            <button
              onClick={onBackToHome}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-500 transition flex items-center gap-1.5 cursor-pointer bg-emerald-50 border border-emerald-100 px-3.5 py-1.5 rounded-lg shadow-3xs"
            >
              <span>🏪</span> Xem giao diện Chợ ZeroMall
            </button>
          </div>
        </header>

        {/* Content Container */}
        <main className="p-8 flex-1">
          {activePortalTab === 'USERS' && (
            <UsersTab users={users} fetchUsers={fetchUsers} triggerAuditLog={triggerAuditLog} />
          )}

          {activePortalTab === 'MANAGE_SHOPS' && (
            <ShopsTab shops={shops} fetchShops={fetchShops} triggerAuditLog={triggerAuditLog} />
          )}

          {activePortalTab === 'CATEGORIES' && (
            <CategoriesTab categories={categories} fetchCategories={fetchCategories} triggerAuditLog={triggerAuditLog} />
          )}

          {activePortalTab === 'VIOLATIONS' && (
            <ProductModerationTab triggerAuditLog={triggerAuditLog} />
          )}

          {activePortalTab === 'PLATFORM_VOUCHERS' && (
            <PlatformVouchersTab platformVouchers={platformVouchers} fetchVouchers={loadVouchers} triggerAuditLog={triggerAuditLog} />
          )}

          {activePortalTab === 'FLASH_SALE' && (
            <FlashSaleTab flashSales={flashSales} fetchFlashSales={fetchFlashSales} triggerAuditLog={triggerAuditLog} />
          )}

          {activePortalTab === 'MANAGE_CS_STAFF' && (
            <CsStaffTab csStaff={csStaff} fetchCsStaff={fetchCsStaff} triggerAuditLog={triggerAuditLog} />
          )}

          {activePortalTab === 'LIVE_CHAT' && (
            <CsLiveChatTab user={user} />
          )}

          {activePortalTab === 'SYSTEM_REPORTS' && (
            <SystemReportsTab allOrders={allOrders} users={users} commissionRate={commissionRate} />
          )}

          {activePortalTab === 'PRICE_ANALYTICS' && (
            <AdminPriceAnalyticsTab />
          )}

          {activePortalTab === 'COMMISSION_SETTING' && (
            <CommissionSettingTab commissionRate={commissionRate} setCommissionRate={setCommissionRate} triggerAuditLog={triggerAuditLog} />
          )}

          {activePortalTab === 'AUDIT_LOGS' && (
            <AuditLogsTab auditLogs={auditLogs} />
          )}

          {activePortalTab === 'BANNERS' && (
            <BannersTab triggerAuditLog={triggerAuditLog} />
          )}

          {activePortalTab === 'AI_EVALUATION' && (
            <AiEvaluationStudioTab />
          )}
        </main>
      </div>
    </div>
  )
}
