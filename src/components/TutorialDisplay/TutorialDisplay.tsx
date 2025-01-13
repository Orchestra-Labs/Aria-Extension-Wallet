import React, { useEffect, useState } from 'react';
import 'tippy.js/dist/tippy.css';
import { PointerIcon } from 'lucide-react';

interface TutorialDisplayProps {
  imageSrc: string;
  altText: string;
  pointerPosition: { top: string; left: string };
  ripplePosition: { top: string; left: string };
}

export const TutorialDisplay: React.FC<TutorialDisplayProps> = ({
  imageSrc,
  altText,
  pointerPosition,
  ripplePosition,
}) => {
  const [showRipple, setShowRipple] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRipple(true);
    }, 1100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col flex-grow items-center justify-center">
      <div className="relative">
        {/* Transparent overlay */}
        <div className="absolute w-full h-full inset-0 z-10"></div>

        {/* Main image */}
        <img
          src={imageSrc}
          alt={altText}
          className="h-64 mt-2 object-cover border-2 border-neutral-4 rounded-md"
        />

        {/* Animated circle */}
        {showRipple && (
          <div
            className="absolute w-3 h-3 rounded-full bg-white/50 z-20 animate-press-effect"
            style={{ top: ripplePosition.top, left: ripplePosition.left }}
          ></div>
        )}

        {/* Pointer Icon*/}
        <div
          className="absolute transform -translate-x-1/2 animate-press"
          style={{ top: pointerPosition.top, left: pointerPosition.left }}
        >
          <PointerIcon className="w-6 h-6 text-white z-30" />
        </div>
      </div>
    </div>
  );
};
