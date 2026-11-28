import React, { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../../../config/api.config'
import { returnService, type ReturnData } from '../../../services/return.service'

// Child components
import { DriverBottomNav } from './DriverBottomNav'
import { DriverHomeTab } from './DriverHomeTab'
import { DriverOrdersTab } from './DriverOrdersTab'
import { DriverScanTab } from './DriverScanTab'
import { DriverWalletTab } from './DriverWalletTab'
import { DriverAccountTab } from './DriverAccountTab'
import { DriverDeliveryFailModal } from './DriverDeliveryFailModal'
import { DriverCheckInModal } from './DriverCheckInModal'
import { broadcastDriverGps, joinDriverPresence } from '../../../services/supabase-realtime.service'

// Re-export Shipment type for external consumers
export type { Shipment } from './DriverOrdersTab'

/* ──────────────────────────────────────────────
 * Shared types
 * ──────────────────────────────────────────────*/
export interface DriverAppViewProps {
  currentUser: any
  driverProfile: any
  hubs?: any[]
  shipments: Array<{
    id: string
    orderId: string
    trackingNumber: string
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
    codAmount: number
    status: string
    currentHub?: { name: string }
    package?: { weight: number; itemsSummary?: string }
    assignments?: Array<{
      id: string
      type: string
      status: string
      driverId?: string
      driver?: {
        id?: string
        name?: string
        phone?: string
        vehicleNumber?: string
      }
    }>
    trackingLogs: Array<{ status: string; title: string; description: string; timestamp: string }>
  }>
  onRefresh: () => void
  onUpdateStatus: (shipmentId: string, status: string, failureReason?: string, proofImage?: string) => Promise<void>
  actionLoading: boolean
  onLogout: () => void
  onBackToHome?: () => void
}

type TabKey = 'HOME' | 'ORDERS' | 'SCAN' | 'WALLET' | 'ACCOUNT'

/* ──────────────────────────────────────────────
 * DriverAppView — Orchestrator chính
 * Chỉ quản lý state, phân luồng tab,
 * và compose các child component.
 * ──────────────────────────────────────────────*/
export const DriverAppView: React.FC<DriverAppViewProps> = ({
  currentUser,
  driverProfile,
  hubs = [],
  shipments,
  onRefresh,
  onUpdateStatus,
  actionLoading,
  onLogout,
  onBackToHome,
}) => {
  // ── Navigation state ──
  const [activeTab, setActiveTab] = useState<TabKey>('HOME')
  const [ordersSubTab, setOrdersSubTab] = useState<'PICKUP' | 'DELIVERY' | 'HISTORY'>('PICKUP')

  // Hồ sơ tài xế tự phục hồi (Fallback trực tiếp từ API nếu props ban đầu chưa kịp nạp)
  const [localDriverProfile, setLocalDriverProfile] = useState<any>(driverProfile || null)

  useEffect(() => {
    if (driverProfile) {
      setLocalDriverProfile(driverProfile)
    } else {
      fetch(`${API_BASE_URL}/delivery/drivers`)
        .then((res) => res.json())
        .then((list: any[]) => {
          if (Array.isArray(list)) {
            const cleanPhone = (currentUser?.phoneNumber || '').replace(/[^0-9]/g, '')
            const found = list.find(
              (d) =>
                (d.userId && d.userId === currentUser?.id) ||
                (cleanPhone && (d.phone || '').replace(/[^0-9]/g, '') === cleanPhone) ||
                (d.hubId === currentUser?.hubId && d.name?.trim().toLowerCase() === currentUser?.name?.trim().toLowerCase())
            )
            if (found) {
              setLocalDriverProfile(found)
            }
          }
        })
        .catch((err) => console.error('Auto resolve driver profile error:', err))
    }
  }, [driverProfile, currentUser])

  const effectiveProfile = localDriverProfile || driverProfile
  const effectiveHubName =
    effectiveProfile?.hub?.name ||
    hubs.find((h: any) => h.id === (effectiveProfile?.hubId || currentUser?.hubId))?.name ||
    'Bưu Cục SPX'

  const [driverState, setDriverState] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE')
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [attendanceToday, setAttendanceToday] = useState<any>(null)
  const [returnPickups, setReturnPickups] = useState<ReturnData[]>([])
  const [holdingReturnTasks, setHoldingReturnTasks] = useState<ReturnData[]>([])

  // Modal Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên
  const [showFirstLoginPasswordModal, setShowFirstLoginPasswordModal] = useState<boolean>(() => {
    return !!currentUser?.mustChangePassword
  })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null)
  const [submittingPassword, setSubmittingPassword] = useState(false)

  const handleChangeFirstPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangePasswordError(null)

    if (newPassword.length < 6) {
      setChangePasswordError('Mật khẩu mới phải có ít nhất 6 ký tự!')
      return
    }

    if (newPassword === '123456') {
      setChangePasswordError('Vui lòng chọn mật khẩu khác mật khẩu mặc định 123456!')
      return
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError('Mật khẩu xác nhận không khớp!')
      return
    }

    setSubmittingPassword(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/users/${currentUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: '123456',
          newPassword,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || 'Không thể đổi mật khẩu')
      }

      alert('Đổi mật khẩu tài khoản thành công! Bạn có thể bắt đầu nhận ca làm việc.')

      // Cập nhật localStorage
      const stored = localStorage.getItem('delivery_user')
      if (stored) {
        try {
          const userObj = JSON.parse(stored)
          userObj.mustChangePassword = false
          localStorage.setItem('delivery_user', JSON.stringify(userObj))
        } catch {}
      }

      setShowFirstLoginPasswordModal(false)
    } catch (err: any) {
      setChangePasswordError(err.message || 'Lỗi đổi mật khẩu')
    } finally {
      setSubmittingPassword(false)
    }
  }

  // Helper: kiểm tra assignment có đúng là của tài xế đang đăng nhập hay không
  const isMyAssignment = useCallback(
    (a: any) => {
      if (!a) return false
      const prof = effectiveProfile
      const cleanPhone = (prof?.phone || currentUser?.phoneNumber || '').replace(/[^0-9]/g, '')
      const aDriverPhone = (a.driver?.phone || a.driverPhone || '').replace(/[^0-9]/g, '')

      if (prof?.id && (a.driverId === prof.id || a.driver?.id === prof.id)) return true
      if (cleanPhone && aDriverPhone && cleanPhone === aDriverPhone) return true
      return false
    },
    [effectiveProfile, currentUser]
  )

  // Kiểm tra đơn hoàn trả có thuộc phạm vi của tài xế đang đăng nhập hay không (để hiển thị tab Cần Lấy)
  const isReturnBelongToDriver = useCallback(
    (r: any) => {
      const shipment = r.shipment

      // 1. Nếu đơn đã có phân công trực tiếp cho tài xế này
      if (shipment?.assignments?.some((a: any) => isMyAssignment(a))) {
        return true
      }

      // 2. Nếu đơn thuộc cùng Bưu cục (Hub) của tài xế
      const driverHubId = effectiveProfile?.hubId || currentUser?.hubId
      if (driverHubId && shipment?.currentHubId && shipment.currentHubId === driverHubId) {
        return true
      }

      // 3. Khớp địa bàn phụ trách (Tỉnh/Thành phố hoặc Quận/Huyện)
      const driverProvince = (effectiveProfile?.assignedProvince || effectiveProfile?.hub?.province || '').trim().toLowerCase()
      const driverDistrict = (effectiveProfile?.assignedDistrict || effectiveProfile?.hub?.district || '').trim().toLowerCase()
      const buyerAddress = (shipment?.deliveryAddress || '').toLowerCase()

      if (driverProvince && buyerAddress) {
        const cleanDriverProv = driverProvince.replace(/^(thành phố|tỉnh)\s+/i, '').trim()
        if (cleanDriverProv && buyerAddress.includes(cleanDriverProv)) {
          if (driverDistrict) {
            const cleanDriverDist = driverDistrict.replace(/^(quận|huyện|thị xã|thành phố)\s+/i, '').trim()
            if (cleanDriverDist && buyerAddress.includes(cleanDriverDist)) {
              return true
            }
          }
          // Nếu đơn chưa gán bưu cục cụ thể mà cùng tỉnh thành
          if (!shipment?.currentHubId) {
            return true
          }
        }
      }

      return false
    },
    [effectiveProfile, currentUser, isMyAssignment]
  )

  // Kiểm tra kiện hàng hoàn trả này có ĐANG ĐƯỢC GIỮ TRÊN XE của chính tài xế này hay không
  const isHoldingReturnByMe = useCallback(
    (r: any) => {
      const shipment = r.shipment
      const prof = effectiveProfile
      const myId = prof?.id || ''
      const cleanPhone = (prof?.phone || currentUser?.phoneNumber || '').replace(/[^0-9]/g, '')
      const myName = (prof?.name || currentUser?.name || '').trim().toLowerCase()

      // 1. Phân công trực tiếp RETURN_PICKUP hoặc PICKUP còn đang active của tài xế này
      if (shipment?.assignments?.some((a: any) => isMyAssignment(a) && a.status !== 'COMPLETED')) {
        return true
      }

      // 2. Kiểm tra trackingLogs: log RETURN_IN_TRANSIT gần nhất có gắn driverId hoặc tên/SĐT tài xế này không
      if (Array.isArray(shipment?.trackingLogs)) {
        const transitLog = shipment.trackingLogs.find((t: any) => t.status === 'RETURN_IN_TRANSIT')
        if (transitLog) {
          if (myId && transitLog.driverId === myId) return true
          const logDesc = (transitLog.description || '').toLowerCase()
          if (cleanPhone && logDesc.includes(cleanPhone)) return true
          if (myName && logDesc.includes(myName)) return true
        }
      }

      // 3. Kiểm tra evidences: ghi chú lấy hàng có tên/SĐT tài xế này không
      if (Array.isArray(r.evidences)) {
        const pickedEvidence = r.evidences.find((e: any) => {
          const desc = (e.description || '').toLowerCase()
          return (cleanPhone && desc.includes(cleanPhone)) || (myName && desc.includes(myName))
        })
        if (pickedEvidence) return true
      }

      return false
    },
    [effectiveProfile, currentUser, isMyAssignment]
  )

  // Lấy danh sách các đơn Trả Hàng (Cần thu hồi & Đang giữ trên xe)
  const fetchReturnPickups = useCallback(async () => {
    try {
      const data = await returnService.getReturns()
      if (Array.isArray(data)) {
        // 1. Đơn cần đến nhà Người Mua để thu hồi (chỉ đơn thuộc phạm vi phụ trách của tài xế)
        setReturnPickups(
          data.filter(
            (r) =>
              r.status === 'RETURN_SHIPPING' &&
              r.resolution !== 'REFUND_ONLY' &&
              (r.returnMethod === 'ZMX_PICKUP' || !r.returnMethod) &&
              isReturnBelongToDriver(r)
          )
        )
        // 2. Đơn hoàn trả đã lấy từ khách, đang giữ trên xe chờ nhập kho Bưu Cục (chỉ đơn tài xế này đang giữ)
        setHoldingReturnTasks(
          data.filter(
            (r) =>
              r.status === 'RETURN_IN_TRANSIT' &&
              r.resolution !== 'REFUND_ONLY' &&
              (r.returnMethod === 'ZMX_PICKUP' || !r.returnMethod) &&
              isHoldingReturnByMe(r)
          )
        )
      }
    } catch (e) {
      console.warn('Cannot fetch return pickups for driver:', e)
    }
  }, [isReturnBelongToDriver, isHoldingReturnByMe])

  // Kiểm tra trạng thái điểm danh hôm nay từ backend
  const fetchAttendance = async () => {
    if (!driverProfile?.id) return
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/drivers/${driverProfile.id}/attendance-today`)
      if (res.ok) {
        const data = await res.json()
        setAttendanceToday(data.attendance)
        setDriverState(data.isCheckedIn ? 'ONLINE' : 'OFFLINE')
      }
    } catch (e) {
      console.error('Fetch attendance error:', e)
    }
  }

  useEffect(() => {
    fetchAttendance()
    fetchReturnPickups()
  }, [driverProfile?.id, fetchReturnPickups])

  // Theo dõi GPS và phát Broadcast lên kênh Supabase Realtime khi tài xế trực tuyến
  useEffect(() => {
    if (driverState !== 'ONLINE' || !driverProfile?.id) return

    const presence = joinDriverPresence({
      driverId: driverProfile.id,
      name: driverProfile.name || currentUser?.name || 'Shipper',
      phone: driverProfile.phone || '',
      hubId: driverProfile.hubId,
      vehicleType: driverProfile.vehicleType || 'MOTORBIKE',
      onlineAt: new Date().toISOString(),
    })

    let watchId: number | null = null
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          broadcastDriverGps({
            driverId: driverProfile.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading || undefined,
            speed: pos.coords.speed || undefined,
            timestamp: Date.now(),
          })
        },
        (err) => {
          console.warn('Realtime GPS Watch notice:', err.message)
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      )
    }

    return () => {
      presence.untrack()
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [driverState, driverProfile?.id])

  // Xử lý khi tài xế bấm xác nhận đã lấy hàng hoàn từ Người Mua
  const handleDriverConfirmReturnPickup = async (ret: ReturnData) => {
    if (!window.confirm(`Xác nhận bạn đã đến địa chỉ Người Mua và nhận bưu kiện hoàn trả #${ret.returnNumber}?`)) return
    try {
      const driverName = effectiveProfile?.name || currentUser?.name || 'ZMX'
      const driverPhone = effectiveProfile?.phone || currentUser?.phoneNumber || ''
      const res = await returnService.shipperConfirmPickup(ret.id, {
        driverId: effectiveProfile?.id,
        note: `Tài xế ${driverName} (${driverPhone}) đã thu hồi hàng hoàn tại nhà khách`,
      })
      alert(res.message || 'Xác nhận thu hồi hàng hoàn thành công!')
      fetchReturnPickups()
      onRefresh()
    } catch (e: any) {
      alert(e.message || 'Lỗi xác nhận thu hồi hàng hoàn')
    }
  }

  // Xử lý khi tài xế hoặc bưu cục hoàn tất bàn giao kiện hàng hoàn về Shop (hoặc test nhập kho)
  const handleDriverDeliverReturnToSeller = async (ret: ReturnData) => {
    if (!window.confirm(`[MÔ PHỎNG TEST] Xác nhận bưu kiện hoàn #${ret.returnTrackingNumber || ret.returnNumber} đã được bàn giao nhập kho Bưu Cục hoặc giao tới Người Bán?`)) return
    try {
      await returnService.markDeliveredToSeller(ret.id)
      alert('Đã xác nhận bàn giao hàng hoàn thành công!')
      fetchReturnPickups()
      onRefresh()
    } catch (e: any) {
      alert(e.message || 'Lỗi bàn giao hàng hoàn')
    }
  }

  const toggleOnlineStatus = () => {
    if (driverState === 'OFFLINE') {
      setShowCheckInModal(true)
    } else {
      handleCheckOut()
    }
  }

  // Kết thúc ca làm việc
  const handleCheckOut = async () => {
    if (!driverProfile?.id) return
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc ca làm việc hôm nay? Trạng thái sẽ chuyển về OFFLINE (Tạm nghỉ).')) return
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/drivers/${driverProfile.id}/check-out`, {
        method: 'POST',
      })
      if (res.ok) {
        setDriverState('OFFLINE')
        setAttendanceToday(null)
        onRefresh()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Điểm danh thành công
  const handleCheckInSuccess = (data: any) => {
    setDriverState('ONLINE')
    setAttendanceToday(data.attendance)
    onRefresh()
  }

  // Quét thủ công hàng đợi bưu cục
  const handleDrainQueue = async () => {
    const profId = effectiveProfile?.id || driverProfile?.id
    if (!profId) return
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/drivers/${profId}/drain-queue`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        alert(`Đã kiểm tra hàng đợi bưu cục: Đã phân công ${data.length || 0} đơn mới cho bạn.`)
        onRefresh()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // ── Delivery fail modal ──
  const [failModal, setFailModal] = useState<{ id: string; trackingNumber: string } | null>(null)

  const myShipments = shipments.filter((s) => s.assignments?.some(isMyAssignment))

  // 1. Đơn cần đi lấy tại Shop (First-Mile):
  // Phải có phân công PICKUP đang active (ASSIGNED / ACCEPTED / IN_PROGRESS) của chính tài xế này
  const pickupTasks = shipments.filter(
    (s) =>
      s.status !== 'CANCELLED' &&
      ['PICKUP_PENDING', 'PICKUP_ASSIGNED', 'PICKING_UP'].includes(s.status) &&
      s.assignments?.some(
        (a) =>
          a.type === 'PICKUP' &&
          ['ASSIGNED', 'IN_PROGRESS', 'ACCEPTED'].includes(a.status) &&
          a.status !== 'CANCELLED' &&
          isMyAssignment(a)
      )
  )

  // 1.1 Đơn đang giữ trên xe (Đã lấy từ Shop, đang chờ mang về Hub nhập kho)
  const holdingTasks = shipments.filter(
    (s) =>
      s.status !== 'CANCELLED' &&
      s.status === 'PICKED_UP' &&
      s.assignments?.some(
        (a) =>
          a.type === 'PICKUP' &&
          a.status !== 'CANCELLED' &&
          isMyAssignment(a)
      )
  )

  // 2. Đơn giao hàng Last-Mile:
  // CHỈ lấy các đơn mà tài xế này ĐƯỢC PHÂN CÔNG GIAO HÀNG (DELIVERY) và đang active!
  // Tuyệt đối không hiển thị nếu đơn được phân công cho tài xế bưu cục khác
  const deliveryTasks = shipments.filter(
    (s) =>
      s.status !== 'CANCELLED' &&
      ['DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY'].includes(s.status) &&
      s.assignments?.some(
        (a) =>
          a.type === 'DELIVERY' &&
          ['ASSIGNED', 'IN_PROGRESS', 'ACCEPTED'].includes(a.status) &&
          a.status !== 'CANCELLED' &&
          isMyAssignment(a)
      )
  )

  // 2.1 Đơn giao hàng đang giữ thực tế trên xe đi phát (OUT_FOR_DELIVERY)
  const activeDeliveryOnBikeCount = deliveryTasks.filter((s) => s.status === 'OUT_FOR_DELIVERY').length
  const holdingPickupCount = holdingTasks.length + holdingReturnTasks.length

  // 3. Đơn đã lấy hàng thành công bởi tài xế này (First-Mile: 8.000đ/đơn)
  const completedPickupTasks = shipments.filter(
    (s) =>
      s.status !== 'CANCELLED' &&
      ['PICKED_UP', 'AT_ORIGIN_HUB', 'SORTING', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(s.status) &&
      s.assignments?.some(
        (a) => a.type === 'PICKUP' && isMyAssignment(a)
      )
  )

  // 4. Đơn đã giao hàng thành công bởi tài xế này (Last-Mile: 8.000đ/đơn)
  const completedTasks = shipments.filter(
    (s) =>
      ['DELIVERED', 'COMPLETED'].includes(s.status) &&
      s.assignments?.some(
        (a) =>
          a.type === 'DELIVERY' &&
          (a.status === 'COMPLETED' || ['DELIVERED', 'COMPLETED'].includes(s.status)) &&
          isMyAssignment(a)
      )
  )

  // 5. Đơn giao thất bại bởi tài xế này
  const failedTasks = shipments.filter(
    (s) =>
      s.status === 'DELIVERY_FAILED' &&
      s.assignments?.some((a) => a.type === 'DELIVERY' && isMyAssignment(a))
  )

  // Tổng tiền COD tài xế đang giữ
  const codInWallet = completedTasks.reduce((sum, s) => sum + (s.codAmount || 0), 0)

  // Thu nhập tài xế theo chuẩn SPX Logistics: 8.000đ/lượt lấy + 8.000đ/lượt giao
  const pickupEarnings = completedPickupTasks.length * 8000
  const deliveryEarnings = completedTasks.length * 8000
  const driverEarnings = pickupEarnings + deliveryEarnings

  // Badge cho tab Đơn Hàng: Khi Offline thì ẩn badge (0) theo chuẩn SPX
  const ordersBadge =
    driverState === 'OFFLINE'
      ? 0
      : pickupTasks.length +
        holdingTasks.length +
        returnPickups.length +
        holdingReturnTasks.length +
        deliveryTasks.length

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center text-slate-800 font-sans selection:bg-emerald-600 selection:text-white">
      {/* Mobile Container */}
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-2xl border-x border-slate-200 relative">

        {/* ── App Header (gọn nhẹ) ── */}
        <div className="bg-emerald-600 text-white px-4 py-3 flex justify-between items-center sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">
              🛵
            </div>
            <div>
              <h2 className="font-bold text-sm leading-tight">{effectiveProfile?.name || currentUser?.name || 'Tài Xế'}</h2>
              <p className="text-[11px] text-emerald-100 font-mono">
                {effectiveProfile?.vehicleNumber ? `${effectiveProfile.vehicleNumber} • ` : ''}{effectiveHubName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onBackToHome && (
              <button
                onClick={onBackToHome}
                title="Về Trang Chủ Sàn ZeroMall"
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition cursor-pointer text-sm"
              >
                🛍️
              </button>
            )}
            <button
              onClick={onRefresh}
              title="Làm Mới Dữ Liệu"
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition cursor-pointer text-sm"
            >
              🔄
            </button>
          </div>
        </div>

        {/* ── Main Content (scrollable, trừ bottom nav) ── */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-24">

          {activeTab === 'HOME' && (
            <DriverHomeTab
              currentUser={currentUser}
              driverProfile={effectiveProfile}
              pickupCount={pickupTasks.length + returnPickups.length}
              holdingCount={holdingPickupCount + activeDeliveryOnBikeCount}
              holdingPickupCount={holdingPickupCount}
              holdingDeliveryCount={activeDeliveryOnBikeCount}
              deliveryCount={deliveryTasks.length}
              completedCount={completedTasks.length + completedPickupTasks.length}
              codInWallet={codInWallet}
              onToggleOnline={toggleOnlineStatus}
              driverState={driverState}
              onOpenCheckIn={() => setShowCheckInModal(true)}
              onCheckOut={handleCheckOut}
              attendanceToday={attendanceToday}
              onDrainQueue={handleDrainQueue}
              onViewHistory={() => {
                setActiveTab('ORDERS')
                setOrdersSubTab('HISTORY')
              }}
            />
          )}

          {activeTab === 'ORDERS' && (
            <DriverOrdersTab
              pickupTasks={pickupTasks}
              holdingTasks={holdingTasks}
              holdingReturnTasks={holdingReturnTasks}
              deliveryTasks={deliveryTasks}
              returnTasks={returnPickups}
              completedPickupTasks={completedPickupTasks}
              completedDeliveryTasks={completedTasks}
              failedDeliveryTasks={failedTasks}
              initialSubTab={ordersSubTab}
              onSubTabChange={(tab) => setOrdersSubTab(tab)}
              onConfirmReturnPickup={handleDriverConfirmReturnPickup}
              onDeliverReturnToSeller={handleDriverDeliverReturnToSeller}
              onUpdateStatus={onUpdateStatus}
              actionLoading={actionLoading}
              onShowFailModal={(s) => setFailModal({ id: s.id, trackingNumber: s.trackingNumber })}
              isOnline={driverState === 'ONLINE'}
              onOpenCheckIn={() => setShowCheckInModal(true)}
            />
          )}

          {activeTab === 'SCAN' && (
            <DriverScanTab
              currentUser={currentUser}
              driverProfile={effectiveProfile}
              shipments={shipments}
              onUpdateStatus={onUpdateStatus}
              onRefresh={onRefresh}
              actionLoading={actionLoading}
            />
          )}

          {activeTab === 'WALLET' && (
            <DriverWalletTab
              driverProfile={effectiveProfile}
              completedTasks={completedTasks.map((s) => ({
                id: s.id,
                trackingNumber: s.trackingNumber,
                buyerName: s.buyerName,
                codAmount: s.codAmount,
              }))}
              codInWallet={codInWallet}
              driverEarnings={driverEarnings}
              completedPickupCount={completedPickupTasks.length}
              completedDeliveryCount={completedTasks.length}
              pickupEarnings={pickupEarnings}
              deliveryEarnings={deliveryEarnings}
              onRefresh={onRefresh}
              onViewHistory={() => {
                setActiveTab('ORDERS')
                setOrdersSubTab('HISTORY')
              }}
            />
          )}

          {activeTab === 'ACCOUNT' && (
            <DriverAccountTab
              currentUser={currentUser}
              driverProfile={effectiveProfile}
              hubs={hubs}
              completedCount={completedTasks.length}
              totalOrders={myShipments.length}
              onLogout={onLogout}
            />
          )}

        </div>

        {/* ── Bottom Navigation Bar ── */}
        <DriverBottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ordersBadge={ordersBadge > 0 ? ordersBadge : undefined}
        />

      </div>

      {/* ── Modal: Giao Thất Bại ── */}
      {failModal && (
        <DriverDeliveryFailModal
          trackingNumber={failModal.trackingNumber}
          shipmentId={failModal.id}
          onClose={() => setFailModal(null)}
          onSubmit={(shipmentId, reason) => {
            onUpdateStatus(shipmentId, 'DELIVERY_FAILED', reason)
            setFailModal(null)
          }}
          actionLoading={actionLoading}
        />
      )}

      {/* ── Modal: Điểm Danh Ca Sáng (Check-in Camera & GPS) ── */}
      {showCheckInModal && (
        <DriverCheckInModal
          driverProfile={driverProfile}
          onClose={() => setShowCheckInModal(false)}
          onSuccess={handleCheckInSuccess}
        />
      )}

      {/* ── Modal Bắt Buộc Đổi Mật Khẩu Lần Đầu (First Login) ── */}
      {showFirstLoginPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs text-left animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-2xl font-black shadow-inner">
                🔐
              </div>
              <h3 className="text-base font-black text-slate-900">
                Đổi Mật Khẩu Lần Đầu Đăng Nhập
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Chào mừng tài xế <strong>{currentUser?.name || 'mới'}</strong>! Vì lý do an toàn tài khoản và đối soát ví COD, vui lòng thiết lập mật khẩu cá nhân mới của bạn trước khi bắt đầu nhận ca.
              </p>
            </div>

            <form onSubmit={handleChangeFirstPassword} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mật khẩu hiện tại (mặc định):
                </label>
                <input
                  type="password"
                  disabled
                  value="123456"
                  className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mật khẩu mới <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="password"
                  required
                  placeholder="Nhập ít nhất 6 ký tự..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Xác nhận mật khẩu mới <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="password"
                  required
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
              </div>

              {changePasswordError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-600 font-bold">
                  ⚠️ {changePasswordError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingPassword}
                className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-extrabold rounded-xl text-xs shadow-md transition cursor-pointer"
              >
                {submittingPassword ? 'Đang lưu...' : '✓ Xác Nhận & Bắt Đầu Nhận Ca'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
