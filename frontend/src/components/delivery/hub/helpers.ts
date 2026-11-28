import type { Shipment, Hub, Assignment } from './types'

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CREATED: { label: 'Mới Tạo', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  WAITING_PICKUP: { label: 'Chờ Lấy Hàng', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  PICKUP_ASSIGNED: { label: 'Đã Gán Shipper Lấy', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  PICKED_UP: { label: 'Shipper Đã Lấy', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  AT_ORIGIN_HUB: { label: 'Tại Kho Gửi', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  SORTING: { label: 'Đang Phân Loại', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  IN_TRANSIT: { label: 'Đang Trung Chuyển', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  AT_DESTINATION_HUB: { label: 'Tại Bưu Cục Phát', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  DELIVERY_ASSIGNED: { label: 'Chờ Shipper Nhận', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  OUT_FOR_DELIVERY: { label: 'Đang Giao', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  DELIVERED: { label: 'Đã Giao', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  DELIVERY_FAILED: { label: 'Giao Thất Bại', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  RETURNING: { label: 'Đang Hoàn', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
  RETURNED: { label: 'Đã Hoàn', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
}

export function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

export function extractLinehaulInfo(s: Shipment) {
  const log = s.trackingLogs?.find(
    (l) => l.description?.includes('Xe tải') || l.description?.includes('Seal')
  )
  if (!log) return null

  const text = log.description || ''
  const truckMatch = text.match(/\[([0-9A-Z\-\.]+)\]/) || text.match(/Xe tải\s+([0-9A-Z\-\.]+)/i)
  const sealMatch = text.match(/Seal:\s*\[?([A-Z0-9\-]+)\]?/i)
  const driverMatch = text.match(/Bác tài:\s*([^\(•]+)/i)
  const phoneMatch = text.match(/SĐT:\s*([0-9\+\.]+)/i) || text.match(/\(([0-9\+\.\s]+)\)/)

  return {
    truckNumber: truckMatch ? truckMatch[1] : 'Xe Tải Linehaul',
    sealNumber: sealMatch ? sealMatch[1] : null,
    driver: driverMatch ? driverMatch[1].trim() : null,
    driverPhone: phoneMatch ? phoneMatch[1].trim() : '',
    time: log.timestamp,
  }
}

export function cleanAdminName(str?: string | null): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/^(thành phố|tỉnh|tp\.?)\s+/i, '')
    .replace(/^(quận|huyện|thị xã|thị trấn|tx\.?)\s+/i, '')
    .replace(/^(phường|xã)\s+/i, '')
    .trim()
}

export function matchesDistrict(
  address?: string | null,
  district?: string | null,
  hubName?: string | null
): boolean {
  const addr = (address || '').toLowerCase()
  if (!addr) return false

  const distRaw = (district || '').toLowerCase().trim()
  if (distRaw) {
    // Tránh trường hợp "quận 1" khớp nhầm vào "quận 12" hoặc "quận 10"
    if (/\d+$/.test(distRaw)) {
      const escaped = distRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
      if (new RegExp(`(?:^|[\\s,])${escaped}(?=$|[\\s,])`, 'i').test(addr)) {
        return true
      }
      const numOnly = distRaw.match(/(\d+)$/)?.[1]
      if (numOnly && new RegExp(`(?:^|[\\s,])(?:q\\.?|quận\\s*)${numOnly}(?=$|[\\s,])`, 'i').test(addr)) {
        return true
      }
    } else if (addr.includes(distRaw)) {
      return true
    }
  }

  const distClean = cleanAdminName(district)
  if (distClean && distClean.length >= 2 && !/^\d+$/.test(distClean) && addr.includes(distClean)) {
    return true
  }

  if (hubName) {
    const cleanedHubLabel = hubName
      .toLowerCase()
      .replace(/bưu cục giao hàng|trung tâm phân loại|bưu cục|trạm khai thác|spx|zmx|hub|hud|soc/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (
      cleanedHubLabel &&
      cleanedHubLabel.length >= 4 &&
      !/^\d+$/.test(cleanedHubLabel) &&
      addr.includes(cleanedHubLabel)
    ) {
      return true
    }
  }

  return false
}

export function matchesProvinceRegion(address?: string | null, province?: string | null): boolean {
  const addr = (address || '').toLowerCase()
  const prov = (province || '').toLowerCase()
  if (!addr || !prov) return false

  if (addr.includes(prov)) return true
  const provClean = cleanAdminName(prov)
  if (provClean && provClean.length >= 3 && addr.includes(provClean)) return true

  if (prov.includes('hồ chí minh') || prov.includes('hcm')) {
    return (
      addr.includes('hồ chí minh') ||
      addr.includes('hcm') ||
      addr.includes('sài gòn') ||
      addr.includes('tân bình') ||
      addr.includes('gò vấp') ||
      addr.includes('bình thạnh') ||
      addr.includes('thủ đức') ||
      addr.includes('bình tân') ||
      addr.includes('tân phú') ||
      addr.includes('phú nhuận') ||
      addr.includes('nhà bè') ||
      addr.includes('bình chánh') ||
      addr.includes('hóc môn') ||
      addr.includes('củ chi') ||
      /(?:^|[\s,])(quận|q\.?)\s*(1|2|3|4|5|6|7|8|9|10|11|12)(?=$|[\s,])/.test(addr) ||
      addr.includes('bình dương') ||
      addr.includes('long an') ||
      addr.includes('đồng nai')
    )
  }

  if (prov.includes('hà nội') || prov.includes('mê linh')) {
    return (
      addr.includes('hà nội') ||
      addr.includes('mê linh') ||
      addr.includes('cầu giấy') ||
      addr.includes('ba đình') ||
      addr.includes('đống đa') ||
      addr.includes('hoàn kiếm') ||
      addr.includes('hà đông') ||
      addr.includes('long biên') ||
      addr.includes('hoàng mai') ||
      addr.includes('thanh xuân') ||
      addr.includes('nam từ liêm') ||
      addr.includes('bắc từ liêm') ||
      addr.includes('tây hồ') ||
      addr.includes('gia lâm') ||
      addr.includes('đông anh') ||
      addr.includes('sóc sơn') ||
      addr.includes('bắc ninh') ||
      addr.includes('vĩnh phúc') ||
      addr.includes('hải phòng')
    )
  }

  if (prov.includes('đà nẵng')) {
    return (
      addr.includes('đà nẵng') ||
      addr.includes('hải châu') ||
      addr.includes('sơn trà') ||
      addr.includes('ngũ hành sơn') ||
      addr.includes('cẩm lệ') ||
      addr.includes('liên chiểu') ||
      addr.includes('hòa vang')
    )
  }

  if (prov.includes('cần thơ')) {
    return (
      addr.includes('cần thơ') ||
      addr.includes('ninh kiều') ||
      addr.includes('bình thủy') ||
      addr.includes('cái răng') ||
      addr.includes('ô môn') ||
      addr.includes('thốt nốt')
    )
  }

  return false
}

export function matchesRouteTargetHub(
  address?: string | null,
  targetHub?: { name?: string; province?: string; district?: string; type?: string } | null
): boolean {
  if (!targetHub) return true
  const isSoc = targetHub.type === 'SORTING_CENTER'
  if (isSoc) {
    return matchesProvinceRegion(address, targetHub.province)
  }
  // Đối với Hub phát vệ tinh (DESTINATION_HUB), ưu tiên đối chiếu đúng Quận/Huyện nếu có thông tin quận
  if (targetHub.district || targetHub.name) {
    return matchesDistrict(address, targetHub.district, targetHub.name)
  }
  return matchesProvinceRegion(address, targetHub.province)
}

export function isDestinedForCurrentHub(s: Shipment, currentHub?: Hub | null): boolean {
  if (!currentHub) return true

  const currentHubCode = (currentHub.code || '').trim().toUpperCase()

  // Khi xe đang chạy trên đường (IN_TRANSIT), currentHubId là trạm XUẤT PHÁT chứ không phải trạm ĐẾN
  if (s.status === 'IN_TRANSIT') {
    if (s.currentHubId && s.currentHubId === currentHub.id) {
      return false
    }

    const linehaul = extractLinehaulInfo(s)
    const sealParts = (linehaul?.sealNumber || '').toUpperCase().split('-')
    // Định dạng chuẩn: SEAL-<ORIGIN_CODE>-<DEST_CODE>-<RAND>
    if (sealParts.length >= 4 && sealParts[0] === 'SEAL') {
      const originCode = sealParts[1]
      const destCode = sealParts[2]
      if (originCode && currentHubCode && originCode === currentHubCode) {
        return false
      }
      if (destCode && currentHubCode) {
        return destCode === currentHubCode
      }
    }

    // Fallback theo log gần nhất nếu Seal không theo chuẩn 4 phần
    const latestDesc = (s.trackingLogs?.[0]?.description || '').toLowerCase()
    if (currentHub.name && latestDesc.includes(`về [${currentHub.name.toLowerCase()}]`)) {
      return true
    }
  } else {
    // 1. Với trạng thái đã nhập kho đích (AT_DESTINATION_HUB, DELIVERY_ASSIGNED)
    if (s.currentHubId && s.currentHubId === currentHub.id) return true
  }

  // Với đơn hàng hoàn (Return reverse logistics), tuyến đích là Kho của Shop (pickupAddress của đơn gốc hoặc deliveryAddress đã map thành Kho Shop)
  let addr = (s.deliveryAddress || '').toLowerCase()
  if (s.isReturn || s.returnData || addr.startsWith('kho shop:') || addr.includes('gửi về shop:')) {
    const shopAddrParts = [
      s.pickupAddress?.province,
      s.pickupAddress?.district,
      s.pickupAddress?.address,
      addr,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    addr = shopAddrParts
  } else if (s.pickupAddress && (s as any).isReturn) {
    addr = `${s.pickupAddress.province || ''} ${s.pickupAddress.district || ''} ${s.pickupAddress.address || ''}`.toLowerCase()
  }

  const hubProv = cleanAdminName(currentHub.province)
  const hubDist = cleanAdminName(currentHub.district)

  // Khớp theo tỉnh thành hoặc quận huyện của Hub/SOC (toàn quốc)
  if (hubProv && addr.includes(hubProv)) {
    if (currentHub.type !== 'SORTING_CENTER' && currentHub.district) {
      if (matchesDistrict(addr, currentHub.district, currentHub.name)) return true
    } else {
      return true
    }
  }

  const hubCode = (currentHub.code || '').toLowerCase()
  if (hubCode === 'dn01' || hubProv.includes('đồng nai') || hubDist.includes('biên hòa')) {
    return addr.includes('đồng nai') || addr.includes('biên hòa')
  }
  if (hubCode === 'hn01' || hubProv.includes('hà nội') || hubDist.includes('mê linh')) {
    return addr.includes('hà nội') || addr.includes('mê linh')
  }
  if (hubCode === 'hcm01' || hubProv.includes('hồ chí minh') || hubDist.includes('tân bình')) {
    return (
      addr.includes('hồ chí minh') ||
      addr.includes('hcm') ||
      addr.includes('sài gòn') ||
      (!addr.includes('đồng nai') && !addr.includes('hà nội'))
    )
  }
  return false
}

export function playBeepSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const audioCtx = new AudioContextClass()
    const osc = audioCtx.createOscillator()
    osc.frequency.setValueAtTime(880, audioCtx.currentTime)
    osc.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.08)
  } catch {}
}

export function getPickupDriver(s: Shipment): Assignment | undefined {
  return s.assignments?.find((a) => a.type === 'PICKUP' && a.status === 'COMPLETED')
}

export function getDeliveryDriver(s: Shipment): Assignment | undefined {
  return s.assignments?.find(
    (a) => a.type === 'DELIVERY' && ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(a.status)
  )
}
