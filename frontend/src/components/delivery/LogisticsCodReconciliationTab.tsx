import React, { useState, useMemo } from 'react'

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
  // Chế độ xem: Phân cấp Hubs | Cụm Mega SOC | Sổ kế toán chi tiết
  const [activeTierView, setActiveTierView] = useState<'HUBS' | 'SOCS' | 'PARCELS'>('HUBS')
  const [filter, setFilter] = useState<'ALL' | 'COLLECTING' | 'VAULT' | 'SETTLED'>('ALL')
  const [search, setSearch] = useState('')
  const [selectedHubFilter, setSelectedHubFilter] = useState<string>('ALL')

  // Phân trang sổ chi tiết kiện hàng
  const [parcelPage, setParcelPage] = useState<number>(1)
  const [parcelPageSize, setParcelPageSize] = useState<number>(20)

  // Drawer / Modal kiểm kê két sắt bưu cục
  const [selectedVaultHub, setSelectedVaultHub] = useState<any | null>(null)
  const [settlingHubId, setSettlingHubId] = useState<string | null>(null)
  const [locallySettledHubIds, setLocallySettledHubIds] = useState<string[]>([])

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
      } else if (['OUT_FOR_DELIVERY', 'DELIVERY_ASSIGNED', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'SORTING', 'PICKED_UP', 'PICKUP_ASSIGNED'].includes(s.status)) {
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
        ['OUT_FOR_DELIVERY', 'DELIVERY_ASSIGNED', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'SORTING', 'PICKED_UP', 'PICKUP_ASSIGNED'].includes(s.status)
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
    })
  }, [destinationHubs, megaSocs, drivers, codShipments, hubs, locallySettledHubIds])

  // Tính toán số liệu COD theo từng Cụm Mega SOC
  const socClusters = useMemo(() => {
    return megaSocs.map((soc) => {
      const childHubs = hubCodBreakdown.filter((item) => item.parentSoc.id === soc.id || item.parentSoc.code === soc.code)
      const totalChildCod = childHubs.reduce((sum, item) => sum + item.totalCod, 0)
      const totalCollectingInCluster = childHubs.reduce((sum, item) => sum + item.collectingAmount, 0)
      const totalVaultInCluster = childHubs.reduce((sum, item) => sum + item.vaultCashAmount, 0)
      const totalRemittedInCluster = childHubs.reduce((sum, item) => sum + item.remittedAmount, 0)
      const totalShipments = childHubs.reduce((sum, item) => sum + item.shipmentCount, 0)

      return {
        soc,
        childHubs,
        totalChildHubs: childHubs.length,
        totalShipments,
        totalCod: totalChildCod,
        totalCollecting: totalCollectingInCluster,
        totalVault: totalVaultInCluster,
        totalRemitted: totalRemittedInCluster,
      }
    })
  }, [megaSocs, hubCodBreakdown])

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

  // Xuất báo cáo sổ quỹ COD ra định dạng CSV chuẩn
  const handleExportCsv = () => {
    const headers = ['Mã Trạm', 'Tên Bưu Cục', 'Cụm SOC Chủ Quản', 'Địa Bàn', 'Số Shipper', 'Tổng COD Phát Sinh (VND)', 'Đang Thu Ngoài Đường (VND)', 'Tiền Két Sắt Hub (VND)', 'Đã Nộp Về Sàn (VND)', 'Trạng Thái Két']
    const rows = hubCodBreakdown.map((item) => [
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

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Bao_Cao_Doi_Soat_COD_ZeroExpress_${new Date().toISOString().slice(0, 10)}.csv`)
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
        if (!['OUT_FOR_DELIVERY', 'DELIVERY_ASSIGNED', 'IN_TRANSIT', 'AT_DESTINATION_HUB', 'SORTING', 'PICKED_UP', 'PICKUP_ASSIGNED'].includes(s.status)) return false
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
  const settledPct = totalCodAll > 0 ? Math.max(0, 100 - collectingPct - vaultPct) : 0

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

          {/* Card 2: Đang Thu Trên Đường */}
          <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-2xl space-y-1">
            <span className="text-[11px] text-amber-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>🛵</span> Đang Thu Ngoài Đường
            </span>
            <p className="text-2xl font-black text-amber-600 font-mono mt-0.5">{formatMoney(totalCollecting)}</p>
            <p className="text-[10px] text-amber-700/80 font-medium">
              {collectingShipments.length} đơn shipper đang giao tận tay khách
            </p>
          </div>

          {/* Card 3: Trong Két Sắt Hub */}
          <div className="bg-rose-50/60 border border-rose-200/80 p-4 rounded-2xl space-y-1">
            <span className="text-[11px] text-rose-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>🏦</span> Tiền Trong Két Sắt Hub
            </span>
            <p className="text-2xl font-black text-rose-600 font-mono mt-0.5">{formatMoney(totalVault)}</p>
            <p className="text-[10px] text-rose-700/80 font-medium">
              {vaultShipments.length} đơn tiền mặt tại quầy chờ nộp Sàn
            </p>
          </div>

          {/* Card 4: Đã Nộp & Giải Ngân */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-2xl space-y-1">
            <span className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>✅</span> Đã Nộp Ký Quỹ & Trả Ví
            </span>
            <p className="text-2xl font-black text-emerald-600 font-mono mt-0.5">{formatMoney(totalSettled)}</p>
            <p className="text-[10px] text-emerald-700/80 font-medium">
              {settledShipments.length} đơn đã chốt an toàn vào Ví Shop
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
              <span>🏢</span> Sổ Quỹ Két Sắt Từng Bưu Cục ({destinationHubs.length} Hubs)
            </button>

            <button
              onClick={() => setActiveTierView('SOCS')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTierView === 'SOCS'
                  ? 'bg-slate-900 text-white shadow-3xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>🏭</span> Báo Cáo Theo Cụm Mega SOC ({megaSocs.length})
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 min-w-56">Bưu Cục Hub & Địa Bàn</th>
                  <th className="py-3 px-4 text-center min-w-28">Shipper</th>
                  <th className="py-3 px-4 text-right min-w-36">Tổng COD Phát Sinh</th>
                  <th className="py-3 px-4 text-right min-w-36">Đang Thu Ngoài Đường</th>
                  <th className="py-3 px-4 text-right min-w-36">Tiền Trong Két Hub</th>
                  <th className="py-3 px-4 text-right min-w-36">Đã Nộp Về Sàn</th>
                  <th className="py-3 px-4 text-center min-w-32">Trạng Thái Két</th>
                  <th className="py-3 px-4 text-right min-w-52">Quản Trị Két Sắt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hubCodBreakdown.map((item) => {
                  const hasVaultCash = item.vaultCashAmount > 0

                  return (
                    <tr key={item.hub.id} className="hover:bg-slate-50/80 transition">
                      {/* Bưu cục & SOC Chủ Quản */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <span>🏢</span>
                          <span className="font-black">{cleanHubName(item.hub.name)}</span>
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-mono border border-slate-200">
                            {item.hub.code}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <span>🏭</span> Trực thuộc: {item.parentSoc.shortName}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate max-w-xs" title={item.hub.address}>
                            {item.hub.district ? `${item.hub.district}, ` : ''}{item.hub.province}
                          </span>
                        </div>
                      </td>

                      {/* Shipper */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                          🛵 {item.driverCount}
                        </span>
                      </td>

                      {/* Tổng COD */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-xs">
                        {item.totalCod > 0 ? (
                          <>
                            <div>{formatMoney(item.totalCod)}</div>
                            <span className="text-[10px] text-slate-400 font-sans font-normal">{item.shipmentCount} kiện</span>
                          </>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Đang thu ngoài đường */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-600">
                        {item.collectingAmount > 0 ? formatMoney(item.collectingAmount) : <span className="text-slate-300 font-sans">-</span>}
                      </td>

                      {/* Tiền trong két Hub */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-sm">
                        {hasVaultCash ? (
                          <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 inline-block">
                            {formatMoney(item.vaultCashAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-sans text-xs">-</span>
                        )}
                      </td>

                      {/* Đã nộp sàn */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {item.remittedAmount > 0 ? formatMoney(item.remittedAmount) : <span className="text-slate-300 font-sans">-</span>}
                      </td>

                      {/* Trạng thái két */}
                      <td className="py-3.5 px-4 text-center">
                        {item.isOverLimit ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            ⚠️ Vượt Hạn Mức
                          </span>
                        ) : hasVaultCash ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            🛡️ Đang Giữ Tiền
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            ✓ Két Cân Bằng
                          </span>
                        )}
                      </td>

                      {/* Thao tác Quản trị két */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Xem chi tiết két */}
                          <button
                            type="button"
                            onClick={() => setSelectedVaultHub(item)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold transition text-xs flex items-center gap-1 cursor-pointer shadow-3xs"
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
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition text-xs flex items-center gap-1 cursor-pointer shadow-3xs"
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
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition text-xs font-semibold"
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
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: GIÁM SÁT THEO CỤM VÙNG MEGA SOC */}
        {/* ========================================================================= */}
        {activeTierView === 'SOCS' && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {socClusters.map((c) => (
              <div
                key={c.soc.id}
                className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏭</span>
                      <h4 className="font-black text-slate-900 text-base">{c.soc.name}</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Mã trạm: <b className="font-mono text-slate-700">{c.soc.code}</b> • Khu vực: {c.soc.province}
                    </p>
                  </div>

                  <span className="px-3 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-full text-xs font-bold">
                    {c.totalChildHubs} Hubs Vệ Tinh
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl space-y-1 border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-bold uppercase">Tổng COD Qua Cụm</span>
                    <p className="text-lg font-black text-slate-900 font-mono">{formatMoney(c.totalCod)}</p>
                    <span className="text-[10px] text-slate-400">{c.totalShipments} bưu kiện</span>
                  </div>

                  <div className="bg-amber-50/50 p-3 rounded-2xl space-y-1 border border-amber-200">
                    <span className="text-[11px] text-amber-800 font-bold uppercase">Đang Thu Ngoài Tuyến</span>
                    <p className="text-lg font-black text-amber-600 font-mono">{formatMoney(c.totalCollecting)}</p>
                    <span className="text-[10px] text-amber-700">Shipper đang giao</span>
                  </div>

                  <div className="bg-rose-50/50 p-3 rounded-2xl space-y-1 border border-rose-200">
                    <span className="text-[11px] text-rose-800 font-bold uppercase">Tiền Trong Két Các Hub</span>
                    <p className="text-lg font-black text-rose-600 font-mono">{formatMoney(c.totalVault)}</p>
                    <span className="text-[10px] text-rose-700">Chờ nộp về tài khoản sàn</span>
                  </div>

                  <div className="bg-emerald-50/50 p-3 rounded-2xl space-y-1 border border-emerald-200">
                    <span className="text-[11px] text-emerald-800 font-bold uppercase">Đã Nộp & Giải Ngân</span>
                    <p className="text-lg font-black text-emerald-600 font-mono">{formatMoney(c.totalRemitted)}</p>
                    <span className="text-[10px] text-emerald-700">Đã chốt sổ an toàn</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                  <span>Mạng lưới các bưu cục con:</span>
                  <span className="font-bold text-sky-800">
                    {c.childHubs.map((h) => cleanHubName(h.hub.name)).join(', ') || 'Chưa gán bưu cục'}
                  </span>
                </div>
              </div>
            ))}
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
                    <th className="py-3 px-4 min-w-36">Mã Vận Đơn</th>
                    <th className="py-3 px-4 min-w-48">Khách Nhận & Địa Chỉ</th>
                    <th className="py-3 px-4 min-w-40">Bưu Cục Phụ Trách</th>
                    <th className="py-3 px-4 text-right min-w-28">Tiền Thu Hộ</th>
                    <th className="py-3 px-4 min-w-40">Shipper Thu Tiền</th>
                    <th className="py-3 px-4 text-center min-w-36">Trạng Thái Dòng Tiền</th>
                    <th className="py-3 px-4 text-right min-w-28">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedParcels.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
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
