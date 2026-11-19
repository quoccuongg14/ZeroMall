import React, { useState, useEffect } from 'react';
import type { Banner, BannerFormData, BannerPosition } from './types';
import { BannerCropModal } from './BannerCropModal';
import { BANNER_TARGET_RATIO } from './types';

interface BannerEditModalProps {
  isOpen: boolean;
  banner: Banner | null;
  defaultPosition?: BannerPosition;
  onClose: () => void;
  onSave: (formData: BannerFormData, id?: string) => Promise<void>;
}

export const BannerEditModal: React.FC<BannerEditModalProps> = ({
  isOpen,
  banner,
  defaultPosition = 'CAROUSEL',
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<BannerFormData>({
    title: '',
    subTitle: '',
    badge: 'MINT SALE',
    imageUrl: '',
    linkUrl: '/flash-sale',
    position: defaultPosition,
    displayOrder: 0,
    isActive: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crop modal state
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropSourceImage, setCropSourceImage] = useState<string>('');
  const [imageRatio, setImageRatio] = useState<number | null>(null);

  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title || '',
        subTitle: banner.subTitle || '',
        badge: banner.badge || '',
        imageUrl: banner.imageUrl || '',
        linkUrl: banner.linkUrl || '',
        position: banner.position || 'CAROUSEL',
        displayOrder: banner.displayOrder ?? 0,
        isActive: banner.isActive !== undefined ? banner.isActive : true,
      });
      checkImageRatio(banner.imageUrl);
    } else {
      setFormData({
        title: '',
        subTitle: '',
        badge: 'ƯU ĐÃI SÀN',
        imageUrl: '',
        linkUrl: '/flash-sale',
        position: defaultPosition,
        displayOrder: 0,
        isActive: true,
      });
      setImageRatio(null);
    }
    setError(null);
  }, [banner, defaultPosition, isOpen]);

  const checkImageRatio = (url: string) => {
    if (!url) {
      setImageRatio(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageRatio(img.width / img.height);
    };
    img.src = url;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError('Kích thước ảnh không được vượt quá 8MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCropSourceImage(dataUrl);
        // Check ratio
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          setImageRatio(ratio);
          // Auto open crop modal if aspect ratio differs from 2.5:1
          if (Math.abs(ratio - BANNER_TARGET_RATIO) >= 0.08) {
            setIsCropModalOpen(true);
          } else {
            setFormData((prev) => ({ ...prev, imageUrl: dataUrl }));
          }
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset file input
  };

  const handleOpenCropCurrent = () => {
    if (!formData.imageUrl) {
      setError('Vui lòng chọn ảnh trước khi cắt');
      return;
    }
    setCropSourceImage(formData.imageUrl);
    setIsCropModalOpen(true);
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    setFormData((prev) => ({ ...prev, imageUrl: croppedDataUrl }));
    setImageRatio(BANNER_TARGET_RATIO);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Vui lòng nhập tiêu đề banner');
      return;
    }
    if (!formData.imageUrl.trim()) {
      setError('Vui lòng tải ảnh banner');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(formData, banner?.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi lưu banner');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isRatioOk = imageRatio && Math.abs(imageRatio - BANNER_TARGET_RATIO) < 0.08;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">🖼️</span>
              <h3 className="text-base font-black text-slate-800">
                {banner ? 'Chỉnh Sửa Banner Sàn' : 'Thêm Banner Sàn Mới'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Position Picker */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Vị Trí Khung Banner:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, position: 'CAROUSEL' }))}
                  className={`p-2.5 rounded-xl border text-center transition font-bold cursor-pointer ${
                    formData.position === 'CAROUSEL'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="text-sm">🎠 Khung 1</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">Carousel Lớn (Trượt)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, position: 'SIDE_TOP' }))}
                  className={`p-2.5 rounded-xl border text-center transition font-bold cursor-pointer ${
                    formData.position === 'SIDE_TOP'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="text-sm">📌 Khung 2</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">Banner Phụ Trên (Cố định)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, position: 'SIDE_BOTTOM' }))}
                  className={`p-2.5 rounded-xl border text-center transition font-bold cursor-pointer ${
                    formData.position === 'SIDE_BOTTOM'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="text-sm">📌 Khung 3</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">Banner Phụ Dưới (Cố định)</div>
                </button>
              </div>
            </div>

            {/* Image Upload & Cropper Trigger */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">
                  Ảnh Banner (Chuẩn tỉ lệ 2.5 : 1): <span className="text-red-500">*</span>
                </label>
                {imageRatio && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isRatioOk ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isRatioOk ? '✅ Tỉ lệ 2.5:1 chuẩn' : `⚠️ Tỉ lệ hiện tại: ${imageRatio.toFixed(2)}:1`}
                  </span>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3.5 py-2 bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 rounded-lg font-bold cursor-pointer transition shadow-3xs flex items-center gap-1.5 hover:text-emerald-700">
                  <span>📁</span> Tải File Ảnh Lên
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {formData.imageUrl && (
                  <button
                    type="button"
                    onClick={handleOpenCropCurrent}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold cursor-pointer transition shadow-3xs flex items-center gap-1.5"
                  >
                    <span>✂️</span> Cắt & Căn Chỉnh Ảnh (2.5:1)
                  </button>
                )}
              </div>

              {/* Image Preview Box */}
              {formData.imageUrl ? (
                <div className="relative aspect-[2.5/1] rounded-xl overflow-hidden border border-slate-300 bg-slate-900 group">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenCropCurrent}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold shadow-md cursor-pointer text-xs"
                    >
                      ✂️ Chỉnh Khung Cắt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-400">
                  <div className="text-3xl mb-1">🖼️</div>
                  <div>Chưa chọn ảnh. Vui lòng tải file ảnh từ máy tính hoặc dán link ảnh bên dưới.</div>
                </div>
              )}

              {/* Direct Image URL input */}
              <div className="pt-1">
                <input
                  type="text"
                  placeholder="Hoặc dán URL ảnh trực tiếp (https://...)"
                  value={formData.imageUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({ ...prev, imageUrl: val }));
                    checkImageRatio(val);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
                />
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Tiêu Đề Banner: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: XANH MÁT NGÀY HÈ 6.6"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-bold"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Huy Hiệu (Badge):</label>
                <input
                  type="text"
                  placeholder="Ví dụ: MINT SALE, TECH ZONE, ĐỘC QUYỀN"
                  value={formData.badge}
                  onChange={(e) => setFormData((prev) => ({ ...prev, badge: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-bold text-emerald-700"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Phụ Đề / Mô Tả Ngắn:</label>
              <input
                type="text"
                placeholder="Ví dụ: Miễn Phí Vận Chuyển Toàn Quốc Cho Mọi Đơn Hàng"
                value={formData.subTitle}
                onChange={(e) => setFormData((prev) => ({ ...prev, subTitle: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>

            {/* Link URL & Display Order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Link Điều Hướng Khi Bấm Vào:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: /flash-sale hoặc /category/dien-tu"
                  value={formData.linkUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, linkUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Thứ Tự Hiển Thị (Nhỏ xếp trước):</label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData((prev) => ({ ...prev, displayOrder: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  min="0"
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="pt-2 flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="font-bold text-slate-800">Trạng Thái Hoạt Động</div>
                <div className="text-[11px] text-slate-500">Bật để banner xuất hiện ngay trên trang chủ</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Hủy Bỏ
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? 'Đang Lưu...' : '💾 Lưu Banner Sàn'}
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Crop Modal */}
      <BannerCropModal
        isOpen={isCropModalOpen}
        imageSrc={cropSourceImage}
        onClose={() => setIsCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </>
  );
};
