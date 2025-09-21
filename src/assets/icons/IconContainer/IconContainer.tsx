import React from 'react';
import { NotFoundIcon } from '../NotFoundIcon';

interface IconContainerProps {
  src?: string;
  alt?: string;
  className?: string;
  icon?: React.ReactNode;
  isFallback?: boolean;
}

export const IconContainer: React.FC<IconContainerProps> = ({
  src,
  alt = '',
  className = 'w-full h-full',
  icon,
  isFallback = false,
}) => {
  const [error, setError] = React.useState(false);

  const handleImageError = () => {
    setError(true);
  };

  const containerStyle = {
    borderRadius: '50%',
    overflow: isFallback ? 'visible' : 'hidden',
    display: '',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (icon) {
    return (
      <div style={containerStyle} className={className}>
        {icon}
      </div>
    );
  }

  if (error || !src) {
    return (
      <div style={containerStyle} className={className}>
        <NotFoundIcon className={className} />
      </div>
    );
  }

  return (
    <div style={containerStyle} className={className}>
      <img
        src={src}
        alt={alt}
        onError={handleImageError}
        className={`object-contain ${className}`}
      />
    </div>
  );
};
