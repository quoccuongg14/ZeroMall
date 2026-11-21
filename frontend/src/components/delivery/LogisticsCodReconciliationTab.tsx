import React, { useState, useMemo, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'

export interface Hub {
  id: string
  code: string
  name: string
  type: string
  address: string
  province: string
  district: string
  drivers?: any[]
  _count?: { shipments?: number; drivers?: number }
}

export interface Driver {
  id: string
  name: string
  phone: string
  vehicleNumber: string
  vehicleType: string
  status: string
  hubId?: string
  hub?: { id?: string; name: string; code?: string }
}

export interface Shipment {
  id: string
  orderId: string
  trackingNumber: string
  sellerId: string
  buyerName: string
  buyerPhone: string
  deliveryAddress: string
  declaredValue: number
  codAmount: number
  shippingFee: number
  status: string
  createdAt: string
  currentHubId?: string
  currentHub?: { id?: string; name: string; code: string }
  codTransaction?: {
    id: string
    status: string
    codAmount: number
    collectedAmount: number
    collectedAt?: string
    settledAt?: string
  }
  assignments?: Array<{
    id: string
    type: string
    status: string
    driver?: { id?: string; name: string; phone: string; vehicleNumber?: string }
  }>
}

export interface LogisticsCodReconciliationTabProps {
  shipments: Shipment[]
  hubs?: Hub[]
  drivers?: Driver[]
  onSelectShipment?: (shipment: Shipment) => void
}

const formatMoney = (val: number) => (val || 0).toLocaleString('vi-VN') + 'đ'

const cleanHubName = (name: string): string => {
  return (name || '')
    .replace(/^Trung Tâm Phân Loại\s+/i, '')
    .replace(/^Bưu Cục Giao Hàng\s+/i, '')
    .replace(/^Kho Trung Chuyển\s+/i, '')
    .replace(/^Bưu Cục\s+/i, '')
    .trim()
}

// Helper phân loại Hub vào Cụm Mega SOC chủ quản theo địa giới chuẩn TMĐT
export const getParentSoc = (hub: { province?: string; code?: string }) => {
  const p = (hub.province || '').toLowerCase()
  if (p.includes('hồ chí minh') || p.includes('đồng nai') || p.includes('bình dương')) {
    return { id: 'hub-hcm-01', code: 'HCM01', name: 'Trung Tâm Phân Loại Bắc Củ Chi SOC', shortName: 'Bắc Củ Chi SOC' }
  }
  if (p.includes('hà nội') || p.includes('hoà bình') || p.includes('hòa bình') || p.includes('bắc ninh')) {
    return { id: 'hub-hn-01', code: 'HN01', name: 'Trung Tâm Phân Loại Mê Linh SOC', shortName: 'Mê Linh SOC' }
  }
  if (p.includes('đà nẵng') || p.includes('quảng nam') || p.includes('huế')) {
    return { id: 'hub-dng-soc', code: 'DNG01', name: 'Trung Tâm Phân Loại Hòa Cầm SOC', shortName: 'Hòa Cầm SOC' }
  }
  return { id: 'hub-ct-soc', code: 'CT01', name: 'Trung Tâm Phân Loại Trà Nóc SOC', shortName: 'Trà Nóc SOC' }
}

// Helper khớp bưu kiện vào Bưu cục đích
export const matchShipmentToHub = (s: Shipment, allHubs: Hub[]): Hub | undefined => {
  const destHubs = allHubs.filter((h) => h.type !== 'SORTING_CENTER')
  if (destHubs.length === 0) return undefined

  if (s.currentHubId) {
    const direct = destHubs.find((h) => h.id === s.currentHubId)
    if (direct) return direct
  }
  if (s.currentHub?.code) {
    const directCode = destHubs.find((h) => h.code === s.currentHub?.code)
    if (directCode) return directCode
  }

  const driverName = (s.assignments?.[0]?.driver?.name || '').toLowerCase()
  if (driverName.includes('hòa bình')) return destHubs.find((h) => h.code === 'HB01')
  if (driverName.includes('biên hòa')) return destHubs.find((h) => h.code === 'DN01')
  if (driverName.includes('ninh kiều')) return destHubs.find((h) => h.code === 'NK01')
  if (driverName.includes('quận 1')) return destHubs.find((h) => h.code === 'Q01')
  if (driverName.includes('cầu giấy')) return destHubs.find((h) => h.code === 'CG01')

  const addr = (s.deliveryAddress || '').toLowerCase()
  if (addr.includes('hòa bình')) return destHubs.find((h) => h.code === 'HB01')
  if (addr.includes('biên hòa') || addr.includes('đồng nai')) return destHubs.find((h) => h.code === 'DN01')
  if (addr.includes('quận 1') || addr.includes('hai bà trưng') || addr.includes('phạm ngũ lão')) return destHubs.find((h) => h.code === 'Q01')
  if (addr.includes('thủ đức')) return destHubs.find((h) => h.code === 'TD01')
  if (addr.includes('an giang') || addr.includes('cần thơ') || addr.includes('ninh kiều')) return destHubs.find((h) => h.code === 'NK01')
  if (addr.includes('cầu giấy')) return destHubs.find((h) => h.code === 'CG01')
  if (addr.includes('đống đa')) return destHubs.find((h) => h.code === 'DD01')
  if (addr.includes('thanh xuân')) return destHubs.find((h) => h.code === 'TX01')
  if (addr.includes('đà nẵng') || addr.includes('hải châu')) return destHubs.find((h) => h.code === 'HC01')

  return destHubs.find((h) => h.code === 'TB01') || destHubs[0]
}

export const LogisticsCodReconciliationTab: React.FC<LogisticsCodReconciliationTabProps> = ({
  shipments,
  hubs = [],
  drivers = [],
  onSelectShipment,
}) => {
  // Chế độ xem: Thu Hồi Công Nợ Bưu Cục | Đối Soát Giải Ngân Shop | Sổ Kế Toán Chi Tiết
  const [activeTierView, setActiveTierView] = useState<'HUBS' | 'SELLERS' | 'PARCELS'>('HUBS')
  const [filter, setFilter] = useState<'ALL' | 'COLLECTING' | 'VAULT' | 'SETTLED'>('ALL')
  const [search, setSearch] = useState('')
  const [selectedHubFilter, setSelectedHubFilter] = useState<string>('ALL')
  // Mặc định lọc các Hub đang giữ tiền két cần thu hồi để Admin không bị phân tâm bởi các Hub 0đ
  const [hubStatusFilter, setHubStatusFilter] = useState<'ALL' | 'VAULT' | 'COLLECTING' | 'BALANCED'>('VAULT')

  // Phân trang sổ chi tiết kiện hàng
  const [parcelPage, setParcelPage] = useState<number>(1)
  const [parcelPageSize, setParcelPageSize] = useState<number>(20)

  // Drawer / Modal kiểm kê két sắt bưu cục
  const [selectedVaultHub, setSelectedVaultHub] = useState<any | null>(null)
  const [settlingHubId, setSettlingHubId] = useState<string | null>(null)
  const [locallySettledHubIds, setLocallySettledHubIds] = useState<string[]>([])

  // Quản trị giải ngân Người Bán (Shop Settlement)
  const [shops, setShops] = useState<any[]>([])
  const [locallySettledSellerIds, setLocallySettledSellerIds] = useState<string[]>([])
  const [settlingSellerId, setSettlingSellerId] = useState<string | null>(null)
  const [sellerSearch, setSellerSearch] = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/shops`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setShops(data)
      })
      .catch((err) => console.error('Error fetching shops for COD:', err))
  }, [])

  const shopMap = useMemo(() => {
    const map = new Map<string, any>()
    shops.forEach((s) => {
      if (s.id) map.set(s.id, s)
      if (s.ownerId) map.set(s.ownerId, s)
    })
    return map
  }, [shops])

  // Lọc chỉ lấy các đơn có thu COD và không bị hủy
  const codShipments = useMemo(() => {
    return shipments.filter((s) => s.status !== 'CANCELLED' && (s.codAmount || 0) > 0)
  }, [shipments])

  // Phân loại dòng tiền 3 chặng thời gian thực
  const { collectingShipments, vaultShipments, settledShipments, totalCollecting, totalVault, totalSettled, totalCodAll } = useMemo(() => {
    const collecting: Shipment[] = []
    const inVault: Shipment[] = []
    const settled: Shipment[] = []

    codShipments.forEach((s) => {
      const isDelivered = ['DELIVERED', 'COMPLETED'].includes(s.status)
      const matchedHub = matchShipmentToHub(s, hubs)
      const isHubLocallySettled = matchedHub ? locallySettledHubIds.includes(matchedHub.id) : false

      if (isDelivered) {
        if (s.codTransaction?.settledAt || s.codTransaction?.status === 'SETTLED' || isHubLocallySettled) {
          settled.push(s)
        } else {
          inVault.push(s)
        }
      } else {
        // Mọi đơn COD chưa giao xong (WAITING_PICKUP, PICKUP_ASSIGNED, PICKED_UP, SORTING, IN_TRANSIT, AT_DESTINATION_HUB, OUT_FOR_DELIVERY...)
        collecting.push(s)
      }
    })

    const tCollecting = collecting.reduce((sum, s) => sum + s.codAmount, 0)
    const tVault = inVault.reduce((sum, s) => sum + s.codAmount, 0)
    const tSettled = settled.reduce((sum, s) => sum + s.codAmount, 0)
    const tAll = codShipments.reduce((sum, s) => sum + s.codAmount, 0)

    return {
      collectingShipments: collecting,
      vaultShipments: inVault,
      settledShipments: settled,
      totalCollecting: tCollecting,
      totalVault: tVault,
      totalSettled: tSettled,
      totalCodAll: tAll,
    }
  }, [codShipments, hubs, locallySettledHubIds])

  // Danh sách các Bưu Cục vệ tinh (Destination Hubs) & Mega SOC
  const destinationHubs = useMemo(() => hubs.filter((h) => h.type !== 'SORTING_CENTER'), [hubs])
  const megaSocs = useMemo(() => hubs.filter((h) => h.type === 'SORTING_CENTER'), [hubs])

  // Tính toán số liệu COD theo từng Hub
  const hubCodBreakdown = useMemo(() => {
    return destinationHubs.map((hub) => {
      const parentSoc = getParentSoc(hub)
      const hubDrivers = drivers.filter((d) => d.hubId === hub.id)
      const hubShipments = codShipments.filter((s) => {
        const matched = matchShipmentToHub(s, hubs)
        return matched?.id === hub.id
      })

      const hubCollecting = hubShipments.filter((s) =>
        !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(s.status)
      )

      const isHubSettled = locallySettledHubIds.includes(hub.id)
      const hubVaultShipments = hubShipments.filter((s) =>
        ['DELIVERED', 'COMPLETED'].includes(s.status) &&
        !s.codTransaction?.settledAt &&
        s.codTransaction?.status !== 'SETTLED' &&
        !isHubSettled
      )
      const hubSettledShipments = hubShipments.filter((s) =>
        ['DELIVERED', 'COMPLETED'].includes(s.status) &&
        (Boolean(s.codTransaction?.settledAt) || s.codTransaction?.status === 'SETTLED' || isHubSettled)
      )

      const totalHubCod = hubShipments.reduce((sum, s) => sum + s.codAmount, 0)
      const collectingAmount = hubCollecting.reduce((sum, s) => sum + s.codAmount, 0)
      const vaultCashAmount = hubVaultShipments.reduce((sum, s) => sum + s.codAmount, 0)
      const remittedAmount = hubSettledShipments.reduce((sum, s) => sum + s.codAmount, 0)

      return {
        hub,
        parentSoc,
        driverCount: hubDrivers.length,
        shipmentCount: hubShipments.length,
        totalCod: totalHubCod,
        collectingAmount,
        vaultCashAmount,
        remittedAmount,
        hubShipments,
        hubCollecting,
        hubVaultShipments,
        hubSettledShipments,
        isOverLimit: vaultCashAmount > 20000000, // Cảnh báo két đọng trên 20 triệu
      }
    }).sort((a, b) => {
      // 1. Ưu tiên Bưu cục đang có tiền trong két cần thu nộp về sàn
      if (b.vaultCashAmount !== a.vaultCashAmount) return b.vaultCashAmount - a.vaultCashAmount
      // 2. Tiếp theo ưu tiên Bưu cục có tiền COD phát sinh / đang thu
      if (b.totalCod !== a.totalCod) return b.totalCod - a.totalCod
      // 3. Theo tên
      return a.hub.name.localeCompare(b.hub.name)
    })
  }, [destinationHubs, megaSocs, drivers, codShipments, hubs, locallySettledHubIds])

  // Lọc Hub theo bộ lọc trạng thái két
  const filteredHubs = useMemo(() => {
    return hubCodBreakdown.filter((item) => {
      if (hubStatusFilter === 'VAULT') return item.vaultCashAmount > 0
      if (hubStatusFilter === 'COLLECTING') return item.collectingAmount > 0
      if (hubStatusFilter === 'BALANCED') return item.vaultCashAmount === 0 && item.collectingAmount === 0
      return true
    })
  }, [hubCodBreakdown, hubStatusFilter])

  const hubsWithVaultCount = useMemo(() => hubCodBreakdown.filter((h) => h.vaultCashAmount > 0).length, [hubCodBreakdown])
  const hubsWithCollectingCount = useMemo(() => hubCodBreakdown.filter((h) => h.collectingAmount > 0).length, [hubCodBreakdown])
  const hubsBalancedCount = useMemo(() => hubCodBreakdown.filter((h) => h.vaultCashAmount === 0 && h.collectingAmount === 0).length, [hubCodBreakdown])

  // Tổng hợp đối soát dòng tiền theo từng Người Bán (Seller Settlement & Escrow Ledger)
  const sellerSettlements = useMemo(() => {
    const map = new Map<string, {
      sellerId: string
      shopName: string
      email?: string
      phone?: string
      totalShipments: number
      deliveredShipments: number
      grossCod: number
      deliveredCod: number
      collectingCod: number
      platformFee: number
      netPayable: number
      shipments: Shipment[]
      isSettled: boolean
    }>()

    codShipments.forEach((s) => {
      const sellerId = s.sellerId || 'unknown'
      const shop = shopMap.get(sellerId)
      const shopName = shop?.name || (sellerId === 'seller-test-01' ? 'Shop Thử Nghiệm ZMX' : `Shop #${sellerId.slice(0, 8)}`)
      const isDelivered = ['DELIVERED', 'COMPLETED'].includes(s.status)

      if (!map.has(sellerId)) {
        map.set(sellerId, {
          sellerId,
          shopName,
          email: shop?.email || `${sellerId.slice(0, 8)}@zeromall.vn`,
          phone: shop?.phoneNumber || '090xxxxxxx',
          totalShipments: 0,
          deliveredShipments: 0,
          grossCod: 0,
          deliveredCod: 0,
          collectingCod: 0,
          platformFee: 0,
          netPayable: 0,
          shipments: [],
          isSettled: false,
        })
      }

      const item = map.get(sellerId)!
      item.totalShipments += 1
      item.grossCod += s.codAmount
      item.shipments.push(s)

      if (isDelivered) {
        item.deliveredShipments += 1
        item.deliveredCod += s.codAmount
      } else {
        item.collectingCod += s.codAmount
      }
    })

    return Array.from(map.values()).map((item) => {
      const isLocallySettled = locallySettledSellerIds.includes(item.sellerId)
      // 5% phí hoa hồng dịch vụ Sàn thu trên doanh số COD giao thành công
      const platformFee = Math.round(item.deliveredCod * 0.05)
      const netPayable = Math.max(0, item.deliveredCod - platformFee)
      const isSettled = isLocallySettled || (item.deliveredShipments > 0 && item.shipments.every((s) => s.codTransaction?.status === 'SETTLED'))

      return {
        ...item,
        platformFee,
        netPayable,
        isSettled,
      }
    }).sort((a, b) => b.deliveredCod - a.deliveredCod)
  }, [codShipments, shopMap, locallySettledSellerIds])

  // Lọc danh sách Shop theo tìm kiếm
  const filteredSellerSettlements = useMemo(() => {
    if (!sellerSearch.trim()) return sellerSettlements
    const q = sellerSearch.toLowerCase()
    return sellerSettlements.filter(
      (s) =>
        s.shopName.toLowerCase().includes(q) ||
        s.sellerId.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
    )
  }, [sellerSettlements, sellerSearch])

  // Thao tác Kế toán / Admin duyệt giải ngân vào Ví Shop
  const handleSettleSeller = (sellerItem: any) => {
    if (sellerItem.deliveredCod <= 0) {
      alert(`Người bán "${sellerItem.shopName}" chưa có đơn COD giao thành công để giải ngân.`)
      return
    }

    const confirmMsg = `XÁC NHẬN GIẢI NGÂN VÍ DOANH THU SHOP:\n\n• Tên Shop: ${sellerItem.shopName}\n• Tổng tiền COD thu hộ: ${formatMoney(sellerItem.deliveredCod)} (${sellerItem.deliveredShipments} đơn)\n• Khấu trừ hoa hồng sàn (5%): -${formatMoney(sellerItem.platformFee)}\n• Số tiền thực chuyển vào Ví Shop: ${formatMoney(sellerItem.netPayable)}\n\nXác nhận chuyển tiền vào Ví Người Bán ngay bây giờ?`
    if (!window.confirm(confirmMsg)) return

    setSettlingSellerId(sellerItem.sellerId)
    setTimeout(() => {
      setLocallySettledSellerIds((prev) => [...prev, sellerItem.sellerId])
      setSettlingSellerId(null)
      alert(`✓ ĐÃ GIẢI NGÂN THÀNH CÔNG!\n\nĐã chuyển ${formatMoney(sellerItem.netPayable)} vào Ví Người Bán "${sellerItem.shopName}".\nSàn đã thu ${formatMoney(sellerItem.platformFee)} hoa hồng dịch vụ.`)
    }, 500)
  }

  // Thao tác Kế toán duyệt chốt két và nộp tiền từ Bưu cục về Sàn
  const handleSettleHubVault = (hubItem: any) => {
    if (hubItem.vaultCashAmount <= 0) {
      alert(`Két sắt của ${hubItem.hub.name} hiện không có tiền tồn chờ nộp.`)
      return
    }

    const confirmMsg = `XÁC NHẬN ĐỐI SOÁT & CHỐT NỘP KÉT:\n\n• Bưu cục: ${hubItem.hub.name}\n• Số tiền nộp: ${formatMoney(hubItem.vaultCashAmount)}\n• Số vận đơn: ${hubItem.hubVaultShipments.length} đơn\n\nXác nhận Trưởng bưu cục đã chuyển khoản đủ số tiền trên vào Tài khoản Ký Quỹ Escrow của Sàn?`
    if (!window.confirm(confirmMsg)) return

    setSettlingHubId(hubItem.hub.id)
    setTimeout(() => {
      setLocallySettledHubIds((prev) => [...prev, hubItem.hub.id])
      setSettlingHubId(null)
      if (selectedVaultHub && selectedVaultHub.hub.id === hubItem.hub.id) {
        setSelectedVaultHub(null)
      }
      alert(`✓ ĐÃ ĐỐI SOÁT THÀNH CÔNG!\n\nĐã hạch toán ${formatMoney(hubItem.vaultCashAmount)} từ Két sắt ${hubItem.hub.name} vào Tài khoản Ký Quỹ Escrow của Sàn. Sẵn sàng giải ngân ví Shop.`)
    }, 600)
  }

  // Xuất báo cáo đối soát ra định dạng CSV chuẩn
  const handleExportCsv = () => {
    let headers: string[] = []
    let rows: any[][] = []
    let fileName = ''

    if (activeTierView === 'SELLERS') {
      headers = ['Mã Shop', 'Tên Người Bán', 'Email', 'Số Điện Thoại', 'Tổng Đơn', 'Đã Giao', 'Tổng COD Phát Sinh (VND)', 'Đã Thu Thành Công (VND)', 'Hoa Hồng Sàn 5% (VND)', 'Thực Chuyển Ví Shop (VND)', 'Trạng Thái']
      rows = sellerSettlements.map((s) => [
        s.sellerId,
        `"${s.shopName}"`,
        s.email || '',
        s.phone || '',
        s.totalShipments,
        s.deliveredShipments,
        s.grossCod,
        s.deliveredCod,
        s.platformFee,
        s.netPayable,
        s.isSettled ? 'ĐÃ GIẢI NGÂN' : s.deliveredCod > 0 ? 'SẴN SÀNG GIẢI NGÂN' : 'ĐANG GIAO HÀNG',
      ])
      fileName = `Bao_Cao_Doi_Soat_Shop_ZeroMall_${new Date().toISOString().slice(0, 10)}.csv`
    } else if (activeTierView === 'PARCELS') {
      headers = ['Mã Vận Đơn', 'Mã Đơn Hàng', 'Shop Bán', 'Người Nhận', 'Số Điện Thoại', 'Địa Chỉ', 'Tiền COD (VND)', 'Trạng Thái Đơn']
      rows = displayedShipments.map((s) => [
        s.trackingNumber,
        s.orderId,
        `"${shopMap.get(s.sellerId)?.name || 'ZeroMall Shop'}"`,
        `"${s.buyerName}"`,
        s.buyerPhone,
        `"${s.deliveryAddress}"`,
        s.codAmount,
        s.status,
      ])
      fileName = `So_Ke_Toan_Van_Don_COD_ZeroMall_${new Date().toISOString().slice(0, 10)}.csv`
    } else {
      headers = ['Mã Trạm', 'Tên Bưu Cục', 'Cụm SOC Chủ Quản', 'Địa Bàn', 'Số Shipper', 'Tổng COD Phát Sinh (VND)', 'Đang Thu Ngoài Đường (VND)', 'Tiền Két Sắt Hub (VND)', 'Đã Nộp Về Sàn (VND)', 'Trạng Thái Két']
      rows = hubCodBreakdown.map((item) => [
        item.hub.code,
        item.hub.name,
        item.parentSoc.shortName,
        `"${item.hub.district}, ${item.hub.province}"`,
        item.driverCount,
        item.totalCod,
        item.collectingAmount,
        item.vaultCashAmount,
        item.remittedAmount,
        item.vaultCashAmount > 20000000 ? 'VƯỢT HẠN MỨC' : item.vaultCashAmount > 0 ? 'ĐANG GIỮ TIỀN' : 'CÂN BẰNG',
      ])
      fileName = `Bao_Cao_Cong_No_Két_Hub_ZeroExpress_${new Date().toISOString().slice(0, 10)}.csv`
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Lọc danh sách bưu kiện trong tab Sổ Kế Toán Chi Tiết
  const displayedShipments = useMemo(() => {
    return codShipments.filter((s) => {
      const isDelivered = ['DELIVERED', 'COMPLETED'].includes(s.status)
      const matchedHub = matchShipmentToHub(s, hubs)
      const isHubSettled = matchedHub ? locallySettledHubIds.includes(matchedHub.id) : false
      const isRemitted = Boolean(s.codTransaction?.settledAt) || s.codTransaction?.status === 'SETTLED' || isHubSettled

      if (filter === 'COLLECTING') {
        if (isDelivered) return false
      } else if (filter === 'VAULT') {
        if (!isDelivered || isRemitted) return false
      } else if (filter === 'SETTLED') {
        if (!isRemitted) return false
      }

      if (selectedHubFilter !== 'ALL') {
        if (matchedHub?.id !== selectedHubFilter) return false
      }

      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          s.trackingNumber.toLowerCase().includes(q) ||
          s.orderId.toLowerCase().includes(q) ||
          (s.buyerName && s.buyerName.toLowerCase().includes(q)) ||
          (s.buyerPhone && s.buyerPhone.includes(q)) ||
          (s.deliveryAddress && s.deliveryAddress.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [codShipments, filter, selectedHubFilter, search, hubs, locallySettledHubIds])

  // Phân trang danh sách bưu kiện
  const totalParcelPages = Math.ceil(displayedShipments.length / parcelPageSize) || 1
  const paginatedParcels = useMemo(() => {
    const startIndex = (parcelPage - 1) * parcelPageSize
    return displayedShipments.slice(startIndex, startIndex + parcelPageSize)
  }, [displayedShipments, parcelPage, parcelPageSize])

  // Tỷ trọng % dòng tiền để vẽ thanh tiến độ
  const collectingPct = totalCodAll > 0 ? Math.round((totalCollecting / totalCodAll) * 100) : 0
  const vaultPct = totalCodAll > 0 ? Math.round((totalVault / totalCodAll) * 100) : 0
  const settledPct = totalCodAll > 0 ? Math.round((totalSettled / totalCodAll) * 100) : 0

  return (
    <div className="space-y-6">
      {/* 1. Header Điều Hành Dòng Tiền Thu Hộ COD Chuẩn Enterprise */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-3xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl text-emerald-700 shadow-3xs">
              💵
            </span>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Đối Soát & Ký Quỹ Thu Hộ COD</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Escrow Central
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Kiểm soát dòng tiền mặt 3 chặng thời gian thực: Shipper ngoài đường ➔ Két sắt Bưu cục ➔ Tài khoản Ký quỹ Sàn & Trả ví Shop.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-3xs cursor-pointer"
            title="Xuất bảng đối soát số liệu các Bưu cục ra tệp Excel CSV"
          >
            <span>📊</span> Xuất Báo Cáo Sổ Quỹ (CSV)
          </button>
        </div>
      </div>

      {/* 2. Thẻ KPI Dòng Tiền 3 Chặng & Thanh Phân Bổ Tiến Độ */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-3xs space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Tổng COD */}
          <div className="bg-slate-50/80 border border-slate-200 p-4 rounded-2xl space-y-1">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>💰</span> Tổng Tiền COD Phát Sinh
            </span>
            <p className="text-2xl font-black text-slate-900 font-mono mt-0.5">{formatMoney(totalCodAll)}</p>
            <p className="text-[10px] text-slate-400 font-medium">
              Toàn bộ {codShipments.length} bưu kiện COD trên mạng lưới
            </p>
          </div>

          {/* Card 2: Công nợ tiền mặt cần thu hồi */}
          <div className="bg-rose-50/60 border border-rose-200/80 p-4 rounded-2xl space-y-1">
            <span className="text-[11px] text-rose-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>⚠️</span> Công Nợ Tiền Mặt Cần Thu Hồi
            </span>
            <p className="text-2xl font-black text-rose-600 font-mono mt-0.5">
              {formatMoney(totalVault + totalCollecting)}
            </p>
            <p className="text-[10px] text-rose-700/80 font-medium">
              {hubsWithVaultCount} Bưu cục giữ két ({formatMoney(totalVault)}) + Ngoài đường ({formatMoney(totalCollecting)})
            </p>
          </div>

          {/* Card 3: Tài khoản Ký Quỹ Sàn (Escrow Pool) */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-2xl space-y-1">
            <span className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>🏦</span> Tài Khoản Ký Quỹ Sàn (Escrow)
            </span>
            <p className="text-2xl font-black text-emerald-600 font-mono mt-0.5">
              {formatMoney(totalSettled)}
            </p>
            <p className="text-[10px] text-emerald-700/80 font-medium">
              {settledShipments.length} đơn tiền đã chuyển khoản nộp về Sàn
            </p>
          </div>

          {/* Card 4: Hoa hồng Sàn thu về (5%) */}
          <div className="bg-indigo-50/60 border border-indigo-200/80 p-4 rounded-2xl space-y-1">
            <span className="text-[11px] text-indigo-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>💎</span> Hoa Hồng Sàn Thu Về (5%)
            </span>
            <p className="text-2xl font-black text-indigo-600 font-mono mt-0.5">
              {formatMoney(Math.round(totalCodAll * 0.05))}
            </p>
            <p className="text-[10px] text-indigo-700/80 font-medium">
              Doanh thu hoa hồng dịch vụ Sàn khấu trừ từ đơn hàng
            </p>
          </div>
        </div>

        {/* Thanh phân bổ dòng tiền 3 chặng (Pipeline Distribution Bar) */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wide">
              Tiến Độ Thu Hồi & Giải Ngân Dòng Tiền:
            </span>
            <div className="flex items-center gap-4 text-[11px] font-bold">
              <span className="flex items-center gap-1.5 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                Ngoài đường: {collectingPct}%
              </span>
              <span className="flex items-center gap-1.5 text-rose-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                Két bưu cục: {vaultPct}%
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Đã nộp sàn: {settledPct}%
              </span>
            </div>
          </div>

          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div style={{ width: `${collectingPct}%` }} className="bg-amber-400 transition-all duration-500" title={`Ngoài đường: ${formatMoney(totalCollecting)}`} />
            <div style={{ width: `${vaultPct}%` }} className="bg-rose-500 transition-all duration-500" title={`Két bưu cục: ${formatMoney(totalVault)}`} />
            <div style={{ width: `${settledPct}%` }} className="bg-emerald-500 transition-all duration-500" title={`Đã nộp sàn: ${formatMoney(totalSettled)}`} />
          </div>
        </div>
      </div>

      {/* 3. Bộ Chuyển Đổi Phân Hệ Đối Soát: [Sổ Quỹ Bưu Cục] | [Cụm Mega SOC] | [Chi Tiết Kiện Hàng] */}
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTierView('HUBS')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTierView === 'HUBS'
                  ? 'bg-slate-900 text-white shadow-3xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>⚠️</span> Thu Hồi Công Nợ Bưu Cục ({hubsWithVaultCount} Hubs Đang Giữ Két)
            </button>

            <button
              onClick={() => setActiveTierView('SELLERS')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTierView === 'SELLERS'
                  ? 'bg-slate-900 text-white shadow-3xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>🛍️</span> Đối Soát & Giải Ngân Cho Shop ({sellerSettlements.length} Shops)
            </button>

            <button
              onClick={() => setActiveTierView('PARCELS')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTierView === 'PARCELS'
                  ? 'bg-slate-900 text-white shadow-3xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>📋</span> Sổ Kế Toán Chi Tiết Kiện Hàng ({codShipments.length})
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            Hạch toán đối soát tự động từ CSDL Logistics
          </span>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: SỔ QUỸ KÉT SẮT THEO TỪNG BƯU CỤC HUB (HUB CASHIER TABLE) */}
        {/* ========================================================================= */}
        {activeTierView === 'HUBS' && (
          <div>
            {/* Thanh lọc trạng thái két sắt bưu cục */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                  Lọc Két Sắt:
                </span>
                <button
                  type="button"
                  onClick={() => setHubStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    hubStatusFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-3xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>Tất Cả Hubs</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/60 text-slate-800 font-mono">
                    {hubCodBreakdown.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHubStatusFilter('VAULT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    hubStatusFilter === 'VAULT'
                      ? 'bg-rose-600 text-white shadow-3xs'
                      : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Có Tiền Trong Két</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-mono font-bold">
                    {hubsWithVaultCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHubStatusFilter('COLLECTING')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    hubStatusFilter === 'COLLECTING'
                      ? 'bg-amber-500 text-white shadow-3xs'
                      : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Đang Thu Ngoài Đường</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-mono font-bold">
                    {hubsWithCollectingCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHubStatusFilter('BALANCED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    hubStatusFilter === 'BALANCED'
                      ? 'bg-slate-700 text-white shadow-3xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>✓ Két Cân Bằng</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
                    {hubsBalancedCount}
                  </span>
                </button>
              </div>

              <span className="text-[11px] text-slate-400 font-medium">
                Ưu tiên vận hành: Két đọng tiền mặt ➔ Đang thu phát ➔ Cân bằng
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 min-w-60 whitespace-nowrap">Bưu Cục Hub & Địa Bàn</th>
                    <th className="py-3 px-3 text-center w-24 whitespace-nowrap">Shipper</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Tổng COD Phát Sinh</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Đang Thu Ngoài Đường</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Tiền Trong Két Hub</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Đã Nộp Về Sàn</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Trạng Thái Két</th>
                    <th className="py-3 px-4 text-right min-w-56 whitespace-nowrap">Thao Tác Két Sắt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHubs.map((item) => {
                    const hasVaultCash = item.vaultCashAmount > 0

                    return (
                      <tr key={item.hub.id} className="hover:bg-slate-50/80 transition">
                        {/* Bưu cục & SOC Chủ Quản */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>🏢</span>
                            <span className="font-black">{cleanHubName(item.hub.name)}</span>
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-mono border border-slate-200">
                              {item.hub.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 whitespace-nowrap">
                              <span>🏭</span> Trực thuộc: {item.parentSoc.shortName}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate max-w-xs" title={item.hub.address}>
                              {item.hub.district ? `${item.hub.district}, ` : ''}{item.hub.province}
                            </span>
                          </div>
                        </td>

                        {/* Shipper */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold inline-block">
                            🛵 {item.driverCount}
                          </span>
                        </td>

                        {/* Tổng COD */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                          {item.totalCod > 0 ? (
                            <>
                              <div>{formatMoney(item.totalCod)}</div>
                              <span className="text-[10px] text-slate-400 font-sans font-normal">{item.shipmentCount} kiện</span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0đ</span>
                          )}
                        </td>

                        {/* Đang thu ngoài đường */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-600 whitespace-nowrap">
                          {item.collectingAmount > 0 ? (
                            formatMoney(item.collectingAmount)
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0đ</span>
                          )}
                        </td>

                        {/* Tiền trong két Hub */}
                        <td className="py-3.5 px-4 text-right font-mono font-black text-sm whitespace-nowrap">
                          {hasVaultCash ? (
                            <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 inline-block font-mono">
                              {formatMoney(item.vaultCashAmount)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0đ</span>
                          )}
                        </td>

                        {/* Đã nộp sàn */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                          {item.remittedAmount > 0 ? (
                            formatMoney(item.remittedAmount)
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0đ</span>
                          )}
                        </td>

                        {/* Trạng thái két */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {item.isOverLimit ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse whitespace-nowrap">
                              ⚠️ Vượt Hạn Mức
                            </span>
                          ) : hasVaultCash ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                              🛡️ Đang Giữ Tiền
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 whitespace-nowrap">
                              ✓ Két Cân Bằng
                            </span>
                          )}
                        </td>

                        {/* Thao tác Quản trị két */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút Xem chi tiết két */}
                            <button
                              type="button"
                              onClick={() => setSelectedVaultHub(item)}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold transition text-xs flex items-center gap-1 cursor-pointer shadow-3xs whitespace-nowrap flex-shrink-0"
                              title="Mở sổ kiểm kê các vận đơn và tiền mặt trong két sắt này"
                            >
                              <span>🔍</span> Chi Tiết Két
                            </button>

                            {/* Nút Chốt nộp tiền về sàn nếu có tiền két */}
                            {hasVaultCash && (
                              <button
                                type="button"
                                disabled={settlingHubId === item.hub.id}
                                onClick={() => handleSettleHubVault(item)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition text-xs flex items-center gap-1 cursor-pointer shadow-3xs whitespace-nowrap flex-shrink-0"
                                title="Xác nhận bưu cục đã chuyển khoản tiền két về tài khoản Sàn"
                              >
                                <span>⚡</span> Chốt Nộp Sàn
                              </button>
                            )}

                            {/* Nút xem đơn */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedHubFilter(item.hub.id)
                                setActiveTierView('PARCELS')
                              }}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition text-xs font-semibold flex-shrink-0"
                              title="Lọc các bưu kiện của bưu cục này sang Sổ Kế Toán"
                            >
                              📦
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: ĐỐI SOÁT DÒNG TIỀN & GIẢI NGÂN CHO SHOP (SELLER SETTLEMENT LEDGER) */}
        {/* ========================================================================= */}
        {activeTierView === 'SELLERS' && (
          <div>
            {/* Top summary & search for Sellers */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={sellerSearch}
                    onChange={(e) => setSellerSearch(e.target.value)}
                    placeholder="Tìm theo tên Shop, email, SĐT..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                  <span className="absolute left-2.5 top-1.8 text-slate-400 text-xs">🔍</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    💰 COD Đã Thu: {formatMoney(sellerSettlements.reduce((sum, s) => sum + s.deliveredCod, 0))}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">
                    💎 Hoa Hồng Sàn (5%): {formatMoney(sellerSettlements.reduce((sum, s) => sum + s.platformFee, 0))}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                    🤝 Net Trả Shop: {formatMoney(sellerSettlements.reduce((sum, s) => sum + s.netPayable, 0))}
                  </span>
                </div>
              </div>

              <span className="text-[11px] text-slate-400 font-medium">
                Quy chuẩn: Tự động khấu trừ 5% hoa hồng dịch vụ Sàn trước khi giải ngân vào Ví Shop
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 min-w-64 whitespace-nowrap">Shop (Người Bán)</th>
                    <th className="py-3 px-3 text-center w-32 whitespace-nowrap">Số Đơn Hàng</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Tổng COD Thu Hộ</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Hoa Hồng Sàn (5%)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Thực Nhận Vào Ví Shop</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Trạng Thái Ký Quỹ</th>
                    <th className="py-3 px-4 text-right min-w-44 whitespace-nowrap">Thao Tác Kế Toán</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSellerSettlements.map((item) => {
                    const isDeliveredReady = item.deliveredCod > 0

                    return (
                      <tr key={item.sellerId} className="hover:bg-slate-50/80 transition">
                        {/* Thông tin Shop */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-xs">
                              🏪
                            </span>
                            <span className="font-black text-slate-900">{item.shopName}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span>SĐT: {item.phone || '090xxxxxxx'}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-400">ID: {item.sellerId.slice(0, 12)}...</span>
                          </div>
                        </td>

                        {/* Số đơn */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold inline-block">
                            {item.deliveredShipments} / {item.totalShipments} đơn giao
                          </span>
                        </td>

                        {/* Tổng COD Thu Hộ */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                          {item.grossCod > 0 ? (
                            <>
                              <div>{formatMoney(item.grossCod)}</div>
                              {item.collectingCod > 0 && (
                                <span className="text-[10px] text-amber-600 font-sans font-normal">
                                  ({formatMoney(item.collectingCod)} đang giao)
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0đ</span>
                          )}
                        </td>

                        {/* Hoa hồng sàn 5% */}
                        <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 whitespace-nowrap">
                          {item.platformFee > 0 ? (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                              +{formatMoney(item.platformFee)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0đ</span>
                          )}
                        </td>

                        {/* Thực nhận vào Ví Shop */}
                        <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-indigo-700 whitespace-nowrap">
                          {item.netPayable > 0 ? (
                            formatMoney(item.netPayable)
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0đ</span>
                          )}
                        </td>

                        {/* Trạng thái Ký quỹ */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {item.isSettled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Đã Giải Ngân Vào Ví
                            </span>
                          ) : isDeliveredReady ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              ⏳ Sẵn Sàng Giải Ngân
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                              🛵 Đang Đi Giao Hàng
                            </span>
                          )}
                        </td>

                        {/* Thao tác kế toán */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isDeliveredReady && !item.isSettled ? (
                              <button
                                type="button"
                                disabled={settlingSellerId === item.sellerId}
                                onClick={() => handleSettleSeller(item)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition text-xs flex items-center gap-1 cursor-pointer shadow-3xs whitespace-nowrap flex-shrink-0"
                                title="Giải ngân số tiền Net vào ví doanh thu của Shop"
                              >
                                <span>⚡</span> Giải Ngân Ví
                              </button>
                            ) : item.isSettled ? (
                              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                ✓ Hoàn tất
                              </span>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => {
                                setSearch(item.shopName)
                                setActiveTierView('PARCELS')
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition text-xs font-semibold flex-shrink-0"
                              title="Xem chi tiết các đơn hàng của Shop này"
                            >
                              📦
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: SỔ KẾ TOÁN CHI TIẾT KIỆN HÀNG COD */}
        {/* ========================================================================= */}
        {activeTierView === 'PARCELS' && (
          <div className="space-y-0">
            {/* Filter toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 bg-white">
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                {[
                  { id: 'ALL', label: `Tất Cả (${codShipments.length})` },
                  { id: 'COLLECTING', label: `🛵 Đang Giao Ngoài Tuyến (${collectingShipments.length})` },
                  { id: 'VAULT', label: `🏦 Trong Két Sắt Hub (${vaultShipments.length})` },
                  { id: 'SETTLED', label: `✅ Đã Nộp & Giải Ngân (${settledShipments.length})` },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setFilter(item.id as any)
                      setParcelPage(1)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      filter === item.id
                        ? 'bg-slate-900 text-white shadow-3xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Lọc theo Hub */}
                <select
                  value={selectedHubFilter}
                  onChange={(e) => {
                    setSelectedHubFilter(e.target.value)
                    setParcelPage(1)
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none"
                >
                  <option value="ALL">Toàn bộ Bưu Cục ({destinationHubs.length})</option>
                  {destinationHubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      [{h.code}] {cleanHubName(h.name)}
                    </option>
                  ))}
                </select>

                <div className="relative w-full sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setParcelPage(1)
                    }}
                    placeholder="Tìm mã ZMX, tên khách, SĐT..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 min-w-36 whitespace-nowrap">Mã Vận Đơn</th>
                    <th className="py-3 px-4 min-w-44 whitespace-nowrap">Shop (Người Bán)</th>
                    <th className="py-3 px-4 min-w-48 whitespace-nowrap">Khách Nhận & Địa Chỉ</th>
                    <th className="py-3 px-4 min-w-40 whitespace-nowrap">Bưu Cục Phụ Trách</th>
                    <th className="py-3 px-4 text-right min-w-28 whitespace-nowrap">Tiền Thu Hộ</th>
                    <th className="py-3 px-4 min-w-40 whitespace-nowrap">Shipper Thu Tiền</th>
                    <th className="py-3 px-4 text-center min-w-36 whitespace-nowrap">Trạng Thái Dòng Tiền</th>
                    <th className="py-3 px-4 text-right min-w-28 whitespace-nowrap">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedParcels.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                        Không có vận đơn COD nào phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    paginatedParcels.map((s) => {
                      const latestAssignment = s.assignments && s.assignments[0]
                      const isDelivered = ['DELIVERED', 'COMPLETED'].includes(s.status)
                      const matchedHub = matchShipmentToHub(s, hubs)
                      const isHubSettled = matchedHub ? locallySettledHubIds.includes(matchedHub.id) : false
                      const isRemitted = Boolean(s.codTransaction?.settledAt) || s.codTransaction?.status === 'SETTLED' || isHubSettled

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition">
                          {/* Mã đơn */}
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-800 space-y-0.5">
                            <div className="text-sm">{s.trackingNumber}</div>
                            <div className="text-[10px] text-slate-400 font-sans font-normal">
                              #{s.orderId}
                            </div>
                          </td>

                          {/* Shop Bán */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 text-xs block">
                              {shopMap.get(s.sellerId)?.name || (s.sellerId === 'seller-test-01' ? 'Shop Thử Nghiệm ZMX' : `Shop #${s.sellerId.slice(0, 8)}`)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {s.sellerId.slice(0, 8)}...
                            </span>
                          </td>

                          {/* Khách nhận */}
                          <td className="py-3.5 px-4 space-y-0.5 max-w-xs">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>{s.buyerName}</span>
                              <span className="text-slate-500 font-normal text-[11px]">({s.buyerPhone})</span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate" title={s.deliveryAddress}>
                              {s.deliveryAddress}
                            </p>
                          </td>

                          {/* Bưu cục phụ trách */}
                          <td className="py-3.5 px-4">
                            {matchedHub ? (
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-800 text-xs">
                                  {cleanHubName(matchedHub.name)}
                                </span>
                                <span className="px-1 py-0.2 rounded font-mono text-[9px] bg-slate-100 text-slate-600 block w-fit">
                                  {matchedHub.code}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Chưa xác định</span>
                            )}
                          </td>

                          {/* Tiền COD */}
                          <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-emerald-800">
                            {formatMoney(s.codAmount)}
                          </td>

                          {/* Shipper */}
                          <td className="py-3.5 px-4">
                            {latestAssignment?.driver ? (
                              <div className="space-y-0.5">
                                <div className="font-bold text-slate-800 text-xs">
                                  {latestAssignment.driver.name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {latestAssignment.driver.phone} • {latestAssignment.driver.vehicleNumber}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Chưa gán</span>
                            )}
                          </td>

                          {/* Trạng thái tiền */}
                          <td className="py-3.5 px-4 text-center">
                            {isRemitted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span>✅</span> Đã Nộp & Giải Ngân
                              </span>
                            ) : isDelivered ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                <span>🏦</span> Trong Két Sắt Hub
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <span>🛵</span> Đang Thu Trên Đường
                              </span>
                            )}
                          </td>

                          {/* Thao tác */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => onSelectShipment && onSelectShipment(s)}
                              className="px-2.5 py-1 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                              Lộ Trình ➔
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>

              {/* Phân trang bưu kiện */}
              {displayedShipments.length > 0 && (
                <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-600 font-medium">
                    <span>
                      Hiển thị <b>{(parcelPage - 1) * parcelPageSize + 1} - {Math.min(parcelPage * parcelPageSize, displayedShipments.length)}</b> trên tổng số <b>{displayedShipments.length}</b> vận đơn
                    </span>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1">
                      <span>Hiển thị:</span>
                      <select
                        value={parcelPageSize}
                        onChange={(e) => {
                          setParcelPageSize(Number(e.target.value))
                          setParcelPage(1)
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
                      >
                        <option value={10}>10 / trang</option>
                        <option value={20}>20 / trang</option>
                        <option value={50}>50 / trang</option>
                        <option value={100}>100 / trang</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={parcelPage <= 1}
                      onClick={() => setParcelPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition cursor-pointer"
                    >
                      ◀ Trước
                    </button>
                    <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-bold font-mono">
                      {parcelPage} / {totalParcelPages}
                    </span>
                    <button
                      type="button"
                      disabled={parcelPage >= totalParcelPages}
                      onClick={() => setParcelPage((p) => Math.min(totalParcelPages, p + 1))}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition cursor-pointer"
                    >
                      Sau ▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DRAWER / MODAL: KIỂM KÊ KÉT SẮT & ĐỐI SOÁT BƯU CỤC (HUB VAULT AUDIT DRAWER) */}
      {/* ========================================================================= */}
      {selectedVaultHub && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-2xl text-rose-700 shrink-0">
                  🏦
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>Sổ Két Sắt Bưu Cục: {selectedVaultHub.hub.name}</span>
                    <span className="px-2 py-0.5 rounded font-mono text-xs bg-slate-200 text-slate-800 font-bold">
                      {selectedVaultHub.hub.code}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Trực thuộc: {selectedVaultHub.parentSoc.name} • {selectedVaultHub.hub.district ? `${selectedVaultHub.hub.district}, ` : ''}{selectedVaultHub.hub.province}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedVaultHub(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center font-bold text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Thống kê tài chính của két */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Tiền Mặt Đang Trong Két</span>
                  <p className="text-xl font-black text-rose-600 font-mono">{formatMoney(selectedVaultHub.vaultCashAmount)}</p>
                  <span className="text-[10px] text-rose-700">{selectedVaultHub.hubVaultShipments.length} vận đơn đã thu</span>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Đang Thu Ngoài Đường</span>
                  <p className="text-xl font-black text-amber-600 font-mono">{formatMoney(selectedVaultHub.collectingAmount)}</p>
                  <span className="text-[10px] text-amber-700">{selectedVaultHub.hubCollecting.length} đơn shipper đang giao</span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Đã Nộp Sàn & Trả Ví</span>
                  <p className="text-xl font-black text-emerald-600 font-mono">{formatMoney(selectedVaultHub.remittedAmount)}</p>
                  <span className="text-[10px] text-emerald-700">{selectedVaultHub.hubSettledShipments.length} đơn an toàn</span>
                </div>
              </div>

              {/* Danh sách các đơn tiền mặt trong két */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Danh Sách Vận Đơn Thu Tiền Mặt Đang Nằm Trong Két Sắt ({selectedVaultHub.hubVaultShipments.length}):
                  </span>
                  {selectedVaultHub.vaultCashAmount > 0 && (
                    <button
                      type="button"
                      disabled={settlingHubId === selectedVaultHub.hub.id}
                      onClick={() => handleSettleHubVault(selectedVaultHub)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
                    >
                      <span>⚡</span> Xác Nhận Chốt Két Nộp Về Sàn
                    </button>
                  )}
                </div>

                {selectedVaultHub.hubVaultShipments.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                    Két sắt của bưu cục này hiện không có tiền mặt tồn đọng. Toàn bộ tiền COD đã được nộp về Sàn hoặc bưu cục chưa phát sinh đơn giao thành công.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Mã Vận Đơn</th>
                          <th className="py-2.5 px-3">Khách Nhận</th>
                          <th className="py-2.5 px-3">Shipper Thu Tiền</th>
                          <th className="py-2.5 px-3 text-right">Tiền Thu Mặt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedVaultHub.hubVaultShipments.map((s: Shipment) => {
                          const assignment = s.assignments && s.assignments[0]
                          return (
                            <tr key={s.id} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">
                                {s.trackingNumber}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-800">{s.buyerName}</span>
                                <span className="text-slate-400 text-[11px] block">{s.buyerPhone}</span>
                              </td>
                              <td className="py-2.5 px-3">
                                {assignment?.driver?.name || 'Shipper Bưu Cục'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-rose-600 text-sm">
                                {formatMoney(s.codAmount)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                Quy định an toàn két sắt SPX: Tiền mặt tại két không được vượt quá 20.000.000đ.
              </span>
              <button
                type="button"
                onClick={() => setSelectedVaultHub(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
