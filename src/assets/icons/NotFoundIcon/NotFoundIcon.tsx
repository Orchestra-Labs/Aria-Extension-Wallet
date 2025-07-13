import React from 'react';

interface NotFoundIconProps {
  className?: string;
}

export const NotFoundIcon: React.FC<NotFoundIconProps> = ({ className = 'w-full h-full' }) => (
  <div className={`flex items-center justify-center rounded-full bg-grey-dark ${className}`}>
    <span className="text-blue-DEFAULT text-xl font-bold">?</span>
  </div>
);
