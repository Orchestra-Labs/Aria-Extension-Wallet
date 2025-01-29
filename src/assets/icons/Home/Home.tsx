import React from 'react';

export const Home: React.FC<React.SVGProps<SVGSVGElement>> = props => (
  <svg
    fill="#61CBF4"
    width="800px"
    height="800px"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="3"
      d="M20 19v-8.5a1 1 0 0 0-.4-.8l-7-5.25a1 1 0 0 0-1.2 0l-7 5.25a1 1 0 0 0-.4.8V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z"
    />
  </svg>
);
