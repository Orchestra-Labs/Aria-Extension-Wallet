import { Swiper, SwiperClass, SwiperSlide } from 'swiper/react';
import 'swiper/swiper-bundle.css';
import { BalanceCard, SearchBar, SortDialog, ValidatorScroller } from '@/components';
import {
  swiperIndexState,
  showCurrentValidatorsAtom,
  showAllAssetsAtom,
  searchTermAtom,
  filteredAssetsAtom,
  filteredValidatorsAtom,
  hasNonZeroAssetsAtom,
} from '@/atoms';
import { useEffect, useRef, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Button } from '@/ui-kit';
import { userAccountAtom } from '@/atoms/accountAtom';
import { ChainSubscriptions } from '../ChainSubscriptions';
import { SwapTutorial } from '../SwapTutorial';
import { AssetScroller } from '@/components/AssetScroller/AssetScroller';
import { SearchType } from '@/constants';
import { Search } from 'lucide-react';

export const Main = () => {
  const swiperRef = useRef<SwiperClass | null>(null);

  const [activeIndex, setActiveIndex] = useAtom(swiperIndexState);
  const [showCurrentValidators, setShowCurrentValidators] = useAtom(showCurrentValidatorsAtom);
  const [showAllAssets, setShowAllAssets] = useAtom(showAllAssetsAtom);
  const setSearchTerm = useSetAtom(searchTermAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const filteredAssets = useAtomValue(filteredAssetsAtom);
  const filteredValidators = useAtomValue(filteredValidatorsAtom);
  const hasNonZeroAssets = useAtomValue(hasNonZeroAssetsAtom);

  const [showSearch, setShowSearch] = useState(false);

  const routeToVisibilitySelection = !userAccount?.settings.hasSetCoinList;
  const routeToTutorial = !userAccount?.settings.hasViewedTutorial;

  const searchType = activeIndex === 0 ? SearchType.ASSET : SearchType.VALIDATOR;

  const assetViewToggleChange = (shouldShowAllAssets: boolean) => {
    setShowAllAssets(shouldShowAllAssets);
  };

  const validatorViewToggleChange = (shouldShowCurrent: boolean) => {
    setShowCurrentValidators(shouldShowCurrent);
  };

  const swipeTo = (index: number) => {
    setActiveIndex(index);
    if (swiperRef.current) swiperRef.current.slideTo(index);
  };

  useEffect(() => {
    if (swiperRef.current) swiperRef.current.slideTo(activeIndex);
  }, [activeIndex]);

  useEffect(() => {
    // reset search text when switching slides
    setSearchTerm('');
    setShowSearch(false);
  }, [activeIndex, setSearchTerm]);

  useEffect(() => {
    if (hasNonZeroAssets && showAllAssets) setShowAllAssets(false);
  }, [hasNonZeroAssets, showAllAssets, setShowAllAssets]);

  if (routeToTutorial) return <SwapTutorial />;
  if (routeToVisibilitySelection) return <ChainSubscriptions />;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Balance swiper */}
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
              <BalanceCard currentStep={activeIndex} totalSteps={2} swipeTo={swipeTo} />
            </div>
          </SwiperSlide>
          <SwiperSlide>
            <div className="w-full px-4 mt-4 flex-shrink-0">
              <BalanceCard currentStep={activeIndex} totalSteps={2} swipeTo={swipeTo} />
            </div>
          </SwiperSlide>
        </Swiper>
      </div>

      {/* Content section */}
      <div className="flex-grow pt-4 px-4 pb-4 flex flex-col overflow-hidden">
        {/* Header row: Title • chips • actions */}
        {activeIndex === 0 ? (
          <div className="flex items-center px-2 mb-2">
            <h3 className="text-h4 text-white font-bold">Holdings</h3>
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
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="icon"
                className="rounded-lg"
                onClick={() => setShowSearch(s => !s)}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
              <SortDialog searchType={searchType} />
            </div>
          </div>
        ) : (
          <div className="flex items-center px-2 mb-2">
            <h3 className="text-h4 text-white font-bold">Validators</h3>
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
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="icon"
                className="rounded-lg"
                onClick={() => setShowSearch(s => !s)}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
              <SortDialog searchType={searchType} />
            </div>
          </div>
        )}

        {/* Toggleable search field (only when the magnifier is tapped) */}
        {showSearch && <SearchBar searchType={searchType} />}

        {/* List */}
        <div className="w-full mt-2">
          {activeIndex === 0 ? (
            <AssetScroller assets={filteredAssets} />
          ) : (
            <ValidatorScroller validators={filteredValidators} />
          )}
        </div>
      </div>
    </div>
  );
};
