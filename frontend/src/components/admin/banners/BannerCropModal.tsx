import React, { useState, useRef, useEffect } from 'react';
import { BANNER_TARGET_RATIO, BANNER_RECOMMENDED_WIDTH, BANNER_RECOMMENDED_HEIGHT } from './types';

interface BannerCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

export const BannerCropModal: React.FC<BannerCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
}) => {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number; ratio: number } | null>(null);
  
  // Crop state
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load image when imageSrc changes
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageObj(img);
      const ratio = img.width / img.height;
      setImageInfo({ width: img.width, height: img.height, ratio });
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // Handle Redraw Canvas
  useEffect(() => {
    if (!imageObj || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Frame dimensions (2.5 : 1)
    const frameWidth = width - 40;
    const frameHeight = frameWidth / BANNER_TARGET_RATIO;
    const frameX = (width - frameWidth) / 2;
    const frameY = (height - frameHeight) / 2;

    // Calculate base scale so image covers the frame
    const baseScale = Math.max(frameWidth / imageObj.width, frameHeight / imageObj.height);
    const scale = baseScale * zoom;

    const drawW = imageObj.width * scale;
    const drawH = imageObj.height * scale;

    const centerX = frameX + frameWidth / 2 + pan.x;
    const centerY = frameY + frameHeight / 2 + pan.y;

    const imgX = centerX - drawW / 2;
    const imgY = centerY - drawH / 2;

    // 1. Draw base image
    ctx.drawImage(imageObj, imgX, imgY, drawW, drawH);

    // 2. Draw darkened overlay outside the 2.5:1 frame
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    // Top
    ctx.fillRect(0, 0, width, frameY);
    // Bottom
    ctx.fillRect(0, frameY + frameHeight, width, height - (frameY + frameHeight));
    // Left
    ctx.fillRect(0, frameY, frameX, frameHeight);
    // Right
    ctx.fillRect(frameX + frameWidth, frameY, width - (frameX + frameWidth), frameHeight);

    // 3. Draw border around the crop frame
    ctx.strokeStyle = '#10b981'; // emerald-500
    ctx.lineWidth = 2.5;
    ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);

    // 4. Draw grid lines (rule of thirds) inside frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Horizontal grid
    ctx.beginPath();
    ctx.moveTo(frameX, frameY + frameHeight / 3);
    ctx.lineTo(frameX + frameWidth, frameY + frameHeight / 3);
    ctx.moveTo(frameX, frameY + (2 * frameHeight) / 3);
    ctx.lineTo(frameX + frameWidth, frameY + (2 * frameHeight) / 3);

    // Vertical grid
    ctx.moveTo(frameX + frameWidth / 3, frameY);
    ctx.lineTo(frameX + frameWidth / 3, frameY + frameHeight);
    ctx.moveTo(frameX + (2 * frameWidth) / 3, frameY);
    ctx.lineTo(frameX + (2 * frameWidth) / 3, frameY + frameHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Update small preview canvas
    if (previewCanvasRef.current) {
      const prevCanvas = previewCanvasRef.current;
      const prevCtx = prevCanvas.getContext('2d');
      if (prevCtx) {
        prevCtx.clearRect(0, 0, prevCanvas.width, prevCanvas.height);
        // Draw the cropped portion from main canvas
        prevCtx.drawImage(
          canvas,
          frameX,
          frameY,
          frameWidth,
          frameHeight,
          0,
          0,
          prevCanvas.width,
          prevCanvas.height
        );
      }
    }
  }, [imageObj, zoom, pan]);

  // Mouse / Touch handlers for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 1-Click Auto Center-Crop
  const handleAutoCenterCrop = () => {
    if (!imageObj) return;

    const outW = BANNER_RECOMMENDED_WIDTH;
    const outH = BANNER_RECOMMENDED_HEIGHT;

    const offscreen = document.createElement('canvas');
    offscreen.width = outW;
    offscreen.height = outH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // Find center crop of 2.5 : 1
    const imgRatio = imageObj.width / imageObj.height;
    let sW = imageObj.width;
    let sH = imageObj.height;
    let sX = 0;
    let sY = 0;

    if (imgRatio > BANNER_TARGET_RATIO) {
      // Image is wider than 2.5:1 -> crop sides
      sW = imageObj.height * BANNER_TARGET_RATIO;
      sX = (imageObj.width - sW) / 2;
    } else {
      // Image is taller than 2.5:1 -> crop top/bottom
      sH = imageObj.width / BANNER_TARGET_RATIO;
      sY = (imageObj.height - sH) / 2;
    }

    ctx.drawImage(imageObj, sX, sY, sW, sH, 0, 0, outW, outH);
    const croppedUrl = offscreen.toDataURL('image/jpeg', 0.92);
    onCropComplete(croppedUrl);
    onClose();
  };

  // Confirm manual crop from current view
  const handleConfirmManualCrop = () => {
    if (!imageObj || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const frameWidth = canvas.width - 40;
    const frameHeight = frameWidth / BANNER_TARGET_RATIO;
    const frameX = (canvas.width - frameWidth) / 2;
    const frameY = (canvas.height - frameHeight) / 2;

    const baseScale = Math.max(frameWidth / imageObj.width, frameHeight / imageObj.height);
    const scale = baseScale * zoom;

    const drawW = imageObj.width * scale;
    const drawH = imageObj.height * scale;

    const centerX = frameX + frameWidth / 2 + pan.x;
    const centerY = frameY + frameHeight / 2 + pan.y;

    const imgX = centerX - drawW / 2;
    const imgY = centerY - drawH / 2;

    // Calculate source rect on original image
    const sX = (frameX - imgX) / scale;
    const sY = (frameY - imgY) / scale;
    const sW = frameWidth / scale;
    const sH = frameHeight / scale;

    const outW = BANNER_RECOMMENDED_WIDTH;
    const outH = BANNER_RECOMMENDED_HEIGHT;

    const offscreen = document.createElement('canvas');
    offscreen.width = outW;
    offscreen.height = outH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(imageObj, sX, sY, sW, sH, 0, 0, outW, outH);
    const croppedUrl = offscreen.toDataURL('image/jpeg', 0.92);
    onCropComplete(croppedUrl);
    onClose();
  };

  if (!isOpen) return null;

  const isExactRatio = imageInfo && Math.abs(imageInfo.ratio - BANNER_TARGET_RATIO) < 0.05;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-lg text-lg">✂️</span>
            <div>
              <h3 className="text-base font-black text-slate-800">
                Kiểm Duyệt & Cắt Ảnh Chuẩn Khung Banner (2.5 : 1)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Khóa tỉ lệ chuẩn vàng Shopee (1000x400 px), bảo đảm banner sắc nét, không bị vỡ hay méo hình.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Status Badge */}
          {imageInfo && (
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              isExactRatio 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-center gap-2">
                <span>{isExactRatio ? '✅' : '⚠️'}</span>
                <span>
                  Ảnh gốc: <strong className="font-bold">{imageInfo.width} × {imageInfo.height} px</strong> (Tỉ lệ: {imageInfo.ratio.toFixed(2)} : 1)
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                isExactRatio ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
              }`}>
                {isExactRatio ? 'Chuẩn tỉ lệ 2.5:1' : 'Khác tỉ lệ chuẩn, cần cắt'}
              </span>
            </div>
          )}

          {/* Interactive Canvas Area */}
          <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-900 flex flex-col items-center justify-center select-none">
            <canvas
              ref={canvasRef}
              width={700}
              height={340}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`w-full max-h-[340px] object-contain ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            />
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-md border border-white/20">
              💡 Rê chuột để dịch chuyển • Kéo thanh trượt bên dưới để thu phóng
            </div>
          </div>

          {/* Controls: Zoom & Quick Auto-crop */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            {/* Zoom Slider */}
            <div className="sm:col-span-7 space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>🔍 Phóng to / Thu nhỏ:</span>
                <span className="text-emerald-700">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Auto-Crop Button */}
            <div className="sm:col-span-5 flex justify-end">
              <button
                type="button"
                onClick={handleAutoCenterCrop}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>⚡</span> Tự Động Cắt Chuẩn Tâm (1 Chạm)
              </button>
            </div>
          </div>

          {/* Real-time Result Preview */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700">
              👀 Xem trước hiển thị trên trang chủ (Tỉ lệ 2.5:1):
            </span>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 p-2 flex justify-center">
              <canvas
                ref={previewCanvasRef}
                width={500}
                height={200}
                className="w-full max-w-[500px] h-auto rounded-lg shadow-2xs border border-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            Hủy Bỏ
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleConfirmManualCrop}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer flex items-center gap-1.5"
            >
              <span>💾</span> Áp Dụng Khung Cắt Này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
