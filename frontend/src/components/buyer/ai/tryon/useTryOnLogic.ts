import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL, TRYON_SERVICE_URL } from '../../../../config/api.config'
import type { Product } from '../../FlashSale'
import type {
  BodyMeasurements,
  FitResult,
  CartFashionItem,
  OutfitSlots,
  OutfitSlotKey,
  TryonEngineMode,
  ScoredOutfitBundle,
  VirtualTryOnModalProps,
} from './types'
import {
  detectItemSlot,
  getBodyPhysiqueInfo,
  formatDisplayPrice,
  isOuterwearProduct,
  detectAccessoryZone,
  flattenOutfitItems,
  isProductMatchingGender,
} from './tryonUtils'
import { addOutfitBundleToCart } from '../../../../utils/cartBundleHelper'
import { predictProductSize, type SizePredictionResult } from '../../../../utils/sizePredictor'
import {
  composeVariantSelection,
  extractColorFromVariantString,
  getEffectiveProductForColor,
  getProductColorVariants,
} from '../../../../utils/variantImageHelper'

export const useTryOnLogic = ({
  isOpen,
  onClose,
  product,
  initialVariant,
  cart,
  onAddToCart,
  onBuyNow,
  initialBundle,
}: VirtualTryOnModalProps) => {
  const navigate = useNavigate()
  // 1. Ảnh người dùng & Thông số thể hình
  const [userPhoto, setUserPhoto] = useState<string>(() => {
    const saved = localStorage.getItem('zeromall_tryon_user_photo')
    const savedName = localStorage.getItem('zeromall_tryon_user_name')
    if (!saved || saved.includes('tran_thanh') || (savedName && savedName.includes('Trấn Thành'))) {
      try {
        localStorage.removeItem('zeromall_tryon_user_photo')
        localStorage.removeItem('zeromall_tryon_user_name')
      } catch (_) {}
      return ''
    }
    return saved
  })
  const [userPhotoName, setUserPhotoName] = useState<string>(() => {
    const saved = localStorage.getItem('zeromall_tryon_user_name')
    if (!saved || saved.includes('Trấn Thành') || saved.includes('tran_thanh')) return ''
    return saved
  })
  const DEFAULT_BODY_STATS = {
    male: { height: 175, weight: 68 },
    female: { height: 160, weight: 50 },
  } as const

  const [gender, setGender] = useState<'male' | 'female'>(() => {
    return (localStorage.getItem('zeromall_tryon_user_gender') as 'male' | 'female') || 'male'
  })
  const [height, setHeight] = useState<number>(() => {
    const savedGender = (localStorage.getItem('zeromall_tryon_user_gender') as 'male' | 'female') || 'male'
    return Number(localStorage.getItem('zeromall_tryon_user_height')) || DEFAULT_BODY_STATS[savedGender].height
  })
  const [weight, setWeight] = useState<number>(() => {
    const savedGender = (localStorage.getItem('zeromall_tryon_user_gender') as 'male' | 'female') || 'male'
    return Number(localStorage.getItem('zeromall_tryon_user_weight')) || DEFAULT_BODY_STATS[savedGender].weight
  })

  // 2. Quản lý Chế độ thử đồ AI Siêu Thực
  const [gemBalance, setGemBalance] = useState<number | null>(7060)
  const [tryonEngineMode, setTryonEngineMode] = useState<TryonEngineMode>('mage')
  const [showMageConfirmModal, setShowMageConfirmModal] = useState<boolean>(false)
  const [sizeOverrides, setSizeOverrides] = useState<Record<string, string>>({})

  // Đồng bộ dọn sạch ảnh cũ & nạp số dư Gem từ Backend
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('zeromall_tryon_user_photo')
      const savedName = localStorage.getItem('zeromall_tryon_user_name')
      if (!saved || saved.includes('tran_thanh') || (savedName && savedName.includes('Trấn Thành'))) {
        try {
          localStorage.removeItem('zeromall_tryon_user_photo')
          localStorage.removeItem('zeromall_tryon_user_name')
        } catch (_) {}
        setUserPhoto('')
        setUserPhotoName('')
        setCompositeTryOnImage('')
      }

      fetch(`${TRYON_SERVICE_URL}/api/tryon/gem-status`)
        .then(res => res.json())
        .then(data => {
          if (data && typeof data.balance === 'number') {
            setGemBalance(data.balance)
          }
        })
        .catch(err => console.warn('[useTryOnLogic] gem-status fetch error:', err))
    }
  }, [isOpen])

  // Lưu thông số thể hình vào LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('zeromall_tryon_user_height', String(height))
      localStorage.setItem('zeromall_tryon_user_weight', String(weight))
      localStorage.setItem('zeromall_tryon_user_gender', gender)
    } catch (e) {
      console.warn('[useTryOnLogic] Failed to persist body stats to localStorage:', e)
    }
  }, [height, weight, gender])

  // Tính toán BMI và phân loại thể hình
  const hM = Math.max(1, height / 100)
  const currentBmi = Number((weight / (hM * hM)).toFixed(1))
  const physiqueInfo = getBodyPhysiqueInfo(currentBmi)

  // Helper chuẩn hóa danh sách phụ kiện theo vùng giải phẫu (cho phép đeo nhiều phụ kiện khác vùng cùng lúc)
  const applyAccessoryToOutfit = (prev: OutfitSlots, item: Product, toggleIfSameId = true): OutfitSlots => {
    const existingList = Array.isArray(prev.accessories) ? prev.accessories : []
    const alreadyEquipped = existingList.some(a => a.id === item.id)

    let nextList: Product[]
    if (alreadyEquipped) {
      if (!toggleIfSameId) return prev
      nextList = existingList.filter(a => a.id !== item.id)
    } else {
      const targetZone = detectAccessoryZone(item)
      // Nếu khác 'other' và đã có 1 phụ kiện cùng vùng cơ thể (vd đổi mũ mới), thay thế phụ kiện vùng đó
      if (targetZone !== 'other') {
        const filtered = existingList.filter(a => detectAccessoryZone(a) !== targetZone)
        nextList = [...filtered, item]
      } else {
        nextList = [...existingList, item]
      }
    }

    return {
      ...prev,
      accessories: nextList,
      accessory: nextList[0] || null,
    }
  }

  // 3. Món đồ được chọn để ướm thử & Nguồn cấp tủ đồ
  const [selectedOutfit, setSelectedOutfit] = useState<OutfitSlots>(() => {
    const init: OutfitSlots = { top: null, outer_top: null, bottom: null, shoes: null, accessory: null, accessories: [] }
    if (initialBundle && Array.isArray(initialBundle.items) && initialBundle.items.length > 0) {
      initialBundle.items.forEach((it) => {
        if (!it.product) return
        const slot = it.slot || detectItemSlot(it.product)
        if (slot === 'accessory') {
          const updated = applyAccessoryToOutfit(init, it.product, false)
          init.accessories = updated.accessories
          init.accessory = updated.accessory
        } else if (slot === 'top') {
          if (isOuterwearProduct(it.product) && init.top && !isOuterwearProduct(init.top)) {
            init.outer_top = it.product
          } else {
            init.top = it.product
          }
        } else if (slot === 'bottom' || slot === 'shoes') {
          init[slot] = it.product
        }
      })
      if (product) {
        const pSlot = detectItemSlot(product) || 'top'
        if (pSlot === 'accessory') {
          const updated = applyAccessoryToOutfit(init, product, false)
          init.accessories = updated.accessories
          init.accessory = updated.accessory
        } else if (pSlot === 'top' && !init.top) {
          init.top = product
        } else if ((pSlot === 'bottom' || pSlot === 'shoes') && !init[pSlot]) {
          init[pSlot] = product
        }
      }
      return init
    }
    if (product) {
      const slot = detectItemSlot(product) || 'top'
      if (slot === 'accessory') {
        init.accessories = [product]
        init.accessory = product
      } else if (slot === 'top' && isOuterwearProduct(product)) {
        init.outer_top = product
      } else if (slot === 'top' || slot === 'bottom' || slot === 'shoes') {
        init[slot] = product
      }
    }
    return init
  })
  const [activeOutfitSlot, setActiveOutfitSlot] = useState<OutfitSlotKey>(() => {
    if (!product) return 'top'
    const s = detectItemSlot(product)
    if (s === 'top' && isOuterwearProduct(product)) return 'outer_top'
    return s || 'top'
  })

  const [sourceTab, setSourceTab] = useState<'cart' | 'catalog'>('catalog')
  const [cartFashionItems, setCartFashionItems] = useState<CartFashionItem[]>([])
  const [availablePants, setAvailablePants] = useState<Product[]>(() => (product ? [product] : []))
  const [selectedPant, setSelectedPant] = useState<Product | null>(() => product || null)
  const [isLoadingPants, setIsLoadingPants] = useState<boolean>(true)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'top' | 'bottom' | 'shoes' | 'accessory'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearchingDb, setIsSearchingDb] = useState<boolean>(false)
  const searchTimeoutRef = useRef<any>(null)

  // 4. Kết quả phân tích AI thử đồ
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false)
  const [measurements, setMeasurements] = useState<BodyMeasurements | null>(null)
  const [fitResult, setFitResult] = useState<FitResult | null>(null)
  const [compositeTryOnImage, setCompositeTryOnImage] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'photo' | 'heatmap'>('photo')
  const [viewMode, setViewMode] = useState<'tryon' | 'original' | 'sidebyside'>('tryon')
  const [toastMsg, setToastMsg] = useState<string>('')

  // 5. Danh sách 100 Set Phối Đồ AI Đẹp Nhất
  const [topScoredOutfits, setTopScoredOutfits] = useState<ScoredOutfitBundle[]>([])
  const [isLoadingTopOutfits, setIsLoadingTopOutfits] = useState<boolean>(false)
  const [selectedOutfitBundleId, setSelectedOutfitBundleId] = useState<string | null>(() => initialBundle?.id || null)
  const [isOutfitModalOpen, setIsOutfitModalOpen] = useState<boolean>(false)
  const [isSlotPickerOpen, setIsSlotPickerOpen] = useState<boolean>(false)
  const [slotPickerTarget, setSlotPickerTarget] = useState<OutfitSlotKey | null>(null)
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState<boolean>(false)
  const [selectedColorVariants, setSelectedColorVariants] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen && product && initialVariant) {
      const cName = extractColorFromVariantString(product, initialVariant)
      if (cName) {
        setSelectedColorVariants((prev) => ({ ...prev, [product.id]: cName }))
      }
    }
  }, [isOpen, product?.id, initialVariant])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const customGarmentInputRef = useRef<HTMLInputElement | null>(null)

  const isValidTryOnProduct = (p: any): boolean => {
    if (!p || !p.id) return false
    if (p.status === 'hidden' || p.status === 'deleted' || p.status === 'violated') return false
    if (p.isViolated === true) return false
    return true
  }

  // Hàm tải và lọc các món thời trang trong giỏ hàng thực tế
  const loadCartFashionItems = (): CartFashionItem[] => {
    try {
      let rawCartItems: any[] = []
      if (cart && Array.isArray(cart)) {
        rawCartItems = cart
      } else {
        const savedUser = localStorage.getItem('zm_user')
        const user = savedUser ? JSON.parse(savedUser) : null
        const key = user?.id ? `zm_cart_${user.id}` : 'zm_cart_guest'
        const saved = localStorage.getItem(key) || localStorage.getItem('zm_cart_guest')
        if (saved) {
          rawCartItems = JSON.parse(saved)
        }
      }

      if (Array.isArray(rawCartItems)) {
        const fashionList: CartFashionItem[] = []
        rawCartItems.forEach((item) => {
          if (!isValidTryOnProduct(item.product)) return
          const slot = detectItemSlot(item.product)
          if (slot !== null) {
            const rawPrice = item.product.price || item.product.flashPrice || 0
            const numericPrice = typeof rawPrice === 'number'
              ? rawPrice
              : (parseFloat(String(rawPrice).replace(/[^0-9]/g, '')) || 0)

            const priceStr = numericPrice.toLocaleString('vi-VN') + 'đ'

            fashionList.push({
              product: {
                id: item.product.id,
                name: item.product.name,
                price: priceStr,
                flashPrice: item.product.flashPrice || priceStr,
                originalPrice: item.product.originalPrice || priceStr,
                image: item.product.image,
                category: (item.product as any).category || 'Thời Trang',
                rating: (item.product as any).rating || 0,
                sold: item.product.sold || 0,
                stock: item.product.stock || 99,
                total: item.product.total || 100,
                status: (item.product as any).status || 'active',
                isViolated: Boolean((item.product as any).isViolated),
              } as unknown as Product,
              variant: item.selectedVariant,
              quantity: item.quantity
            })
          }
        })
        setCartFashionItems(fashionList)
        return fashionList
      }
    } catch (e) {
      console.error('Lỗi khi nạp danh sách giỏ hàng cho thử đồ:', e)
    }
    setCartFashionItems([])
    return []
  }

  // Hàm tìm kiếm đồ thời trang trong database ZeroMall
  const handleSearchDatabase = (query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    const q = query.trim()
    if (!q) {
      setSearchResults([])
      setIsSearchingDb(false)
      return
    }
    setIsSearchingDb(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/products?search=${encodeURIComponent(q)}&limit=60`)
        if (res.ok) {
          const raw = await res.json()
          const prods: Product[] = Array.isArray(raw) ? raw : (raw.products || [])
          const validFashion = prods.filter(p => isValidTryOnProduct(p) && detectItemSlot(p) !== null)
          setSearchResults(validFashion)
        }
      } catch (err) {
        console.error('Lỗi khi tìm kiếm sản phẩm trong database:', err)
      } finally {
        setIsSearchingDb(false)
      }
    }, 300)
  }

  // Helper tạo OutfitSlots sạch từ 1 sản phẩm lẻ (tự nhận diện áo khoác / phụ kiện)
  const buildOutfitFromSingleProduct = (item: Product): { outfit: OutfitSlots; activeSlot: OutfitSlotKey } => {
    const base: OutfitSlots = { top: null, outer_top: null, bottom: null, shoes: null, accessory: null, accessories: [] }
    const slot = detectItemSlot(item) || 'top'
    if (slot === 'accessory') {
      base.accessories = [item]
      base.accessory = item
      return { outfit: base, activeSlot: 'accessory' }
    }
    if (slot === 'top' && isOuterwearProduct(item)) {
      base.outer_top = item
      return { outfit: base, activeSlot: 'outer_top' }
    }
    base[slot] = item
    return { outfit: base, activeSlot: slot }
  }

  // Khi mở modal hoặc khi product/initialBundle thay đổi
  useEffect(() => {
    if (isOpen) {
      if (initialBundle && Array.isArray(initialBundle.items) && initialBundle.items.length > 0) {
        let bundleOutfit: OutfitSlots = { top: null, outer_top: null, bottom: null, shoes: null, accessory: null, accessories: [] }
        initialBundle.items.forEach((it) => {
          if (!it.product) return
          const slot = it.slot || detectItemSlot(it.product)
          if (slot === 'accessory') {
            bundleOutfit = applyAccessoryToOutfit(bundleOutfit, it.product, false)
          } else if (slot === 'top') {
            if (isOuterwearProduct(it.product) && bundleOutfit.top && !isOuterwearProduct(bundleOutfit.top)) {
              bundleOutfit.outer_top = it.product
            } else {
              bundleOutfit.top = it.product
            }
          } else if (slot === 'bottom' || slot === 'shoes') {
            bundleOutfit[slot] = it.product
          }
        })
        if (product) {
          const pSlot = detectItemSlot(product) || 'top'
          if (pSlot === 'accessory') {
            bundleOutfit = applyAccessoryToOutfit(bundleOutfit, product, false)
          } else if (pSlot === 'top' && !bundleOutfit.top) {
            bundleOutfit.top = product
          } else if ((pSlot === 'bottom' || pSlot === 'shoes') && !bundleOutfit[pSlot]) {
            bundleOutfit[pSlot] = product
          }
        }
        setSelectedOutfit(bundleOutfit)
        setSelectedOutfitBundleId(initialBundle.id)
        const primary = bundleOutfit.top || bundleOutfit.outer_top || bundleOutfit.bottom || bundleOutfit.shoes || bundleOutfit.accessory || product
        if (primary) {
          setSelectedPant(primary)
        }
        if (product) {
          const detected = detectItemSlot(product) || 'top'
          setActiveOutfitSlot(detected === 'top' && isOuterwearProduct(product) ? 'outer_top' : detected)
        }
        setSourceTab('catalog')
      } else if (product) {
        const { outfit, activeSlot } = buildOutfitFromSingleProduct(product)
        setSelectedOutfit(prev => {
          if (activeSlot === 'accessory') return applyAccessoryToOutfit(prev, product, false)
          return { ...prev, [activeSlot]: product }
        })
        if (!selectedOutfit.top && !selectedOutfit.outer_top && !selectedOutfit.bottom) {
          setSelectedOutfit(outfit)
        }
        setActiveOutfitSlot(activeSlot)
        setSelectedPant(product)
        setSourceTab('catalog')
      }
    }
  }, [isOpen, product, initialBundle])

  // Tải danh sách trang phục thời trang từ CSDL thực tế
  useEffect(() => {
    if (!isOpen) return

    const cartItems = loadCartFashionItems()

    const fetchRealFashion = async () => {
      setIsLoadingPants(true)
      try {
        const [resNam, resNu, resGiayNam, resGiayNu, resPhuKien, resTuiVi, resDongHo, resNon, resThatLung] = await Promise.all([
          fetch(`${API_BASE_URL}/products?category=thoi-trang-nam&limit=40`),
          fetch(`${API_BASE_URL}/products?category=thoi-trang-nu&limit=40`),
          fetch(`${API_BASE_URL}/products?category=giay-dep-nam&limit=30`),
          fetch(`${API_BASE_URL}/products?category=giay-dep-nu&limit=30`),
          fetch(`${API_BASE_URL}/products?category=phu-kien-nu&limit=60`),
          fetch(`${API_BASE_URL}/products?category=tui-vi-nu&limit=40`),
          fetch(`${API_BASE_URL}/products?category=dong-ho&limit=40`),
          fetch(`${API_BASE_URL}/products?search=n%C3%B3n&limit=20`),
          fetch(`${API_BASE_URL}/products?search=th%E1%BA%AFt%20l%C6%B0ng&limit=20`),
        ])

        const parseList = async (res: Response) => {
          if (!res.ok) return []
          const data = await res.json()
          return Array.isArray(data) ? data : (data.products || [])
        }

        const [listNam, listNu, listGiayNam, listGiayNu, listPhuKien, listTuiVi, listDongHo, listNon, listThatLung] = await Promise.all([
          parseList(resNam),
          parseList(resNu),
          parseList(resGiayNam),
          parseList(resGiayNu),
          parseList(resPhuKien),
          parseList(resTuiVi),
          parseList(resDongHo),
          parseList(resNon),
          parseList(resThatLung)
        ])

        const rawCombined = [
          ...listNam,
          ...listNu,
          ...listGiayNam,
          ...listGiayNu,
          ...listPhuKien,
          ...listTuiVi,
          ...listDongHo,
          ...listNon,
          ...listThatLung
        ]
        
        const uniqueMap = new Map<string, Product>()
        rawCombined.forEach(p => {
          if (isValidTryOnProduct(p) && !uniqueMap.has(p.id) && detectItemSlot(p) !== null) {
            uniqueMap.set(p.id, p)
          }
        })
        const combined = Array.from(uniqueMap.values())
        let effectivePants = combined.length > 0 ? combined : []

        // Đối chiếu các món trong giỏ hàng với DB thực tế để loại bỏ ngay sản phẩm vừa bị CSKH khóa
        let verifiedCartItems = cartItems
        if (cartItems.length > 0) {
          try {
            const checkRes = await fetch(`${API_BASE_URL}/products/check-active`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: cartItems.map((c) => c.product.id) }),
            })
            if (checkRes.ok) {
              const checkData = await checkRes.json()
              if (Array.isArray(checkData?.activeIds)) {
                const activeSet = new Set<string>(checkData.activeIds)
                verifiedCartItems = cartItems.filter((c) => activeSet.has(c.product.id))
                setCartFashionItems(verifiedCartItems)
              }
            }
          } catch {
            // Giữ danh sách hiện có nếu kiểm tra mạng tạm thời gián đoạn
          }
        }

        if (product && isValidTryOnProduct(product)) {
          const filtered = effectivePants.filter(p => p.id !== product.id)
          effectivePants = [product, ...filtered]
          setAvailablePants(effectivePants)
          if (!initialBundle) {
            const { activeSlot } = buildOutfitFromSingleProduct(product)
            setSelectedOutfit(prev => {
              if (activeSlot === 'accessory') return applyAccessoryToOutfit(prev, product, false)
              return { ...prev, [activeSlot]: product }
            })
            setActiveOutfitSlot(activeSlot)
            setSelectedPant(product)
            setSourceTab('catalog')
          }
        } else {
          setAvailablePants(effectivePants)
          const matchingCart = verifiedCartItems.find((c) => isProductMatchingGender(c.product, gender))
          if (matchingCart) {
            const first = matchingCart.product
            const { outfit, activeSlot } = buildOutfitFromSingleProduct(first)
            setSelectedOutfit(outfit)
            setActiveOutfitSlot(activeSlot)
            setSelectedPant(first)
            setSourceTab('cart')
          } else if (effectivePants.length > 0) {
            const first = effectivePants.find((p) => isProductMatchingGender(p, gender)) || effectivePants[0]
            const { outfit, activeSlot } = buildOutfitFromSingleProduct(first)
            setSelectedOutfit(outfit)
            setActiveOutfitSlot(activeSlot)
            setSelectedPant(first)
            setSourceTab('catalog')
          }
        }
      } catch (e) {
        console.error('Lỗi khi tải sản phẩm ZeroMall:', e)
        if (product) {
          setAvailablePants([product])
          const { outfit } = buildOutfitFromSingleProduct(product)
          setSelectedOutfit(outfit)
          setSelectedPant(product)
        }
      } finally {
        setIsLoadingPants(false)
      }
    }

    fetchRealFashion()
  }, [isOpen, product, cart])

  // Chuyển đổi giới tính thông minh:
  // - Khi sang Nữ: xóa hết đồ đang thử hiện tại, cập nhật chiều cao/cân nặng mặc định của nữ (160cm / 50kg), lọc & hiển thị đồ nữ
  // - Khi là Nam: giữ nguyên đồ đang thử hiện tại, khôi phục thông số nam nếu đang ở thông số mặc định nữ
  const handleChangeGender = (nextGender: 'male' | 'female', clearCurrentOutfit = true) => {
    setGender(nextGender)
    setCategoryFilter('all')
    setSearchQuery('')
    setSearchResults([])

    if (nextGender === 'female') {
      if (gender !== 'female' || (height === DEFAULT_BODY_STATS.male.height && weight === DEFAULT_BODY_STATS.male.weight)) {
        setHeight(DEFAULT_BODY_STATS.female.height)
        setWeight(DEFAULT_BODY_STATS.female.weight)
      }
      if (clearCurrentOutfit) {
        setSelectedOutfit({ top: null, outer_top: null, bottom: null, shoes: null, accessory: null, accessories: [] })
        setSelectedPant(null)
        setActiveOutfitSlot('top')
        setSelectedOutfitBundleId(null)
        setSelectedColorVariants({})
        setSizeOverrides({})
        setCompositeTryOnImage('')
        setFitResult(null)
        setMeasurements(null)
      }
      const hasFemaleInCart = cartFashionItems.some((c) => isProductMatchingGender(c.product, 'female'))
      if (sourceTab === 'cart' && !hasFemaleInCart) {
        setSourceTab('catalog')
      }
    } else {
      if (gender === 'female' && height === DEFAULT_BODY_STATS.female.height && weight === DEFAULT_BODY_STATS.female.weight) {
        setHeight(DEFAULT_BODY_STATS.male.height)
        setWeight(DEFAULT_BODY_STATS.male.weight)
      }
    }
  }

  // Xử lý tải ảnh người dùng & tự động phân tích giới tính AI
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUserPhotoName(file.name)
      const reader = new FileReader()
      reader.onload = async (event) => {
        if (event.target?.result) {
          const dataUrl = event.target.result as string
          setUserPhoto(dataUrl)
          setCompositeTryOnImage('')
          setViewMode('original')
          try {
            localStorage.setItem('zeromall_tryon_user_photo', dataUrl)
            localStorage.setItem('zeromall_tryon_user_name', file.name)
          } catch (eStorage) {
            console.warn('[useTryOnLogic] Failed to cache user photo to localStorage:', eStorage)
          }

          // Phân tích giới tính Nam / Nữ bằng AI & tên file
          const fileNameLower = file.name.toLowerCase()
          let detectedG: 'male' | 'female' | null = null

          if (fileNameLower.includes('nu') || fileNameLower.includes('gai') || fileNameLower.includes('female') || fileNameLower.includes('woman') || fileNameLower.includes('girl')) {
            detectedG = 'female'
          } else if (fileNameLower.includes('nam') || fileNameLower.includes('trai') || fileNameLower.includes('male') || fileNameLower.includes('man') || fileNameLower.includes('boy')) {
            detectedG = 'male'
          }

          if (detectedG) {
            handleChangeGender(detectedG, detectedG === 'female')
            triggerToast(
              detectedG === 'female'
                ? '🤖 AI nhận diện ảnh Nữ (160cm • 50kg): Đã dọn đồ đang thử và hiển thị lựa chọn đồ Nữ!'
                : '🤖 AI nhận diện ảnh Nam: Giữ nguyên đồ đang thử hiện tại!'
            )
          } else {
            triggerToast('📸 Đã tải ảnh của bạn! Đang phân tích giới tính & vóc dáng...')
            try {
              const res = await fetch(`${TRYON_SERVICE_URL}/api/tryon/detect-gender`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_image: dataUrl })
              })
              if (res.ok) {
                const data = await res.json()
                if (data && (data.gender === 'male' || data.gender === 'female')) {
                  handleChangeGender(data.gender, data.gender === 'female')
                  triggerToast(
                    data.gender === 'female'
                      ? `🤖 AI nhận diện ảnh Nữ (160cm • 50kg): Đã xóa đồ cũ và mở danh sách đồ Nữ!`
                      : `🤖 AI nhận diện ảnh Nam (${data.reason || 'Tự động lọc đồ Nam'}). Giữ nguyên đồ đang thử!`
                  )
                }
              }
            } catch (err) {
              console.warn('AI detect gender error:', err)
            }
          }
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // Chọn nhanh ảnh người mẫu
  const handleSelectPresetModel = (modelUrl: string, modelName: string, modelGender: 'male' | 'female') => {
    setUserPhoto(modelUrl)
    setUserPhotoName(modelName)
    handleChangeGender(modelGender, modelGender === 'female')
    setCompositeTryOnImage('')
    setViewMode('original')
    try {
      localStorage.setItem('zeromall_tryon_user_photo', modelUrl)
      localStorage.setItem('zeromall_tryon_user_name', modelName)
    } catch (e) {
      console.warn('[useTryOnLogic] Failed to cache selected model to localStorage:', e)
    }
    triggerToast(
      modelGender === 'female'
        ? `Đã chọn [${modelName}] (160cm • 50kg) và hiển thị các món đồ Nữ!`
        : `Đã chọn [${modelName}]! Bấm "Ướm Cả Bộ" để AI thử đồ.`
    )
  }

  // Xóa ảnh người dùng
  const handleClearUserPhoto = () => {
    setUserPhoto('')
    setUserPhotoName('')
    setCompositeTryOnImage('')
    try {
      localStorage.removeItem('zeromall_tryon_user_photo')
      localStorage.removeItem('zeromall_tryon_user_name')
    } catch (_) {}
    triggerToast('Đã xóa ảnh người dùng!')
  }

  // Tải ảnh món đồ tự do lên để thử trực tiếp (không cần bước bóc tách vải)
  const handleCustomGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string
      if (!dataUrl) return
      const customProduct: Product = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        price: '0',
        originalPrice: '0',
        flashPrice: '0',
        sold: 0,
        total: 10,
        image: dataUrl,
        category: gender === 'female' ? 'Thời Trang Nữ' : 'Thời Trang Nam',
        stock: 1
      }
      const { outfit, activeSlot } = buildOutfitFromSingleProduct(customProduct)
      setSelectedOutfit(outfit)
      setActiveOutfitSlot(activeSlot)
      setSelectedPant(customProduct)
      triggerToast(`📸 Đã tải món đồ "${customProduct.name}" vào Bảng Phối Đồ!`)
      if (userPhoto) {
        handleRunTryOn(customProduct, undefined, undefined, undefined, undefined, outfit)
      }
    }
    reader.readAsDataURL(file)
  }

  // Chạy AI Thử Đồ
  const handleRunTryOn = async (
    pantToTry?: Product,
    overrideUserPhoto?: string,
    overrideHeight?: number,
    overrideWeight?: number,
    overrideGender?: 'male' | 'female',
    overrideOutfit?: OutfitSlots
  ) => {
    const effectivePhoto = overrideUserPhoto !== undefined ? overrideUserPhoto : userPhoto
    if (!effectivePhoto || effectivePhoto.trim() === '') {
      triggerToast('⚠️ Vui lòng tải ảnh của bạn lên trước khi thử đồ!')
      fileInputRef.current?.click()
      return
    }

    const applyColorToSlot = (item: Product | null): Product | null =>
      item ? getEffectiveProductForColor(item, selectedColorVariants[item.id]) : null

    const rawOutfit = overrideOutfit || selectedOutfit
    const rawAccessories = Array.isArray(rawOutfit.accessories)
      ? rawOutfit.accessories.map((a) => applyColorToSlot(a)!).filter(Boolean)
      : []
    const effectiveOutfit: OutfitSlots = {
      top: applyColorToSlot(rawOutfit.top),
      outer_top: applyColorToSlot(rawOutfit.outer_top),
      bottom: applyColorToSlot(rawOutfit.bottom),
      shoes: applyColorToSlot(rawOutfit.shoes),
      accessory: rawAccessories[0] || applyColorToSlot(rawOutfit.accessory),
      accessories: rawAccessories,
    }
    const activeItems = flattenOutfitItems(effectiveOutfit)
    const rawTargetPant = pantToTry || selectedPant || (activeItems.length > 0 ? activeItems[0] : null)
    const targetPant = rawTargetPant ? applyColorToSlot(rawTargetPant) : null
    if (!targetPant && activeItems.length === 0) {
      triggerToast('⚠️ Vui lòng chọn ít nhất 1 món đồ để thử!')
      return
    }

    setIsLoadingAi(true)
    setIsSizeGuideOpen(false)
    const effectiveH = overrideHeight !== undefined ? overrideHeight : height
    const effectiveW = overrideWeight !== undefined ? overrideWeight : weight
    const effectiveG = overrideGender || gender

    try {
      const res = await fetch(`${TRYON_SERVICE_URL}/api/tryon/full-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          height_cm: Number(effectiveH),
          weight_kg: Number(effectiveW),
          gender: effectiveG,
          pant: targetPant || {},
          outfit: effectiveOutfit,
          user_image: effectivePhoto,
          use_mage: true
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setMeasurements(data.measurements)
          setFitResult(data.fit)
          if (data.preview && data.preview.composite_image) {
            setCompositeTryOnImage(data.preview.composite_image)
            setViewMode('tryon')
          }
          if (data.outfits && Array.isArray(data.outfits) && data.outfits.length > 0) {
            setTopScoredOutfits(data.outfits)
          }
          const activeCount = activeItems.length
          if (activeCount > 1) {
            triggerToast(`✨ Đã ướm thử trọn bộ ${activeCount} món thành công!`)
          } else {
            triggerToast(`Đã ướm thử theo khung người ${effectiveH}cm • ${effectiveW}kg thành công!`)
          }
        }
      }
    } catch (e: any) {
      console.error('Try-on API error:', e)
      triggerToast('Không thể kết nối dịch vụ AI Thử Đồ (Port 5006).')
    } finally {
      setIsLoadingAi(false)
    }
  }

  // Quản lý phối đồ (Hỗ trợ Layering 2 lớp áo & Đeo nhiều phụ kiện khác vùng)
  const handleEquipItem = (item: Product, targetSlot?: OutfitSlotKey) => {
    const detected = detectItemSlot(item)
    let resolvedSlot: OutfitSlotKey = targetSlot || detected || activeOutfitSlot || 'top'

    // Tự động nhận diện áo khoác ngoài mặc chồng lên áo trong (Layer 2)
    if (!targetSlot && detected === 'top') {
      if (isOuterwearProduct(item) && selectedOutfit.top && selectedOutfit.top.id !== item.id && !isOuterwearProduct(selectedOutfit.top)) {
        resolvedSlot = 'outer_top'
      } else if (!isOuterwearProduct(item) && selectedOutfit.outer_top && !selectedOutfit.top) {
        resolvedSlot = 'top'
      } else if (activeOutfitSlot === 'outer_top') {
        resolvedSlot = 'outer_top'
      }
    }

    if (resolvedSlot === 'accessory') {
      const nextOutfit = applyAccessoryToOutfit(selectedOutfit, item, true)
      const isAdded = nextOutfit.accessories.some(a => a.id === item.id)
      setSelectedOutfit(nextOutfit)
      setActiveOutfitSlot('accessory')
      setSelectedPant(item)
      triggerToast(
        isAdded
          ? `✓ Đã đeo thêm [${item.name.slice(0, 24)}...] (${nextOutfit.accessories.length} phụ kiện)!`
          : `Đã gỡ [${item.name.slice(0, 24)}...] khỏi danh sách phụ kiện.`
      )
      return
    }

    const newOutfit: OutfitSlots = {
      ...selectedOutfit,
      [resolvedSlot]: item,
    }
    setSelectedOutfit(newOutfit)
    setActiveOutfitSlot(resolvedSlot)
    setSelectedPant(item)
    const slotLabel =
      resolvedSlot === 'top'
        ? 'Áo trong'
        : resolvedSlot === 'outer_top'
        ? 'Áo khoác ngoài'
        : resolvedSlot === 'bottom'
        ? 'Quần/Váy'
        : 'Giày/Dép'
    triggerToast(`Đã chọn [${item.name.slice(0, 25)}...] vào ô ${slotLabel}. Bấm "Ướm Thử" để AI mặc đồ!`)
  }

  const handleRemoveSlot = (slot: OutfitSlotKey, e: React.MouseEvent, itemId?: string) => {
    e.stopPropagation()
    let newOutfit: OutfitSlots
    if (slot === 'accessory') {
      const nextAccs = itemId
        ? (selectedOutfit.accessories || []).filter(a => a.id !== itemId)
        : []
      newOutfit = {
        ...selectedOutfit,
        accessories: nextAccs,
        accessory: nextAccs[0] || null,
      }
    } else {
      newOutfit = {
        ...selectedOutfit,
        [slot]: null,
      }
    }
    setSelectedOutfit(newOutfit)
    const remaining = flattenOutfitItems(newOutfit)
    if (remaining.length > 0) {
      setSelectedPant(remaining[0])
    } else {
      setSelectedPant(null)
      setCompositeTryOnImage('')
    }
    triggerToast('Đã gỡ món khỏi bộ phối đồ.')
  }

  const handleSelectSlot = (slot: OutfitSlotKey) => {
    setActiveOutfitSlot(slot)
    setCategoryFilter(slot === 'outer_top' ? 'top' : slot)
    setSlotPickerTarget(slot)
    setIsSlotPickerOpen(true)
  }

  const handleSelectSlotItem = (item: Product, slot: OutfitSlotKey) => {
    if (slot === 'accessory') {
      const nextOutfit = applyAccessoryToOutfit(selectedOutfit, item, true)
      const isAdded = nextOutfit.accessories.some(a => a.id === item.id)
      setSelectedOutfit(nextOutfit)
      setSelectedPant(item)
      // Không đóng modal để người dùng có thể chọn nhiều phụ kiện liên tiếp (Mũ, Kính, Dây chuyền, Nịt...)
      triggerToast(
        isAdded
          ? `✓ Đã thêm ${item.name} (Đang chọn ${nextOutfit.accessories.length} phụ kiện)`
          : `Đã gỡ ${item.name}`
      )
      return
    }

    setSelectedOutfit(prev => ({ ...prev, [slot]: item }))
    setSelectedPant(item)
    setIsSlotPickerOpen(false)
    const slotNames: Record<OutfitSlotKey, string> = {
      top: 'Áo trong',
      outer_top: 'Áo khoác ngoài',
      bottom: 'Quần & Váy',
      shoes: 'Giày & Dép',
      accessory: 'Phụ kiện',
    }
    triggerToast(`✓ Đã thêm ${item.name} vào ô ${slotNames[slot]}!`)
  }

  const handleApplyPreset = (presetName: string) => {
    if (presetName === 'streetwear') {
      const innerTop = availablePants.find(p => detectItemSlot(p) === 'top' && !isOuterwearProduct(p))
      const outerTop = availablePants.find(p => detectItemSlot(p) === 'top' && isOuterwearProduct(p))
      const bottom = availablePants.find(p => (p.name || '').toLowerCase().includes('jean')) || availablePants.find(p => detectItemSlot(p) === 'bottom')
      const shoes = availablePants.find(p => (p.name || '').toLowerCase().includes('sneaker')) || availablePants.find(p => detectItemSlot(p) === 'shoes')
      const hat = availablePants.find(p => (p.name || '').toLowerCase().includes('nón') || (p.name || '').toLowerCase().includes('mũ')) || availablePants.find(p => detectItemSlot(p) === 'accessory')
      const accs = hat ? [hat] : []
      setSelectedOutfit({ top: innerTop || null, outer_top: outerTop || null, bottom: bottom || null, shoes: shoes || null, accessory: accs[0] || null, accessories: accs })
      triggerToast('🔥 Đã áp dụng Set Streetwear (Áo + Áo Khoác + Quần + Giày + Mũ)!')
    } else if (presetName === 'office') {
      const top = availablePants.find(p => (p.name || '').toLowerCase().includes('sơ mi')) || availablePants.find(p => detectItemSlot(p) === 'top' && !isOuterwearProduct(p))
      const blazer = availablePants.find(p => (p.name || '').toLowerCase().includes('blazer') || (p.name || '').toLowerCase().includes('vest')) || null
      const bottom = availablePants.find(p => (p.name || '').toLowerCase().includes('tây') || (p.name || '').toLowerCase().includes('slimfit')) || availablePants.find(p => detectItemSlot(p) === 'bottom')
      const shoes = availablePants.find(p => (p.name || '').toLowerCase().includes('tây') || (p.name || '').toLowerCase().includes('loafer')) || availablePants.find(p => detectItemSlot(p) === 'shoes')
      setSelectedOutfit({ top: top || null, outer_top: blazer, bottom: bottom || null, shoes: shoes || null, accessory: null, accessories: [] })
      triggerToast('👔 Đã áp dụng Set Công Sở! Bấm "Ướm Thử" để AI thử đồ.')
    } else if (presetName === 'sport') {
      const top = availablePants.find(p => (p.name || '').toLowerCase().includes('thun') || (p.name || '').toLowerCase().includes('cotton')) || availablePants.find(p => detectItemSlot(p) === 'top')
      const bottom = availablePants.find(p => (p.name || '').toLowerCase().includes('jogger')) || availablePants.find(p => detectItemSlot(p) === 'bottom')
      const shoes = availablePants.find(p => (p.name || '').toLowerCase().includes('sneaker') || (p.name || '').toLowerCase().includes('dép')) || availablePants.find(p => detectItemSlot(p) === 'shoes')
      setSelectedOutfit({ top: top || null, outer_top: null, bottom: bottom || null, shoes: shoes || null, accessory: null, accessories: [] })
      triggerToast('⚡ Đã áp dụng Set Thể Thao! Bấm "Ướm Thử" để AI thử đồ.')
    }
  }

  const resolveVariantForItem = (item: Product): string => {
    const pred = predictedSizes[item.id]
    const sizeVal = resolvedItemSizes[item.id] || pred?.recommendedSize || 'Freesize'
    const colorVal = resolvedColorVariants[item.id] || (item as any).selectedVariant
    return composeVariantSelection(item, colorVal, sizeVal)
  }

  const handleAddSingleItemToCart = (item: Product) => {
    const stockVal =
      item.stock !== undefined
        ? item.stock
        : item.total !== undefined
        ? item.total - (item.sold || 0)
        : 99
    if (stockVal <= 0 || item.status === 'hidden') {
      triggerToast('⚠️ Sản phẩm này hiện đã hết hàng!')
      return
    }
    const chosenVariant = resolveVariantForItem(item)
    if (onAddToCart) {
      onAddToCart(item, 1, chosenVariant)
      triggerToast(`🛒 Đã thêm "${item.name.slice(0, 28)}..." (${chosenVariant}) vào giỏ hàng!`)
      setTimeout(() => {
        loadCartFashionItems()
      }, 350)
    } else {
      triggerToast('Chức năng thêm giỏ hàng chưa sẵn sàng ở trang này!')
    }
  }

  const handleBuySingleItem = (item: Product) => {
    const stockVal =
      item.stock !== undefined
        ? item.stock
        : item.total !== undefined
        ? item.total - (item.sold || 0)
        : 99
    if (stockVal <= 0 || item.status === 'hidden') {
      triggerToast('⚠️ Sản phẩm này hiện đã hết hàng!')
      return
    }
    const chosenVariant = resolveVariantForItem(item)
    if (onBuyNow) {
      onClose()
      onBuyNow(item, 1, chosenVariant)
      return
    }
    if (onAddToCart) {
      onAddToCart(item, 1, chosenVariant)
      try {
        localStorage.setItem('zm_selected_keys', JSON.stringify([`${item.id}#${chosenVariant}`]))
        localStorage.setItem('zm_checkout_step', 'checkout')
      } catch (_) {}
      onClose()
      navigate('/checkout')
    }
  }

  const handleAddWholeOutfitToCart = () => {
    const items = flattenOutfitItems(selectedOutfit)
    if (items.length === 0) {
      triggerToast('Chưa có món đồ nào được chọn trong bộ phối!')
      return
    }
    if (onAddToCart) {
      const variant = `Size ${fitResult?.recommended_size || 'L'}`
      const { addedCount, skippedCount } = addOutfitBundleToCart(items, variant, onAddToCart, resolvedCartVariants)
      if (addedCount === 0) {
        triggerToast('⚠️ Các món trong bộ phối hiện đã hết hàng!')
        return
      }
      if (skippedCount > 0) {
        triggerToast(`🛒 Đã thêm ${addedCount} món vào giỏ (${skippedCount} món hết hàng) & chọn sẵn trong giỏ!`)
      } else {
        triggerToast(`🛒 Đã thêm trọn bộ ${addedCount} món phối đồ & chọn sẵn trong giỏ hàng!`)
      }
      setTimeout(() => {
        loadCartFashionItems()
      }, 350)
    }
  }

  const handleBuyWholeOutfit = () => {
    const items = flattenOutfitItems(selectedOutfit)
    if (items.length === 0) {
      triggerToast('Chưa có món đồ nào được chọn trong bộ phối!')
      return
    }
    const hasLoggedUser = Boolean(localStorage.getItem('zm_user'))
    if (!hasLoggedUser && onBuyNow) {
      const firstValid = items.find((p) => (p.stock ?? 99) > 0 && p.status !== 'hidden') || items[0]
      onClose()
      onBuyNow(firstValid, 1, resolveVariantForItem(firstValid))
      return
    }
    if (onAddToCart) {
      const variant = `Size ${fitResult?.recommended_size || 'L'}`
      const { addedCount } = addOutfitBundleToCart(items, variant, onAddToCart, resolvedCartVariants)
      if (addedCount === 0) {
        triggerToast('⚠️ Các món trong bộ phối hiện đã hết hàng!')
        return
      }
      try {
        localStorage.setItem('zm_checkout_step', 'checkout')
      } catch (_) {}
      onClose()
      navigate('/checkout')
    } else if (onBuyNow) {
      const firstValid = items[0]
      onClose()
      onBuyNow(firstValid, 1, resolveVariantForItem(firstValid))
    }
  }

  // 100 Sets AI
  const fetchTopScoredOutfits = async (targetProduct?: Product) => {
    const activeItems = flattenOutfitItems(selectedOutfit)
    const genderMatchedPropProduct = product && isProductMatchingGender(product, gender) ? product : null
    const genderMatchedFallback = availablePants.find((p) => isProductMatchingGender(p, gender)) || null
    const effectiveProd = targetProduct || selectedPant || activeItems[0] || genderMatchedPropProduct || genderMatchedFallback
    if (!effectiveProd) return

    setIsLoadingTopOutfits(true)
    try {
      const res = await fetch(`${TRYON_SERVICE_URL}/api/tryon/generate-top-outfits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: effectiveProd,
          height_cm: Number(height),
          weight_kg: Number(weight),
          gender: gender,
          limit: 100
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.outfits)) {
          setTopScoredOutfits(data.outfits)
        }
      }
    } catch (err) {
      console.warn('[useTryOnLogic] Error fetching top scored outfits:', err)
    } finally {
      setIsLoadingTopOutfits(false)
    }
  }

  const handleAnchorItemTo100Sets = (item: Product) => {
    setSelectedPant(item)
    const slot = detectItemSlot(item) || 'top'
    setSelectedOutfit(prev => ({ ...prev, [slot]: item }))
    setActiveOutfitSlot(slot)
    setIsOutfitModalOpen(true)
    fetchTopScoredOutfits(item)
    triggerToast(`🎯 AI đang mô phỏng 100 set phối đồ xoay quanh [${item.name.slice(0, 25)}...]!`)
  }

  const handleSelectBundlePreview = (bundle: ScoredOutfitBundle) => {
    setSelectedOutfitBundleId(bundle.id)
    const newOutfit: OutfitSlots = { top: null, outer_top: null, bottom: null, shoes: null, accessory: null, accessories: [] }
    bundle.items.forEach((it) => {
      if (!it.product) return
      const slot = it.slot || detectItemSlot(it.product)
      if (slot === 'accessory') {
        const updated = applyAccessoryToOutfit(newOutfit, it.product, false)
        newOutfit.accessories = updated.accessories
        newOutfit.accessory = updated.accessory
      } else if (slot === 'top') {
        if (isOuterwearProduct(it.product) && newOutfit.top && !isOuterwearProduct(newOutfit.top)) {
          newOutfit.outer_top = it.product
        } else {
          newOutfit.top = it.product
        }
      } else if (slot === 'bottom' || slot === 'shoes') {
        newOutfit[slot] = it.product
      }
    })

    setSelectedOutfit(newOutfit)
    setSelectedOutfitBundleId(bundle.id)
    const primary = newOutfit.bottom || newOutfit.top || newOutfit.outer_top || newOutfit.shoes || newOutfit.accessory || bundle.items[0]?.product
    if (primary) {
      setSelectedPant(primary)
    }

    triggerToast(`✓ Đã nạp ${flattenOutfitItems(newOutfit).length} món của [${bundle.title}] vào Bảng Phối Đồ!`)
  }

  const handleExecuteTryOnBundle = (bundle: ScoredOutfitBundle) => {
    setIsOutfitModalOpen(false)

    const newOutfit: OutfitSlots = { top: null, outer_top: null, bottom: null, shoes: null, accessory: null, accessories: [] }
    bundle.items.forEach((it) => {
      if (!it.product) return
      const slot = it.slot || detectItemSlot(it.product)
      if (slot === 'accessory') {
        const updated = applyAccessoryToOutfit(newOutfit, it.product, false)
        newOutfit.accessories = updated.accessories
        newOutfit.accessory = updated.accessory
      } else if (slot === 'top') {
        if (isOuterwearProduct(it.product) && newOutfit.top && !isOuterwearProduct(newOutfit.top)) {
          newOutfit.outer_top = it.product
        } else {
          newOutfit.top = it.product
        }
      } else if (slot === 'bottom' || slot === 'shoes') {
        newOutfit[slot] = it.product
      }
    })

    setSelectedOutfit(newOutfit)
    setSelectedOutfitBundleId(bundle.id)
    const primary = newOutfit.bottom || newOutfit.top || newOutfit.outer_top || newOutfit.shoes || newOutfit.accessory || bundle.items[0]?.product
    if (primary) {
      setSelectedPant(primary)
    }

    if (!userPhoto) {
      triggerToast(`✓ Đã nạp ${flattenOutfitItems(newOutfit).length} món vào Bảng Phối Đồ! Hãy tải ảnh của bạn để AI ướm thử lên người.`)
      fileInputRef.current?.click()
      return
    }

    setActiveTab('photo')
    handleRunTryOn(undefined, undefined, undefined, undefined, undefined, newOutfit)
  }

  const handleAddScoredOutfitToCart = (bundle: ScoredOutfitBundle) => {
    if (!onAddToCart) {
      triggerToast('Chức năng thêm giỏ hàng chưa sẵn sàng!')
      return
    }
    const items = bundle.items.map((it) => it.product).filter(Boolean)
    const variant = `Size ${fitResult?.recommended_size || 'L'}`
    const bundleSizes: Record<string, string> = {}
    items.forEach((item) => {
      const isOuter = bundle.items.some(
        (bIt) =>
          bIt.product?.id === item.id &&
          ((bIt.slot as string) === 'outer_top' || /khoác|blazer|jacket/i.test(bIt.role || ''))
      )
      const pred = predictProductSize({
        product: item,
        heightCm: Number(height) || 170,
        weightKg: Number(weight) || 65,
        gender,
        isOuterLayer: isOuter,
      })
      if (pred.recommendedSize) {
        bundleSizes[item.id] = pred.recommendedSize
      }
    })
    const { addedCount, skippedCount } = addOutfitBundleToCart(items, variant, onAddToCart, bundleSizes)
    if (addedCount === 0) {
      triggerToast('⚠️ Các món trong set này hiện đã hết hàng!')
      return
    }
    if (skippedCount > 0) {
      triggerToast(`🎉 Đã thêm ${addedCount} món vào giỏ (${skippedCount} món hết hàng) & chọn sẵn trong giỏ!`)
    } else {
      triggerToast(`🎉 Đã thêm trọn bộ ${addedCount} món (Tiết kiệm ${formatDisplayPrice(bundle.savings)}) & chọn sẵn trong giỏ!`)
    }
    setTimeout(() => {
      loadCartFashionItems()
    }, 350)
  }

  useEffect(() => {
    if (isOpen) {
      fetchTopScoredOutfits(selectedPant || product || undefined)
    }
  }, [isOpen, selectedPant?.id, height, weight, gender])

  const triggerToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  const effectiveSelectedOutfit = useMemo<OutfitSlots>(() => {
    const mapItem = (item: Product | null): Product | null =>
      item ? getEffectiveProductForColor(item, selectedColorVariants[item.id]) : null
    const accs = Array.isArray(selectedOutfit.accessories)
      ? selectedOutfit.accessories.map((a) => mapItem(a)!).filter(Boolean)
      : []
    return {
      top: mapItem(selectedOutfit.top),
      outer_top: mapItem(selectedOutfit.outer_top),
      bottom: mapItem(selectedOutfit.bottom),
      shoes: mapItem(selectedOutfit.shoes),
      accessory: accs[0] || mapItem(selectedOutfit.accessory),
      accessories: accs,
    }
  }, [selectedOutfit, selectedColorVariants])

  const outfitItems = useMemo(() => flattenOutfitItems(effectiveSelectedOutfit), [effectiveSelectedOutfit])

  const predictedSizes = useMemo<Record<string, SizePredictionResult>>(() => {
    const map: Record<string, SizePredictionResult> = {}
    const h = Number(height) || 170
    const w = Number(weight) || 65
    outfitItems.forEach((item) => {
      map[item.id] = predictProductSize({
        product: item,
        heightCm: h,
        weightKg: w,
        gender,
        isOuterLayer: selectedOutfit.outer_top?.id === item.id,
      })
    })
    return map
  }, [outfitItems, selectedOutfit.outer_top?.id, height, weight, gender])

  const resolvedColorVariants = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    outfitItems.forEach((item) => {
      const variants = getProductColorVariants(item)
      const chosen = selectedColorVariants[item.id]
      if (chosen && variants.some((v) => v.name.toLowerCase() === chosen.toLowerCase())) {
        map[item.id] = chosen
      } else if (variants.length > 0) {
        map[item.id] = variants[0].name
      }
    })
    return map
  }, [outfitItems, selectedColorVariants])

  const resolvedItemSizes = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    outfitItems.forEach((item) => {
      const pred = predictedSizes[item.id]
      const override = sizeOverrides[item.id]
      if (override && pred?.availableOptions?.includes(override)) {
        map[item.id] = override
      } else if (pred?.recommendedSize) {
        map[item.id] = pred.recommendedSize
      }
    })
    return map
  }, [outfitItems, predictedSizes, sizeOverrides])

  const resolvedCartVariants = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    outfitItems.forEach((item) => {
      const sizeVal = resolvedItemSizes[item.id] || predictedSizes[item.id]?.recommendedSize || 'Freesize'
      const colorVal = resolvedColorVariants[item.id] || (item as any).selectedVariant
      map[item.id] = composeVariantSelection(item, colorVal, sizeVal)
    })
    return map
  }, [outfitItems, resolvedItemSizes, predictedSizes, resolvedColorVariants])

  const setItemSizeOverride = (productId: string, size: string) => {
    setSizeOverrides((prev) => ({ ...prev, [productId]: size }))
  }

  const setItemColorVariant = (productId: string, colorName: string) => {
    setSelectedColorVariants((prev) => ({ ...prev, [productId]: colorName }))
    triggerToast(`🎨 Đã chọn màu [${colorName}]! Bấm "Ướm Thử Lên Người" để AI mặc màu mới.`)
  }

  const totalOutfitPrice = outfitItems.reduce((sum, item) => {
    const raw = item.price || item.flashPrice || 0
    const num = typeof raw === 'number' ? raw : (parseFloat(String(raw).replace(/[^0-9]/g, '')) || 0)
    return sum + num
  }, 0)

  return {
    userPhoto,
    userPhotoName,
    height,
    setHeight,
    weight,
    setWeight,
    gender,
    setGender,
    handleChangeGender,
    physiqueInfo,
    currentBmi,
    gemBalance,
    tryonEngineMode,
    setTryonEngineMode,
    showMageConfirmModal,
    setShowMageConfirmModal,
    selectedOutfit: effectiveSelectedOutfit,
    activeOutfitSlot,
    sourceTab,
    setSourceTab,
    cartFashionItems,
    availablePants,
    selectedPant,
    isLoadingPants,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearchingDb,
    isLoadingAi,
    measurements,
    fitResult,
    compositeTryOnImage,
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    toastMsg,
    topScoredOutfits,
    isLoadingTopOutfits,
    selectedOutfitBundleId,
    isOutfitModalOpen,
    setIsOutfitModalOpen,
    isSlotPickerOpen,
    setIsSlotPickerOpen,
    slotPickerTarget,
    setSlotPickerTarget,
    isSizeGuideOpen,
    setIsSizeGuideOpen,
    handleSelectSlotItem,
    fileInputRef,
    customGarmentInputRef,
    outfitItems,
    predictedSizes,
    resolvedItemSizes,
    selectedColorVariants: resolvedColorVariants,
    setItemSizeOverride,
    setItemColorVariant,
    totalOutfitPrice,
    handleSearchDatabase,
    handlePhotoUpload,
    handleSelectPresetModel,
    handleClearUserPhoto,
    handleCustomGarmentUpload,
    handleRunTryOn,
    handleEquipItem,
    handleRemoveSlot,
    handleSelectSlot,
    handleApplyPreset,
    handleAddSingleItemToCart,
    handleBuySingleItem,
    handleAddWholeOutfitToCart,
    handleBuyWholeOutfit,
    fetchTopScoredOutfits,
    handleAnchorItemTo100Sets,
    handleSelectBundlePreview,
    handleExecuteTryOnBundle,
    handleAddScoredOutfitToCart,
    triggerToast,
  }
}
