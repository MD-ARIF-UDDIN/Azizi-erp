import React from 'react';

export const Logo: React.FC<{ className?: string; size?: number | string; style?: React.CSSProperties }> = ({ 
  className = '', 
  size = 32,
  style
}) => {
  const dimension = typeof size === 'number' ? `${size}px` : size;
  return (
    <img
      src="/logo.png"
      alt="AZIZI Typing & Stamp Making"
      className={`object-contain inline-block shrink-0 ${className}`}
      style={{ width: dimension, height: dimension, ...style }}
      loading="eager"
    />
  );
};
