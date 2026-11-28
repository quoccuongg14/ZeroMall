import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:8000';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const STORAGE_BUCKETS = {
  PRODUCT_IMAGES: 'product-images',
  RETURN_EVIDENCE: 'return-evidence',
  DELIVERY_POD: 'delivery-pod',
  DRIVER_ATTENDANCE: 'driver-attendance',
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  upsert?: boolean;
}

/**
 * Hàm đọc file ra DataURL dự phòng khi môi trường offline / dev không có Supabase Cloud
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function isAvifFile(file: File): boolean {
  return file.type === 'image/avif' || /\.avif$/i.test(file.name);
}

/**
 * Chuyển ảnh AVIF sang WebP chất lượng cao trên trình duyệt để tương thích 100% với Storage bucket & mọi thiết bị
 */
async function convertAvifToWebpIfNeeded(file: File): Promise<File> {
  if (!isAvifFile(file)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.9)
    );
    if (blob && blob.size > 0) {
      const nextName = file.name.replace(/\.avif$/i, '.webp');
      return new File([blob], nextName, { type: 'image/webp' });
    }
  } catch {
    // Giữ nguyên file AVIF nếu trình duyệt không hỗ trợ decode qua canvas
  }
  return file;
}

/**
 * Tải ảnh sản phẩm lên Bucket 'product-images' (Public read, Shop-isolated)
 */
export async function uploadProductImage(
  file: File,
  shopId: string = 'general',
  options?: UploadOptions
): Promise<string> {
  // Ràng buộc kích thước: tối đa 5MB
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('Dung lượng ảnh vượt quá giới hạn 5MB cho phép.');
  }

  // Ràng buộc MIME Type (hỗ trợ cả AVIF và trường hợp trình duyệt không trả file.type cho .avif)
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  const isAllowedByExt = /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name);
  if (!allowedMimes.includes(file.type) && !(file.type === '' && isAllowedByExt)) {
    throw new Error('Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP, GIF, AVIF.');
  }

  const uploadFile = await convertAvifToWebpIfNeeded(file);
  const sanitizedFileName = uploadFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${shopId}/${Date.now()}-${sanitizedFileName}`;

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.PRODUCT_IMAGES)
      .upload(filePath, uploadFile, {
        cacheControl: '3600',
        upsert: options?.upsert ?? true,
      });

    if (error) {
      console.warn('Supabase Storage upload warning:', error.message);
      // Fallback về DataURL nếu chưa cấu hình endpoint từ xa
      return await readFileAsDataUrl(uploadFile);
    }

    const { data: publicData } = supabase.storage
      .from(STORAGE_BUCKETS.PRODUCT_IMAGES)
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  } catch (err) {
    console.warn('Fallback to local file reader:', err);
    return await readFileAsDataUrl(uploadFile);
  }
}

/**
 * Tải bằng chứng đổi trả lên Bucket bảo mật 'return-evidence' (Private)
 */
export async function uploadReturnEvidence(
  file: File,
  returnId: string,
  _userId?: string
): Promise<string> {
  const MAX_SIZE = 20 * 1024 * 1024; // 20MB
  if (file.size > MAX_SIZE) {
    throw new Error('Dung lượng file bằng chứng vượt quá giới hạn 20MB.');
  }

  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime'
  ];
  if (!allowedMimes.includes(file.type)) {
    throw new Error('Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc video MP4, MOV.');
  }

  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${returnId}/${Date.now()}-${sanitizedFileName}`;

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.RETURN_EVIDENCE)
      .upload(filePath, file, {
        upsert: true,
      });

    if (error) {
      console.warn('Supabase Return Evidence upload warning:', error.message);
      return await readFileAsDataUrl(file);
    }

    // Với private bucket, lấy Signed URL có thời hạn (7 ngày cho hồ sơ tranh chấp)
    const { data: signedData, error: signError } = await supabase.storage
      .from(STORAGE_BUCKETS.RETURN_EVIDENCE)
      .createSignedUrl(data.path, 60 * 60 * 24 * 7);

    if (signError || !signedData?.signedUrl) {
      return await readFileAsDataUrl(file);
    }

    return signedData.signedUrl;
  } catch (err) {
    console.warn('Fallback to local file reader for evidence:', err);
    return await readFileAsDataUrl(file);
  }
}

/**
 * Tải ảnh ký nhận / bằng chứng giao hàng POD lên Bucket bảo mật 'delivery-pod' (Private)
 */
export async function uploadDeliveryPod(
  file: File,
  shipmentId: string,
  _driverId?: string
): Promise<string> {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    throw new Error('Ảnh POD vượt quá giới hạn 10MB.');
  }

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(file.type)) {
    throw new Error('Chỉ chấp nhận ảnh định dạng JPG, PNG, WEBP.');
  }

  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${shipmentId}/${Date.now()}-${sanitizedFileName}`;

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.DELIVERY_POD)
      .upload(filePath, file, { upsert: true });

    if (error) {
      return await readFileAsDataUrl(file);
    }

    const { data: signedData } = await supabase.storage
      .from(STORAGE_BUCKETS.DELIVERY_POD)
      .createSignedUrl(data.path, 60 * 60 * 24 * 30); // 30 ngày cho POD

    return signedData?.signedUrl || await readFileAsDataUrl(file);
  } catch (err) {
    return await readFileAsDataUrl(file);
  }
}

/**
 * Tải ảnh selfie điểm danh tài xế lên Bucket 'driver-attendance' (Private)
 */
export async function uploadDriverAttendance(
  file: File,
  driverId: string
): Promise<string> {
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('Ảnh selfie điểm danh vượt quá giới hạn 5MB.');
  }

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(file.type)) {
    throw new Error('Chỉ chấp nhận ảnh định dạng JPG, PNG, WEBP.');
  }

  const filePath = `${driverId}/${Date.now()}-selfie.jpg`;

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.DRIVER_ATTENDANCE)
      .upload(filePath, file, { upsert: true });

    if (error) {
      return await readFileAsDataUrl(file);
    }

    const { data: signedData } = await supabase.storage
      .from(STORAGE_BUCKETS.DRIVER_ATTENDANCE)
      .createSignedUrl(data.path, 60 * 60 * 24 * 7);

    return signedData?.signedUrl || await readFileAsDataUrl(file);
  } catch (err) {
    return await readFileAsDataUrl(file);
  }
}
