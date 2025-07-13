import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ScrollArea } from '@/ui-kit';
import { useDrag } from '@use-gesture/react';
import { animated, useSpring } from 'react-spring';
import { Loader } from '../Loader';

interface TileScrollerProps {
  children: React.ReactNode;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export interface TileScrollerHandle {
  shouldPreventClick: () => boolean;
}

export const TileScroller = forwardRef<TileScrollerHandle, TileScrollerProps>(
  ({ children, isRefreshing = false, onRefresh }, ref) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [dragStarted, setDragStarted] = useState(false);
    const [isRefreshTriggered, setIsRefreshTriggered] = useState(false);
    const [isRefreshComplete, setIsRefreshComplete] = useState(true);

    useImperativeHandle(ref, () => ({
      shouldPreventClick: () => dragStarted || isRefreshTriggered,
    }));

    const TOP_OVERSCROLL_LIMIT = 52;
    const OVERSCROLL_ACTIVATION_THRESHOLD = TOP_OVERSCROLL_LIMIT * 0.75;
    const BOTTOM_OVERSCROLL_PERCENTAGE = 0.075;
    const MAX_REFRESH_VELOCITY = 0.5;

    const [{ y, loaderOpacity }, api] = useSpring(() => ({ y: 0, loaderOpacity: 0 }));

    // Handle refresh completion
    useEffect(() => {
      if (isRefreshing === false && isRefreshTriggered) {
        setIsRefreshTriggered(false);
        setIsRefreshComplete(true);
        api.start({ y: 0, loaderOpacity: 0 });
      }
    }, [isRefreshing, isRefreshTriggered, api]);

    const bind = useDrag(
      ({
        movement: [, my],
        memo = viewportRef.current?.scrollTop || 0,
        event,
        dragging,
        last,
        velocity,
      }) => {
        event.stopPropagation();

        if (!isMouseDown || !event.target || (event.target as HTMLElement).closest('.slide-tray')) {
          return memo;
        }

        if (!dragStarted && my !== 0) setDragStarted(true);

        if (viewportRef.current) {
          const viewport = viewportRef.current;
          const atTop = viewport.scrollTop <= 0;
          const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight;

          const maxBottomOverscrollDistance = viewport.clientHeight * BOTTOM_OVERSCROLL_PERCENTAGE;
          const limitedOverscroll = atTop
            ? Math.min(my / 2, TOP_OVERSCROLL_LIMIT)
            : Math.max(my / 2, -maxBottomOverscrollDistance);

          if (dragging) {
            if ((atTop && my > 0) || (atBottom && my < 0)) {
              api.start({
                y: limitedOverscroll,
                loaderOpacity: atTop ? limitedOverscroll / TOP_OVERSCROLL_LIMIT : 0,
              });
            } else {
              viewport.scrollTop = memo - my;
              api.start({ y: 0, loaderOpacity: 0 });
            }
          } else if (last && !isRefreshTriggered && isRefreshComplete) {
            const velocityMagnitude = Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2);

            if (
              atTop &&
              limitedOverscroll > OVERSCROLL_ACTIVATION_THRESHOLD &&
              velocityMagnitude < MAX_REFRESH_VELOCITY
            ) {
              setIsRefreshTriggered(true);
              setIsRefreshComplete(false);
              api.start({ y: TOP_OVERSCROLL_LIMIT, loaderOpacity: 1 });
              onRefresh?.();
            } else {
              api.start({ y: 0, loaderOpacity: 0 });
            }

            setDragStarted(false);
          }
        }

        return memo;
      },
    );

    const handleMouseDown = () => setIsMouseDown(true);
    const handleMouseUp = () => {
      setIsMouseDown(false);
      setDragStarted(false);
      if (!isRefreshTriggered) {
        api.start({ y: 0, loaderOpacity: 0 });
      }
    };

    useEffect(() => {
      const resetDrag = () => {
        setIsMouseDown(false);
        setDragStarted(false);
        if (!isRefreshTriggered) {
          api.start({ y: 0, loaderOpacity: 0 });
        }
      };

      window.addEventListener('mouseup', resetDrag);
      window.addEventListener('mouseleave', resetDrag);
      window.addEventListener('pointercancel', resetDrag);

      return () => {
        window.removeEventListener('mouseup', resetDrag);
        window.removeEventListener('mouseleave', resetDrag);
        window.removeEventListener('pointercancel', resetDrag);
      };
    }, [api, isRefreshTriggered]);

    return (
      <ScrollArea
        className="flex-grow w-full overflow-y-auto border border-neutral-3 rounded-md select-none"
        type="always"
        scrollbarProps={{}}
        viewportRef={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <animated.div
          className="relative pr-3 select-none"
          style={{
            transform: y.to(v => `translateY(${v}px)`),
          }}
          {...bind()}
        >
          <animated.div
            className="absolute top-[-52px] left-0 right-0 flex justify-center items-center h-12 select-none"
            style={{
              opacity: loaderOpacity,
              transform: y.to(v => `translateY(${Math.max(v - 52, -52)}px)`),
            }}
          >
            <Loader isSpinning={isRefreshTriggered || isRefreshing} />
          </animated.div>

          {children}
        </animated.div>
      </ScrollArea>
    );
  },
);
