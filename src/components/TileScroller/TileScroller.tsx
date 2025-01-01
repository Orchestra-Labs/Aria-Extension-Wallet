import React, { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { isFetchingValidatorDataAtom, isFetchingWalletDataAtom } from '@/atoms';
import { ScrollArea } from '@/ui-kit';
import { Asset, CombinedStakingInfo } from '@/types';
import { useDrag } from '@use-gesture/react';
import { animated, useSpring } from 'react-spring';
import { Loader } from '../Loader';
import { ValidatorTiles } from '../TileScroller/ValidatorTiles';
import { AssetTiles } from '../TileScroller/AssetTiles';
import { useRefreshData } from '@/hooks';

interface TileScrollerProps {
  activeIndex?: number;
  isSelectable?: boolean;
  onSelectAsset?: (asset: Asset) => void;
  onSelectValidator?: (validator: CombinedStakingInfo) => void;
  isDialog?: boolean;
  isReceiveDialog?: boolean;
  isEditPage?: boolean;
  multiSelectEnabled?: boolean;
}

export const TileScroller: React.FC<TileScrollerProps> = ({
  activeIndex = 0,
  isSelectable = false,
  onSelectAsset,
  onSelectValidator,
  isDialog = false,
  isReceiveDialog = false,
  isEditPage = false,
  multiSelectEnabled = false,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { refreshData } = useRefreshData();

  const isFetchingData = useAtomValue(
    activeIndex === 0 ? isFetchingWalletDataAtom : isFetchingValidatorDataAtom,
  );
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);
  const [isRefreshTriggered, setIsRefreshTriggered] = useState(false);

  const TOP_OVERSCROLL_LIMIT = 52;
  const OVERSCROLL_ACTIVATION_THRESHOLD = TOP_OVERSCROLL_LIMIT * 0.75;
  const BOTTOM_OVERSCROLL_PERCENTAGE = 0.075;
  const MAX_REFRESH_VELOCITY = 0.5;

  const [{ y, loaderOpacity }, api] = useSpring(() => ({ y: 0, loaderOpacity: 0 }));

  useEffect(() => {
    if (isRefreshTriggered && !isFetchingData) {
      // Split refresh to just the affected tiles
      if (activeIndex === 0) {
        refreshData({ wallet: true, validator: false });
      } else {
        refreshData({ validator: true, wallet: false });
      }
    }
  }, [isRefreshTriggered, activeIndex]);

  useEffect(() => {
    if (isRefreshTriggered) {
      setIsRefreshTriggered(isFetchingData);
    }
  }, [isFetchingData]);

  useEffect(() => {
    if (!isRefreshTriggered) {
      api.start({ y: 0, loaderOpacity: 0 });
    }
  }, [isRefreshTriggered, api]);

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
        } else if (last && !isRefreshTriggered) {
          const velocityMagnitude = Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2);

          if (
            atTop &&
            limitedOverscroll > OVERSCROLL_ACTIVATION_THRESHOLD &&
            velocityMagnitude < MAX_REFRESH_VELOCITY
          ) {
            setIsRefreshTriggered(true);
            api.start({ y: TOP_OVERSCROLL_LIMIT, loaderOpacity: 1 });
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

  const allowOnClick = !(dragStarted || isRefreshTriggered);
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
          <Loader isSpinning={isRefreshTriggered} />
        </animated.div>

        {activeIndex === 0 ? (
          <AssetTiles
            isSelectable={isSelectable}
            onClick={allowOnClick ? onSelectAsset : () => {}}
            isDialog={isDialog}
            isReceiveDialog={isReceiveDialog}
            isEditPage={isEditPage}
            multiSelectEnabled={multiSelectEnabled}
          />
        ) : (
          <ValidatorTiles
            isSelectable={isSelectable}
            onClick={allowOnClick ? onSelectValidator : () => {}}
            isDialog={isDialog}
          />
        )}
      </animated.div>
    </ScrollArea>
  );
};
