import React, { useState, useEffect, useMemo } from 'react'
import { API_BASE_URL } from '../../config/api.config'
import type { ReturnData } from '../../services/return.service'
import { ZeroMallLogoMark } from '../../components/common/ZeroMallLogo'

interface TrackingLog {
  id: string
  status: string
  title: string
  description: string
  location?: string
  timestamp: string
}

interface Shipment {
  id: string
  orderId: string
  trackingNumber: string
  sellerId: string
  buyerName: string
  buyerPhone: string
  deliveryAddress: string
  pickupAddress?: {
    id?: string
    name?: string
    contactName?: string
    phone?: string
    address?: string
    ward?: string
    district?: string
    province?: string
  }
  declaredValue: number
  codAmount: number
  shippingFee: number
  status: string
  createdAt: string
  currentHubId?: string
  currentHub?: { id?: string; name: string; code: string }
  package?: {
    weight: number
    itemsSummary?: string
    fragile: boolean
    liquid: boolean
  }
  assignments?: Array<{
    id: string
    type: string
    status: string
    driver: { name: string; phone: string; vehicleNumber: string }
  }>
  trackingLogs: TrackingLog[]
}

interface Driver {
  id: string
  name: string
  phone: string
  vehicleNumber: string
  vehicleType: string
  status: string
  hubId?: string
  hub?: { id?: string; name: string; code?: string }
}

interface Hub {
  id: string
  code: string
  name: string
  type: string
  address: string
  province: string
  district: string
  email?: string
}

import { DeliveryAuthForm } from '../../components/delivery/DeliveryAuthForm'
import { DriverAppView } from '../../components/delivery/driver/DriverAppView'
import { HubOperatorStation } from '../../components/delivery/HubOperatorStation'
import { AdminPortalLayout } from '../../components/delivery/admin/AdminPortalLayout'

interface DeliveryPortalProps {
  user?: any
  token?: string | null
  onAuthSuccess?: (user: any, token: string) => void
  onLogout?: () => void
  onBackToHome?: () => void
}

export const DeliveryPortal: React.FC<DeliveryPortalProps> = ({
  user: initialUser,
  token: initialToken,
  onAuthSuccess,
  onLogout,
  onBackToHome
}) => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<any>(() => {
    if (initialUser) return initialUser
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    if (params?.get('role') === 'admin' || params?.get('as') === 'admin') {
      const adminUser = {
        id: 'admin-logistics-01',
        name: 'Quản Trị Viên Vận Hành SPX',
        email: 'admin.logistics@spx.zeromall.vn',
        role: 'LOGISTICS_OPERATOR',
      }
      localStorage.setItem('delivery_user', JSON.stringify(adminUser))
      return adminUser
    }
    const saved = localStorage.getItem('delivery_user')
    if (!saved) return null
    try {
      return JSON.parse(saved)
    } catch {
      return null
    }
  })
  const [_token, setToken] = useState<string | null>(() => {
    return initialToken || localStorage.getItem('delivery_token') || null
  })

  const handleLoginSuccess = async (usr: any, tok: string) => {
    setCurrentUser(usr)
    setToken(tok)
    localStorage.setItem('delivery_user', JSON.stringify(usr))
    localStorage.setItem('delivery_token', tok)
    await fetchAllData()
    if (onAuthSuccess) onAuthSuccess(usr, tok)
  }

  const handleDeliveryLogout = () => {
    setCurrentUser(null)
    setToken(null)
    localStorage.removeItem('delivery_user')
    localStorage.removeItem('delivery_token')
    if (onLogout) onLogout()
  }

  const [shipments, setShipments] = useState<Shipment[]>([])
  const [returns, setReturns] = useState<ReturnData[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [hubs, setHubs] = useState<Hub[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [shipmentsRes, driversRes, hubsRes, returnsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/delivery/shipments`),
        fetch(`${API_BASE_URL}/delivery/drivers`),
        fetch(`${API_BASE_URL}/delivery/hubs`),
        fetch(`${API_BASE_URL}/delivery/returns`),
      ])

      if (shipmentsRes.ok) setShipments(await shipmentsRes.json())
      if (driversRes.ok) setDrivers(await driversRes.json())
      if (hubsRes.ok) setHubs(await hubsRes.json())
      if (returnsRes.ok) setReturns(await returnsRes.json())
    } catch (e) {
      console.error('Error loading logistics database:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [currentUser?.id])

  const handleUpdateStatus = async (
    shipmentId: string,
    status: string,
    failureReason?: string,
    proofImage?: string,
    hubId?: string,
    note?: string,
    linehaulData?: {
      truckNumber?: string
      truckDriver?: string
      truckDriverPhone?: string
      sealNumber?: string
      targetHubId?: string
    }
  ) => {
    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/shipments/${shipmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          failureReason,
          proofImage,
          hubId,
          note,
          ...(linehaulData || {}),
        }),
      })
      if (res.ok) {
        alert('Cập nhật trạng thái bưu kiện thành công!')
        await fetchAllData()
        if (selectedShipment && selectedShipment.id === shipmentId) {
          const updated = await res.json()
          setSelectedShipment(updated)
        }
      }
    } catch (e) {
      console.error(e)
      alert('Lỗi cập nhật chặng vận chuyển')
    } finally {
      setActionLoading(false)
    }
  }

  const isDriver = currentUser?.role === 'DRIVER'

  // Tìm Driver profile tương ứng trong CSDL (Hook chạy ở cấp cao nhất trước mọi câu lệnh return)
  const currentDriver = useMemo(() => {
    if (!currentUser) return null
    const cleanUserPhone = (currentUser.phoneNumber || '').replace(/[^0-9]/g, '')
    const userEmail = (currentUser.email || '').toLowerCase().trim()

    // 1. Khớp chính xác theo userId
    let found = drivers.find((d: any) => d.userId && d.userId === currentUser.id)
    if (found) return found

    // 2. Khớp theo số điện thoại chuẩn hóa
    if (cleanUserPhone) {
      found = drivers.find((d) => (d.phone || '').replace(/[^0-9]/g, '') === cleanUserPhone)
      if (found) return found
    }

    // 3. Khớp nếu driver có email hoặc phone trong email
    if (userEmail) {
      found = drivers.find((d: any) => {
        if (d.email && d.email.toLowerCase().trim() === userEmail) return true
        if (cleanUserPhone && userEmail.includes(cleanUserPhone)) return true
        return false
      })
      if (found) return found
    }

    // 4. Khớp theo hubId và tên nếu trùng
    if (currentUser.hubId && currentUser.name) {
      found = drivers.find(
        (d) =>
          d.hubId === currentUser.hubId &&
          d.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      )
      if (found) return found
    }

    return null
  }, [drivers, currentUser])

  // Bộ lọc dữ liệu theo Tab & Vai trò (DRIVER chỉ thấy đơn của mình và các đơn tại Hub của mình, OPERATOR/ADMIN thấy toàn sàn)
  const roleBaseShipments = useMemo(() => {
    if (!isDriver) return shipments
    return shipments.filter((s) => {
      if (s.status === 'CANCELLED') return false
      return (
        // 1. Đơn đã gán cho tài xế này
        s.assignments?.some((a) => 
          (a.driver?.phone === currentUser?.phoneNumber || 
          (currentDriver && (a.driver?.phone === currentDriver.phone || (a as any).driverId === currentDriver.id))) &&
          a.status !== 'CANCELLED'
        ) ||
        // 2. Đơn tại bưu cục đích của tài xế này (chờ quét nhận đi giao)
        (currentDriver && ['AT_DESTINATION_HUB', 'DELIVERY_ASSIGNED', 'IN_TRANSIT'].includes(s.status) && (s.currentHubId === currentDriver.hubId || !s.currentHubId)) ||
        // 3. Đơn cần lấy hàng thuộc bưu cục của tài xế này
        (currentDriver && ['CREATED', 'WAITING_PICKUP', 'PICKUP_ASSIGNED'].includes(s.status) && (s.currentHubId === currentDriver.hubId || !s.currentHubId))
      )
    })
  }, [isDriver, shipments, currentUser, currentDriver])

  // If not logged in as delivery staff/driver, show login form
  if (!currentUser) {
    return <DeliveryAuthForm onAuthSuccess={handleLoginSuccess} onBackToHome={onBackToHome || (() => {})} />
  }

  // Màn hình chờ khi đang đồng bộ dữ liệu trạm từ CSDL thực tế
  if (loading && hubs.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-700">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <h3 className="text-sm font-bold text-slate-800">Đang đồng bộ dữ liệu trạm vận hành ZeroExpress...</h3>
        <p className="text-xs text-slate-400 mt-1">Vui lòng chờ trong giây lát</p>
      </div>
    )
  }

  // 1. NẾU LÀ TÀI XẾ (DRIVER) -> HIỂN THỊ TRỰC TIẾP APP TÀI XẾ MOBILE
  if (currentUser.role === 'DRIVER') {
    return (
      <DriverAppView
        currentUser={currentUser}
        driverProfile={currentDriver}
        hubs={hubs}
        shipments={roleBaseShipments}
        onRefresh={fetchAllData}
        onUpdateStatus={handleUpdateStatus}
        actionLoading={actionLoading}
        onLogout={handleDeliveryLogout}
        onBackToHome={onBackToHome}
      />
    )
  }

  // 2. NẾU LÀ NHÂN VIÊN KHO (HUB_OPERATOR) -> HIỂN THỊ TRẠM PHÂN LOẠI & MÁY QUÉT CỦA BƯU CỤC ĐÓ
  if (currentUser.role === 'HUB_OPERATOR') {
    // Tự động tìm Hub phù hợp theo hubId / email thực tế từ CSDL
    const email = (currentUser?.email || '').toLowerCase().trim()
    const assignedHub = (() => {
      // 1. Ưu tiên khớp chính xác theo hubId gán trên tài khoản
      if (currentUser?.hubId) {
        const found = hubs.find((h) => h.id === currentUser.hubId)
        if (found) return found
      }
      // 2. Khớp chính xác theo email bưu cục
      if (email) {
        const found = hubs.find((h) => h.email && h.email.toLowerCase().trim() === email)
        if (found) return found
      }
      // 3. Khớp theo mã bưu cục (nếu email có chứa mã)
      const foundByCode = hubs.find((h) => h.code && email.includes(h.code.toLowerCase()))
      if (foundByCode) return foundByCode

      return null
    })()

    if (!assignedHub && !loading) {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-700">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-md w-full text-center space-y-4">
            <span className="text-4xl">🏢</span>
            <h3 className="text-base font-black text-slate-900">Chưa Gán Bưu Cục Vận Hành</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tài khoản <strong>{currentUser?.email}</strong> hiện chưa được liên kết với trạm bưu cục nào trong hệ thống ZeroExpress.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => fetchAllData()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                🔄 Đồng Bộ Lại
              </button>
              <button
                onClick={handleDeliveryLogout}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Đăng Xuất
              </button>
            </div>
          </div>
        </div>
      )
    }

    const isAssignedSoc = assignedHub?.type === 'SORTING_CENTER'

    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-emerald-600 selection:text-white flex flex-col justify-between text-left">
        <header className="bg-slate-900 text-white py-3.5 px-6 sm:px-12 sticky top-0 z-30 shadow-md">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3.5">
              <ZeroMallLogoMark size="lg" className="shadow-xs" />
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black tracking-tight text-white">
                    ZMX{' '}
                    <span className={isAssignedSoc ? 'text-indigo-400' : 'text-sky-400'}>
                      {isAssignedSoc ? 'Sorting Center' : 'Delivery Hub'}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider border ${
                      isAssignedSoc
                        ? 'text-indigo-300 bg-indigo-950 border-indigo-600'
                        : 'text-sky-300 bg-sky-950 border-sky-600'
                    }`}
                  >
                    {assignedHub?.name || (isAssignedSoc ? 'Trung Tâm Phân Loại' : 'Bưu Cục Giao Hàng')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  {isAssignedSoc ? 'Điều phối viên SOC:' : 'Nhân viên bưu cục:'}{' '}
                  <b>{currentUser?.name || currentUser?.email || 'Nhân viên'}</b> ({currentUser?.email || ''})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => fetchAllData()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>🔄</span> Làm Mới
              </button>
              <button
                onClick={handleDeliveryLogout}
                className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                🚪 Đăng Xuất
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
          <HubOperatorStation
            currentUser={currentUser}
            hubs={hubs}
            drivers={drivers}
            shipments={shipments}
            returns={returns}
            onRefresh={fetchAllData}
            onUpdateStatus={(shipmentId, status, failureReason, hubId, note, linehaulData) =>
              handleUpdateStatus(shipmentId, status, failureReason, undefined, hubId, note, linehaulData)
            }
            actionLoading={actionLoading}
            assignedHub={assignedHub || undefined}
            assignedHubId={assignedHub?.id}
            onSwitchUser={handleLoginSuccess}
          />
        </main>

        <footer className="bg-white border-t border-slate-200 py-3.5 text-center text-xs text-slate-400 font-medium">
          © 2026 ZeroExpress (ZMX) Logistics • {isAssignedSoc ? 'Hệ Thống Trung Tâm Phân Loại Tự Động SOC' : 'Mạng Lưới Bưu Cục Phát Giao Hàng Tận Nơi'} • {assignedHub?.name}
        </footer>
      </div>
    )
  }

  // 3. NẾU LÀ ĐIỀU PHỐI VIÊN CẤP CAO / ADMIN (LOGISTICS_OPERATOR / ADMIN) -> HIỂN THỊ CỔNG THÁP ĐIỀU HÀNH CHUYÊN NGHIỆP SPX CONTROL TOWER
  return (
    <AdminPortalLayout
      currentUser={currentUser}
      shipments={shipments as any}
      hubs={hubs as any}
      drivers={drivers as any}
      loading={loading}
      onRefresh={fetchAllData}
      onLogout={handleDeliveryLogout}
      onBackToHome={onBackToHome}
      onUpdateStatus={handleUpdateStatus}
    />
  )
}
