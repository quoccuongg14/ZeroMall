import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL, TRYON_SERVICE_URL } from '../../../../config/api.config'
import type { Product } from '../../FlashSale'
import type {
  BodyMeasurements,
  FitResult,
  ExtractedGarment,
  CartFashionItem,
  OutfitSlots,
  TryonEngineMode,
  ScoredOutfitBundle,
  VirtualTryOnModalProps,
} from './types'
import { detectItemSlot, getBodyPhysiqueInfo, formatDisplayPrice } from './tryonUtils'

export const useTryOnLogic = ({
  isOpen,
  product,
  cart,
  onAddToCart,
  initialBundle,
}: VirtualTryOnModalProps) => {
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
  const [height, setHeight] = useState<number>(() => {
    return Number(localStorage.getItem('zeromall_tryon_user_height')) || 175
  })
  const [weight, setWeight] = useState<number>(() => {
    return Number(localStorage.getItem('zeromall_tryon_user_weight')) || 68
  })
  const [gender, setGender] = useState<'male' | 'female'>(() => {
    return (localStorage.getItem('zeromall_tryon_user_gender') as 'male' | 'female') || 'male'
  })

  // 2. Quản lý Chế độ thử đồ AI Siêu Thực
  const [gemBalance, setGemBalance] = useState<number | null>(7060)
  const [tryonEngineMode, setTryonEngineMode] = useState<TryonEngineMode>('mage')
  const [showMageConfirmModal, setShowMageConfirmModal] = useState<boolean>(false)

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

  // 3. Món đồ được chọn để ướm thử & Nguồn cấp tủ đồ
  const [selectedOutfit, setSelectedOutfit] = useState<OutfitSlots>(() => {
    const init: OutfitSlots = { top: null, bottom: null, shoes: null, accessory: null }
    if (initialBundle && Array.isArray(initialBundle.items) && initialBundle.items.length > 0) {
      initialBundle.items.forEach((it) => {
        const slot = it.slot || detectItemSlot(it.product)
        if (slot && slot in init && it.product) {
          init[slot] = it.product
        }
      })
      if (product) {
        const pSlot = detectItemSlot(product) || 'top'
        if (!init[pSlot]) init[pSlot] = product
      }
      return init
    }
    if (product) {
      const slot = detectItemSlot(product) || 'top'
      init[slot] = product
    }
    return init
  })
  const [activeOutfitSlot, setActiveOutfitSlot] = useState<'top' | 'bottom' | 'shoes' | 'accessory'>(() => {
    return (product ? detectItemSlot(product) : null) || 'top'
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

  // 4. Kết quả phân tích AI & Bóc tách đồ
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false)
  const [measurements, setMeasurements] = useState<BodyMeasurements | null>(null)
  const [fitResult, setFitResult] = useState<FitResult | null>(null)
  const [compositeTryOnImage, setCompositeTryOnImage] = useState<string>('')
  const [extractedGarment, setExtractedGarment] = useState<ExtractedGarment | null>(null)
  const [isScanningGarment, setIsScanningGarment] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'photo' | 'scanner' | 'heatmap'>('photo')
  const [viewMode, setViewMode] = useState<'tryon' | 'original' | 'sidebyside'>('tryon')
  const [toastMsg, setToastMsg] = useState<string>('')

  // 5. Danh sách 100 Set Phối Đồ AI Đẹp Nhất
  const [topScoredOutfits, setTopScoredOutfits] = useState<ScoredOutfitBundle[]>([])
  const [isLoadingTopOutfits, setIsLoadingTopOutfits] = useState<boolean>(false)
  const [selectedOutfitBundleId, setSelectedOutfitBundleId] = useState<string | null>(() => initialBundle?.id || null)
  const [rightColTab, setRightColTab] = useState<'outfits100' | 'wardrobe' | 'scanner'>('wardrobe')
  const [isOutfitModalOpen, setIsOutfitModalOpen] = useState<boolean>(false)
  const [isSlotPickerOpen, setIsSlotPickerOpen] = useState<boolean>(false)
  const [slotPickerTarget, setSlotPickerTarget] = useState<'top' | 'bottom' | 'shoes' | 'accessory' | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const customGarmentInputRef = useRef<HTMLInputElement | null>(null)

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
          if (!item.product) return
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
          const validFashion = prods.filter(p => detectItemSlot(p) !== null)
          setSearchResults(validFashion)
        }
      } catch (err) {
        console.error('Lỗi khi tìm kiếm sản phẩm trong database:', err)
      } finally {
        setIsSearchingDb(false)
      }
    }, 300)
  }

  // Khi mở modal hoặc khi product/initialBundle thay đổi
  useEffect(() => {
    if (isOpen) {
      if (initialBundle && Array.isArray(initialBundle.items) && initialBundle.items.length > 0) {
        const bundleOutfit: OutfitSlots = { top: null, bottom: null, shoes: null, accessory: null }
        initialBundle.items.forEach((it) => {
          const slot = it.slot || detectItemSlot(it.product)
          if (slot && slot in bundleOutfit && it.product) {
            bundleOutfit[slot] = it.product
          }
        })
        if (product) {
          const pSlot = detectItemSlot(product) || 'top'
          if (!bundleOutfit[pSlot]) bundleOutfit[pSlot] = product
        }
        setSelectedOutfit(bundleOutfit)
        setSelectedOutfitBundleId(initialBundle.id)
        const primary = bundleOutfit.top || bundleOutfit.bottom || bundleOutfit.shoes || bundleOutfit.accessory || product
        if (primary) {
          setSelectedPant(primary)
        }
        if (product) {
          setActiveOutfitSlot(detectItemSlot(product) || 'top')
        }
        setSourceTab('catalog')
      } else if (product) {
        const slot = detectItemSlot(product) || 'top'
        setSelectedOutfit(prev => ({ ...prev, [slot]: product }))
        setActiveOutfitSlot(slot)
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
          if (p && p.id && !uniqueMap.has(p.id) && detectItemSlot(p) !== null) {
            uniqueMap.set(p.id, p)
          }
        })
        const combined = Array.from(uniqueMap.values())
        let effectivePants = combined.length > 0 ? combined : []

        if (product) {
          const filtered = effectivePants.filter(p => p.id !== product.id)
          effectivePants = [product, ...filtered]
          setAvailablePants(effectivePants)
          if (!initialBundle) {
            const slot = detectItemSlot(product) || 'top'
            setSelectedOutfit(prev => ({ ...prev, [slot]: product }))
            setActiveOutfitSlot(slot)
            setSelectedPant(product)
            setSourceTab('catalog')
          }
        } else {
          setAvailablePants(effectivePants)
          if (cartItems.length > 0) {
            const first = cartItems[0].product
            const slot = detectItemSlot(first) || 'top'
            setSelectedOutfit({ top: null, bottom: null, shoes: null, accessory: null, [slot]: first })
            setActiveOutfitSlot(slot)
            setSelectedPant(first)
            setSourceTab('cart')
          } else if (effectivePants.length > 0) {
            const first = effectivePants[0]
            const slot = detectItemSlot(first) || 'top'
            setSelectedOutfit({ top: null, bottom: null, shoes: null, accessory: null, [slot]: first })
            setActiveOutfitSlot(slot)
            setSelectedPant(first)
            setSourceTab('catalog')
          }
        }
      } catch (e) {
        console.error('Lỗi khi tải sản phẩm ZeroMall:', e)
        if (product) {
          setAvailablePants([product])
          const slot = detectItemSlot(product) || 'top'
          setSelectedOutfit({ top: null, bottom: null, shoes: null, accessory: null, [slot]: product })
          setSelectedPant(product)
        }
      } finally {
        setIsLoadingPants(false)
      }
    }

    fetchRealFashion()
  }, [isOpen, product, cart])

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
            setGender(detectedG)
            triggerToast(`🤖 AI nhận diện vóc dáng: ${detectedG === 'male' ? 'Nam' : 'Nữ'}. Đã tự động lọc đồ ${detectedG === 'male' ? 'Nam' : 'Nữ'}!`)
          } else {
            triggerToast('📸 Đã tải ảnh của bạn! Đang phân tích vóc dáng...')
            // Gọi endpoint AI phân tích thị giác
            try {
              const res = await fetch(`${TRYON_SERVICE_URL}/api/tryon/detect-gender`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_image: dataUrl })
              })
              if (res.ok) {
                const data = await res.json()
                if (data && (data.gender === 'male' || data.gender === 'female')) {
                  setGender(data.gender)
                  const gLabel = data.gender === 'male' ? 'Nam' : 'Nữ'
                  triggerToast(`🤖 AI nhận diện ảnh: Vóc dáng ${gLabel} (${data.reason || 'Tự động lọc trang phục ' + gLabel}). Bạn có thể đổi lại nếu muốn!`)
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
    setGender(modelGender)
    setCompositeTryOnImage('')
    setViewMode('original')
    try {
      localStorage.setItem('zeromall_tryon_user_photo', modelUrl)
      localStorage.setItem('zeromall_tryon_user_name', modelName)
    } catch (e) {
      console.warn('[useTryOnLogic] Failed to cache selected model to localStorage:', e)
    }
    triggerToast(`Đã chọn [${modelName}]! Bấm "Ướm Cả Bộ" để AI thử đồ.`)
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

  // Bóc tách trang phục
  const handleScanGarment = async (garmentToScan?: Product) => {
    const target = garmentToScan || selectedPant
    if (!target || !target.image) return
    setIsScanningGarment(true)
    triggerToast('AI FashnHumanParser đang quét và bóc tách từng lớp vải...')

    try {
      const res = await fetch(`${TRYON_SERVICE_URL}/api/tryon/extract-garment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: target.image,
          garment_info: target
        })
      })
      if (res.ok) {
        const extData = await res.json()
        if (extData.success) {
          setExtractedGarment(extData)
          setActiveTab('scanner')
          triggerToast(`Bóc tách thành công [${extData.detected_category.toUpperCase()}]!`)
        }
      }
    } catch (err) {
      console.error(err)
      triggerToast('Không thể kết nối AI Extractor.')
    } finally {
      setIsScanningGarment(false)
    }
  }

  // Tải ảnh món đồ tự do
  const handleCustomGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string
      if (!dataUrl) return
      setIsScanningGarment(true)
      triggerToast('AI đang quét và bóc tách món đồ bạn vừa tải lên...')

      try {
        const res = await fetch(`${TRYON_SERVICE_URL}/api/tryon/extract-garment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataUrl,
            garment_info: { name: file.name }
          })
        })
        if (res.ok) {
          const ext = await res.json()
          if (ext.success) {
            setExtractedGarment(ext)
            const customProduct: Product = {
              id: `custom-${Date.now()}`,
              name: file.name.replace(/\.[^/.]+$/, ''),
              price: '0',
              originalPrice: '0',
              flashPrice: '0',
              sold: 0,
              total: 10,
              image: dataUrl,
              category: ext.detected_category,
              stock: 1
            }
            setSelectedPant(customProduct)
            setActiveTab('scanner')
            triggerToast(`AI đã bóc tách thành công: ${ext.detected_category.toUpperCase()}!`)
            handleRunTryOn(customProduct)
          }
        }
      } catch (err) {
        console.error(err)
        triggerToast('Lỗi khi bóc tách món đồ.')
      } finally {
        setIsScanningGarment(false)
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

    const effectiveOutfit = overrideOutfit || selectedOutfit
    const activeItems = Object.values(effectiveOutfit).filter(Boolean) as Product[]
    const targetPant = pantToTry || selectedPant || (activeItems.length > 0 ? activeItems[0] : null)
    if (!targetPant && activeItems.length === 0) {
      triggerToast('⚠️ Vui lòng chọn ít nhất 1 món đồ để thử!')
      return
    }

    setIsLoadingAi(true)
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
          if (data.extracted_garment && data.extracted_garment.extracted_garment_url) {
            setExtractedGarment(data.extracted_garment)
          }
          if (data.outfits && Array.isArray(data.outfits) && data.outfits.length > 0) {
            setTopScoredOutfits(data.outfits)
          }
          const activeCount = Object.values(effectiveOutfit).filter(Boolean).length
          if (activeCount > 1) {
            triggerToast(`✨ Đã phối trọn bộ ${activeCount} món lên người mẫu thành công!`)
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

  // Quản lý phối đồ
  const handleEquipItem = (item: Product, targetSlot?: 'top' | 'bottom' | 'shoes' | 'accessory') => {
    const slot = targetSlot || detectItemSlot(item) || activeOutfitSlot || 'top'
    const newOutfit = {
      ...selectedOutfit,
      [slot]: item
    }
    setSelectedOutfit(newOutfit)
    setActiveOutfitSlot(slot)
    setSelectedPant(item)
    const slotLabel = slot === 'top' ? 'Áo' : slot === 'bottom' ? 'Quần/Váy' : slot === 'shoes' ? 'Giày/Dép' : 'Mũ/Phụ Kiện'
    triggerToast(`Đã chọn [${item.name.slice(0, 25)}...] vào ô ${slotLabel}. Bấm "Ướm Cả Bộ" để AI thử đồ!`)
  }

  const handleRemoveSlot = (slot: 'top' | 'bottom' | 'shoes' | 'accessory', e: React.MouseEvent) => {
    e.stopPropagation()
    const newOutfit = {
      ...selectedOutfit,
      [slot]: null
    }
    setSelectedOutfit(newOutfit)
    const remaining = Object.values(newOutfit).filter(Boolean) as Product[]
    if (remaining.length > 0) {
      setSelectedPant(remaining[0])
    } else {
      setSelectedPant(null)
      setCompositeTryOnImage('')
    }
    triggerToast('Đã gỡ món khỏi bộ phối đồ.')
  }

  const handleSelectSlot = (slot: 'top' | 'bottom' | 'shoes' | 'accessory') => {
    setActiveOutfitSlot(slot)
    setCategoryFilter(slot)
    setSlotPickerTarget(slot)
    setIsSlotPickerOpen(true)
  }

  const handleSelectSlotItem = (item: Product, slot: 'top' | 'bottom' | 'shoes' | 'accessory') => {
    setSelectedOutfit(prev => ({ ...prev, [slot]: item }))
    setSelectedPant(item)
    setIsSlotPickerOpen(false)
    const slotNames: Record<'top' | 'bottom' | 'shoes' | 'accessory', string> = {
      top: 'Áo',
      bottom: 'Quần & Váy',
      shoes: 'Giày & Dép',
      accessory: 'Phụ kiện',
    }
    triggerToast(`✓ Đã thêm ${item.name} vào ô ${slotNames[slot]}!`)
  }

  const handleApplyPreset = (presetName: string) => {
    if (presetName === 'streetwear') {
      const top = availablePants.find(p => (p.name || '').toLowerCase().includes('bomber')) || availablePants.find(p => detectItemSlot(p) === 'top')
      const bottom = availablePants.find(p => (p.name || '').toLowerCase().includes('jean')) || availablePants.find(p => detectItemSlot(p) === 'bottom')
      const shoes = availablePants.find(p => (p.name || '').toLowerCase().includes('sneaker')) || availablePants.find(p => detectItemSlot(p) === 'shoes')
      const hat = availablePants.find(p => (p.name || '').toLowerCase().includes('nón') || (p.name || '').toLowerCase().includes('mũ')) || availablePants.find(p => detectItemSlot(p) === 'accessory')
      setSelectedOutfit({ top: top || null, bottom: bottom || null, shoes: shoes || null, accessory: hat || null })
      triggerToast('🔥 Đã áp dụng Set Streetwear! Bấm "Ướm Cả Bộ" để AI thử đồ.')
    } else if (presetName === 'office') {
      const top = availablePants.find(p => (p.name || '').toLowerCase().includes('sơ mi') || (p.name || '').toLowerCase().includes('blazer')) || availablePants.find(p => detectItemSlot(p) === 'top')
      const bottom = availablePants.find(p => (p.name || '').toLowerCase().includes('tây') || (p.name || '').toLowerCase().includes('slimfit')) || availablePants.find(p => detectItemSlot(p) === 'bottom')
      const shoes = availablePants.find(p => (p.name || '').toLowerCase().includes('tây') || (p.name || '').toLowerCase().includes('loafer')) || availablePants.find(p => detectItemSlot(p) === 'shoes')
      setSelectedOutfit({ top: top || null, bottom: bottom || null, shoes: shoes || null, accessory: null })
      triggerToast('👔 Đã áp dụng Set Công Sở! Bấm "Ướm Cả Bộ" để AI thử đồ.')
    } else if (presetName === 'sport') {
      const top = availablePants.find(p => (p.name || '').toLowerCase().includes('thun') || (p.name || '').toLowerCase().includes('cotton')) || availablePants.find(p => detectItemSlot(p) === 'top')
      const bottom = availablePants.find(p => (p.name || '').toLowerCase().includes('jogger')) || availablePants.find(p => detectItemSlot(p) === 'bottom')
      const shoes = availablePants.find(p => (p.name || '').toLowerCase().includes('sneaker') || (p.name || '').toLowerCase().includes('dép')) || availablePants.find(p => detectItemSlot(p) === 'shoes')
      setSelectedOutfit({ top: top || null, bottom: bottom || null, shoes: shoes || null, accessory: null })
      triggerToast('⚡ Đã áp dụng Set Thể Thao! Bấm "Ướm Cả Bộ" để AI thử đồ.')
    }
  }

  const handleAddWholeOutfitToCart = () => {
    const items = Object.values(selectedOutfit).filter(Boolean) as Product[]
    if (items.length === 0) {
      triggerToast('Chưa có món đồ nào được chọn trong bộ phối!')
      return
    }
    if (onAddToCart) {
      items.forEach(item => {
        onAddToCart(item, 1, `Size ${fitResult?.recommended_size || 'L'}`)
      })
      triggerToast(`🛒 Đã thêm trọn bộ ${items.length} món phối đồ vào giỏ hàng!`)
      setTimeout(() => {
        loadCartFashionItems()
      }, 350)
    }
  }

  // 100 Sets AI
  const fetchTopScoredOutfits = async (targetProduct?: Product) => {
    const activeItems = Object.values(selectedOutfit).filter(Boolean) as Product[]
    const effectiveProd = targetProduct || selectedPant || product || (activeItems.length > 0 ? activeItems[0] : null)
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
    const newOutfit: OutfitSlots = { top: null, bottom: null, shoes: null, accessory: null }
    bundle.items.forEach((it) => {
      const slot = it.slot || detectItemSlot(it.product)
      if (slot && slot in newOutfit) {
        newOutfit[slot] = it.product
      }
    })

    setSelectedOutfit(newOutfit)
    setSelectedOutfitBundleId(bundle.id)
    const primary = newOutfit.bottom || newOutfit.top || newOutfit.shoes || newOutfit.accessory || bundle.items[0]?.product
    if (primary) {
      setSelectedPant(primary)
    }

    triggerToast(`✓ Đã nạp 4 món của [${bundle.title}] vào Bảng Phối Đồ!`)
  }

  const handleExecuteTryOnBundle = (bundle: ScoredOutfitBundle) => {
    setIsOutfitModalOpen(false)

    const newOutfit: OutfitSlots = { top: null, bottom: null, shoes: null, accessory: null }
    bundle.items.forEach((it) => {
      const slot = it.slot || detectItemSlot(it.product)
      if (slot && slot in newOutfit && it.product) {
        newOutfit[slot] = it.product
      }
    })

    setSelectedOutfit(newOutfit)
    setSelectedOutfitBundleId(bundle.id)
    const primary = newOutfit.bottom || newOutfit.top || newOutfit.shoes || newOutfit.accessory || bundle.items[0]?.product
    if (primary) {
      setSelectedPant(primary)
    }

    if (!userPhoto) {
      triggerToast('✓ Đã nạp 4 món vào Bảng Phối Đồ! Hãy tải ảnh của bạn để AI ướm thử lên người.')
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
    let addedCount = 0
    bundle.items.forEach((it) => {
      if (it.product) {
        onAddToCart(it.product, 1, `Size ${fitResult?.recommended_size || 'L'}`)
        addedCount++
      }
    })
    triggerToast(`🎉 Đã thêm trọn bộ ${addedCount} món (Tiết kiệm ${formatDisplayPrice(bundle.savings)}) vào giỏ hàng thành công!`)
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

  const outfitItems = Object.values(selectedOutfit).filter(Boolean) as Product[]
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
    physiqueInfo,
    currentBmi,
    gemBalance,
    tryonEngineMode,
    setTryonEngineMode,
    showMageConfirmModal,
    setShowMageConfirmModal,
    selectedOutfit,
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
    extractedGarment,
    isScanningGarment,
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    toastMsg,
    topScoredOutfits,
    isLoadingTopOutfits,
    selectedOutfitBundleId,
    rightColTab,
    setRightColTab,
    isOutfitModalOpen,
    setIsOutfitModalOpen,
    isSlotPickerOpen,
    setIsSlotPickerOpen,
    slotPickerTarget,
    setSlotPickerTarget,
    handleSelectSlotItem,
    fileInputRef,
    customGarmentInputRef,
    outfitItems,
    totalOutfitPrice,
    handleSearchDatabase,
    handlePhotoUpload,
    handleSelectPresetModel,
    handleClearUserPhoto,
    handleScanGarment,
    handleCustomGarmentUpload,
    handleRunTryOn,
    handleEquipItem,
    handleRemoveSlot,
    handleSelectSlot,
    handleApplyPreset,
    handleAddWholeOutfitToCart,
    fetchTopScoredOutfits,
    handleAnchorItemTo100Sets,
    handleSelectBundlePreview,
    handleExecuteTryOnBundle,
    handleAddScoredOutfitToCart,
    triggerToast,
  }
}
