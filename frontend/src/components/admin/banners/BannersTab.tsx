import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../../config/api.config';
import type { Banner, BannerFormData, BannerPosition } from './types';
import { BannerEditModal } from './BannerEditModal';

interface BannersTabProps {
  triggerAuditLog?: (action: string) => Promise<void>;
}

export const BannersTab: React.FC<BannersTabProps> = ({ triggerAuditLog }) => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [defaultPosition, setDefaultPosition] = useState<BannerPosition>('CAROUSEL');

  // Preview simulator state
  const [activePreviewSlide, setActivePreviewSlide] = useState(0);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/products/banners`);
      if (!res.ok) throw new Error('Không thể tải danh sách banner');
      const data = await res.json();
      setBanners(data);
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi tải danh sách banner');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  // Split banners into positions
  const carouselBanners = banners
    .filter((b) => b.position === 'CAROUSEL')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const activeCarouselBanners = carouselBanners.filter((b) => b.isActive);

  const sideTopBanner = banners.find((b) => b.position === 'SIDE_TOP');
  const sideBottomBanner = banners.find((b) => b.position === 'SIDE_BOTTOM');

  // Auto slide simulator
  useEffect(() => {
    if (activeCarouselBanners.length <= 1) return;
    const timer = setInterval(() => {
      setActivePreviewSlide((prev) => (prev + 1) % activeCarouselBanners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [activeCarouselBanners.length]);

  // Open Create Modal
  const handleOpenCreate = (pos: BannerPosition = 'CAROUSEL') => {
    setEditingBanner(null);
    setDefaultPosition(pos);
    setIsEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setDefaultPosition(banner.position);
    setIsEditModalOpen(true);
  };

  // Save Banner (Create or Update)
  const handleSaveBanner = async (formData: BannerFormData, id?: string) => {
    const url = id 
      ? `${API_BASE_URL}/products/banners/${id}` 
      : `${API_BASE_URL}/products/banners`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.message || 'Lưu banner thất bại');
    }

    await fetchBanners();

    if (triggerAuditLog) {
      await triggerAuditLog(
        id ? `Cập nhật banner sàn: "${formData.title}"` : `Tạo mới banner sàn: "${formData.title}"`
      );
    }
  };

  // Toggle Active
  const handleToggleActive = async (banner: Banner) => {
    try {
      const res = await fetch(`${API_BASE_URL}/products/banners/${banner.id}/toggle`, {
        method: 'PUT',
      });
      if (!res.ok) throw new Error('Không thể thay đổi trạng thái banner');
      await fetchBanners();

      if (triggerAuditLog) {
        await triggerAuditLog(
          `${banner.isActive ? 'Tạm ẩn' : 'Kích hoạt'} banner sàn: "${banner.title}"`
        );
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi bật/tắt banner');
    }
  };

  // Delete Banner
  const handleDelete = async (banner: Banner) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa banner "${banner.title}" không?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/products/banners/${banner.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Không thể xóa banner');
      await fetchBanners();

      if (triggerAuditLog) {
        await triggerAuditLog(`Đã xóa banner sàn: "${banner.title}"`);
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa banner');
    }
  };

  // Move Order Up/Down for Carousel
  const handleMoveOrder = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= carouselBanners.length) return;

    const currentBanner = carouselBanners[index];
    const targetBanner = carouselBanners[targetIndex];

    const newOrders = [
      { id: currentBanner.id, displayOrder: targetBanner.displayOrder },
      { id: targetBanner.id, displayOrder: currentBanner.displayOrder },
    ];

    try {
      const res = await fetch(`${API_BASE_URL}/products/banners/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: newOrders }),
      });
      if (!res.ok) throw new Error('Không thể sắp xếp banner');
      await fetchBanners();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi sắp xếp thứ tự');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl text-lg font-black">🖼️</span>
            <div>
              <h2 className="text-lg font-black text-slate-800">Quản Lý Banner Sàn ZeroMall</h2>
              <p className="text-xs text-slate-500 font-medium">
                Kiểm duyệt khung hình, tự động cắt ảnh tỉ lệ vàng 2.5:1 và quản lý trượt Carousel nhiều ảnh chuẩn Shopee.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenCreate('CAROUSEL')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>➕</span> Thêm Banner Lớn (Khung 1)
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading && (
        <div className="p-4 bg-white border border-slate-200/80 rounded-xl text-center text-xs text-slate-500 font-bold animate-pulse">
          ⏳ Đang đồng bộ danh sách banner sàn...
        </div>
      )}

      {/* Real-time Hero Simulator */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-md text-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
              Mô Phỏng Trực Quan Giao Diện Trang Chủ (Real-time Live Simulator)
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Tỉ lệ chuẩn 2.5 : 1 • Tự động trượt 4s
          </span>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Left: Carousel Frame */}
          <div className="lg:col-span-8 relative aspect-[21/9] sm:aspect-[2.5/1] rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group">
            {activeCarouselBanners.length > 0 ? (
              activeCarouselBanners.map((slide, idx) => (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-opacity duration-700 flex items-center justify-between ${
                    idx === activePreviewSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                >
                  {/* Overlay text */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent z-10 flex flex-col justify-center px-6 sm:px-10 text-left text-white space-y-1.5">
                    {slide.badge && (
                      <span className="inline-block self-start text-[9px] font-black px-2 py-0.5 rounded-sm bg-white text-emerald-700 uppercase tracking-wider">
                        {slide.badge}
                      </span>
                    )}
                    <h3 className="text-lg sm:text-2xl font-black uppercase tracking-tight line-clamp-1">
                      {slide.title}
                    </h3>
                    {slide.subTitle && (
                      <p className="text-[10px] sm:text-xs text-white/85 font-medium line-clamp-1 max-w-md">
                        {slide.subTitle}
                      </p>
                    )}
                    <span className="self-start text-[10px] font-bold bg-emerald-600 text-white px-3 py-1 rounded shadow-sm">
                      MUA NGAY ➔
                    </span>
                  </div>

                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <span>Chưa có banner Carousel nào đang hoạt động</span>
              </div>
            )}

            {/* Dots */}
            {activeCarouselBanners.length > 1 && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                {activeCarouselBanners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePreviewSlide(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === activePreviewSlide ? 'bg-emerald-500 w-5' : 'bg-white/50 w-2'
                    }`}
                  ></button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Stacked Side Banners */}
          <div className="lg:col-span-4 flex lg:flex-col gap-3">
            {/* Side Top */}
            <div className="flex-1 aspect-[2.5/1] rounded-xl overflow-hidden relative border border-slate-700 bg-slate-950 group">
              {sideTopBanner ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10 flex flex-col justify-center p-3 text-left text-white space-y-0.5">
                    {sideTopBanner.badge && (
                      <span className="text-[8px] font-black text-teal-300 uppercase">{sideTopBanner.badge}</span>
                    )}
                    <h4 className="text-xs font-black uppercase truncate">{sideTopBanner.title}</h4>
                    {sideTopBanner.subTitle && (
                      <p className="text-[9px] text-white/80 truncate">{sideTopBanner.subTitle}</p>
                    )}
                  </div>
                  <img
                    src={sideTopBanner.imageUrl}
                    alt="Side Top"
                    className="w-full h-full object-cover"
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">
                  Khung 2 (Phụ trên trống)
                </div>
              )}
            </div>

            {/* Side Bottom */}
            <div className="flex-1 aspect-[2.5/1] rounded-xl overflow-hidden relative border border-slate-700 bg-slate-950 group">
              {sideBottomBanner ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10 flex flex-col justify-center p-3 text-left text-white space-y-0.5">
                    {sideBottomBanner.badge && (
                      <span className="text-[8px] font-black text-emerald-300 uppercase">{sideBottomBanner.badge}</span>
                    )}
                    <h4 className="text-xs font-black uppercase truncate">{sideBottomBanner.title}</h4>
                    {sideBottomBanner.subTitle && (
                      <p className="text-[9px] text-white/80 truncate">{sideBottomBanner.subTitle}</p>
                    )}
                  </div>
                  <img
                    src={sideBottomBanner.imageUrl}
                    alt="Side Bottom"
                    className="w-full h-full object-cover"
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">
                  Khung 3 (Phụ dưới trống)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Carousel Management (Khung 1) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <span>🎠</span> Khung 1: Carousel Lớn Bên Trái ({carouselBanners.length} Banner)
            </h3>
            <p className="text-xs text-slate-500">
              Admin có thể thêm nhiều banner để chạy xoay vòng tự động. Bấm nút mũi tên để đổi thứ tự.
            </p>
          </div>
          <button
            onClick={() => handleOpenCreate('CAROUSEL')}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition cursor-pointer border border-emerald-200"
          >
            ➕ Thêm Slide Mới
          </button>
        </div>

        {/* Carousel Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Thứ Tự</th>
                <th className="py-3 px-4 w-36">Ảnh Banner (2.5:1)</th>
                <th className="py-3 px-4">Tiêu Đề & Phụ Đề</th>
                <th className="py-3 px-4">Huy Hiệu (Badge)</th>
                <th className="py-3 px-4">Link Điều Hướng</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {carouselBanners.map((b, idx) => (
                <tr key={b.id} className="hover:bg-slate-50/60 transition">
                  {/* Order & Move buttons */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-black text-slate-700 bg-slate-100 w-6 h-6 rounded-full flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveOrder(idx, 'UP')}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[10px] cursor-pointer"
                          title="Lên trên"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={idx === carouselBanners.length - 1}
                          onClick={() => handleMoveOrder(idx, 'DOWN')}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[10px] cursor-pointer"
                          title="Xuống dưới"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Thumbnail */}
                  <td className="py-3 px-4">
                    <div className="w-28 aspect-[2.5/1] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-3xs">
                      <img
                        src={b.imageUrl}
                        alt={b.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </td>

                  {/* Title & Sub */}
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800 line-clamp-1">{b.title}</div>
                    {b.subTitle && (
                      <div className="text-[11px] text-slate-500 line-clamp-1">{b.subTitle}</div>
                    )}
                  </td>

                  {/* Badge */}
                  <td className="py-3 px-4">
                    {b.badge ? (
                      <span className="px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px] uppercase">
                        {b.badge}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Link */}
                  <td className="py-3 px-4">
                    <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded max-w-[140px] truncate inline-block">
                      {b.linkUrl || '—'}
                    </span>
                  </td>

                  {/* Active Toggle */}
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(b)}
                      className={`px-2.5 py-1 rounded-full font-bold text-[10px] cursor-pointer transition ${
                        b.isActive
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {b.isActive ? '● Đang Chạy' : '○ Đã Tắt'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(b)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition cursor-pointer"
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold transition cursor-pointer"
                      >
                        🗑️ Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Side Banners (Khung 2 & 3) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <span>📌</span> Khung 2 & 3: Banner Phụ Cố Định (2 Ô Bên Phải)
          </h3>
          <p className="text-xs text-slate-500">
            Hai banner phụ cố định bên cạnh khung lớn để hiển thị các chương trình khuyến mãi đặc biệt (Freeship, Trả góp, Voucher độc quyền).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Khung 2: Side Top */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-slate-700 flex items-center gap-1.5">
                <span>1️⃣</span> Khung 2 (Banner Phụ Trên)
              </span>
              {sideTopBanner ? (
                <button
                  onClick={() => handleOpenEdit(sideTopBanner)}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  ✏️ Chỉnh Sửa
                </button>
              ) : (
                <button
                  onClick={() => handleOpenCreate('SIDE_TOP')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  ➕ Thêm Mới
                </button>
              )}
            </div>

            {sideTopBanner ? (
              <div className="space-y-2">
                <div className="aspect-[2.5/1] rounded-lg overflow-hidden border border-slate-300 bg-slate-900">
                  <img
                    src={sideTopBanner.imageUrl}
                    alt={sideTopBanner.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-slate-800">{sideTopBanner.title}</div>
                  <div className="text-slate-500 text-[11px]">{sideTopBanner.subTitle}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">Link: {sideTopBanner.linkUrl}</div>
                </div>
              </div>
            ) : (
              <div className="aspect-[2.5/1] rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs">
                <span>Chưa cài đặt banner</span>
              </div>
            )}
          </div>

          {/* Khung 3: Side Bottom */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-slate-700 flex items-center gap-1.5">
                <span>2️⃣</span> Khung 3 (Banner Phụ Dưới)
              </span>
              {sideBottomBanner ? (
                <button
                  onClick={() => handleOpenEdit(sideBottomBanner)}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  ✏️ Chỉnh Sửa
                </button>
              ) : (
                <button
                  onClick={() => handleOpenCreate('SIDE_BOTTOM')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  ➕ Thêm Mới
                </button>
              )}
            </div>

            {sideBottomBanner ? (
              <div className="space-y-2">
                <div className="aspect-[2.5/1] rounded-lg overflow-hidden border border-slate-300 bg-slate-900">
                  <img
                    src={sideBottomBanner.imageUrl}
                    alt={sideBottomBanner.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-slate-800">{sideBottomBanner.title}</div>
                  <div className="text-slate-500 text-[11px]">{sideBottomBanner.subTitle}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">Link: {sideBottomBanner.linkUrl}</div>
                </div>
              </div>
            ) : (
              <div className="aspect-[2.5/1] rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs">
                <span>Chưa cài đặt banner</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit / Create Modal */}
      <BannerEditModal
        isOpen={isEditModalOpen}
        banner={editingBanner}
        defaultPosition={defaultPosition}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveBanner}
      />
    </div>
  );
};
