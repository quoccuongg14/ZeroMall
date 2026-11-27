import React from 'react';

interface AssistantProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    image: string;
    category?: string;
    sales?: number;
    rating?: number;
    recommendationReason?: string;
  };
  onSelectProduct: (productId: string, productName: string) => void;
  compact?: boolean;
}

export const AssistantProductCard: React.FC<AssistantProductCardProps> = ({
  product,
  onSelectProduct,
  compact = false,
}) => {
  const priceFormatted = (product.price || 0).toLocaleString('vi-VN') + 'đ';
  const originalPriceFormatted = product.originalPrice
    ? (product.originalPrice || 0).toLocaleString('vi-VN') + 'đ'
    : null;

  return (
    <div
      onClick={() => onSelectProduct(product.id, product.name)}
      className={`${
        compact ? 'w-[148px] max-w-[148px] shrink-0' : 'w-full'
      } bg-white rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between group cursor-pointer hover:border-indigo-400`}
    >
      {/* Product Image & Badges */}
      <div
        className={`relative w-full bg-slate-100 overflow-hidden ${
          compact ? 'h-[112px]' : 'h-[160px]'
        }`}
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-2xl">
            🛍️
          </div>
        )}

        {product.recommendationReason && (
          <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs max-w-[90%] truncate">
            {product.recommendationReason}
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className={`${compact ? 'p-2 space-y-1.5' : 'p-2.5 space-y-2'} flex-1 flex flex-col justify-between`}>
        <div>
          <h4
            className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-indigo-600 transition"
            title={product.name}
          >
            {product.name}
          </h4>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
            {product.rating && product.rating > 0 ? (
              <span className="text-amber-500 font-bold">★ {product.rating}</span>
            ) : null}
            <span>•</span>
            <span>{product.sales && product.sales > 0 ? `Đã bán ${product.sales}` : 'Mới'}</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="text-xs font-black text-rose-600">{priceFormatted}</span>
            {originalPriceFormatted && (
              <span className="text-[10px] text-slate-400 line-through">
                {originalPriceFormatted}
              </span>
            )}
          </div>

          <button
            type="button"
            className={`w-full ${
              compact ? 'mt-1.5 py-1' : 'mt-2 py-1.5'
            } bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 hover:border-indigo-600 transition flex items-center justify-center gap-1 cursor-pointer`}
          >
            <span>Xem Chi Tiết</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
