import React from 'react';

export function UniformPreview({ hex }: { hex: string }){
  const stroke = '#0f172a';
  const fill = hex || '#ffffff';
  return (
    <svg viewBox="0 0 220 220" className="w-full h-48">
      <defs>
        <linearGradient id="shirt" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={fill} />
          <stop offset="1" stopColor={fill} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="220" height="220" rx="18" fill="#f8fafc" />
      <path
        d="M70 45 L95 30 Q110 20 125 30 L150 45 L175 70 L160 85 L150 75 L150 175 Q150 190 135 190 L85 190 Q70 190 70 175 L70 75 L60 85 L45 70 Z"
        fill="url(#shirt)" stroke={stroke} strokeWidth="5" strokeLinejoin="round"
      />
      <path d="M100 35 Q110 45 120 35" fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <circle cx="110" cy="92" r="5" fill={stroke} opacity="0.6"/>
      <circle cx="110" cy="112" r="5" fill={stroke} opacity="0.6"/>
      <circle cx="110" cy="132" r="5" fill={stroke} opacity="0.6"/>
    </svg>
  );
}
