import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'
import {
  fetchBatchAuditScan,
  fetchViolationQueue,
  bulkHideAllPlatformViolations,
  fixProductCategory,
  type BatchAuditStats,
} from '../../services/ai-category-auditor.service'

interface CsCategoryAuditTabProps {
  user: any
  triggerAuditLog: (action: string) => Promise<void>
}

export const CsCategoryAuditTab: React.FC<CsCategoryAuditTabProps> = ({ user, triggerAuditLog }) => {
  const [batchAudit, setBatchAudit] = useState<BatchAuditStats | null>(null)
  const [isAuditing, setIsAuditing] = useState(false)
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [hidingId, setHidingId] = useState<string | null>(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50
  
  // Filter & Search (Mặc định: Chỉ hiển thị Hàng Đợi Vi Phạm để CSKH thao tác theo luồng Inbox Zero)
  const [filterIssue, setFilterIssue] = useState<'FLAGGED' | 'WRONG_CATEGORY' | 'IMAGE_MISMATCH' | 'PROHIBITED' | 'HIDDEN' | 'ALL'>('FLAGGED')
  const [searchQuery, setSearchQuery] = useState('')

  // Bulk Selection & Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [isBulkHidingAll, setIsBulkHidingAll] = useState(false)
  
  // Shops map: id -> { id, name, ownerId, phoneNumber }
  const [shopsMap, setShopsMap] = useState<Record<string, any>>({})
  
  // Modals
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string } | null>(null)
  const [warningModalItem, setWarningModalItem] = useState<any | null>(null)
  const [warningTitle, setWarningTitle] = useState('')
  const [warningMessage, setWarningMessage] = useState('')
  const [isSendingWarning, setIsSendingWarning] = useState(false)

  // Fetch shop metadata
  const fetchShops = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/shops`)
      if (res.ok) {
        const data = await res.json()
        const map: Record<string, any> = {}
        data.forEach((s: any) => { map[s.id] = s })
        setShopsMap(map)
      }
    } catch (e) {
      console.error('Error fetching shops map:', e)
    }
  }

  // Tải dữ liệu theo Hàng Đợi Vi Phạm (Centralized Violation Queue) hoặc Toàn Sàn
  const loadData = async (targetPage = currentPage, currentFilter = filterIssue) => {
    setIsAuditing(true)
    setSelectedIds([])
    try {
      let data: BatchAuditStats | null = null
      if (currentFilter === 'ALL') {
        data = await fetchBatchAuditScan(undefined, targetPage, pageSize)
      } else if (currentFilter === 'HIDDEN') {
        data = await fetchViolationQueue(undefined, targetPage, pageSize, undefined, 'hidden')
      } else {
        const issueType = currentFilter === 'WRONG_CATEGORY' ? 'WRONG_CATEGORY'
          : currentFilter === 'IMAGE_MISMATCH' ? 'IMAGE_MISMATCH'
          : currentFilter === 'PROHIBITED' ? 'PROHIBITED'
          : undefined
        data = await fetchViolationQueue(undefined, targetPage, pageSize, issueType, 'active')
      }

      if (data) {
        setBatchAudit(data)
        const maxPage = Math.max(1, data.totalPages || 1)
        const safePage = Math.min(targetPage, maxPage)
        setCurrentPage(safePage)
      }
    } catch (e) {
      console.error('Error loading violation queue data:', e)
    } finally {
      setIsAuditing(false)
    }
  }

  const handleFilterChange = (newFilter: typeof filterIssue) => {
    setFilterIssue(newFilter)
    setCurrentPage(1)
    loadData(1, newFilter)
  }

  useEffect(() => {
    fetchShops()
    loadData(1, 'FLAGGED')
  }, [])

  // Handle 1-Click Category Fix by CSKH (Auto-Refill: tự động kéo sản phẩm vi phạm tiếp theo lên)
  const handleAutoFixCategory = async (productId: string, newCategory: string, productName: string) => {
    setFixingId(productId)
    try {
      const ok = await fixProductCategory(productId, newCategory)
      if (ok) {
        await triggerAuditLog(`[CSKH AI-AUDIT] Cập nhật ngành hàng sản phẩm "${productName}" (ID: ${productId}) sang "${newCategory}"`)
        alert(`✅ CSKH đã chuyển sản phẩm "${productName}" sang đúng ngành hàng "${newCategory}" thành công!`)
        loadData(currentPage, filterIssue)
      } else {
        alert('Không thể cập nhật ngành hàng. Vui lòng thử lại.')
      }
    } catch (e: any) {
      alert('Lỗi khi cập nhật ngành hàng: ' + e.message)
    } finally {
      setFixingId(null)
    }
  }

  // Handle Toggle Product Hide/Show (Tạm ẩn khỏi sàn & Tự động thông báo Shop & Auto-Refill)
  const handleToggleProductStatus = async (item: any) => {
    const isCurrentlyHidden = item.status === 'hidden'
    const nextStatus = isCurrentlyHidden ? 'active' : 'hidden'
    const confirmText = isCurrentlyHidden
      ? `Mở khóa hiển thị lại sản phẩm "${item.name}" trên sàn?`
      : `CSKH xác nhận TẠM ẨN sản phẩm "${item.name}" khỏi sàn và TỰ ĐỘNG GỬI THÔNG BÁO đến Kênh Người Bán để Shop khắc phục?`

    if (!window.confirm(confirmText)) return

    setHidingId(item.id)
    try {
      const violationReason = item.auditResult?.recommendation || item.auditResult?.imageFeedback || 'Sản phẩm vi phạm quy định hình ảnh hoặc ngành hàng'
      const res = await fetch(`${API_BASE_URL}/products/bulk-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: [item.id],
          status: nextStatus,
          reason: violationReason,
        }),
      })
      if (res.ok) {
        await triggerAuditLog(`[CSKH AI-AUDIT] Đổi trạng thái sản phẩm "${item.name}" (ID: ${item.id}) sang ${nextStatus}`)
        alert(`✅ Đã ${isCurrentlyHidden ? 'mở khóa hiển thị' : 'tạm ẩn sản phẩm và tự động gửi thông báo đến Shop'} thành công!`)
        loadData(currentPage, filterIssue)
      } else {
        alert('Không thể cập nhật trạng thái sản phẩm.')
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message)
    } finally {
      setHidingId(null)
    }
  }

  // Handle Bulk Status Update (Tạm ẩn hoặc mở khóa hàng loạt & Auto-Refill)
  const handleBulkUpdateStatus = async (productIds: string[], targetStatus: 'hidden' | 'active', actionLabel: string) => {
    if (!productIds || productIds.length === 0) return

    const confirmMsg = targetStatus === 'hidden'
      ? `CSKH xác nhận TẠM ẨN ${productIds.length} sản phẩm vi phạm khỏi sàn và TỰ ĐỘNG GỬI THÔNG BÁO đến Kênh Người Bán?`
      : `CSKH xác nhận MỞ KHÓA HIỂN THỊ lại ${productIds.length} sản phẩm trên sàn?`

    if (!window.confirm(confirmMsg)) return

    setIsBulkProcessing(true)
    try {
      const res = await fetch(`${API_BASE_URL}/products/bulk-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds,
          status: targetStatus,
          reason: 'Sản phẩm vi phạm quy định hình ảnh hoặc ngành hàng trên sàn ZeroMall'
        })
      })

      if (res.ok) {
        await triggerAuditLog(`[CSKH AI-AUDIT] ${actionLabel} ${productIds.length} sản phẩm (Trạng thái: ${targetStatus})`)
        alert(`✅ Đã ${targetStatus === 'hidden' ? 'tạm ẩn và tự động gửi thông báo đến các chủ Shop' : 'mở khóa'} thành công ${productIds.length} sản phẩm!`)
        setSelectedIds([])
        loadData(currentPage, filterIssue)
      } else {
        alert('Không thể cập nhật trạng thái hàng loạt. Vui lòng thử lại.')
      }
    } catch (e: any) {
      alert('Lỗi cập nhật hàng loạt: ' + e.message)
    } finally {
      setIsBulkProcessing(false)
    }
  }

  // 1-Click Tạm Ẩn Toàn Bộ Vi Phạm Trên Sàn (Global Trust & Safety Action)
  const handleBulkHideAllPlatformViolations = async () => {
    const totalViolations = batchAudit?.totalActiveViolations ?? (batchAudit?.totalViolations || 0)
    if (totalViolations === 0) {
      alert('Hiện không còn sản phẩm vi phạm nào đang hoạt động trên sàn!')
      return
    }

    const confirmMsg = `⚡ XÁC NHẬN TẠM ẨN TOÀN BỘ VI PHẠM TRÊN TOÀN SÀN\n\nCSKH có chắc chắn muốn TẠM ẨN TOÀN BỘ ${totalViolations} sản phẩm vi phạm đang hoạt động trên sàn?\n\nHệ thống sẽ:\n1. Tự động tạm ẩn ${totalViolations} sản phẩm vi phạm khỏi sàn.\n2. Tự động gửi thông báo chi tiết đến Kênh Người Bán của tất cả các chủ Shop có sản phẩm vi phạm.`

    if (!window.confirm(confirmMsg)) return

    setIsBulkHidingAll(true)
    try {
      const result = await bulkHideAllPlatformViolations('CSKH tạm ẩn hàng loạt do vi phạm quy định hình ảnh hoặc ngành hàng')
      if (result && result.count > 0) {
        await triggerAuditLog(`[CSKH AI-AUDIT] Tạm ẩn toàn bộ ${result.count} sản phẩm vi phạm trên toàn sàn`)
        alert(`✅ ĐÃ TẠM ẨN THÀNH CÔNG ${result.count} SẢN PHẨM VI PHẠM TRÊN TOÀN SÀN!\n\nHệ thống đã gửi thông báo đến các gian hàng liên quan để chủ shop chủ động sửa thông tin.`)
        setSelectedIds([])
        loadData(1, filterIssue)
      } else {
        alert('Không có sản phẩm vi phạm nào được cập nhật hoặc toàn bộ vi phạm đã được xử lý.')
        loadData(1, filterIssue)
      }
    } catch (e: any) {
      alert('Lỗi khi tạm ẩn toàn bộ vi phạm: ' + e.message)
    } finally {
      setIsBulkHidingAll(false)
    }
  }

  // Open Warning Notification Modal
  const openWarningModal = (item: any) => {
    const shop = shopsMap[item.shopId]
    const shopName = shop?.name || `Shop #${item.shopId?.slice(0, 8)}`
    const isImageMismatch = item.auditResult?.issueType === 'IMAGE_MISMATCH'

    setWarningModalItem(item)
    setWarningTitle(isImageMismatch ? `[Cảnh báo CSKH] Hình ảnh sản phẩm không khớp nội dung` : `[Cảnh báo CSKH] Sản phẩm sai phân loại ngành hàng`)
    
    if (isImageMismatch) {
      setWarningMessage(
        `Kính gửi ${shopName},\n\nBộ phận CSKH & Kiểm duyệt ZeroMall phát hiện sản phẩm "${item.name}" (Mã: ${item.id}) có hình ảnh minh họa không khớp với tiêu đề và mô tả.\n\nChi tiết đánh giá: ${item.auditResult?.imageFeedback || item.auditResult?.recommendation}\n\nVui lòng cập nhật hình ảnh đúng thực tế của sản phẩm trong vòng 24 giờ. Sau thời gian này, sản phẩm có thể bị tạm khóa hiển thị để bảo vệ quyền lợi người mua.\n\nTrân trọng,\nBộ phận CSKH ZeroMall`
      )
    } else {
      setWarningMessage(
        `Kính gửi ${shopName},\n\nBộ phận CSKH & Kiểm duyệt ZeroMall phát hiện sản phẩm "${item.name}" (Mã: ${item.id}) đang đăng bán trong danh mục "${item.category}" chưa phù hợp.\n\nĐề xuất điều chỉnh: Chuyển sang danh mục "${item.auditResult?.suggestedCategory || 'Danh mục chuẩn'}".\n\nVui lòng vào Kênh Người Bán để cập nhật lại danh mục đúng chuẩn.\n\nTrân trọng,\nBộ phận CSKH ZeroMall`
      )
    }
  }

  // Send Warning Notification to Shop Owner
  const handleSendWarning = async () => {
    if (!warningModalItem) return
    const shop = shopsMap[warningModalItem.shopId]
    const targetUserId = shop?.ownerId || warningModalItem.shopId

    setIsSendingWarning(true)
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          title: warningTitle,
          content: warningMessage,
          type: 'SYSTEM',
          metadata: {
            productId: warningModalItem.id,
            shopId: warningModalItem.shopId,
            sentBy: user?.email || 'cskh@zeromall.vn',
            issueType: warningModalItem.auditResult?.issueType
          }
        })
      })

      if (res.ok) {
        await triggerAuditLog(`[CSKH CẢNH BÁO SHOP] Đã gửi thông báo nhắc nhở Shop "${shop?.name || warningModalItem.shopId}" về sản phẩm "${warningModalItem.name}"`)
        alert('✅ Đã gửi thông báo cảnh báo thành công tới chủ gian hàng!')
        setWarningModalItem(null)
      } else {
        alert('Không thể gửi thông báo. Vui lòng thử lại.')
      }
    } catch (e: any) {
      alert('Lỗi khi gửi thông báo: ' + e.message)
    } finally {
      setIsSendingWarning(false)
    }
  }

  // Base products list: use allProducts (50 items) if available, fallback to flaggedProducts
  const baseProducts = (batchAudit?.allProducts && batchAudit.allProducts.length > 0)
    ? batchAudit.allProducts
    : (batchAudit?.flaggedProducts || [])

  // Thống kê động trên toàn sàn và trên trang hiện tại
  const activeViolationsCount = batchAudit?.totalActiveViolations ?? (batchAudit?.totalViolations || 0)
  const hiddenViolationsCount = batchAudit?.totalHiddenViolations ?? 0
  const totalPlatformProducts = batchAudit?.totalProducts || 7430
  const wrongCategoryCount = batchAudit?.wrongCategoryCount || 0
  const imageMismatchCount = batchAudit?.imageMismatchCount || 0
  const prohibitedCount = batchAudit?.prohibitedCount || 0

  const filteredProducts = baseProducts.filter((item) => {
    // 1. Issue type filter
    if (filterIssue === 'FLAGGED' && (item.auditResult?.isMatched || item.status === 'hidden')) return false
    if (filterIssue === 'WRONG_CATEGORY' && (item.auditResult?.issueType !== 'WRONG_CATEGORY' || item.status === 'hidden')) return false
    if (filterIssue === 'IMAGE_MISMATCH' && (item.auditResult?.issueType !== 'IMAGE_MISMATCH' || item.status === 'hidden')) return false
    if (filterIssue === 'PROHIBITED' && ((item.auditResult?.issueType !== 'PROHIBITED_ITEM' && !item.auditResult?.isProhibited) || item.status === 'hidden')) return false
    if (filterIssue === 'HIDDEN' && item.status !== 'hidden') return false

    // 2. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const nameMatch = (item.name || '').toLowerCase().includes(q)
      const idMatch = (item.id || '').toLowerCase().includes(q)
      const shopName = (shopsMap[item.shopId]?.name || '').toLowerCase()
      const shopMatch = shopName.includes(q) || (item.shopId || '').toLowerCase().includes(q)
      if (!nameMatch && !idMatch && !shopMatch) return false
    }

    return true
  })

  // Đếm số sản phẩm vi phạm chưa bị ẩn trên trang hiện tại
  const unhiddenFlaggedCount = filteredProducts.filter((p) => !p.auditResult?.isMatched && p.status !== 'hidden').length
  const totalInQueue = filterIssue === 'ALL' ? totalPlatformProducts : filterIssue === 'HIDDEN' ? hiddenViolationsCount : activeViolationsCount

  // Danh sách ID đang hiển thị trên bảng
  const allVisibleIds = filteredProducts.map((p) => p.id)
  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id))

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(allVisibleIds)
    }
  }

  // Tích nhanh tất cả các sản phẩm vi phạm chưa bị ẩn
  const handleSelectAllFlagged = () => {
    const unhiddenFlaggedIds = filteredProducts
      .filter((p) => !p.auditResult?.isMatched && p.status !== 'hidden')
      .map((p) => p.id)
    setSelectedIds(unhiddenFlaggedIds)
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <h2 className="text-base font-black tracking-tight text-white uppercase">
                AI Category & Image Auditor (Hàng Đợi Vi Phạm CSKH)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/40 text-emerald-200 border border-emerald-400/30">
                Multimodal AI QC
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 font-medium max-w-2xl">
              Hàng đợi xử lý vi phạm tập trung (Centralized Violation Queue). Tự động đẩy sản phẩm sai lệch lên đầu ca trực, tự động nạp tiếp khi xử lý (Auto-Refill) và 1-Click Tạm ẩn toàn sàn.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Nút Tạm Ẩn Toàn Bộ Vi Phạm Trên Sàn (1-Click Global Take-down) */}
            {activeViolationsCount > 0 && (
              <button
                type="button"
                onClick={handleBulkHideAllPlatformViolations}
                disabled={isBulkHidingAll || isAuditing}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 active:from-red-900 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-lg border border-red-400/40 disabled:opacity-50"
                title="Tạm ẩn toàn bộ vi phạm trên toàn sàn và tự động gửi thông báo đến các chủ gian hàng"
              >
                <span>{isBulkHidingAll ? '⏳' : '🚫'}</span>
                <span>
                  {isBulkHidingAll
                    ? 'Đang Tạm Ẩn...'
                    : `Tạm Ẩn Toàn Bộ (${activeViolationsCount.toLocaleString('vi-VN')} Vi Phạm)`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => loadData(currentPage, filterIssue)}
              disabled={isAuditing}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 shadow-sm"
            >
              <span>{isAuditing ? '⏳' : '⚡'}</span>
              <span>{isAuditing ? 'Đang Quét AI...' : 'Quét Lại Bằng AI'}</span>
            </button>
          </div>
        </div>

        {/* 5 Stats Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-emerald-700/50">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">Tổng Sản Phẩm Sàn</p>
            <p className="text-xl font-black text-white mt-0.5">{totalPlatformProducts.toLocaleString('vi-VN')}</p>
          </div>
          <div className="bg-amber-500/20 backdrop-blur-md rounded-xl p-3 border border-amber-400/40 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-amber-200 font-bold uppercase tracking-wider">Hàng Đợi Vi Phạm</p>
              <span className="px-1.5 py-0.2 bg-amber-400/30 text-amber-100 rounded text-[9px] font-black uppercase">
                Auto-Refill
              </span>
            </div>
            <p className="text-xl font-black text-amber-100 mt-0.5">{activeViolationsCount.toLocaleString('vi-VN')}</p>
          </div>
          <div className="bg-slate-700/40 backdrop-blur-md rounded-xl p-3 border border-slate-500/30">
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Đã Tạm Ẩn Trên Sàn</p>
            <p className="text-xl font-black text-slate-100 mt-0.5">{hiddenViolationsCount.toLocaleString('vi-VN')}</p>
          </div>
          <div className="bg-amber-600/20 backdrop-blur-md rounded-xl p-3 border border-amber-500/30">
            <p className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">Sai Ngành Hàng</p>
            <p className="text-xl font-black text-amber-200 mt-0.5">{wrongCategoryCount}</p>
          </div>
          <div className="bg-rose-500/20 backdrop-blur-md rounded-xl p-3 border border-rose-400/30">
            <p className="text-[10px] text-rose-300 font-bold uppercase tracking-wider">Lệch Ảnh & Tiêu Đề</p>
            <p className="text-xl font-black text-rose-200 mt-0.5">{imageMismatchCount}</p>
          </div>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Sub-filters */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => handleFilterChange('FLAGGED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterIssue === 'FLAGGED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <span>⚡ Cần xử lý</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px] font-black">
                {activeViolationsCount}
              </span>
            </button>
            <button
              onClick={() => handleFilterChange('WRONG_CATEGORY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterIssue === 'WRONG_CATEGORY'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <span>⚠️ Sai ngành hàng</span>
              <span className="px-1.5 py-0.2 bg-amber-600/30 rounded-full text-[10px]">
                {wrongCategoryCount}
              </span>
            </button>
            <button
              onClick={() => handleFilterChange('IMAGE_MISMATCH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterIssue === 'IMAGE_MISMATCH'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <span>🚨 Lệch ảnh & tiêu đề</span>
              <span className="px-1.5 py-0.2 bg-rose-700/30 rounded-full text-[10px]">
                {imageMismatchCount}
              </span>
            </button>
            {prohibitedCount > 0 && (
              <button
                onClick={() => handleFilterChange('PROHIBITED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  filterIssue === 'PROHIBITED'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                }`}
              >
                <span>🚫 Hàng cấm</span>
                <span className="px-1.5 py-0.2 bg-red-700/30 rounded-full text-[10px]">
                  {prohibitedCount}
                </span>
              </button>
            )}
            <button
              onClick={() => handleFilterChange('HIDDEN')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterIssue === 'HIDDEN'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>🚫 Đang tạm ẩn (Chờ Shop sửa)</span>
              <span className="px-1.5 py-0.2 bg-slate-900/20 rounded-full text-[10px] font-black">
                {hiddenViolationsCount}
              </span>
            </button>
            <button
              onClick={() => handleFilterChange('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterIssue === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Toàn sàn ({totalPlatformProducts.toLocaleString('vi-VN')})</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-80">
            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm, ID, hoặc tên Shop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 2.5 Batch Action & Selection Toolbar */}
      {filteredProducts.length > 0 && (
        <div className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
          selectedIds.length > 0
            ? 'bg-amber-500/10 border-amber-300'
            : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span>Tích chọn toàn bộ ({filteredProducts.length} sản phẩm trên trang)</span>
            </label>

            {unhiddenFlaggedCount > 0 && (
              <button
                type="button"
                onClick={handleSelectAllFlagged}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span>⚡ Tích nhanh {unhiddenFlaggedCount} vi phạm</span>
              </button>
            )}

            {selectedIds.length > 0 && (
              <span className="text-xs font-extrabold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md">
                Đã tích: {selectedIds.length} sản phẩm
              </span>
            )}
          </div>

          {/* Action buttons when items are selected */}
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => handleBulkUpdateStatus(selectedIds, 'hidden', `Tạm ẩn ${selectedIds.length} sản phẩm đã chọn`)}
                  disabled={isBulkProcessing}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <span>{isBulkProcessing ? '⏳' : '🚫'}</span>
                  <span>
                    {selectedIds.length === filteredProducts.length
                      ? `Tạm Ẩn Cả Trang (${selectedIds.length})`
                      : `Tạm Ẩn (${selectedIds.length} Đã Chọn)`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkUpdateStatus(selectedIds, 'active', `Mở khóa ${selectedIds.length} sản phẩm đã chọn`)}
                  disabled={isBulkProcessing}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <span>{isBulkProcessing ? '⏳' : '👁️'}</span>
                  <span>Mở Khóa ({selectedIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-xl cursor-pointer transition"
                >
                  Bỏ tích
                </button>
              </>
            ) : unhiddenFlaggedCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const ids = filteredProducts.filter((p) => !p.auditResult?.isMatched && p.status !== 'hidden').map((p) => p.id)
                  handleBulkUpdateStatus(ids, 'hidden', `Tạm ẩn toàn bộ ${ids.length} vi phạm trên trang`)
                }}
                disabled={isBulkProcessing}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold rounded-xl cursor-pointer transition flex items-center gap-1 shadow-2xs"
                title="Tạm ẩn toàn bộ vi phạm trên trang hiện tại và tự động nạp vi phạm tiếp theo từ hàng đợi (Auto-Refill)"
              >
                <span>⚡ Tạm Ẩn Toàn Trang ({unhiddenFlaggedCount} Vi Phạm)</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 italic">
                (Tích chọn sản phẩm để thực hiện Tạm ẩn hoặc Mở khóa)
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. Main Audit Results Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs relative">
        {isAuditing && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-100 overflow-hidden z-10">
            <div className="h-full bg-emerald-600 animate-pulse w-full"></div>
          </div>
        )}
        {isAuditing && !batchAudit ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-500 font-bold">
              Hệ thống AI đang tải hàng đợi vi phạm và đối chiếu hình ảnh thực tế...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            {filterIssue === 'FLAGGED' && activeViolationsCount === 0 ? (
              <div className="space-y-3 bg-gradient-to-b from-white to-emerald-50/40 p-8 rounded-2xl max-w-xl mx-auto">
                <span className="text-5xl animate-bounce inline-block">🎉</span>
                <h3 className="text-base font-black text-slate-900">
                  Hoàn thành ca trực! Toàn sàn sạch bóng vi phạm!
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Tất cả các sản phẩm có nghi vấn lệch ảnh bìa hoặc sai ngành hàng trên toàn sàn đã được xử lý Tạm Ẩn hoặc chuẩn hóa danh mục. Hệ thống tự động gửi thông báo đến các chủ Shop để chủ động sửa đổi thông tin.
                </p>
                <div className="pt-2 flex items-center justify-center gap-3">
                  {hiddenViolationsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleFilterChange('HIDDEN')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                    >
                      Xem {hiddenViolationsCount} sản phẩm đang tạm ẩn »
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => loadData(1, 'FLAGGED')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                  >
                    🔄 Rà soát lại hàng đợi
                  </button>
                </div>
              </div>
            ) : filterIssue === 'HIDDEN' ? (
              <div className="space-y-2 py-10">
                <span className="text-4xl">📦</span>
                <p className="text-sm font-black text-slate-800">
                  Không có sản phẩm nào đang trong trạng thái Tạm Ẩn.
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  Tất cả sản phẩm đã được mở khóa hiển thị hoặc chưa có sản phẩm nào bị tạm ẩn.
                </p>
              </div>
            ) : (
              <div className="space-y-2 py-10">
                <span className="text-4xl">🔍</span>
                <p className="text-sm font-black text-slate-800">
                  {searchQuery
                    ? 'Không tìm thấy sản phẩm phù hợp với từ khóa tìm kiếm'
                    : 'Không có sản phẩm nào trong danh sách này.'}
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  Bạn có thể chuyển sang các tab bộ lọc khác để kiểm tra hoặc chọn "Cần xử lý".
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className={`overflow-x-auto ${isAuditing ? 'opacity-60 transition' : ''}`}>
            <table className="w-full text-xs text-left text-slate-700">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      title={isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả sản phẩm trên trang'}
                    />
                  </th>
                  <th className="py-3.5 px-4 min-w-[240px]">Sản Phẩm & Ảnh Bìa</th>
                  <th className="py-3.5 px-3 min-w-[160px]">Gian Hàng (Shop)</th>
                  <th className="py-3.5 px-3">Ngành Hàng Hiện Tại</th>
                  <th className="py-3.5 px-3 min-w-[280px]">AI Chẩn Đoán & Khuyến Nghị</th>
                  <th className="py-3.5 px-4 text-center min-w-[190px]">Nghiệp Vụ CSKH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((item) => {
                  const shop = shopsMap[item.shopId]
                  const shopName = shop?.name || `Shop #${item.shopId?.slice(0, 8)}`
                  const res = item.auditResult
                  const isProhibited = res?.issueType === 'PROHIBITED_ITEM' || res?.isProhibited
                  const isImageMismatch = !isProhibited && res?.issueType === 'IMAGE_MISMATCH'
                  const isWrongCategory = !isProhibited && res?.issueType === 'WRONG_CATEGORY'
                  const isHidden = item.status === 'hidden'

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/70 transition ${selectedIds.includes(item.id) ? 'bg-emerald-50/40' : ''}`}>
                      {/* Cột 0: Checkbox chọn */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => handleToggleSelectOne(item.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Cột 1: Sản phẩm & Ảnh */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setImagePreview({ src: item.image, title: item.name })}
                            className="relative group shrink-0 cursor-pointer"
                            title="Click để phóng to ảnh"
                          >
                            <img
                              src={item.image || 'https://placehold.co/100x100?text=No+Image'}
                              alt={item.name}
                              className="w-14 h-14 object-cover rounded-xl border border-slate-200 shadow-2xs group-hover:scale-105 transition"
                            />
                            <span className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                              🔍 Phóng to
                            </span>
                          </button>
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-bold text-slate-900 line-clamp-2 hover:text-emerald-700 transition" title={item.name}>
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-mono">ID: {item.id.slice(0, 10)}...</span>
                              {isHidden && (
                                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded text-[9px] font-black">
                                  ĐÃ ẨN
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Gian hàng */}
                      <td className="py-3.5 px-3">
                        <p className="font-bold text-slate-900">{shopName}</p>
                        {shop?.phoneNumber && (
                          <p className="text-[10px] text-slate-500 font-medium">📞 {shop.phoneNumber}</p>
                        )}
                        <a
                          href={`/shop/${item.shopId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-emerald-600 hover:text-emerald-700 hover:underline font-bold inline-flex items-center gap-1 mt-0.5"
                        >
                          <span>🏪</span> Xem Shop
                        </a>
                      </td>

                      {/* Cột 3: Ngành hàng hiện tại */}
                      <td className="py-3.5 px-3">
                        {item.auditResult?.isMatched ? (
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                            ✅ {item.category}
                          </span>
                        ) : isProhibited ? (
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-red-100 border border-red-300 text-red-800 text-[11px] font-black">
                            🚫 {item.category}
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                            ❌ {item.category}
                          </span>
                        )}
                      </td>

                      {/* Cột 4: AI Chẩn đoán */}
                      <td className="py-3.5 px-3">
                        {item.auditResult?.isMatched ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                                ✅ CHUẨN NGÀNH HÀNG
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                Độ tin cậy: {res?.confidence || 98}%
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800 font-medium leading-relaxed bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                              {res?.recommendation || 'Hình ảnh và tiêu đề hoàn toàn đồng nhất với phân loại ngành hàng.'}
                            </p>
                          </div>
                        ) : isProhibited ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-700 text-white flex items-center gap-1 shadow-xs">
                                <span>🚫</span>
                                <span>VI PHẠM HÀNG CẤM</span>
                              </span>
                              <span className="text-[10px] text-red-600 font-bold">
                                Độ tin cậy: {res?.confidence || 98}%
                              </span>
                            </div>
                            <p className="text-[11px] text-red-900 font-bold leading-relaxed bg-red-50 p-2 rounded-lg border border-red-200">
                              {res?.recommendation || res?.imageFeedback || `[Cảnh báo an toàn] Hình ảnh nhận diện là ${res?.prohibitedLabel || 'vật phẩm cấm kinh doanh'}.`}
                            </p>
                            <p className="text-[11px] text-red-700 font-bold flex items-center gap-1.5">
                              <span>👉 Biện pháp xử lý:</span>
                              <span className="px-2 py-0.5 bg-red-100 border border-red-300 rounded-md font-extrabold text-red-800">
                                Khóa sản phẩm khẩn cấp & Cảnh cáo vi phạm chính sách sàn
                              </span>
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                isImageMismatch 
                                  ? 'bg-rose-600 text-white' 
                                  : 'bg-amber-500 text-white'
                              }`}>
                                {isImageMismatch ? '🚨 LỆCH ẢNH & TIÊU ĐỀ' : '⚠️ SAI NGÀNH HÀNG'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                Độ tin cậy: {res?.confidence || 90}%
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700 font-medium leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                              {res?.imageFeedback || res?.recommendation}
                            </p>
                            {/* Đề xuất chuyển ngành CHỈ hiển thị khi SAI NGÀNH HÀNG và KHÔNG PHẢI HÀNG CẤM */}
                            {isWrongCategory && res?.suggestedCategory && res.suggestedCategory !== item.category && res.suggestedCategory !== 'Hàng Cấm Kinh Doanh' && (
                              <p className="text-[11px] text-indigo-700 font-bold flex items-center gap-1.5">
                                <span>👉 Đề xuất chuyển sang:</span>
                                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-md font-extrabold text-indigo-800">
                                  {res.suggestedCategory}
                                </span>
                              </p>
                            )}

                            {/* Khi LỆCH ẢNH & TIÊU ĐỀ: Khuyến nghị yêu cầu Shop đổi ảnh thực tế */}
                            {isImageMismatch && (
                              <p className="text-[11px] text-rose-700 font-bold flex items-center gap-1.5">
                                <span>👉 Biện pháp:</span>
                                <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 rounded-md font-medium text-rose-800">
                                  Yêu cầu Shop tải ảnh đúng thực tế hoặc Tạm ẩn
                                </span>
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Cột 5: Nghiệp vụ CSKH */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col gap-1.5 items-stretch justify-center max-w-[180px] mx-auto">
                          {item.auditResult?.isMatched ? (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-bold border border-emerald-200 flex items-center justify-center gap-1 shadow-2xs">
                              <span>🛡️</span>
                              <span>Đã Duyệt Đạt Chuẩn</span>
                            </span>
                          ) : isHidden ? (
                            /* Sản phẩm ĐÃ BỊ TẠM ẨN: Hiển thị trạng thái rõ ràng, không hiển thị các nút thao tác thừa */
                            <div className="flex flex-col gap-1 items-stretch justify-center">
                              <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-[11px] font-bold border border-slate-200 flex items-center justify-center gap-1.5 shadow-2xs">
                                <span>🚫</span>
                                <span>Đã Ẩn (Chờ Shop Sửa)</span>
                              </span>
                              <div className="flex items-center justify-center gap-2 mt-1">
                                <button
                                  type="button"
                                  onClick={() => openWarningModal(item)}
                                  className="text-[10px] text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                                  title="Gửi lại cảnh báo nhắc nhở Shop sửa lỗi"
                                >
                                  <span>🔔</span> Báo lại Shop
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleProductStatus(item)}
                                  disabled={hidingId === item.id}
                                  className="text-[10px] text-slate-500 hover:text-emerald-700 font-bold hover:underline cursor-pointer"
                                  title="Mở khóa hiển thị ngoại lệ nếu sản phẩm hợp lệ"
                                >
                                  Mở khóa
                                </button>
                              </div>
                            </div>
                          ) : isProhibited ? (
                            /* Khóa Khẩn Cấp dành riêng cho Hàng Cấm */
                            <button
                              type="button"
                              onClick={() => handleToggleProductStatus(item)}
                              disabled={hidingId === item.id}
                              className="px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs bg-red-600 hover:bg-red-700 text-white"
                              title="Khóa sản phẩm vi phạm hàng cấm ngay lập tức và tự động gửi thông báo"
                            >
                              <span>{hidingId === item.id ? '⏳' : '🚫'}</span>
                              <span>Khóa Khẩn Cấp & Báo Shop</span>
                            </button>
                          ) : (
                            /* Sản phẩm sai ngành hàng hoặc lệch ảnh: 1-Click chuẩn hóa hoặc Tạm Ẩn & Báo Shop */
                            <>
                              {/* 1-Click Fix Category: CHỈ HIỂN THỊ KHI SAI NGÀNH HÀNG (WRONG_CATEGORY) VÀ KHÔNG PHẢI HÀNG CẤM */}
                              {isWrongCategory && res?.suggestedCategory && res.suggestedCategory !== item.category && res.suggestedCategory !== 'Hàng Cấm Kinh Doanh' && (
                                <button
                                  type="button"
                                  onClick={() => handleAutoFixCategory(item.id, res.suggestedCategory, item.name)}
                                  disabled={fixingId === item.id}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50"
                                  title={`Duyệt sửa sang ngành hàng ${res.suggestedCategory}`}
                                >
                                  <span>{fixingId === item.id ? '⏳' : '⚡'}</span>
                                  <span className="truncate">1-Click: Đổi sang {res.suggestedCategory}</span>
                                </button>
                              )}

                              {/* Tạm ẩn & Tự Động Báo Shop: 1-Click thao tác chuẩn sàn Shopee/TikTok Shop */}
                              <button
                                type="button"
                                onClick={() => handleToggleProductStatus(item)}
                                disabled={hidingId === item.id}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50"
                                title="Tạm ẩn sản phẩm khỏi sàn và tự động gửi thông báo chi tiết lý do cho Shop"
                              >
                                <span>{hidingId === item.id ? '⏳' : '🚫'}</span>
                                <span>Tạm Ẩn & Báo Shop</span>
                              </button>

                              {/* Nhắc nhở phụ (chưa tạm ẩn) */}
                              <button
                                type="button"
                                onClick={() => openWarningModal(item)}
                                className="text-[10px] text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer flex items-center justify-center gap-1 mt-0.5"
                                title="Chỉ gửi cảnh báo nhắc nhở mà chưa tạm ẩn sản phẩm"
                              >
                                <span>🔔</span>
                                <span>Chỉ nhắc nhở (chưa ẩn)</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Sleek Bottom Pagination Toolbar */}
        {batchAudit && (batchAudit.totalPages || 1) > 1 && (
          <div className="bg-slate-50/90 border-t border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 font-medium">
              Đang xem <span className="font-bold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> - <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, totalInQueue)}</span> trên tổng số <span className="font-bold text-emerald-700">{totalInQueue.toLocaleString('vi-VN')}</span> {filterIssue === 'ALL' ? 'sản phẩm toàn sàn' : 'vi phạm trong hàng đợi'} (Trang <span className="font-bold text-slate-800">{currentPage}</span> / {batchAudit.totalPages})
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => loadData(1, filterIssue)}
                disabled={currentPage <= 1 || isAuditing}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                title="Về trang 1"
              >
                « Đầu
              </button>
              <button
                type="button"
                onClick={() => loadData(currentPage - 1, filterIssue)}
                disabled={currentPage <= 1 || isAuditing}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <span>‹</span>
                <span>Trước</span>
              </button>

              {/* Dynamic Page Buttons */}
              <div className="flex items-center gap-1 px-1">
                {(() => {
                  const totalP = batchAudit.totalPages || 1
                  const maxButtons = 5
                  let startP = Math.max(1, currentPage - 2)
                  let endP = Math.min(totalP, startP + maxButtons - 1)
                  if (endP - startP < maxButtons - 1) {
                    startP = Math.max(1, endP - maxButtons + 1)
                  }

                  const pages = []
                  for (let p = startP; p <= endP; p++) {
                    pages.push(p)
                  }

                  return pages.map((pageNum) => {
                    const isActive = pageNum === currentPage
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => loadData(pageNum, filterIssue)}
                        disabled={isAuditing}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-2xs font-extrabold ring-2 ring-emerald-400/40'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })
                })()}
              </div>

              <button
                type="button"
                onClick={() => loadData(currentPage + 1, filterIssue)}
                disabled={currentPage >= (batchAudit.totalPages || 1) || isAuditing}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <span>Sau</span>
                <span>›</span>
              </button>
              <button
                type="button"
                onClick={() => loadData(batchAudit.totalPages || 1, filterIssue)}
                disabled={currentPage >= (batchAudit.totalPages || 1) || isAuditing}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                title="Đến trang cuối cùng"
              >
                Cuối »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Zoom Image Preview Modal */}
      {imagePreview && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setImagePreview(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 line-clamp-1">{imagePreview.title}</h3>
              <button 
                onClick={() => setImagePreview(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center max-h-[70vh]">
              <img 
                src={imagePreview.src} 
                alt={imagePreview.title} 
                className="object-contain max-h-[70vh] w-full"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. CSKH Warning Notification Modal */}
      {warningModalItem && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setWarningModalItem(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <h3 className="text-sm font-black text-slate-900">
                  Gửi Cảnh Báo Vi Phạm Cho Gian Hàng
                </h3>
              </div>
              <button 
                onClick={() => setWarningModalItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Tiêu đề thông báo
                </label>
                <input
                  type="text"
                  value={warningTitle}
                  onChange={(e) => setWarningTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Nội dung nhắc nhở / Yêu cầu khắc phục
                </label>
                <textarea
                  rows={7}
                  value={warningMessage}
                  onChange={(e) => setWarningMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWarningModalItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSendWarning}
                disabled={isSendingWarning}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>{isSendingWarning ? '⏳' : '🚀'}</span>
                <span>{isSendingWarning ? 'Đang gửi...' : 'Gửi Cảnh Báo Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
