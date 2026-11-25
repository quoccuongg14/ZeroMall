import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api.config'

interface CsProductModerationSubTabProps {
  triggerAuditLog: (action: string) => Promise<void>
}

export const CsProductModerationSubTab: React.FC<CsProductModerationSubTabProps> = ({ triggerAuditLog }) => {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState<'VIOLATIONS' | 'DELISTED' | 'ACTIVE' | 'ALL'>('VIOLATIONS')
  const [policyTypeFilter, setPolicyTypeFilter] = useState<'ALL' | 'BUYER_REPORT' | 'PROHIBITED' | 'COUNTERFEIT'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [counts, setCounts] = useState({
    all: 0,
    active: 0,
    violations: 0,
    delisted: 0,
    buyerReports: 0,
    counterfeit: 0,
    prohibited: 0,
  })
  const [categories, setCategories] = useState<any[]>([])
  const [shopsMap, setShopsMap] = useState<Record<string, string>>({})

  // Modals
  const [deleteModalProduct, setDeleteModalProduct] = useState<any | null>(null)
  const [deleteReason, setDeleteReason] = useState('Hàng giả / Nhái nhãn hiệu')
  const [deleteNote, setDeleteNote] = useState('')
  const [penaltyPoints, setPenaltyPoints] = useState<number>(3)
  const [isDeleting, setIsDeleting] = useState(false)

  // Lock / Hide Modal (hỗ trợ khóa toàn bộ sản phẩm dùng chung ảnh sai trên sàn)
  const [lockModalProduct, setLockModalProduct] = useState<any | null>(null)
  const [lockReason, setLockReason] = useState('Ảnh hiển thị sai lệch hoặc không khớp với sản phẩm thực tế')
  const [lockSameImageAcrossShops, setLockSameImageAcrossShops] = useState(true)
  const [isLocking, setIsLocking] = useState(false)

  // Preview Modal
  const [previewProduct, setPreviewProduct] = useState<any | null>(null)

  // Edit Stock & Sales Modal
  const [stockEditProduct, setStockEditProduct] = useState<any | null>(null)
  const [editStockValue, setEditStockValue] = useState<number>(0)
  const [editSalesValue, setEditSalesValue] = useState<number>(0)
  const [isUpdatingStock, setIsUpdatingStock] = useState<boolean>(false)

  // Phân biệt vi phạm chính sách với lỗi lệch ảnh/ngành hàng AI (thuộc riêng tab Rà Soát AI)
  const isImageMismatchViolation = (p: any) => {
    const reason = (p.violationReason || '').toLowerCase()
    return (
      reason.startsWith('ảnh hiển thị') ||
      reason.startsWith('ảnh là') ||
      reason.includes('không tương thích với ngành hàng') ||
      reason.includes('quy định hình ảnh hoặc ngành hàng') ||
      reason.includes('không khớp với sản phẩm')
    )
  }

  const isPolicyViolation = (p: any) => {
    if (p.reportsCount && p.reportsCount > 0) return true
    if (p.isViolated && !isImageMismatchViolation(p)) return true
    return false
  }

  const getPolicyViolationType = (p: any): 'BUYER_REPORT' | 'PROHIBITED' | 'COUNTERFEIT' | 'OTHER' => {
    const reason = (p.violationReason || '').toLowerCase()
    if (p.reportsCount && p.reportsCount > 0) return 'BUYER_REPORT'
    if (reason.includes('hàng giả') || reason.includes('nhái') || reason.includes('sở hữu trí tuệ') || reason.includes('bản quyền')) {
      return 'COUNTERFEIT'
    }
    if (reason.includes('từ cấm') || reason.includes('nguy hiểm') || reason.includes('cấm') || reason.includes('y tế') || reason.includes('quảng cáo')) {
      return 'PROHIBITED'
    }
    return 'OTHER'
  }

  const fetchMetadata = async () => {
    try {
      const [resCat, resShops] = await Promise.all([
        fetch(`${API_BASE_URL}/products/categories`),
        fetch(`${API_BASE_URL}/auth/shops`),
      ])
      if (resCat.ok) {
        setCategories(await resCat.json())
      }
      if (resShops.ok) {
        const shopsData = await resShops.json()
        const map: Record<string, string> = {}
        shopsData.forEach((s: any) => { map[s.id] = s.name })
        setShopsMap(map)
      }
    } catch (e) {
      console.error('Error fetching metadata for CS moderation:', e)
    }
  }

  const fetchAllProducts = async (pageToFetch = currentPage) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        subTab: activeSubTab,
        policyType: policyTypeFilter,
        category: categoryFilter,
        page: String(pageToFetch),
        limit: '50',
      })
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim())
      }

      const resProd = await fetch(`${API_BASE_URL}/products/moderation/list?${params.toString()}`)
      if (resProd.ok) {
        const data = await resProd.json()
        setProducts(Array.isArray(data.products) ? data.products : [])
        if (data.pagination) {
          setTotalPages(Math.max(1, data.pagination.totalPages || 1))
          setTotalItems(data.pagination.total || 0)
        }
        if (data.counts) {
          setCounts(data.counts)
        }
      }
    } catch (e) {
      console.error('Error fetching products for CS moderation:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetadata()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    fetchAllProducts(currentPage)
  }, [activeSubTab, policyTypeFilter, categoryFilter, debouncedSearch, currentPage])

  const formatMoney = (val: any) => {
    const num = parseFloat(val) || 0
    return num.toLocaleString('vi-VN') + 'đ'
  }

  // Server đã lọc & phân trang sẵn
  const filteredProducts = products
  const countAll = counts.all
  const countActive = counts.active
  const countViolations = counts.violations
  const countDelisted = counts.delisted
  const countBuyerReports = counts.buyerReports
  const countProhibited = counts.prohibited
  const countCounterfeit = counts.counterfeit

  // Xử lý Xóa Vi Phạm Sản Phẩm & Phạt Sao Quả Tạ
  const handleConfirmDeleteViolation = async () => {
    if (!deleteModalProduct) return
    setIsDeleting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/products/${deleteModalProduct.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        const fullReason = `CSKH gỡ sản phẩm vi phạm: [${deleteReason}] ${deleteNote ? `- Ghi chú: ${deleteNote}` : ''} (+${penaltyPoints} điểm Sao Quả Tạ Shop ${shopsMap[deleteModalProduct.shopId] || deleteModalProduct.shopId})`
        await triggerAuditLog(`[CSKH MODERATION] ${fullReason} - Sản phẩm: "${deleteModalProduct.name}" (ID: ${deleteModalProduct.id})`)
        alert(`✅ CSKH đã gỡ bỏ sản phẩm vi phạm "${deleteModalProduct.name}" và áp dụng chế tài Sao Quả Tạ thành công!`)
        setDeleteModalProduct(null)
        setDeleteNote('')
        fetchAllProducts(currentPage)
      } else {
        alert('Lỗi: Không thể xóa sản phẩm. Vui lòng thử lại.')
      }
    } catch (e: any) {
      alert('Lỗi kết nối: ' + e.message)
    } finally {
      setIsDeleting(false)
    }
  }

  // Xử lý Tạm Khóa / Mở Khóa Sản Phẩm
  const handleToggleProductStatus = async (product: any) => {
    if (product.status !== 'hidden') {
      setLockModalProduct(product)
      setLockReason('Ảnh hiển thị sai lệch hoặc không khớp với sản phẩm thực tế')
      setLockSameImageAcrossShops(Boolean(product.image))
      return
    }

    if (!window.confirm(`CSKH xác nhận MỞ KHÓA HIỂN THỊ lại sản phẩm "${product.name}" trên sàn?`)) return

    try {
      const res = await fetch(`${API_BASE_URL}/products/${product.id}/toggle-status`, {
        method: 'PUT',
      })
      if (res.ok) {
        await triggerAuditLog(`[CSKH MODERATION] Mở khóa sản phẩm "${product.name}" (ID: ${product.id})`)
        alert(`✅ Đã mở khóa hiển thị sản phẩm thành công!`)
        fetchAllProducts(currentPage)
      } else {
        alert('Không thể cập nhật trạng thái sản phẩm.')
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message)
    }
  }

  const handleConfirmLockProduct = async () => {
    if (!lockModalProduct) return
    setIsLocking(true)
    try {
      if (lockSameImageAcrossShops && lockModalProduct.image) {
        const res = await fetch(`${API_BASE_URL}/products/bulk-hide-by-image`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: lockModalProduct.image,
            reason: lockReason.trim() || 'Ảnh hiển thị sai lệch hoặc không khớp với sản phẩm thực tế',
          }),
        })
        if (res.ok) {
          const data = await res.json()
          await triggerAuditLog(`[CSKH MODERATION] Khóa đồng loạt ${data.count || 1} sản phẩm dùng chung ảnh sai với "${lockModalProduct.name}"`)
          alert(`✅ Đã tạm khóa thành công ${data.count || 1} sản phẩm dùng chung ảnh vi phạm trên toàn sàn!`)
          setLockModalProduct(null)
          fetchAllProducts(currentPage)
        } else {
          alert('Không thể khóa hàng loạt theo ảnh. Vui lòng thử lại.')
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/products/${lockModalProduct.id}/toggle-status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: lockReason.trim() || 'CSKH tạm ẩn do vi phạm quy định hình ảnh hoặc ngành hàng',
          }),
        })
        if (res.ok) {
          await triggerAuditLog(`[CSKH MODERATION] Tạm khóa sản phẩm "${lockModalProduct.name}" (ID: ${lockModalProduct.id})`)
          alert(`✅ Đã tạm khóa sản phẩm thành công!`)
          setLockModalProduct(null)
          fetchAllProducts(currentPage)
        } else {
          alert('Không thể cập nhật trạng thái sản phẩm.')
        }
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message)
    } finally {
      setIsLocking(false)
    }
  }

  // Xử lý Bỏ Qua Cảnh Báo Vi Phạm
  const handleDismissViolation = async (product: any) => {
    if (!window.confirm(`Xác nhận sản phẩm "${product.name}" hợp lệ và xóa sạch cảnh báo báo cáo vi phạm?`)) return
    try {
      const res = await fetch(`${API_BASE_URL}/products/violations/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isViolated: false }),
      })
      if (res.ok) {
        await triggerAuditLog(`[CSKH MODERATION] Bỏ qua cảnh báo vi phạm cho sản phẩm "${product.name}" (ID: ${product.id})`)
        alert(`✅ Đã xóa cảnh báo vi phạm cho sản phẩm "${product.name}"!`)
        fetchAllProducts(currentPage)
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message)
    }
  }

  // Cập nhật tồn kho / lượt bán
  const handleSaveStockAndSales = async () => {
    if (!stockEditProduct) return
    setIsUpdatingStock(true)
    try {
      const res = await fetch(`${API_BASE_URL}/products/${stockEditProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock: editStockValue,
          sales: editSalesValue,
        }),
      })

      if (res.ok) {
        await triggerAuditLog(`[CSKH INVENTORY OVERRIDE] Điều chỉnh kho/bán cho sản phẩm "${stockEditProduct.name}" (ID: ${stockEditProduct.id}) -> Tồn kho: ${editStockValue}, Đã bán: ${editSalesValue}`)
        alert(`✅ Đã điều chỉnh Tồn kho & Lượt bán thành công!`)
        setStockEditProduct(null)
        fetchAllProducts(currentPage)
      } else {
        alert('Lỗi: Không thể cập nhật Tồn kho/Lượt bán.')
      }
    } catch (e: any) {
      alert('Lỗi kết nối: ' + e.message)
    } finally {
      setIsUpdatingStock(false)
    }
  }

  return (
    <div className="space-y-4 text-left">
      {/* 1. Header Card & SubTab Navigation */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🚫</span>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Kiểm Duyệt Từ Cấm, Hàng Giả & Báo Cáo Vi Phạm (Policy Moderation)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Chế tài gỡ bỏ sản phẩm vi phạm, xử lý tố cáo từ người mua và áp dụng Điểm Phạt Sao Quả Tạ chuẩn Shopee
            </p>
          </div>

          <button
            onClick={() => fetchAllProducts(currentPage)}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <span>🔄</span> Tải Lại Dữ Liệu
          </button>
        </div>

        {/* Status Sub-Tabs */}
        <div className="flex border-b border-slate-200 text-xs font-bold gap-2 overflow-x-auto">
          {[
            { id: 'VIOLATIONS', label: '⚠️ Bị Báo Cáo / Vi Phạm', count: countViolations, color: 'text-rose-600', badge: 'bg-rose-500 text-white' },
            { id: 'DELISTED', label: '🔒 Đã Tạm Khóa / Ẩn', count: countDelisted, color: 'text-amber-700' },
            { id: 'ACTIVE', label: '✅ Đang Hoạt Động', count: countActive, color: 'text-emerald-700' },
            { id: 'ALL', label: '🌐 Tất Cả Sản Phẩm', count: countAll, color: 'text-slate-700' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setCurrentPage(1)
                setActiveSubTab(tab.id as any)
              }}
              className={`pb-3 px-3 transition cursor-pointer relative flex items-center gap-1.5 whitespace-nowrap ${
                activeSubTab === tab.id
                  ? 'border-b-2 border-rose-600 text-rose-600 font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                tab.badge ? tab.badge : 'bg-slate-100 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <div className="sm:col-span-8 relative">
            <span className="absolute left-3.5 top-2.5 text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm, mã SKU/ID, hoặc tên Shop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCurrentPage(1)
                setCategoryFilter(e.target.value)
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Tất cả ngành hàng</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Policy Violation Category Sub-Filter Pills (Chỉ hiện khi xem mục VIOLATIONS) */}
        {activeSubTab === 'VIOLATIONS' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Phân loại vi phạm chính sách:</span>
            {[
              { id: 'ALL', label: '🚨 Tất Cả Vi Phạm', count: countViolations },
              { id: 'BUYER_REPORT', label: '📢 Tố Cáo Người Mua', count: countBuyerReports },
              { id: 'COUNTERFEIT', label: '🛡️ Hàng Giả / Bản Quyền', count: countCounterfeit },
              { id: 'PROHIBITED', label: '⛔ Từ Cấm / Hàng Cấm', count: countProhibited },
            ].map((pType) => (
              <button
                key={pType.id}
                type="button"
                onClick={() => {
                  setCurrentPage(1)
                  setPolicyTypeFilter(pType.id as any)
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  policyTypeFilter === pType.id
                    ? 'bg-rose-50 text-rose-700 border border-rose-300 shadow-3xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent'
                }`}
              >
                <span>{pType.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  policyTypeFilter === pType.id ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {pType.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Product Moderation Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="font-bold">Đang tải danh sách sản phẩm thực tế...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <span className="text-4xl">🎉</span>
            <p className="text-xs font-bold text-slate-600">Tuyệt vời! Không có sản phẩm nào vi phạm trong mục này</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Sản Phẩm & Mã ID</th>
                  <th className="py-3.5 px-3">Gian Hàng (Shop)</th>
                  <th className="py-3.5 px-3">Ngành Hàng</th>
                  <th className="py-3.5 px-3 text-right">Giá Bán</th>
                  <th className="py-3.5 px-3 text-center">Trạng Thái / Vi Phạm</th>
                  <th className="py-3.5 px-4 text-center">Chế Tài & Thao Tác CSKH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const shopName = shopsMap[p.shopId] || p.shopId
                  const isPolViolated = isPolicyViolation(p)
                  const pType = getPolicyViolationType(p)
                  const isHidden = p.status === 'hidden'

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      {/* Cột 1: Thông tin sản phẩm */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <img
                            src={p.image || 'https://placehold.co/100x100?text=No+Image'}
                            alt={p.name}
                            className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-bold text-slate-900 line-clamp-1 hover:text-rose-700 transition" title={p.name}>
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {p.id.slice(0, 12)}...</p>
                            {p.brand && (
                              <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                                Brand: {p.brand}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Gian hàng */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900">{shopName}</p>
                          <a
                            href={`/shop/${p.shopId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 font-semibold"
                          >
                            <span>🏪 Xem Shop</span>
                          </a>
                        </div>
                      </td>

                      {/* Cột 3: Ngành hàng */}
                      <td className="py-3.5 px-3 font-semibold text-slate-600">
                        {p.category || 'Mặc định'}
                      </td>

                      {/* Cột 4: Giá bán */}
                      <td className="py-3.5 px-3 text-right">
                        <p className="font-black text-[#ee4d2d]">{formatMoney(p.price)}</p>
                        {p.originalPrice && (
                          <p className="text-[10px] text-slate-400 line-through">{formatMoney(p.originalPrice)}</p>
                        )}
                      </td>

                      {/* Cột 5: Trạng thái & Cảnh báo vi phạm */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="space-y-1.5 inline-flex flex-col items-center">
                          {isPolViolated ? (
                            <div className="flex flex-col items-center gap-1">
                              {p.reportsCount && p.reportsCount > 0 ? (
                                <span className="px-2 py-0.5 bg-rose-50 border border-rose-300 text-rose-700 text-[10px] font-black rounded-md flex items-center gap-1 shadow-3xs">
                                  <span>📢</span> {p.reportsCount} tố cáo từ khách
                                </span>
                              ) : pType === 'COUNTERFEIT' ? (
                                <span className="px-2 py-0.5 bg-purple-50 border border-purple-300 text-purple-700 text-[10px] font-black rounded-md flex items-center gap-1 shadow-3xs">
                                  <span>🛡️</span> Vi phạm bản quyền / Hàng giả
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-black rounded-md flex items-center gap-1 shadow-3xs">
                                  <span>⛔</span> Vi phạm từ cấm sàn
                                </span>
                              )}
                            </div>
                          ) : isHidden ? (
                            <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold rounded-md">
                              🔒 Đang Tạm Khóa
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md">
                              ✅ Đang Hoạt Động
                            </span>
                          )}

                          {p.violationReason && !isImageMismatchViolation(p) && (
                            <p className="text-[10px] text-rose-600 max-w-[210px] line-clamp-2 font-medium leading-tight text-center" title={p.violationReason}>
                              {p.violationReason}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Cột 6: Thao tác CSKH */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setPreviewProduct(p)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                            title="Xem chi tiết sản phẩm"
                          >
                            👁️
                          </button>

                          <button
                            onClick={() => {
                              setStockEditProduct(p)
                              setEditStockValue(p.stock || 0)
                              setEditSalesValue(p.sales || 0)
                            }}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer"
                            title="Điều chỉnh Kho & Lượt Bán"
                          >
                            📦
                          </button>

                          {isPolViolated && (
                            <button
                              onClick={() => handleDismissViolation(p)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                              title="Bỏ qua cảnh báo vi phạm hợp lệ"
                            >
                              Bỏ qua
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleProductStatus(p)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              isHidden
                                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                            }`}
                            title={isHidden ? 'Mở khóa sản phẩm' : 'Tạm khóa sản phẩm'}
                          >
                            {isHidden ? 'Mở khóa' : 'Tạm ẩn'}
                          </button>

                          <button
                            onClick={() => {
                              setDeleteModalProduct(p)
                              setDeleteReason(p.violationReason || 'Hàng giả / Nhái nhãn hiệu')
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer shadow-3xs flex items-center gap-1"
                            title="Gỡ bỏ vĩnh viễn và phạt Sao Quả Tạ Shop"
                          >
                            <span>🗑️</span> Gỡ Vi Phạm
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

        {/* Server-side Pagination Bar */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/70 text-xs">
            <span className="text-slate-500 font-medium">
              Hiển thị <strong>{filteredProducts.length}</strong> / <strong>{totalItems}</strong> sản phẩm (Trang {currentPage}/{totalPages})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                ← Trang trước
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Trang sau →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: TẠM KHÓA SẢN PHẨM (CÓ TÙY CHỌN KHÓA HÀNG LOẠT THEO ẢNH) */}
      {lockModalProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl overflow-hidden text-left border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔒</span>
                <h3 className="font-black text-slate-900 text-base">Tạm Khóa / Ẩn Sản Phẩm Vi Phạm</h3>
              </div>
              <button
                onClick={() => setLockModalProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl flex gap-3 items-center border border-slate-200/60">
              <img
                src={lockModalProduct.image || 'https://placehold.co/100x100?text=No+Image'}
                alt={lockModalProduct.name}
                className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0"
              />
              <div className="space-y-0.5 min-w-0">
                <p className="font-bold text-slate-900 text-xs line-clamp-1">{lockModalProduct.name}</p>
                <p className="text-[10px] text-slate-500 font-medium">Shop: <strong>{shopsMap[lockModalProduct.shopId] || lockModalProduct.shopId}</strong></p>
                <p className="text-[10px] text-[#ee4d2d] font-bold">Giá: {formatMoney(lockModalProduct.price)}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-800">Lý do tạm ẩn gửi đến Shop:</label>
                <input
                  type="text"
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {lockModalProduct.image && (
                <label className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockSameImageAcrossShops}
                    onChange={(e) => setLockSameImageAcrossShops(e.target.checked)}
                    className="mt-0.5 accent-amber-600 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-950 block">
                      Khóa đồng thời TẤT CẢ sản phẩm trên toàn sàn dùng chung ảnh này
                    </span>
                    <span className="text-[11px] text-amber-800 block leading-snug">
                      Ngăn các shop khác đang nhân bản cùng hình ảnh sai tiếp tục hiển thị ở tìm kiếm và Phòng Thử Đồ AI.
                    </span>
                  </div>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setLockModalProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleConfirmLockProduct}
                disabled={isLocking}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isLocking ? 'Đang khóa...' : lockSameImageAcrossShops ? '🔒 Khóa Tất Cả Cùng Ảnh' : '🔒 Khóa Sản Phẩm Này'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: GỠ BỎ VI PHẠM & ÁP DỤNG ĐIỂM PHẠT SAO QUẢ TẠ */}
      {deleteModalProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl overflow-hidden text-left border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚫</span>
                <h3 className="font-black text-slate-900 text-base">Gỡ Bỏ Sản Phẩm Vi Phạm & Chế Tài</h3>
              </div>
              <button
                onClick={() => setDeleteModalProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl flex gap-3 items-center border border-slate-200/60">
              <img
                src={deleteModalProduct.image || 'https://placehold.co/100x100?text=No+Image'}
                alt={deleteModalProduct.name}
                className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0"
              />
              <div className="space-y-0.5 min-w-0">
                <p className="font-bold text-slate-900 text-xs line-clamp-1">{deleteModalProduct.name}</p>
                <p className="text-[10px] text-slate-500 font-medium">Shop: <strong>{shopsMap[deleteModalProduct.shopId] || deleteModalProduct.shopId}</strong></p>
                <p className="text-[10px] text-[#ee4d2d] font-bold">Giá: {formatMoney(deleteModalProduct.price)}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-800">1. Điều khoản vi phạm:</label>
                <select
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-rose-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="Hàng giả / Nhái nhãn hiệu bản quyền">Hàng giả / Nhái nhãn hiệu bản quyền</option>
                  <option value="Hàng cấm buôn bán theo quy định pháp luật">Hàng cấm buôn bán theo quy định pháp luật</option>
                  <option value="Hình ảnh / Nội dung phản cảm, đồi trụy">Hình ảnh / Nội dung phản cảm, đồi trụy</option>
                  <option value="Spam từ khóa / Đăng sai ngành hàng">Spam từ khóa / Đăng sai ngành hàng</option>
                  <option value="Gian lận giá / Tăng giá ảo trước khuyến mãi">Gian lận giá / Tăng giá ảo trước khuyến mãi</option>
                  <option value="Hàng hóa kém chất lượng / Nhiều khiếu nại">Hàng hóa kém chất lượng / Nhiều khiếu nại</option>
                  <option value="Khác">Lý do khác</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">2. Điểm phạt Sao Quả Tạ (Penalty Points):</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 5].map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setPenaltyPoints(pts)}
                      className={`flex-1 py-2 rounded-xl font-bold border transition cursor-pointer ${
                        penaltyPoints === pts
                          ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-200'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      +{pts} Điểm
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">3. Ghi chú chi tiết cho Shop:</label>
                <textarea
                  rows={2}
                  placeholder="Nhập chi tiết nội dung vi phạm gửi đến Người Bán..."
                  value={deleteNote}
                  onChange={(e) => setDeleteNote(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <p className="font-bold">⚠️ Lưu ý bảo toàn dữ liệu giao dịch:</p>
                <p>Thao tác này chỉ gỡ bỏ sản phẩm khỏi sàn. Mọi **hóa đơn & lịch sử đơn hàng cũ của người mua vẫn được bảo tồn toàn vẹn**.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteModalProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleConfirmDeleteViolation}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                {isDeleting ? 'Đang xử lý...' : 'Xác Nhận Gỡ Vi Phạm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: XEM NHANH CHI TIẾT SẢN PHẨM */}
      {previewProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl overflow-hidden text-left border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <h3 className="font-black text-slate-900 text-base">Chi Tiết Sản Phẩm Kiểm Duyệt</h3>
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <img
                  src={previewProduct.image || 'https://placehold.co/300x300?text=No+Image'}
                  alt={previewProduct.name}
                  className="w-full h-56 object-cover rounded-2xl border border-slate-200 shadow-2xs"
                />
              </div>

              <div className="space-y-2 text-xs">
                <h4 className="font-black text-slate-900 text-sm">{previewProduct.name}</h4>
                <p className="text-slate-500">Mã SKU / ID: <code className="font-mono text-slate-800">{previewProduct.id}</code></p>
                <p className="text-slate-500">Gian hàng: <strong>{shopsMap[previewProduct.shopId] || previewProduct.shopId}</strong></p>
                <p className="text-slate-500">Ngành hàng: <strong>{previewProduct.category}</strong></p>
                <p className="text-slate-500">Thương hiệu: <strong>{previewProduct.brand || 'No Brand'}</strong></p>
                <div className="p-2.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                  <span className="text-xs text-slate-500">Giá bán niêm yết:</span>
                  <p className="text-lg font-black text-[#ee4d2d]">{formatMoney(previewProduct.price)}</p>
                </div>
                <p className="text-slate-600">Tồn kho: <strong>{previewProduct.stock}</strong> | Đã bán: <strong>{previewProduct.sales || 0}</strong></p>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-bold text-slate-800">Mô tả sản phẩm:</span>
              <p className="p-3 bg-slate-50 rounded-xl text-slate-600 max-h-32 overflow-y-auto leading-relaxed border border-slate-200/50">
                {previewProduct.description || 'Chưa có mô tả'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setPreviewProduct(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ĐIỀU CHỈNH KHO / LƯỢT BÁN */}
      {stockEditProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl overflow-hidden text-left border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📦</span>
                <h3 className="font-black text-slate-900 text-base">Kiểm Soát Tồn Kho & Lượt Bán</h3>
              </div>
              <button
                onClick={() => setStockEditProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl flex gap-3 items-center border border-slate-200/60">
              <img
                src={stockEditProduct.image || 'https://placehold.co/100x100?text=No+Image'}
                alt={stockEditProduct.name}
                className="w-12 h-12 object-cover rounded-xl border border-slate-200 shrink-0"
              />
              <div className="space-y-0.5 min-w-0">
                <p className="font-bold text-slate-900 text-xs line-clamp-1">{stockEditProduct.name}</p>
                <p className="text-[10px] text-slate-500 font-medium">Shop: <strong>{shopsMap[stockEditProduct.shopId] || stockEditProduct.shopId}</strong></p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-800">1. Số lượng Tồn Kho Thực Tế:</label>
                <input
                  type="number"
                  min="0"
                  value={editStockValue}
                  onChange={(e) => setEditStockValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">2. Số Lượng Đã Bán:</label>
                <input
                  type="number"
                  min="0"
                  value={editSalesValue}
                  onChange={(e) => setEditSalesValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setEditSalesValue(0)}
                    className="px-2 py-0.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded text-[10px] font-bold cursor-pointer border border-rose-200"
                  >
                    Reset về 0 (Xóa đơn ảo)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setStockEditProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveStockAndSales}
                disabled={isUpdatingStock}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isUpdatingStock ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
