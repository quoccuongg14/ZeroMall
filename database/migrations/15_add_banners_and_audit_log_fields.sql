-- Migration 15: Add Banner table, default banners, and expand AuditLog fields for Storefront Governance

-- 1. Create Banner table in product schema
CREATE TABLE IF NOT EXISTS product."Banner" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subTitle" TEXT,
    "badge" TEXT,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "position" TEXT NOT NULL DEFAULT 'CAROUSEL',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Banner_position_isActive_displayOrder_idx" 
ON product."Banner"("position", "isActive", "displayOrder");

-- 2. Seed initial default platform banners
INSERT INTO product."Banner" (id, title, "subTitle", badge, "imageUrl", "linkUrl", "position", "displayOrder", "isActive", "createdAt", "updatedAt")
VALUES
    ('banner-carousel-1', 'XANH MÁT NGÀY HÈ 6.6', 'Miễn Phí Vận Chuyển Toàn Quốc Cho Mọi Đơn Hàng', 'MINT SALE', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80', '/flash-sale', 'CAROUSEL', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('banner-carousel-2', 'ĐẠI TIỆC CÔNG NGHỆ', 'Giảm Đến 50% - Trả Góp 0% Lãi Suất', 'TECH ZONE', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80', '/category/thiet-bi-dien-tu', 'CAROUSEL', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('banner-carousel-3', 'XU HƯỚNG THỜI TRANG BỀN VỮNG', 'Chất Liệu Tự Nhiên - Hoàn Xu 10% Đơn Hàng', 'ECO FASHION', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=80', '/virtual-tryon', 'CAROUSEL', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('banner-side-top', 'MÃ FREESHIP LÊN TỚI 300K', 'Nhận mã miễn phí vận chuyển tuần này', 'ĐỘC QUYỀN ZEROMALL', 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&auto=format&fit=crop&q=80', '/vouchers', 'SIDE_TOP', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('banner-side-bottom', 'SẢN PHẨM CÔNG NGHỆ XANH', 'Trả góp lãi suất 0% kỳ hạn dài', 'XU HƯỚNG MỚI', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&auto=format&fit=crop&q=80', '/category/thiet-bi-dien-tu', 'SIDE_BOTTOM', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 3. Add columns to auth."AuditLog" if not exist
ALTER TABLE auth."AuditLog" ADD COLUMN IF NOT EXISTS "module" TEXT DEFAULT 'SYSTEM';
ALTER TABLE auth."AuditLog" ADD COLUMN IF NOT EXISTS "actionType" TEXT DEFAULT 'UPDATE';
ALTER TABLE auth."AuditLog" ADD COLUMN IF NOT EXISTS "targetId" TEXT;
ALTER TABLE auth."AuditLog" ADD COLUMN IF NOT EXISTS "targetName" TEXT;
ALTER TABLE auth."AuditLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT DEFAULT '127.0.0.1';
ALTER TABLE auth."AuditLog" ADD COLUMN IF NOT EXISTS "metadata" TEXT;

-- 4. Add columns to auth."Shop" if not exist
ALTER TABLE auth."Shop" ADD COLUMN IF NOT EXISTS "blockedUntil" TIMESTAMP(3);
ALTER TABLE auth."Shop" ADD COLUMN IF NOT EXISTS "blockReason" TEXT;
