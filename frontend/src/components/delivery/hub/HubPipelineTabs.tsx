import React from 'react'
import type { StationTab } from './types'

interface TabConfig {
  id: StationTab
  title: string
  desc: string
  count: number
  icon: string
  activeColor: string
  countColor: string
}

interface HubPipelineTabsProps {
  currentTab: StationTab
  onSelectTab: (tab: StationTab) => void
  pickupCount: number
  returnCount: number
  sortingCount: number
  inTransitCount: number
  destinationCount: number
  hubType?: string // 'SORTING_CENTER' | 'DESTINATION_HUB' | 'ORIGIN_HUB'
}

export const HubPipelineTabs: React.FC<HubPipelineTabsProps> = ({
  currentTab,
  onSelectTab,
  pickupCount,
  returnCount,
  sortingCount,
  inTransitCount,
  destinationCount,
  hubType = 'DESTINATION_HUB',
}) => {
  const isSoc = hubType === 'SORTING_CENTER'

  // Cấu hình Tabs cho Trung Tâm Phân Loại (SOC)
  const socTabs: TabConfig[] = [
    {
      id: 'INBOUND_RECEIVING',
      title: '1. Tiếp Nhận Xe Tải Cập Bến',
      desc: 'Cắt seal chì, dỡ hàng & đối soát kiện từ Hub/SOC khác',
      count: inTransitCount,
      icon: '🚛',
      activeColor: 'border-indigo-500 bg-indigo-50 ring-indigo-200',
      countColor: 'text-indigo-700 bg-indigo-100 border-indigo-300',
    },
    {
      id: 'SORTING_LINEHAUL',
      title: '2. Phân Luồng & Đóng Xe Tuyến',
      desc: 'Phân loại băng chuyền, quét DWS & niêm phong xe tải',
      count: sortingCount,
      icon: '⚡',
      activeColor: 'border-sky-500 bg-sky-50 ring-sky-200',
      countColor: 'text-sky-700 bg-sky-100 border-sky-300',
    },
    {
      id: 'INBOUND_PICKUP',
      title: '3. Tiếp Nhận Shop / Hàng Hoàn',
      desc:
        returnCount > 0
          ? `Nhận ${pickupCount} đơn gửi trực tiếp, ${returnCount} đơn hoàn`
          : 'Tiếp nhận hàng Shop ký gửi trực tiếp & kiện thu hồi',
      count: pickupCount + returnCount,
      icon: '📥',
      activeColor: 'border-amber-500 bg-amber-50 ring-amber-200',
      countColor: 'text-amber-700 bg-amber-100 border-amber-300',
    },
    {
      id: 'SOC_DASHBOARD',
      title: '4. Giám Sát Vận Hành SOC',
      desc: 'Sản lượng băng chuyền, tình trạng cửa Dock & tải trọng xe',
      count: sortingCount + inTransitCount,
      icon: '📊',
      activeColor: 'border-emerald-500 bg-emerald-50 ring-emerald-200',
      countColor: 'text-emerald-700 bg-emerald-100 border-emerald-300',
    },
  ]

  // Cấu hình Tabs cho Bưu Cục Giao Hàng (HUB)
  const hubTabs: TabConfig[] = [
    {
      id: 'INBOUND_PICKUP',
      title: '1. Nhận Từ Shipper',
      desc:
        returnCount > 0
          ? `Tiếp nhận ${pickupCount} đơn Shop, ${returnCount} đơn Thu Hồi`
          : 'Tiếp nhận bưu kiện Shipper First-Mile bàn giao về kho',
      count: pickupCount + returnCount,
      icon: '📥',
      activeColor: 'border-amber-500 bg-amber-50 ring-amber-200',
      countColor: 'text-amber-700 bg-amber-100 border-amber-300',
    },
    {
      id: 'SORTING_LINEHAUL',
      title: '2. Bàn Giao Về SOC',
      desc: 'Gom kiện xuất kho chuyển tiếp về SOC tổng phân loại',
      count: sortingCount,
      icon: '📤',
      activeColor: 'border-sky-500 bg-sky-50 ring-sky-200',
      countColor: 'text-sky-700 bg-sky-100 border-sky-300',
    },
    {
      id: 'INBOUND_RECEIVING',
      title: '3. Tiếp Nhận Xe Từ SOC',
      desc: 'Cắt Seal & nhận kiện phân loại từ SOC về bưu cục phát',
      count: inTransitCount,
      icon: '🏢',
      activeColor: 'border-indigo-500 bg-indigo-50 ring-indigo-200',
      countColor: 'text-indigo-700 bg-indigo-100 border-indigo-300',
    },
    {
      id: 'DISPATCH_LASTMILE',
      title: '4. Chia Tuyến Shipper Phát',
      desc: 'Bàn giao Shipper Last-Mile đi phát tận tay người mua',
      count: destinationCount,
      icon: '🛵',
      activeColor: 'border-emerald-500 bg-emerald-50 ring-emerald-200',
      countColor: 'text-emerald-700 bg-emerald-100 border-emerald-300',
    },
    {
      id: 'HUB_CASHIER',
      title: '5. Thu Ngân Bưu Cục',
      desc: 'Duyệt nộp tiền COD & Quản lý quỹ tiền mặt bưu cục',
      count: 0,
      icon: '🏦',
      activeColor: 'border-rose-500 bg-rose-50 ring-rose-200',
      countColor: 'text-rose-700 bg-rose-100 border-rose-300',
    },
  ]

  const activeTabs = isSoc ? socTabs : hubTabs

  return (
    <div className={`grid gap-3 ${isSoc ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
      {activeTabs.map((tab) => {
        const isActive = currentTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col justify-between space-y-2.5 ${
              isActive
                ? `${tab.activeColor} shadow-sm ring-2`
                : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-xl">{tab.icon}</span>
              <span
                className={`text-lg font-black px-2.5 py-0.5 rounded-lg border ${
                  isActive ? tab.countColor : 'text-slate-500 bg-slate-100 border-slate-200'
                }`}
              >
                {tab.count}
              </span>
            </div>
            <div>
              <h4 className="font-black text-xs text-slate-800 leading-tight">{tab.title}</h4>
              <p className="text-[10px] text-slate-400 font-medium line-clamp-1">{tab.desc}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
