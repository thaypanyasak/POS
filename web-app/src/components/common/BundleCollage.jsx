import React from 'react';
import { Package } from '@phosphor-icons/react';

export default function BundleCollage({
  images = [],
  className = 'w-full h-full',
  fallbackIconSize = 24,
}) {
  const validImages = Array.from(new Set((images || []).filter(Boolean)));

  if (validImages.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-teal-50 text-teal-600 ${className}`}>
        <Package size={fallbackIconSize} weight="duotone" />
      </div>
    );
  }

  if (validImages.length === 1) {
    return (
      <div className={`overflow-hidden relative bg-slate-100 ${className}`}>
        <img
          src={validImages[0]}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  if (validImages.length === 2) {
    return (
      <div className={`grid grid-cols-2 gap-0.5 bg-slate-200 overflow-hidden ${className}`}>
        <div className="overflow-hidden bg-white">
          <img
            src={validImages[0]}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        <div className="overflow-hidden bg-white">
          <img
            src={validImages[1]}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      </div>
    );
  }

  if (validImages.length === 3) {
    return (
      <div className={`grid grid-cols-2 grid-rows-2 gap-0.5 bg-slate-200 overflow-hidden ${className}`}>
        <div className="row-span-2 col-span-1 overflow-hidden bg-white">
          <img
            src={validImages[0]}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        <div className="col-span-1 row-span-1 overflow-hidden bg-white">
          <img
            src={validImages[1]}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        <div className="col-span-1 row-span-1 overflow-hidden bg-white">
          <img
            src={validImages[2]}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-0.5 bg-slate-200 overflow-hidden relative ${className}`}>
      {validImages.slice(0, 4).map((img, idx) => (
        <div key={idx} className="relative w-full h-full overflow-hidden bg-white">
          <img
            src={img}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          {idx === 3 && validImages.length > 4 && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center text-[10px] sm:text-xs font-black text-white font-mono">
              +{validImages.length - 3}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
