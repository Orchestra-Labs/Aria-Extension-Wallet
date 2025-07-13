import React from 'react';
import { NotFoundIcon } from '../NotFoundIcon';

interface IconContainerProps {
  src?: string;
  alt?: string;
  className?: string;
  icon?: React.ReactNode;
}

export const IconContainer: React.FC<IconContainerProps> = ({
  src,
  alt = '',
  className = 'w-full h-full',
  icon,
}) => {
  const [error, setError] = React.useState(false);

  const handleImageError = () => {
    setError(true);
  };

  const containerStyle = {
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (icon) {
    <div style={containerStyle} className={className}>
      {icon}
    </div>;
  }

  if (error || !src) {
    <div style={containerStyle} className={className}>
      <NotFoundIcon className={className} />
    </div>;
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
