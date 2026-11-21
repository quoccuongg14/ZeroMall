import React, { useState, useMemo, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'
import { LinehaulDispatchModal } from './LinehaulDispatchModal'
import { LinehaulInboundReconciliationModal } from './LinehaulInboundReconciliationModal'
import { LastMileDispatchModal } from './LastMileDispatchModal'
import { HubDockTruckList } from './HubDockTruckList'

import type {
  Shipment,
  StationTab,
  HubOperatorStationProps,
  LinehaulTrip,
  Hub,
} from './hub/types'
import {
  extractLinehaulInfo,
  isDestinedForCurrentHub,
} from './hub/helpers'
import { useHubDockTrucks } from './hub/useHubDockTrucks'
import { useHubDispatchModals } from './hub/useHubDispatchModals'
import { useHubScanner } from './hub/useHubScanner'
import { HubPipelineTabs } from './hub/HubPipelineTabs'
import { HubScannerBar } from './hub/HubScannerBar'
import { HubLinehaulTripsBanner } from './hub/HubLinehaulTripsBanner'
import { DockTruckQuickSealModal } from './hub/DockTruckQuickSealModal'
import { HubParcelTable } from './hub/HubParcelTable'
import { HubCashierDesk } from './hub/HubCashierDesk'
import { SocDashboard } from './hub/SocDashboard'
import { HubCreateEditModal } from './HubCreateEditModal'
import { DriverCreateModal } from './hub/DriverCreateModal'
import { HubDriversManageModal } from './hub/HubDriversManageModal'

export const HubOperatorStation: React.FC<HubOperatorStationProps> = ({
  currentUser,
  hubs,
  drivers = [],
  shipments,
  returns = [],
  onRefresh,
  onUpdateStatus,
  actionLoading,
  assignedHubId,
  assignedHub,
  onSwitchUser,
}) => {
  const [assignedNotification, setAssignedNotification] = useState<{
    shipmentTrackingNumber: string
    orderId: string
    buyerAddress: string
    hubName: string
    hubCode: string
    driverName: string
    driverPhone: string
    vehicleNumber: string
    driverEmail: string
    driverUserId: string
  } | null>(null)
  const currentHub = useMemo(() => {
    if (assignedHub) return assignedHub
    if (assignedHubId) {
      const found = hubs.find((h) => h.id === assignedHubId)
      if (found) return found
    }
    const email = (currentUser?.email || '').toLowerCase().trim()
    if (email) {
      const matchedByEmail = hubs.find((h) => h.email && h.email.toLowerCase().trim() === email)
      if (matchedByEmail) return matchedByEmail
    }
    if (currentUser?.hubId) {
      const matchedByHubId = hubs.find((h) => h.id === currentUser.hubId)
      if (matchedByHubId) return matchedByHubId
    }
    return hubs[0] || null
  }, [assignedHub, assignedHubId, currentUser, hubs])

  const isSoc = currentHub?.type === 'SORTING_CENTER'

  const [stationTab, setStationTab] = useState<StationTab>(() => {
    const isSocHub = currentHub?.type === 'SORTING_CENTER'
    return isSocHub ? 'INBOUND_RECEIVING' : 'INBOUND_PICKUP'
  })
  const [searchFilter, setSearchFilter] = useState('')

  // Tự động chuyển tab phù hợp khi đổi loại Hub (SOC vs HUB)
  useEffect(() => {
    if (isSoc) {
      if (stationTab === 'DISPATCH_LASTMILE' || stationTab === 'HUB_CASHIER' || stationTab === 'INBOUND_PICKUP') {
        setStationTab('INBOUND_RECEIVING')
      }
    } else {
      if (stationTab === 'SOC_DASHBOARD' || stationTab === 'INBOUND_RECEIVING' || stationTab === 'SORTING_LINEHAUL') {
        setStationTab('INBOUND_PICKUP')
      }
    }
  }, [isSoc, currentHub?.id])

  // Modal Tuyển / Thêm tài xế mới cho Bưu cục hoặc Xe tải cho SOC
  const [isAddDriverModalOpen, setIsAddDriverModalOpen] = useState(false)
  const [driverModalVehicleType, setDriverModalVehicleType] = useState<'MOTORBIKE' | 'VAN' | 'TRUCK'>('MOTORBIKE')
  const [isAddHubModalOpen, setIsAddHubModalOpen] = useState(false)
  const [editingHub, setEditingHub] = useState<Hub | null>(null)
  const [isDriversManageModalOpen, setIsDriversManageModalOpen] = useState(false)

  // Danh sách shipper phụ trách bưu cục hiện tại
  const hubDrivers = useMemo(() => {
    if (!currentHub) return []
    return (drivers || []).filter(
      (d) => (d.hubId === currentHub.id || d.hub?.id === currentHub.id) && d.vehicleType !== 'TRUCK'
    )
  }, [drivers, currentHub])

  // Xóa Bưu cục con trực thuộc SOC
  const handleDeleteChildHub = async (hub: Hub) => {
    const confirmMsg = `Bạn có chắc chắn muốn xóa Bưu cục con [${hub.name}] (${hub.code}) khỏi hệ thống?\n\nLưu ý: Bưu cục chỉ có thể xóa khi không còn kiện hàng tồn và không còn tài xế trực thuộc.`
    if (!window.confirm(confirmMsg)) return

    try {
      const res = await fetch(`${API_BASE_URL}/delivery/hubs/${hub.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || 'Không thể xóa bưu cục')
      }
      alert(`Đã xóa bưu cục [${hub.name}] thành công!`)
      onRefresh()
    } catch (err: any) {
      alert(`Lỗi xóa bưu cục: ${err.message || 'Đã có lỗi xảy ra'}`)
    }
  }

  // 1. Nhận Từ Shipper
  const pickupInboundList = useMemo(
    () => shipments.filter((s) => s.status === 'PICKED_UP' && s.currentHubId === currentHub?.id),
    [shipments, currentHub]
  )

  // 1.1 Hàng Hoàn Chờ Bàn Giao Từ Shipper (Inbound Pickup)
  const returnInboundList = useMemo(() => {
    return returns.filter((r) => {
      const isPendingHubInbound =
        r.status === 'RETURN_IN_TRANSIT' &&
        r.resolution !== 'REFUND_ONLY' &&
        (r.returnMethod === 'ZMX_PICKUP' || !r.returnMethod)

      if (!isPendingHubInbound) return false
      if (r.shipment?.currentHubId && currentHub?.id) {
        return r.shipment.currentHubId === currentHub.id
      }
      return true
    })
  }, [returns, currentHub])

  const returnInboundAsShipments = useMemo(() => {
    return returnInboundList.map((ret): Shipment => {
      const trackingNum = ret.returnTrackingNumber || ret.returnNumber
      const buyerName = ret.shipment?.buyerName || 'Người Mua'
      const buyerPhone = ret.shipment?.buyerPhone || ''
      const buyerAddress = ret.shipment?.deliveryAddress || 'Địa chỉ khách'
      const shopName = ret.shipment?.pickupAddress?.name || 'Kho Shop'
      const shopAddress = [
        ret.shipment?.pickupAddress?.address,
        ret.shipment?.pickupAddress?.ward,
        ret.shipment?.pickupAddress?.district,
        ret.shipment?.pickupAddress?.province,
      ]
        .filter(Boolean)
        .join(', ') || 'Kho Người Bán'

      const itemsSummary =
        ret.items?.map((it) => `${it.productName} (x${it.quantity})`).join(', ') || 'Hàng hoàn trả'

      return {
        id: ret.id,
        orderId: ret.orderId,
        trackingNumber: trackingNum,
        buyerName: `${buyerName} (Khách Hoàn)`,
        buyerPhone: buyerPhone,
        deliveryAddress: `Gửi về Shop: ${shopName} • ${shopAddress}`,
        pickupAddress: { name: buyerName, phone: buyerPhone, address: buyerAddress },
        codAmount: 0,
        status: 'RETURN_IN_TRANSIT',
        currentHubId: ret.shipment?.currentHubId || currentHub?.id,
        currentHub: currentHub ? { id: currentHub.id, name: currentHub.name } : undefined,
        package: { weight: 0.5, itemsSummary },
        assignments: [
          {
            id: `ret-asn-${ret.id}`,
            type: 'PICKUP',
            status: 'COMPLETED',
            driver: { name: 'Shipper ZMX', phone: 'Đã thu hồi từ khách', vehicleNumber: 'Xe máy' },
            completedAt: ret.updatedAt,
            proofImage: ret.evidences?.find((e) => e.fileType === 'IMAGE')?.fileUrl,
          },
        ],
        isReturn: true,
        returnData: ret,
      }
    })
  }, [returnInboundList, currentHub])

  // 1.2 Hàng Hoàn Đã Nhập Kho (Lưu tại kho này hoặc chờ chuyển tiếp về Shop)
  const returnAtHubAsShipments = useMemo(() => {
    return returns
      .filter((r) => {
        if (r.status !== 'RETURN_AT_HUB') return false
        // Nếu shipment liên kết đã chuyển sang IN_TRANSIT (đã xuất xe tải) hoặc AT_DESTINATION_HUB, không hiển thị ở sàn kho Tab 2
        if (r.shipment?.status && r.shipment.status !== 'AT_ORIGIN_HUB' && r.shipment.status !== 'SORTING') {
          return false
        }
        if (r.shipment?.currentHubId && currentHub?.id) {
          return r.shipment.currentHubId === currentHub.id
        }
        return true
      })
      .map((ret): Shipment => {
        const trackingNum = ret.returnTrackingNumber || ret.returnNumber
        const buyerName = ret.shipment?.buyerName || 'Người Mua'
        const buyerPhone = ret.shipment?.buyerPhone || ''
        const buyerAddress = ret.shipment?.deliveryAddress || 'Địa chỉ khách'
        const shopName = ret.shipment?.pickupAddress?.name || 'Kho Shop'
        const shopAddress = [
          ret.shipment?.pickupAddress?.address,
          ret.shipment?.pickupAddress?.ward,
          ret.shipment?.pickupAddress?.district,
          ret.shipment?.pickupAddress?.province,
        ]
          .filter(Boolean)
          .join(', ') || 'Kho Người Bán'

        const itemsSummary =
          ret.items?.map((it) => `${it.productName} (x${it.quantity})`).join(', ') || 'Hàng hoàn trả'

        return {
          id: ret.shipmentId || ret.id,
          orderId: ret.orderId,
          trackingNumber: trackingNum,
          buyerName: `${shopName} (Shop Nhận Hoàn)`,
          buyerPhone: ret.shipment?.pickupAddress?.phone || buyerPhone,
          deliveryAddress: `Kho Shop: ${shopName} • ${shopAddress}`,
          pickupAddress: { name: buyerName, phone: buyerPhone, address: buyerAddress },
          codAmount: 0,
          status: 'AT_ORIGIN_HUB',
          currentHubId: ret.shipment?.currentHubId || currentHub?.id,
          currentHub: currentHub ? { id: currentHub.id, name: currentHub.name } : undefined,
          package: { weight: 0.5, itemsSummary },
          assignments: [],
          isReturn: true,
          returnData: ret,
        }
      })
  }, [returns, currentHub])

  // 2. Phân loại & Xuất xe (Đơn hàng gửi đi + Hàng hoàn đang lưu tại kho)
  const sortingList = useMemo(
    () => [
      ...shipments.filter(
        (s) =>
          ['AT_ORIGIN_HUB', 'SORTING'].includes(s.status) &&
          s.currentHubId === currentHub?.id
      ),
      // Tại SOC: Các đơn bưu kiện đang lưu tại SOC (cả đơn từ xe tải liên tỉnh cập bến AT_DESTINATION_HUB) cần phân luồng đóng xe chuyển tiếp về HUD con hoặc SOC khác
      ...(isSoc
        ? shipments.filter(
            (s) =>
              s.status === 'AT_DESTINATION_HUB' &&
              s.currentHubId === currentHub?.id
          )
        : []),
      ...returnAtHubAsShipments,
    ],
    [shipments, returnAtHubAsShipments, currentHub, isSoc]
  )

  // Helper map shipment kèm thông tin hoàn hàng (nếu có)
  const enhanceShipmentWithReturn = (s: Shipment): Shipment => {
    const linkedReturn = returns.find((r) => r.shipmentId === s.id || r.id === s.id)
    if (!linkedReturn) return s

    const trackingNum = linkedReturn.returnTrackingNumber || linkedReturn.returnNumber || s.trackingNumber
    const shopName = s.pickupAddress?.name || 'Kho Shop'
    const shopAddress = [
      s.pickupAddress?.address,
      s.pickupAddress?.ward,
      s.pickupAddress?.district,
      s.pickupAddress?.province,
    ]
      .filter(Boolean)
      .join(', ') || 'Kho Người Bán'

    return {
      ...s,
      trackingNumber: trackingNum,
      buyerName: `${shopName} (Shop Nhận Hoàn)`,
      buyerPhone: s.pickupAddress?.phone || s.buyerPhone,
      deliveryAddress: `Kho Shop: ${shopName} • ${shopAddress}`,
      isReturn: true,
      returnData: linkedReturn,
    }
  }

  // 3. Tiếp nhận xe tải đến
  const inTransitList = useMemo(
    () =>
      shipments
        .filter((s) => s.status === 'IN_TRANSIT' && isDestinedForCurrentHub(s, currentHub))
        .map(enhanceShipmentWithReturn),
    [shipments, returns, currentHub]
  )

  // 4. Chia tuyến Shipper Last-Mile
  const destinationList = useMemo(
    () =>
      shipments
        .filter(
          (s) =>
            ['AT_DESTINATION_HUB', 'DELIVERY_ASSIGNED'].includes(s.status) &&
            isDestinedForCurrentHub(s, currentHub)
        )
        .map(enhanceShipmentWithReturn),
    [shipments, returns, currentHub]
  )

  // Quản lý xe tại Dock (custom hook)
  const {
    dockTrucks,
    saveDockTrucks,
    sealingDockTruck,
    setSealingDockTruck,
    quickSealNumber,
    setQuickSealNumber,
    activeScanDockTruckId,
    setActiveScanDockTruckId,
    directScanMode,
    setDirectScanMode,
    handleOpenSealModal,
    handleConfirmSealFromDock,
    handleUnloadEntireDockTruck,
    handleUnloadSingleShipmentFromDock,
    getMatchingUnloadedParcelsForTruck,
    handleBatchLoadRouteToTruck,
  } = useHubDockTrucks(
    currentHub,
    hubs,
    sortingList,
    onUpdateStatus,
    onRefresh,
    (msg) => setScanMessage(msg)
  )

  // Quản lý các Modal chia tuyến & đóng xe (custom hook)
  const {
    selectedShipmentIds,
    setSelectedShipmentIds,
    selectedLastMileIds,
    setSelectedLastMileIds,
    isDispatchModalOpen,
    setIsDispatchModalOpen,
    modalShipments,
    setModalShipments,
    isLastMileModalOpen,
    setIsLastMileModalOpen,
    lastMileModalShipments,
    setLastMileModalShipments,
    reconcilingTrip,
    setReconcilingTrip,
    handleToggleSelectShipment,
    handleSelectAllSorting,
    handleToggleSelectLastMile,
    handleSelectAllLastMile,
    handleOpenLastMileSingle,
    handleOpenLastMileBatch,
    handleConfirmLastMileDispatch,
    handleOpenDispatchSingle,
    handleOpenDispatchBatch,
    handleConfirmLinehaulDispatch,
  } = useHubDispatchModals(
    sortingList,
    destinationList,
    currentHub,
    drivers,
    dockTrucks,
    saveDockTrucks,
    onUpdateStatus,
    onRefresh,
    (msg) => setScanMessage(msg)
  )

  // Bàn giao bưu kiện từ Bưu cục vệ tinh (HUD) về Trung tâm phân loại tổng (SOC)
  const handleHandoverToSoc = async (shipmentIds: string[]) => {
    if (shipmentIds.length === 0) return
    const targetSoc =
      currentHub?.parentSoc ||
      hubs.find((h) => h.id === currentHub?.parentSocId) ||
      hubs.find(
        (h) =>
          h.type === 'SORTING_CENTER' &&
          ((h.province && currentHub?.province && h.province.includes(currentHub.province)) ||
            (currentHub?.province && h.province && currentHub.province.includes(h.province)))
      ) ||
      hubs.find((h) => h.type === 'SORTING_CENTER')

    const socName = targetSoc?.name || 'Trung Tâm Phân Loại (SOC)'
    const confirmMsg = `Xác nhận xuất kho bàn giao ${shipmentIds.length} kiện hàng từ [${currentHub?.name || 'Bưu cục'}] về [${socName}] để phân loại tự động?`
    if (!window.confirm(confirmMsg)) return

    try {
      for (const sId of shipmentIds) {
        await onUpdateStatus(
          sId,
          'IN_TRANSIT',
          undefined,
          targetSoc?.id,
          `Bưu cục [${currentHub?.name || 'HUD'}] đã xuất kho bàn giao kiện hàng cho xe trung chuyển về [${socName}] để phân loại tự động.`,
          {
            truckNumber: 'Xe trung chuyển nội bộ',
            truckDriver: 'Đội xe trung chuyển ZMX',
            targetHubId: targetSoc?.id,
          }
        )
      }
      setSelectedShipmentIds(new Set())
      setScanMessage({
        type: 'success',
        text: `📤 Đã xuất kho bàn giao thành công ${shipmentIds.length} kiện về [${socName}]!`,
      })
      onRefresh()
    } catch (err: any) {
      alert(`Lỗi bàn giao về SOC: ${err.message || 'Lỗi không xác định'}`)
    }
  }

  // Điều chuyển bưu kiện từ SOC về Bưu cục phát địa phương (HUD)
  const handleTransferToChildHub = async (shipment: Shipment, targetChildHub: Hub) => {
    const confirmMsg = `Xác nhận điều chuyển bưu kiện [${shipment.trackingNumber}] về [${targetChildHub.name}] để phân tuyến cho Shipper giao hàng?`
    if (!window.confirm(confirmMsg)) return

    try {
      await onUpdateStatus(
        shipment.id,
        'AT_DESTINATION_HUB',
        undefined,
        targetChildHub.id,
        `Trung tâm phân loại [${currentHub?.name || 'SOC'}] đã hoàn tất phân luồng và chuyển bưu kiện về [${targetChildHub.name}] để Shipper phát.`
      )

      const matchedDriver =
        drivers.find(
          (d) => d.hubId === targetChildHub.id && d.vehicleType === 'MOTORBIKE'
        ) || drivers.find((d) => d.hubId === targetChildHub.id)

      const driverEmail =
        matchedDriver?.phone === '0909888777'
          ? 'shipper_govap@zeromall.com'
          : matchedDriver?.phone === '0909555444'
          ? 'shipper_binhthanh@zeromall.com'
          : matchedDriver?.phone === '0908123456'
          ? 'shipper1@zeromall.com'
          : `shipper_${(matchedDriver?.phone || '').replace(/[^0-9]/g, '')}@spx.zeromall.vn`

      setAssignedNotification({
        shipmentTrackingNumber: shipment.trackingNumber,
        orderId: shipment.orderId,
        buyerAddress: shipment.deliveryAddress,
        hubName: targetChildHub.name,
        hubCode: targetChildHub.code,
        driverName: matchedDriver?.name || 'Shipper Bưu Cục',
        driverPhone: matchedDriver?.phone || '',
        vehicleNumber: matchedDriver?.vehicleNumber || 'Xe máy',
        driverEmail: driverEmail,
        driverUserId: matchedDriver?.userId || 'user-shipper-govap',
      })
      onRefresh()
    } catch (err: any) {
      alert(`Lỗi chuyển bưu kiện về HUD: ${err.message || 'Đã có lỗi xảy ra'}`)
    }
  }

  // Danh sách bưu kiện tổng hợp tại kho để máy quét barcode tra cứu
  const allHubShipmentsForScanner = useMemo(() => {
    return [...shipments, ...returnAtHubAsShipments]
  }, [shipments, returnAtHubAsShipments])

  // Quản lý Máy Quét Mã Vạch (custom hook)
  const {
    scannedCode,
    setScannedCode,
    scanMessage,
    setScanMessage,
    isCameraScannerOpen,
    setIsCameraScannerOpen,
    handleScanCode,
    handleScanSubmit,
  } = useHubScanner(
    stationTab,
    currentHub,
    currentUser,
    hubs,
    allHubShipmentsForScanner,
    returnInboundAsShipments,
    dockTrucks,
    activeScanDockTruckId,
    directScanMode,
    saveDockTrucks,
    onUpdateStatus,
    onRefresh,
    handleOpenDispatchSingle,
    handleOpenLastMileSingle,
    handleHandoverToSoc
  )

  // Gom nhóm chuyến xe
  const linehaulTrips = useMemo(() => {
    const map = new Map<string, LinehaulTrip>()
    inTransitList.forEach((s) => {
      const info = extractLinehaulInfo(s)
      const truck = info?.truckNumber || 'Xe Tuyến Liên Tỉnh'
      const seal = info?.sealNumber || 'Chưa gắn Seal'
      const driver = info?.driver || 'Bác tài'
      const phone = info?.driverPhone || ''
      const key = `${truck}_${seal}`

      if (!map.has(key)) {
        map.set(key, {
          tripKey: key,
          truckNumber: truck,
          sealNumber: seal,
          truckDriver: driver,
          truckDriverPhone: phone,
          originHubName: s.currentHub?.name,
          dispatchedAt: s.trackingLogs?.find((l) => l.description?.includes('Xe tải'))?.timestamp,
          shipments: [],
        })
      }
      map.get(key)!.shipments.push({
        id: s.id,
        trackingNumber: s.trackingNumber,
        orderId: s.orderId,
        buyerName: s.buyerName,
        buyerPhone: s.buyerPhone,
        deliveryAddress: s.deliveryAddress,
        package: s.package,
        codAmount: s.codAmount,
        status: s.status,
      })
    })
    return Array.from(map.values())
  }, [inTransitList])

  const activeReconcilingTrip = useMemo(() => {
    if (!reconcilingTrip) return null
    return linehaulTrips.find((t) => t.tripKey === reconcilingTrip.tripKey) || reconcilingTrip
  }, [reconcilingTrip, linehaulTrips])

  const activeList = useMemo(() => {
    const raw =
      stationTab === 'INBOUND_PICKUP'
        ? [...pickupInboundList, ...returnInboundAsShipments]
        : stationTab === 'SORTING_LINEHAUL'
        ? sortingList
        : stationTab === 'INBOUND_RECEIVING'
        ? inTransitList
        : destinationList

    if (!searchFilter.trim()) return raw
    const q = searchFilter.trim().toLowerCase()
    return raw.filter(
      (s) =>
        s.trackingNumber.toLowerCase().includes(q) ||
        s.buyerName.toLowerCase().includes(q) ||
        s.buyerPhone.includes(q) ||
        s.orderId.toLowerCase().includes(q) ||
        (s.returnData?.returnNumber && s.returnData.returnNumber.toLowerCase().includes(q))
    )
  }, [
    stationTab,
    pickupInboundList,
    returnInboundAsShipments,
    sortingList,
    inTransitList,
    destinationList,
    searchFilter,
  ])

  // Trip Reconciliation Handlers (Tab 3)
  const handleReceiveShipmentFromTrip = async (shipmentId: string) => {
    const truck = reconcilingTrip?.truckNumber || 'Xe tải tuyến'
    await onUpdateStatus(
      shipmentId,
      'AT_DESTINATION_HUB',
      undefined,
      currentHub?.id,
      `Xe tải [${truck}] đã đến. Nhân viên bưu cục [${currentUser.name}] đã đối soát & nhập bưu cục phát ${currentHub?.name}`
    )
    onRefresh()
  }

  const handleReceiveAllShipmentsFromTrip = async (shipmentIds: string[]) => {
    const truck = reconcilingTrip?.truckNumber || 'Xe tải tuyến'
    for (const id of shipmentIds) {
      await onUpdateStatus(
        id,
        'AT_DESTINATION_HUB',
        undefined,
        currentHub?.id,
        `Xe tải [${truck}] đã đến. Xác nhận nhập kho bưu cục phát ${currentHub?.name}`
      )
    }
    setScanMessage({
      type: 'success',
      text: `🏢 Đã nhập kho thành công toàn bộ ${shipmentIds.length} kiện từ chuyến xe [${truck}]!`,
    })
    onRefresh()
  }

  const handleReportTripDiscrepancy = async (trip: LinehaulTrip, missingShipmentIds: string[], reason: string) => {
    for (const id of missingShipmentIds) {
      await onUpdateStatus(
        id,
        'DELIVERY_FAILED',
        reason,
        currentHub?.id,
        `BẤT THƯỜNG ĐỐI SOÁT CHUYẾN XE [${trip.truckNumber}]: ${reason}. Đã lập biên bản gửi Bác tài [${trip.truckDriver}] & Bưu cục gửi để truy soát camera.`
      )
    }
    setScanMessage({
      type: 'error',
      text: `⚠️ Đã lập biên bản bất thường thiếu ${missingShipmentIds.length} kiện trên chuyến xe [${trip.truckNumber}].`,
    })
    onRefresh()
  }

  if (!currentHub) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
        <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-slate-500 font-bold">Đang tải dữ liệu bưu cục...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 text-left">
      {/* HUB / SOC IDENTITY & ACTION BAR */}
      <div
        className={`p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
          isSoc
            ? 'bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border border-indigo-900/40 text-white'
            : 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-xs border ${
              isSoc
                ? 'bg-indigo-500/20 border-indigo-500/30'
                : 'bg-emerald-500/20 border-emerald-500/30'
            }`}
          >
            {isSoc ? '🏭' : '🏢'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-white">
                {currentHub?.name || (isSoc ? 'Trung Tâm Phân Loại SOC' : 'Trạm Khai Thác Bưu Cục')}
              </h2>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isSoc
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {currentHub?.code}
              </span>
              {isSoc && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-extrabold px-2 py-0.5 rounded-full border border-amber-500/30">
                  ⚡ MEGA SORTING CENTER
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium">
              📍 {currentHub?.address ? `${currentHub.address}, ` : ''}{currentHub?.district}, {currentHub?.province}
              <span className="text-white/30 mx-2">•</span>
              {isSoc ? (
                <span className="text-indigo-300 font-bold">
                  🚛 {dockTrucks.length} Cửa Dock Linehaul • ⚡ Băng Chuyền DWS Tự Động
                </span>
              ) : (
                <span className="text-amber-300 font-bold">
                  🛵 {drivers.filter((d) => d.hubId === currentHub?.id).length} Tài xế trực thuộc
                </span>
              )}
            </p>
          </div>
        </div>

        {isSoc ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditingHub(null)
                setIsAddHubModalOpen(true)
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Thiết lập thêm bưu cục giao hàng vệ tinh trực thuộc SOC này"
            >
              <span>🏢</span> + Thêm Hub Con
            </button>
            <button
              onClick={() => {
                setDriverModalVehicleType('TRUCK')
                setIsAddDriverModalOpen(true)
              }}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Đăng ký thêm xe tải tuyến đường dài cho kho tổng SOC"
            >
              <span>🚛</span> + Tuyển Xe Tải
            </button>
            <button
              onClick={() => {
                setStationTab('SORTING_LINEHAUL')
                handleOpenDispatchBatch()
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>⚡</span> Đóng Xe Tải Tuyến Mới
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsDriversManageModalOpen(true)}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Xem thông tin, sửa hồ sơ, đổi mật khẩu và quản lý danh sách Shipper"
            >
              <span>🛵</span> Quản Lý Shipper ({hubDrivers.length})
            </button>
            <button
              onClick={() => {
                setDriverModalVehicleType('MOTORBIKE')
                setIsAddDriverModalOpen(true)
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>➕</span> Tuyển Shipper Mới
            </button>
          </div>
        )}
      </div>

      {/* SECTION 1: 4/5-STEP PIPELINE TABS (DỰA TRÊN LOẠI HUB: SOC vs BƯU CỤC) */}
      <HubPipelineTabs
        currentTab={stationTab}
        onSelectTab={(tab) => {
          setStationTab(tab)
          setSearchFilter('')
          setScanMessage(null)
          setSelectedShipmentIds(new Set())
          setSelectedLastMileIds(new Set())
        }}
        pickupCount={pickupInboundList.length}
        returnCount={returnInboundList.length}
        sortingCount={sortingList.length}
        inTransitCount={inTransitList.length}
        destinationCount={destinationList.length}
        hubType={currentHub?.type}
      />

      {/* SECTION 2: VIEW CHI TIẾT THEO TAB */}
      {stationTab === 'SOC_DASHBOARD' ? (
        <SocDashboard
          currentHub={currentHub}
          hubs={hubs}
          drivers={drivers}
          sortingList={sortingList}
          inTransitList={inTransitList}
          linehaulTrips={linehaulTrips}
          dockTrucks={dockTrucks}
          onRefresh={onRefresh}
          onAddChildHub={() => {
            setEditingHub(null)
            setIsAddHubModalOpen(true)
          }}
          onAddTruckDriver={() => {
            setDriverModalVehicleType('TRUCK')
            setIsAddDriverModalOpen(true)
          }}
          onEditChildHub={(hub) => {
            setEditingHub(hub)
            setIsAddHubModalOpen(true)
          }}
          onDeleteChildHub={handleDeleteChildHub}
        />
      ) : stationTab === 'HUB_CASHIER' ? (
        <HubCashierDesk
          currentHub={currentHub}
          drivers={drivers}
          shipments={shipments}
          onRefresh={onRefresh}
        />
      ) : (
        <>
          {/* SECTION 2: SCANNER BAR */}
          <HubScannerBar
            stationTab={stationTab}
            isSoc={isSoc}
            currentHub={currentHub}
            dockTrucks={dockTrucks}
            activeScanDockTruckId={activeScanDockTruckId}
            setActiveScanDockTruckId={setActiveScanDockTruckId}
            directScanMode={directScanMode}
            setDirectScanMode={setDirectScanMode}
            scannedCode={scannedCode}
            setScannedCode={setScannedCode}
            onScanSubmit={handleScanSubmit}
            scanMessage={scanMessage}
            isCameraScannerOpen={isCameraScannerOpen}
            setIsCameraScannerOpen={setIsCameraScannerOpen}
            actionLoading={actionLoading}
            onScanCode={handleScanCode}
          />

          {/* SECTION 3: PARCEL TABLE & SUB-VIEWS */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
            {/* Banner Xe tại Dock (Tab 2) - Chỉ hiển thị tại SOC */}
            {stationTab === 'SORTING_LINEHAUL' && isSoc && (
              <HubDockTruckList
                dockTrucks={dockTrucks}
                activeScanDockTruckId={activeScanDockTruckId}
                setActiveScanDockTruckId={setActiveScanDockTruckId}
                actionLoading={actionLoading}
                getMatchingUnloadedParcelsForTruck={getMatchingUnloadedParcelsForTruck}
                handleBatchLoadRouteToTruck={handleBatchLoadRouteToTruck}
                handleOpenSealModal={handleOpenSealModal}
                handleUnloadEntireDockTruck={handleUnloadEntireDockTruck}
              />
            )}

            {/* Banner Xe Tuyến Cập Bến (Tab 3) */}
            {stationTab === 'INBOUND_RECEIVING' && (
              <HubLinehaulTripsBanner
                linehaulTrips={linehaulTrips}
                inTransitTotalCount={inTransitList.length}
                onOpenReconciliation={(trip) => setReconcilingTrip(trip)}
              />
            )}

            {/* Main Parcel Table */}
            <HubParcelTable
              stationTab={stationTab}
              activeList={activeList}
              sortingList={sortingList}
              destinationList={destinationList}
              selectedShipmentIds={selectedShipmentIds}
              selectedLastMileIds={selectedLastMileIds}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              onRefresh={onRefresh}
              currentHub={currentHub}
              currentUser={currentUser}
              hubs={hubs}
              dockTrucks={dockTrucks}
              linehaulTrips={linehaulTrips}
              actionLoading={actionLoading}
              onToggleSelectShipment={handleToggleSelectShipment}
              onSelectAllSorting={handleSelectAllSorting}
              onToggleSelectLastMile={handleToggleSelectLastMile}
              onSelectAllLastMile={handleSelectAllLastMile}
              onOpenDispatchBatch={handleOpenDispatchBatch}
              onOpenDispatchSingle={handleOpenDispatchSingle}
              onOpenLastMileBatch={handleOpenLastMileBatch}
              onOpenLastMileSingle={handleOpenLastMileSingle}
              onUnloadSingleShipmentFromDock={handleUnloadSingleShipmentFromDock}
              onSelectRouteForSorting={(destHub) => {
                const prov = (destHub.province || '').toLowerCase()
                const loadedIds = new Set(dockTrucks.flatMap((t) => t.shipments.map((item) => item.id)))
                const matching = sortingList.filter((s) => {
                  if (loadedIds.has(s.id)) return false
                  const addr = (s.deliveryAddress || '').toLowerCase()
                  if (prov.includes('hồ chí minh') || prov.includes('hcm')) {
                    return (
                      addr.includes('hồ chí minh') ||
                      addr.includes('tp.hcm') ||
                      addr.includes('tp hcm') ||
                      addr.includes('sài gòn') ||
                      addr.includes('tân bình') ||
                      addr.includes('gò vấp') ||
                      addr.includes('bình thạnh') ||
                      addr.includes('quận 1') ||
                      addr.includes('bình dương') ||
                      addr.includes('đồng nai')
                    )
                  }
                  if (prov.includes('hà nội') || prov.includes('mê linh')) {
                    return addr.includes('hà nội') || addr.includes('mê linh') || addr.includes('cầu giấy')
                  }
                  return addr.includes(prov)
                })
                setSelectedShipmentIds(new Set(matching.map((s) => s.id)))
              }}
              onOpenReconciliation={(trip) => setReconcilingTrip(trip)}
              onHandoverToSoc={handleHandoverToSoc}
              onTransferToChildHub={handleTransferToChildHub}
              onUpdateStatus={onUpdateStatus}
            />
          </div>
        </>
      )}

      {/* MODAL 1: LINEHAUL DISPATCH & SEAL */}
      <LinehaulDispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => {
          setIsDispatchModalOpen(false)
          setModalShipments([])
        }}
        onConfirm={handleConfirmLinehaulDispatch}
        currentHub={currentHub}
        availableHubs={hubs}
        selectedShipments={modalShipments}
        dockTrucks={dockTrucks}
        registeredDrivers={drivers}
        actionLoading={actionLoading}
      />

      {/* MODAL 2: QUICK SEAL FROM DOCK */}
      <DockTruckQuickSealModal
        sealingDockTruck={sealingDockTruck}
        onClose={() => setSealingDockTruck(null)}
        quickSealNumber={quickSealNumber}
        setQuickSealNumber={setQuickSealNumber}
        onConfirmSeal={handleConfirmSealFromDock}
        actionLoading={actionLoading}
      />

      {/* MODAL 3: INBOUND RECONCILIATION */}
      <LinehaulInboundReconciliationModal
        isOpen={!!reconcilingTrip}
        onClose={() => setReconcilingTrip(null)}
        trip={activeReconcilingTrip}
        currentHubName={currentHub?.name || 'Bưu cục phát'}
        onReceiveShipment={handleReceiveShipmentFromTrip}
        onReceiveAllShipments={handleReceiveAllShipmentsFromTrip}
        onReportDiscrepancy={handleReportTripDiscrepancy}
        actionLoading={actionLoading}
      />

      {/* MODAL 4: LAST-MILE DISPATCH */}
      <LastMileDispatchModal
        isOpen={isLastMileModalOpen}
        onClose={() => {
          setIsLastMileModalOpen(false)
          setLastMileModalShipments([])
        }}
        shipments={lastMileModalShipments}
        drivers={drivers}
        currentHub={currentHub}
        onConfirm={handleConfirmLastMileDispatch}
        actionLoading={actionLoading}
      />

      {/* MODAL 5: TUYỂN / THÊM TÀI XẾ CHO BƯU CỤC NÀY */}
      <DriverCreateModal
        isOpen={isAddDriverModalOpen}
        onClose={() => setIsAddDriverModalOpen(false)}
        currentHub={currentHub}
        onSuccess={onRefresh}
        initialVehicleType={driverModalVehicleType}
      />
      {/* MODAL 6: QUẢN LÝ SHIPPER CHO BƯU CỤC CON */}
      <HubDriversManageModal
        isOpen={isDriversManageModalOpen}
        onClose={() => setIsDriversManageModalOpen(false)}
        currentHub={currentHub}
        drivers={drivers}
        onRefresh={onRefresh}
        onAddDriver={() => {
          setIsDriversManageModalOpen(false)
          setDriverModalVehicleType('MOTORBIKE')
          setIsAddDriverModalOpen(true)
        }}
      />

      {/* MODAL THIẾT LẬP / CHỈNH SỬA BƯU CỤC CON (DÀNH CHO ĐIỀU PHỐI VIÊN SOC) */}
      <HubCreateEditModal
        isOpen={isAddHubModalOpen}
        onClose={() => {
          setIsAddHubModalOpen(false)
          setEditingHub(null)
        }}
        editingHub={editingHub}
        onSuccess={() => {
          onRefresh()
          setIsAddHubModalOpen(false)
          setEditingHub(null)
        }}
        initialParentSocId={currentHub?.id}
      />

      {/* MODAL 7: THÔNG BÁO TỰ ĐỘNG GÁN SHIPPER KHI BÀN GIAO VỀ HUD */}
      {assignedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-2xl max-w-lg w-full p-6 space-y-5 text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shadow-inner shrink-0">
                🛵
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Phân Tuyến Thành Công
                </span>
                <h3 className="text-base font-black text-slate-900 truncate mt-0.5">
                  Đã Bàn Giao Về {assignedNotification.hubCode} & Gán Shipper
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignedNotification(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-xs transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                <span className="font-semibold text-slate-500">Mã vận đơn:</span>
                <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  {assignedNotification.shipmentTrackingNumber}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Bưu cục tiếp nhận:</span>
                <span className="font-bold text-slate-900">{assignedNotification.hubName}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="font-semibold text-slate-500 shrink-0">Địa chỉ giao:</span>
                <span className="font-medium text-slate-800 text-right line-clamp-2">
                  {assignedNotification.buyerAddress}
                </span>
              </div>
            </div>

            {/* Khung Thông Tin Tài Xế & Tài Khoản Đăng Nhập */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">👤</span>
                <span className="font-black text-xs text-emerald-950">Thông Tin Tài Xế Giao Hàng (Last-Mile Shipper):</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white/90 rounded-xl border border-emerald-100 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Họ và tên</span>
                  <div className="font-black text-slate-900 truncate">{assignedNotification.driverName}</div>
                </div>
                <div className="p-2.5 bg-white/90 rounded-xl border border-emerald-100 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">SĐT & Biển số xe</span>
                  <div className="font-bold text-slate-900 truncate">
                    {assignedNotification.driverPhone} • {assignedNotification.vehicleNumber}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-1.5">
                <div className="text-[11px] font-black text-emerald-800 flex items-center gap-1.5">
                  <span>🔑</span>
                  <span>Tài Khoản Đăng Nhập App Tài Xế:</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-600 font-medium">Email:</span>
                  <b className="text-emerald-900 select-all">{assignedNotification.driverEmail}</b>
                </div>
                <div className="flex items-center justify-between text-xs font-mono bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-600 font-medium">Mật khẩu:</span>
                  <b className="text-emerald-900 font-black">123456</b>
                </div>
              </div>
            </div>

            {/* Nút hành động */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (onSwitchUser) {
                    onSwitchUser(
                      {
                        id: assignedNotification.driverUserId,
                        email: assignedNotification.driverEmail,
                        name: assignedNotification.driverName,
                        role: 'DRIVER',
                        phoneNumber: assignedNotification.driverPhone,
                      },
                      'mock-shipper-token'
                    )
                  }
                  setAssignedNotification(null)
                }}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🚀</span>
                <span>Chuyển Sang App Tài Xế Để Đi Giao Hàng</span>
              </button>

              <button
                type="button"
                onClick={() => setAssignedNotification(null)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition cursor-pointer"
              >
                Ở Lại Trạm SOC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
