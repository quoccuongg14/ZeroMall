import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api.config';

interface BannerItem {
  id: string;
  title: string;
  subTitle?: string;
  badge?: string;
  imageUrl: string;
  linkUrl?: string;
  position: 'CAROUSEL' | 'SIDE_TOP' | 'SIDE_BOTTOM';
  displayOrder: number;
  isActive: boolean;
}

export const Hero: React.FC = () => {
  const navigate = useNavigate();
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselBanners, setCarouselBanners] = useState<BannerItem[]>([]);
  const [sideTopBanner, setSideTopBanner] = useState<BannerItem | null>(null);
  const [sideBottomBanner, setSideBottomBanner] = useState<BannerItem | null>(null);

  // Fetch dynamic banners from backend
  useEffect(() => {
    let isMounted = true;
    const fetchBanners = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/products/banners?activeOnly=true`);
        if (res.ok) {
          const data: BannerItem[] = await res.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            const carousels = data
              .filter((b) => b.position === 'CAROUSEL')
              .sort((a, b) => a.displayOrder - b.displayOrder);
            const sideTop = data.find((b) => b.position === 'SIDE_TOP') || null;
            const sideBottom = data.find((b) => b.position === 'SIDE_BOTTOM') || null;

            if (carousels.length > 0) {
              setCarouselBanners(carousels);
            }
            setSideTopBanner(sideTop);
            setSideBottomBanner(sideBottom);
          }
        }
      } catch (err) {
        console.warn('Failed to load dynamic banners, using default view:', err);
      }
    };

    fetchBanners();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fallback defaults if DB is empty or network is delayed
  const effectiveSlides = carouselBanners.length > 0 ? carouselBanners : [
    {
      id: 'default-1',
      title: 'XANH MÁT NGÀY HÈ 6.6',
      subTitle: 'Miễn Phí Vận Chuyển Toàn Quốc Cho Mọi Đơn Hàng',
      imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80',
      badge: 'MINT SALE',
      linkUrl: '/flash-sale',
      position: 'CAROUSEL' as const,
      displayOrder: 0,
      isActive: true,
    },
    {
      id: 'default-2',
      title: 'ĐẠI TIỆC CÔNG NGHỆ',
      subTitle: 'Giảm Đến 50% - Trả Góp 0% Lãi Suất',
      imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
      badge: 'TECH ZONE',
      linkUrl: '/category/thiet-bi-dien-tu',
      position: 'CAROUSEL' as const,
      displayOrder: 1,
      isActive: true,
    },
    {
      id: 'default-3',
      title: 'XU HƯỚNG THỜI TRANG BỀN VỮNG',
      subTitle: 'Chất Liệu Tự Nhiên - Hoàn Xu 10% Đơn Hàng',
      imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=80',
      badge: 'ECO FASHION',
      linkUrl: '/virtual-tryon',
      position: 'CAROUSEL' as const,
      displayOrder: 2,
      isActive: true,
    },
  ];

  // Auto-advance carousel every 4.5s
  useEffect(() => {
    if (effectiveSlides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % effectiveSlides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [effectiveSlides.length]);

  const handleBannerClick = (linkUrl?: string) => {
    if (!linkUrl) return;
    if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
      window.open(linkUrl, '_blank', 'noopener,noreferrer');
    } else {
      navigate(linkUrl);
    }
  };

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSlide((prev) => (prev === 0 ? effectiveSlides.length - 1 : prev - 1));
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSlide((prev) => (prev + 1) % effectiveSlides.length);
  };

  return (
    <section className="space-y-4">
      {/* Banner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Carousel Banner (Khung 1) */}
        <div className="lg:col-span-8 relative aspect-[21/9] sm:aspect-[21/8] lg:aspect-auto lg:h-[320px] rounded-2xl overflow-hidden group shadow-sm border border-slate-200/50 bg-slate-50 select-none">
          {effectiveSlides.map((slide, idx) => (
            <div
              key={slide.id || idx}
              onClick={() => handleBannerClick(slide.linkUrl)}
              className={`absolute inset-0 transition-opacity duration-1000 flex items-center justify-between cursor-pointer ${
                idx === activeSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* Text content overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent z-10 flex flex-col justify-center px-8 sm:px-12 text-left text-white space-y-2.5">
                {slide.badge && (
                  <span className="inline-block self-start text-[9px] font-extrabold px-2 py-0.5 rounded-sm bg-white text-emerald-600 shadow-sm uppercase tracking-wider">
                    {slide.badge}
                  </span>
                )}
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black leading-tight tracking-tight uppercase line-clamp-2">
                  {slide.title}
                </h2>
                {slide.subTitle && (
                  <p className="text-[10px] sm:text-xs text-white/85 font-medium max-w-xs sm:max-w-md line-clamp-2">
                    {slide.subTitle}
                  </p>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBannerClick(slide.linkUrl);
                  }}
                  className="self-start text-[10px] sm:text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-md shadow-md transition cursor-pointer"
                >
                  MUA NGAY
                </button>
              </div>

              {/* Background Image */}
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="w-full h-full object-cover group-hover:scale-101 transition duration-500"
              />
            </div>
          ))}

          {/* Navigation Arrows (visible on hover) */}
          {effectiveSlides.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevSlide}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
                aria-label="Previous Slide"
              >
                ❮
              </button>
              <button
                type="button"
                onClick={handleNextSlide}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
                aria-label="Next Slide"
              >
                ❯
              </button>
            </>
          )}

          {/* Indicators */}
          {effectiveSlides.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
              {effectiveSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide(idx);
                  }}
                  className={`h-2.5 rounded-full transition-all border border-white/20 cursor-pointer ${
                    idx === activeSlide ? 'bg-emerald-600 w-6' : 'bg-white/60 hover:bg-white w-2.5'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                ></button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Stacked Banners (Khung 2 & 3) */}
        <div className="lg:col-span-4 flex flex-col gap-4 lg:h-[320px]">
          {/* Sub banner 1 (Khung 2) */}
          <div
            onClick={() => handleBannerClick(sideTopBanner?.linkUrl || '/vouchers')}
            className="relative flex-1 min-h-0 w-full h-[152px] lg:h-auto rounded-2xl overflow-hidden shadow-sm border border-slate-200/50 bg-slate-50 group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent z-10 flex flex-col justify-center p-5 text-left text-white space-y-1">
              <span className="text-[9px] font-extrabold text-teal-300 tracking-wider uppercase">
                {sideTopBanner?.badge || 'ĐỘC QUYỀN ZEROMALL'}
              </span>
              <h3 className="text-xs sm:text-sm font-bold uppercase truncate">
                {sideTopBanner?.title || 'Mã Freeship Lên Tới 300K'}
              </h3>
              <p className="text-[9px] text-white/80 line-clamp-1">
                {sideTopBanner?.subTitle || 'Nhận mã miễn phí vận chuyển tuần này'}
              </p>
            </div>
            <img
              src={sideTopBanner?.imageUrl || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&auto=format&fit=crop&q=80'}
              alt={sideTopBanner?.title || 'Sub Banner 1'}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-102 transition duration-300"
            />
          </div>

          {/* Sub banner 2 (Khung 3) */}
          <div
            onClick={() => handleBannerClick(sideBottomBanner?.linkUrl || '/category/thiet-bi-dien-tu')}
            className="relative flex-1 min-h-0 w-full h-[152px] lg:h-auto rounded-2xl overflow-hidden shadow-sm border border-slate-200/50 bg-slate-50 group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent z-10 flex flex-col justify-center p-5 text-left text-white space-y-1">
              <span className="text-[9px] font-extrabold text-emerald-300 tracking-wider uppercase">
                {sideBottomBanner?.badge || 'XU HƯỚNG MỚI'}
              </span>
              <h3 className="text-xs sm:text-sm font-bold uppercase truncate">
                {sideBottomBanner?.title || 'Sản Phẩm Công Nghệ Xanh'}
              </h3>
              <p className="text-[9px] text-white/80 line-clamp-1">
                {sideBottomBanner?.subTitle || 'Trả góp lãi suất 0% kỳ hạn dài'}
              </p>
            </div>
            <img
              src={sideBottomBanner?.imageUrl || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&auto=format&fit=crop&q=80'}
              alt={sideBottomBanner?.title || 'Sub Banner 2'}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-102 transition duration-300"
            />
          </div>
        </div>
      </div>

      {/* Modern Services Policies Bar */}
      <div className="bg-white border border-slate-200/60 rounded-xl grid grid-cols-3 divide-x divide-slate-100 py-3.5 shadow-sm text-center">
        <div className="flex items-center justify-center gap-2 text-slate-700 px-2">
          <span className="text-lg text-emerald-600 hidden sm:inline">🛡️</span>
          <span className="text-[10px] sm:text-xs font-semibold text-slate-700 truncate">7 Ngày Miễn Phí Trả Hàng</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-slate-700 px-2">
          <span className="text-lg text-emerald-600 hidden sm:inline">🌟</span>
          <span className="text-[10px] sm:text-xs font-semibold text-slate-700 truncate">100% Hàng Chính Hãng</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-slate-700 px-2">
          <span className="text-lg text-emerald-600 hidden sm:inline">🚚</span>
          <span className="text-[10px] sm:text-xs font-semibold text-slate-700 truncate">Miễn Phí Giao Hàng Toàn Quốc</span>
        </div>
      </div>
    </section>
  );
};
