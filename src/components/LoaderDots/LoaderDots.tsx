import React from 'react';

export const LoaderDots: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex space-x-1 ${className}`}>
    <div
      className="w-2 h-2 bg-blue rounded-full animate-bounce"
      style={{ animationDelay: '0ms' }}
    />
    <div
      className="w-2 h-2 bg-blue rounded-full animate-bounce"
      style={{ animationDelay: '150ms' }}
    />
    <div
      className="w-2 h-2 bg-blue rounded-full animate-bounce"
      style={{ animationDelay: '300ms' }}
    />
  </div>
);
