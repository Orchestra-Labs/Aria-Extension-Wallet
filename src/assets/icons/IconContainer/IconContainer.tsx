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

  if (icon) {
    return <div className={`${className}`}>{icon}</div>;
  }

  if (error || !src) {
    return <NotFoundIcon className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={handleImageError}
      className={`w-full h-full object-contain ${className}`}
    />
  );
};
