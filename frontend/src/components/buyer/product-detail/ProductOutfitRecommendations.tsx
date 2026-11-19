import React, { useState, useEffect } from 'react'
import { TRYON_SERVICE_URL } from '../../../config/api.config'
import type { Product } from '../FlashSale'
import { ProductOutfitModal, type ScoredOutfitBundle, type OutfitItem } from './ProductOutfitModal'

// Re-export types for backward compatibility
export type { ScoredOutfitBundle, OutfitItem }

interface ProductOutfitRecommendationsProps {
  product: Product
  onAddToCart?: (product: Product, quantity: number, variant: string) => void
  onOpenTryOnModal?: (bundle?: ScoredOutfitBundle) => void
}

export const ProductOutfitRecommendations: React.FC<ProductOutfitRecommendationsProps> = ({
  product,
  onAddToCart,
  onOpenTryOnModal
}) => {
  const [outfits, setOutfits] = useState<ScoredOutfitBundle[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  // Kiểm tra sản phẩm có phải thời trang
  const isFashion = Boolean(
    (product.category || '').toLowerCase().includes('thời trang') ||
    (product.category || '').toLowerCase().includes('giày dép') ||
    (product.category || '').toLowerCase().includes('túi ví') ||
    (product.category || '').toLowerCase().includes('phụ kiện') ||
    (product.category || '').toLowerCase().includes('đồng hồ') ||
    ['áo', 'quần', 'váy', 'đầm', 'jean', 'jogger', 'bomber', 'jacket', 'sơ mi', 'thun', 'hoodie', 'blazer', 'polo', 'yếm', 'short', 'giày', 'sneaker', 'dép', 'sandal', 'boot', 'túi', 'ví', 'nón', 'mũ', 'đồng hồ'].some((k) =>
      (product.name || '').toLowerCase().includes(k)
    )
  )

  useEffect(() => {
    if (!product || !isFashion) {
      setIsLoading(false)
      return
    }

    const fetchTopOutfits = async () => {
      setIsLoading(true)
      try {
        const height = Number(localStorage.getItem('zeromall_tryon_user_height')) || 175
        const weight = Number(localStorage.getItem('zeromall_tryon_user_weight')) || 68
        const gender = (localStorage.getItem('zeromall_tryon_user_gender') as 'male' | 'female') || 'male'

        const res = await fetch(`${TRYON_SERVICE_URL}/api/tryon/generate-top-outfits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: {
              id: product.id,
              name: product.name,
              price: product.price || product.flashPrice,
              category: product.category,
              image: product.image
            },
            height_cm: height,
            weight_kg: weight,
            gender: gender
          })
        })

        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.outfits)) {
            setOutfits(data.outfits)
          }
        }
      } catch (e) {
        console.warn('[ProductOutfitRecommendations] Failed to fetch top outfits:', e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTopOutfits()
  }, [product?.id, isFashion])

  if (!isFashion) {
    return null
  }

  return (
    <>
      {/* Sleek, Compact Shopee-style Trigger Bar (Không làm giãn trang sản phẩm) */}
      <div
        onClick={() => setIsModalOpen(true)}
        className="bg-white hover:bg-slate-50/80 border border-indigo-200/80 hover:border-indigo-400/90 rounded-2xl p-3 sm:p-3.5 shadow-2xs my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all duration-200 group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center text-lg text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
            ✨
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs sm:text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">
                Gợi Ý 100 Set Phối Đồ AI Stylist
              </span>
              <span className="bg-amber-50 text-amber-700 border border-amber-200/80 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <span>⚡</span> 100 Set Simulation Engine
              </span>
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-bold px-2 py-0.5 rounded-full hidden md:inline">
                Bánh Xe Màu Sắc & Tỷ Lệ Nhân Trắc Học
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                Ưu Đãi Combo -8%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              Mô phỏng 100 set từ kho ZeroMall xoay quanh sản phẩm này • Xem ngay 5 set điểm cao nhất & ưu đãi giảm 8%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsModalOpen(true)
            }}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <span>⚡</span> Xem 5 Set Phối Đồ ➔
          </button>
        </div>
      </div>

      {/* Modal hiển thị chi tiết 100 Set Phối Đồ AI */}
      <ProductOutfitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={product}
        outfits={outfits}
        isLoading={isLoading}
        onAddToCart={onAddToCart}
        onOpenTryOnModal={onOpenTryOnModal}
      />
    </>
  )
}
