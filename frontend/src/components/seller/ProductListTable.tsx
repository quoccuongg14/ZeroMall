import React, { useState } from 'react'

export interface Product {
  id: string
  name: string
  image: string
  category: string
  brand: string
  description: string
  price: number | string // raw price or price range string
  stock: number
  sales: number
  status: 'active' | 'hidden'
  isViolated?: boolean
  violationReason?: string | null
  sku?: string
  variationsText?: string
}

interface ProductListTableProps {
  products: Product[]
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
  onToggleStatus: (id: string) => void
  onAddNew: () => void
}

export const ProductListTable: React.FC<ProductListTableProps> = ({
  products,
  onEdit,
  onDelete,
  onToggleStatus,
  onAddNew,
}) => {
  // Tabs: 'all' | 'active' | 'violation' | 'outOfStock'
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'violation' | 'outOfStock'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  // Unique categories list for filters
  const categoriesList = Array.from(new Set(products.map((p) => p.category))).filter(Boolean)

  // Filter products by tab
  const getTabFilteredProducts = () => {
    switch (activeTab) {
      case 'active':
        return products.filter((p) => p.status === 'active' && !p.isViolated && p.stock > 0)
      case 'violation':
        return products.filter((p) => p.status === 'hidden' || p.isViolated)
      case 'outOfStock':
        return products.filter((p) => p.stock <= 0)
      case 'all':
      default:
        return products
    }
  }

  // Apply search and category filter
  const filteredProducts = getTabFilteredProducts().filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory ? p.category === selectedCategory : true
    return matchesSearch && matchesCategory
  })

  // Format price helper
  const formatPriceValue = (price: number | string) => {
    if (typeof price === 'number') {
      return `${price.toLocaleString('vi-VN')}đ`
    }
    return price // if it's already a range string like "150.000đ - 200.000đ"
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      
      {/* Search & Actions Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 border border-slate-200/60 rounded-2xl shadow-3xs">
        {/* Search & Category Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Tìm tên sản phẩm, mã SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 border border-slate-250 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-slate-250 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 bg-white cursor-pointer"
          >
            <option value="">Tất cả ngành hàng</option>
            {categoriesList.map((cat, i) => (
              <option key={i} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {(searchQuery || selectedCategory) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('')
              }}
              className="text-xs font-bold text-slate-400 hover:text-red-500 transition"
            >
              Đặt lại
            </button>
          )}
        </div>

        {/* Add New Product Button */}
        <button
          type="button"
          onClick={onAddNew}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer shrink-0 flex items-center gap-1.5"
        >
          ➕ Thêm 1 sản phẩm mới
        </button>
      </div>

      {/* Tabs Menu & Table Card */}
      <div className="bg-white border border-slate-200/60 rounded-3xl overflow-hidden shadow-sm flex flex-col">
        {/* Status Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-4 text-xs font-bold border-b-2 cursor-pointer transition ${
              activeTab === 'all' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Tất cả ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-4 text-xs font-bold border-b-2 cursor-pointer transition ${
              activeTab === 'active' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Đang hoạt động ({products.filter((p) => p.status === 'active' && !p.isViolated && p.stock > 0).length})
          </button>
          <button
            onClick={() => setActiveTab('violation')}
            className={`px-6 py-4 text-xs font-bold border-b-2 cursor-pointer transition ${
              activeTab === 'violation' ? 'border-rose-600 text-rose-600 bg-rose-50/40' : 'border-transparent text-slate-400 hover:text-rose-600'
            }`}
          >
            🚫 Vi phạm / Tạm ẩn ({products.filter((p) => p.status === 'hidden' || p.isViolated).length})
          </button>
          <button
            onClick={() => setActiveTab('outOfStock')}
            className={`px-6 py-4 text-xs font-bold border-b-2 cursor-pointer transition ${
              activeTab === 'outOfStock' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Hết hàng ({products.filter((p) => p.stock <= 0).length})
          </button>
        </div>

        {/* Product Table */}
        <div className="overflow-x-auto">
          {filteredProducts.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center space-y-3.5">
              <span className="text-4xl">📦</span>
              <div>
                <h4 className="text-sm font-extrabold text-slate-600 uppercase">Không tìm thấy sản phẩm</h4>
                <p className="text-xs text-slate-400 max-w-xs leading-normal mt-1">
                  Chưa có sản phẩm nào phù hợp với bộ lọc hoặc tìm kiếm hiện tại của bạn.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 w-[40%]">Sản phẩm</th>
                  <th className="p-4">SKU / Phân loại</th>
                  <th className="p-4">Giá bán</th>
                  <th className="p-4 text-center">Kho hàng</th>
                  <th className="p-4 text-center">Doanh số</th>
                  <th className="p-4 text-center">Trạng thái</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/40 transition">
                    
                    {/* Image & Name Column */}
                    <td className="p-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={p.image || 'https://placehold.co/80x80?text=No+Image'}
                          alt={p.name}
                          className="w-12 h-12 object-cover border border-slate-100 rounded-lg shadow-3xs shrink-0 mt-0.5"
                        />
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="font-bold text-slate-800 line-clamp-2 leading-snug hover:text-emerald-600 cursor-default">
                            {p.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold">{p.category}</p>

                          {/* Remediation Callout Box if violated vs subtle notice if shop-hidden */}
                          {p.isViolated ? (
                            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 space-y-1 mt-1.5 shadow-2xs">
                              <p className="font-extrabold text-rose-700 flex items-start gap-1">
                                <span className="shrink-0">⚠️ Sàn yêu cầu sửa:</span>
                                <span className="font-semibold text-rose-900">
                                  {p.violationReason || 'Sản phẩm bị đánh dấu vi phạm quy chuẩn sàn'}
                                </span>
                              </p>
                              <p className="text-[10px] text-slate-600">
                                👉 Bấm{' '}
                                <button
                                  type="button"
                                  onClick={() => onEdit(p)}
                                  className="text-rose-700 font-extrabold underline cursor-pointer hover:text-rose-900"
                                >
                                  Sửa Ngay
                                </button>{' '}
                                để cập nhật lại ảnh/thông tin đúng. Sau khi lưu, AI sẽ tự động duyệt lại và mở bán cho Shop!
                              </p>
                            </div>
                          ) : p.status === 'hidden' ? (
                            <div className="px-2.5 py-1.5 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-800 mt-1.5 flex items-center justify-between gap-2">
                              <span>
                                ⏸️ Sản phẩm đang ở trạng thái <strong>Tạm ẩn</strong> (không phải lỗi AI). Bấm <strong>Hiện</strong> để mở bán lại nếu cần.
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* SKU & Variation Text */}
                    <td className="p-4">
                      <p className="font-semibold text-slate-700">{p.sku || '--'}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate max-w-[150px]">
                        {p.variationsText || 'Không phân loại'}
                      </p>
                    </td>

                    {/* Price */}
                    <td className="p-4 font-bold text-slate-800">
                      {formatPriceValue(p.price)}
                    </td>

                    {/* Stock */}
                    <td className={`p-4 text-center font-bold ${p.stock <= 0 ? 'text-red-500' : 'text-slate-700'}`}>
                      {p.stock}
                    </td>

                    {/* Sales */}
                    <td className="p-4 text-center font-bold text-slate-700">
                      {p.sales}
                    </td>

                    {/* Status Badge */}
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        p.isViolated
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : p.status === 'hidden'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : p.stock <= 0
                              ? 'bg-red-50 text-red-500 border border-red-200'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}>
                        {p.isViolated ? '🚫 Vi Phạm' : p.status === 'hidden' ? '⏸️ Tạm Ẩn' : p.stock <= 0 ? 'Hết hàng' : 'Đang bán'}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {p.isViolated ? (
                          <button
                            type="button"
                            onClick={() => onEdit(p)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <span>✏️</span>
                            <span>Sửa Ngay</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onEdit(p)}
                            className="text-xs font-bold text-slate-500 hover:text-emerald-600 transition cursor-pointer"
                          >
                            Sửa
                          </button>
                        )}
                        
                        <span className="text-slate-200">|</span>
                        
                        <button
                          type="button"
                          onClick={() => onToggleStatus(p.id)}
                          className="text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer"
                        >
                          {p.status === 'active' ? 'Ẩn' : 'Hiện'}
                        </button>

                        <span className="text-slate-200">|</span>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
                              onDelete(p.id)
                            }
                          }}
                          className="text-xs font-bold text-red-400 hover:text-red-600 transition cursor-pointer"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
    </div>
  )
}
