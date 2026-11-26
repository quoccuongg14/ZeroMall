import React from 'react'

interface ZeroMallLogoMarkProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  alt?: string
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-7 h-7 rounded-lg',
  md: 'w-9 h-9 rounded-xl',
  lg: 'w-11 h-11 rounded-2xl',
}

/**
 * Biểu tượng Logo ZeroMall chuẩn (dùng chung cho Sàn Buyer, Seller, Admin, CSKH và Delivery).
 */
export const ZeroMallLogoMark: React.FC<ZeroMallLogoMarkProps> = ({
  size = 'md',
  className = '',
  alt = 'ZeroMall Logo',
}) => (
  <img
    src="/zeromall-logo.png"
    alt={alt}
    className={`${SIZE_CLASSES[size]} object-contain shrink-0 select-none ${className}`.trim()}
  />
)
