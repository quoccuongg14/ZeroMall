import type { Product } from '../../FlashSale'
import type { CartItem } from '../../../../models/cart.model'

export interface BodyMeasurements {
  bmi: number
  body_type: string
  shape_class: string
  height_cm: number
  weight_kg: number
  gender: string
  chest_cm: number
  waist_cm: number
  hip_cm: number
  thigh_cm: number
  shoulder_cm: number
  inseam_cm: number
  outseam_cm: number
  recommended_pant_size: string
}

export interface FitZone {
  label: string
  diff_percent?: number
  diff_cm?: number
  status: string
  status_code: string
  color: string
}

export interface FitResult {
  fit_score: number
  recommended_size: string
  silhouette?: string
  body_tip?: string
  zones: {
    waist: FitZone
    hip: FitZone
    thigh: FitZone
    length: FitZone
  }
  verdict: string
  stylist_fit_advice: string
}

export interface OutfitItem {
  role: string
  slot?: 'top' | 'bottom' | 'shoes' | 'accessory'
  product: Product
}

export interface ScoredOutfitBundle {
  id: string
  rank: number
  badge: string
  score: number
  title: string
  tag: string
  vibe: string
  stylist_note: string
  items: OutfitItem[]
  total_price: number
  combo_price: number
  savings: number
  discount_percent: number
}

export interface CartFashionItem {
  product: Product
  variant?: string
  quantity: number
}

export type OutfitSlotKey = 'top' | 'outer_top' | 'bottom' | 'shoes' | 'accessory'

export type AccessoryZone = 'hat' | 'eyewear' | 'necklace' | 'belt' | 'bag' | 'wrist' | 'earring' | 'other'

export interface OutfitSlots {
  top: Product | null
  outer_top: Product | null
  bottom: Product | null
  shoes: Product | null
  accessory: Product | null
  accessories: Product[]
}

export type TryonEngineMode = 'free' | 'mage'

export interface VirtualTryOnModalProps {
  isOpen: boolean
  onClose: () => void
  product?: Product | null
  initialVariant?: string
  cart?: CartItem[]
  onAddToCart?: (product: Product, quantity: number, variant: string) => void
  onBuyNow?: (product: Product, quantity: number, variant: string) => void
  initialBundle?: ScoredOutfitBundle | null
}
