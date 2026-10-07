import React, { useState } from 'react';
import { Building2 } from 'lucide-react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string;
  className?: string;
  fit?: 'cover' | 'contain' | 'fill';
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt = 'صورة الشقة الفندقية',
  fallbackText,
  className = '',
  fit = 'cover',
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Fill-mode keeps the complete, undistorted image in front of a blurred cover layer.
  const imageFitClass = fit === 'cover' ? 'object-cover' : 'object-contain';

  if (hasError || !src) {
    return (
      <div
        className={`bg-gradient-to-br from-[#EFE9DF] to-[#E3DCCD] flex flex-col items-center justify-center text-[#68675F] p-4 text-center select-none ${className}`}
        aria-label={alt}
      >
        <Building2 className="w-8 h-8 mb-2 opacity-50 text-[#B69A68]" />
        <span className="text-xs font-medium text-[#68675F] line-clamp-1">
          {fallbackText || alt || 'Luxury home منزل الفخامة'}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {fit === 'fill' && (
        <>
          <img
            src={src}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl"
          />
          <div className="pointer-events-none absolute inset-0 bg-[#282824]/20" aria-hidden="true" />
        </>
      )}
      {isLoading && (
        <div className="absolute inset-0 bg-[#EFE9DF]/60 animate-pulse flex items-center justify-center">
          <Building2 className="w-6 h-6 opacity-30 text-[#B69A68]" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
        className={`w-full h-full ${imageFitClass} transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        {...props}
      />
    </div>
  );
};
