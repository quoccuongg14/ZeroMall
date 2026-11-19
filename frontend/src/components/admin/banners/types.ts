export type BannerPosition = 'CAROUSEL' | 'SIDE_TOP' | 'SIDE_BOTTOM';

export interface Banner {
  id: string;
  title: string;
  subTitle?: string;
  badge?: string;
  imageUrl: string;
  linkUrl?: string;
  position: BannerPosition;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BannerFormData {
  title: string;
  subTitle: string;
  badge: string;
  imageUrl: string;
  linkUrl: string;
  position: BannerPosition;
  displayOrder: number;
  isActive: boolean;
}

export const BANNER_TARGET_RATIO = 2.5; // Tỉ lệ chuẩn 2.5 : 1 (ví dụ 1000x400 px, 800x320 px)
export const BANNER_RECOMMENDED_WIDTH = 1000;
export const BANNER_RECOMMENDED_HEIGHT = 400;
