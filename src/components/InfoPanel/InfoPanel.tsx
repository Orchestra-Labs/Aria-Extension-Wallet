import { ScrollArea } from '@/ui-kit';
import { ReactNode, useRef } from 'react';
import { useDrag } from '@use-gesture/react';
import { animated, useSpring } from 'react-spring';

interface InfoPanelProps {
  children: ReactNode;
  className?: string;
}

export const InfoPanel = ({ children, className = '' }: InfoPanelProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [{ y }, _] = useSpring(() => ({ y: 0 }));

  const bind = useDrag(
    ({ movement: [, my], memo = viewportRef.current?.scrollTop || 0, event, dragging }) => {
      event.stopPropagation();

      if (viewportRef.current) {
        if (dragging) {
          // Normal scrolling behavior
          viewportRef.current.scrollTop = memo - my;
        }
      }
      return memo;
    },
    {
      // Only activate when dragging more than 5px to prevent conflict with clicks
      filterTaps: true,
      threshold: 5,
    },
  );

  return (
    <div className={`mb-4 h-[7.5rem] shadow-md bg-black ${className}`}>
      <ScrollArea
        className="h-full"
        viewportRef={viewportRef}
        scrollbarProps={{
          onPointerDown: e => e.stopPropagation(),
        }}
      >
        <animated.div
          {...bind()}
          className="space-y-1 p-2 pr-4 select-none"
          style={{ y }}
          onMouseDown={e => {
            // Only prevent default if not clicking a link
            if (!(e.target as HTMLElement).closest('a')) {
              e.preventDefault();
            }
          }}
        >
          {children}
        </animated.div>
      </ScrollArea>
    </div>
  );
};

interface InfoPanelRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export const InfoPanelRow = ({ label, value, className = '' }: InfoPanelRowProps) => {
  return (
    <p className={`${className} select-none`}>
      <strong>{label}:</strong> {value}
    </p>
  );
};
