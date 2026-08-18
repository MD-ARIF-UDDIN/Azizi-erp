import React from 'react';

export const Logo: React.FC<{ className?: string; size?: number }> = ({ className, size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Circle - Orange Arc (butt cap for flat cuts) */}
      <path
        d="M 103 353 A 180 180 0 1 1 430 250"
        stroke="#f28f00"
        strokeWidth="32"
        strokeLinecap="butt"
      />
      
      {/* Outer Circle - Blue Arc (butt cap for flat cuts) */}
      <path
        d="M 103 353 A 180 180 0 0 0 430 250"
        stroke="#000ba0"
        strokeWidth="32"
        strokeLinecap="butt"
      />
      
      {/* Monogram A - Blue */}
      <path
        d="M 130 335 L 245 160 L 310 335"
        stroke="#000ba0"
        strokeWidth="34"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M 185 270 H 275"
        stroke="#000ba0"
        strokeWidth="28"
        strokeLinecap="butt"
      />

      {/* Monogram T - Orange */}
      <path
        d="M 245 160 H 375"
        stroke="#f28f00"
        strokeWidth="34"
        strokeLinecap="butt"
      />
      <path
        d="M 312 160 V 335"
        stroke="#f28f00"
        strokeWidth="34"
        strokeLinecap="butt"
      />
    </svg>
  );
};
