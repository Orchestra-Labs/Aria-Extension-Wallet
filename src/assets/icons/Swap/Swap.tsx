import React from 'react';

export const Swap: React.FC<React.SVGProps<SVGSVGElement>> = props => (
  <svg
    fill="none"
    height="24"
    viewBox="0 0 24 24"
    width="24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="m11 8-4-4m0 0-4 4m4-4v16" />
      <path d="m13 16 4 4m0 0 4-4m-4 4v-16" />
    </g>
  </svg>
);
