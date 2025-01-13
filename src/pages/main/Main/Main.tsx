import { Swiper, SwiperClass, SwiperSlide } from 'swiper/react';
import 'swiper/swiper-bundle.css';
import { BalanceCard, SearchBar, SortDialog, TileScroller } from '@/components';
import {
  swiperIndexState,
  showCurrentValidatorsAtom,
  showAllAssetsAtom,
  searchTermAtom,
} from '@/atoms';
import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Button } from '@/ui-kit';
import { userAccountAtom } from '@/atoms/accountAtom';
import { EditCoinListScreen } from '../EditCoinListScreen';
import { SwapTutorial } from '../SwapTutorial';

export const Main = () => {
  const swiperRef = useRef<SwiperClass | null>(null);
  const totalSlides = 2;

  const [activeIndex, setActiveIndex] = useAtom(swiperIndexState);
  console.log('active index', activeIndex);
  const [showCurrentValidators, setShowCurrentValidators] = useAtom(showCurrentValidatorsAtom);
  const [showAllAssets, setShowAllAssets] = useAtom(showAllAssetsAtom);
  const setSearchTerm = useSetAtom(searchTermAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const routeToVisibilitySelection = !userAccount?.settings.hasSetCoinList;
  const routeToTutorial = !userAccount?.settings.hasViewedTutorial;

  const assetViewToggleChange = (shouldShowAllAssets: boolean) => {
    setShowAllAssets(shouldShowAllAssets);
  };

  const validatorViewToggleChange = (shouldShowCurrent: boolean) => {
    setShowCurrentValidators(shouldShowCurrent);
  };

  const swipeTo = (index: number) => {
    setActiveIndex(index);
    if (swiperRef.current) {
      swiperRef.current.slideTo(index);
    }
  };

  useEffect(() => {
    if (swiperRef.current) {
      swiperRef.current.slideTo(activeIndex);
    }
  }, [activeIndex]);

  useEffect(() => {
    setSearchTerm('');
  }, [activeIndex]);

  // TODO: make tiles name of chain with dropdown on right side.  coins for that chain are slightly shifted right
  // TODO: allow search by chain name
  // TODO: modify editcoinlistscreen to different display for tiles.

  // TODO: use routing instead
  if (routeToVisibilitySelection) {
    return <EditCoinListScreen />;
  }

  if (routeToTutorial) {
    return <SwapTutorial />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Swiper Component for Balance Cards */}
      <div className="relative h-48 flex-none overflow-hidden">
        <Swiper
          spaceBetween={50}
          slidesPerView={1}
          loop={false}
          onSlideChange={swiper => setActiveIndex(swiper.activeIndex)}
          onSwiper={swiper => {
            swiperRef.current = swiper;
          }}
        >
          <SwiperSlide>
            <div className="w-full px-4 mt-4 flex-shrink-0">
              <BalanceCard currentStep={activeIndex} totalSteps={totalSlides} swipeTo={swipeTo} />
            </div>
          </SwiperSlide>
          <SwiperSlide>
            <div className="w-full px-4 mt-4 flex-shrink-0">
              <BalanceCard currentStep={activeIndex} totalSteps={totalSlides} swipeTo={swipeTo} />
            </div>
          </SwiperSlide>
        </Swiper>
      </div>

      {/* Assets section */}
      <div className="flex-grow pt-4 px-4 pb-4 flex flex-col overflow-hidden">
        {activeIndex === 0 ? (
          <h3 className="text-h4 text-white font-bold text-left flex items-center px-2">
            <span className="flex-1">Holdings</span>
            <div className="flex-1 flex justify-center items-center space-x-2">
              <Button
                variant={!showAllAssets ? 'selected' : 'unselected'}
                size="small"
                onClick={() => assetViewToggleChange(false)}
                className="px-2 rounded-md text-xs"
              >
                Non-Zero
              </Button>
              <Button
                variant={showAllAssets ? 'selected' : 'unselected'}
                size="small"
                onClick={() => assetViewToggleChange(true)}
                className="px-2 rounded-md text-xs"
              >
                All
              </Button>
            </div>
            <div className="flex-1 flex justify-end">
              <SortDialog />
            </div>
          </h3>
        ) : (
          <h3 className="text-h4 text-white font-bold text-left flex items-center px-2">
            <span className="flex-1">Validators</span>
            <div className="flex-1 flex justify-center items-center space-x-2">
              <Button
                variant={showCurrentValidators ? 'selected' : 'unselected'}
                size="small"
                onClick={() => validatorViewToggleChange(true)}
                className="px-2 rounded-md text-xs"
              >
                Current
              </Button>
              <Button
                variant={!showCurrentValidators ? 'selected' : 'unselected'}
                size="small"
                onClick={() => validatorViewToggleChange(false)}
                className="px-2 rounded-md text-xs"
              >
                All
              </Button>
            </div>
            <div className="flex-1 flex justify-end">
              <SortDialog isValidatorSort />
            </div>
          </h3>
        )}

        {/* Display the filtered and sorted assets */}
        <div className="flex justify-between pr-3 text-neutral-1 text-xs font-bold mb-1">
          {activeIndex === 0 ? (
            <>
              <span className="w-[3.5rem]">Logo</span>
              <span>Chain</span>
              <span className="flex-1"></span>
              <span className="flex-1 text-right">Amount</span>
            </>
          ) : (
            <>
              <span className="w-[3.5rem]">Logo</span>
              {/* <span>{showCurrentValidators ? 'Delegations' : 'Uptime'}</span> */}
              <span>Delegations</span>
              <span className="flex-1"></span>
              <span className="flex-1 text-right">
                {showCurrentValidators ? 'Rewards' : 'APY / Vote %'}
              </span>
            </>
          )}
        </div>

        <TileScroller activeIndex={activeIndex} />

        <SearchBar />
      </div>
    </div>
  );
};
