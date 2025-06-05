import { Asset } from '@/types';
import { SlideTray, Button } from '@/ui-kit';
import { ScrollTile } from '../ScrollTile';
import { ReceiveDialog } from '../ReceiveDialog';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate, useLocation } from 'react-router-dom';
import { DEFAULT_ASSET, LOCAL_ASSET_REGISTRY, ROUTES } from '@/constants';
import {
  swiperIndexState,
  selectedAssetAtom,
  dialogSelectedAssetAtom,
  sendStateAtom,
  selectedCoinListAtom,
  receiveStateAtom,
} from '@/atoms/';
import { cn, formatBalanceDisplay } from '@/helpers';
import { useStablecoinStaking } from '@/hooks/useStablecoinStaking.ts';
import { StablecoinStakeDialog } from '@/components';

interface AssetScrollTileProps {
  asset: Asset;
  isSelectable?: boolean;
  isReceiveDialog?: boolean;
  multiSelectEnabled?: boolean;
  onClick?: (asset: Asset) => void;
}

export const AssetScrollTile = ({
  asset,
  isSelectable = false,
  isReceiveDialog = false,
  multiSelectEnabled = false,
  onClick,
}: AssetScrollTileProps) => {
  const setActiveIndex = useSetAtom(swiperIndexState);
  const setSelectedAsset = useSetAtom(selectedAssetAtom);
  const currentState = useAtomValue(isReceiveDialog ? receiveStateAtom : sendStateAtom);
  const [dialogSelectedAsset, setDialogSelectedAsset] = useAtom(dialogSelectedAssetAtom);
  const selectedCoins = useAtomValue(selectedCoinListAtom);

  const navigate = useNavigate();
  const location = useLocation(); // Get the current route to check if it's the SEND page

  const symbol = asset.symbol || DEFAULT_ASSET.symbol || 'MLD';
  const title = asset.symbol || 'Unknown Asset';
  const logo = asset.logo ? asset.logo : LOCAL_ASSET_REGISTRY.note.logo;

  const valueAmount = isReceiveDialog
    ? asset.exchangeRate === '0'
      ? '-'
      : asset.exchangeRate || '1'
    : asset.amount;

  let value = '';
  if (isReceiveDialog) {
    const sendState = useAtomValue(sendStateAtom);

    if (isNaN(parseFloat(valueAmount))) {
      value = '-';
    } else {
      const unitSymbol = sendState.asset.symbol || 'MLD';
      value = formatBalanceDisplay(valueAmount, unitSymbol);
    }
  } else {
    const unitSymbol = symbol;
    value = formatBalanceDisplay(valueAmount, unitSymbol);
  }

  const handleSendClick = () => {
    // Set the selected asset in the send state
    setSelectedAsset(asset);
    navigate(ROUTES.APP.SEND);
  };

  const handleClick = () => {
    if (onClick) {
      setDialogSelectedAsset(asset);
      onClick(asset);
    }
  };

  // Check if the current page is the SEND page
  const isOnSendPage = location.pathname === ROUTES.APP.SEND;

  // Determine if the asset is selected, based on current state or multi-select mode
  const isSelected = multiSelectEnabled
    ? selectedCoins.some(selectedCoin => selectedCoin.denom === asset.denom)
    : isOnSendPage
      ? asset.denom === currentState.asset.denom
      : asset.denom === dialogSelectedAsset.denom;

  const { params } = useStablecoinStaking();

  const isStablecoinStakingEnabled = params?.supported_tokens?.includes(asset.denom);

  const isStakingEnabled = asset.denom === DEFAULT_ASSET.denom;

  return (
    <>
      {isSelectable ? (
        <ScrollTile
          title={title}
          subtitle="Symphony"
          value={value}
          icon={<img src={logo} alt={title} />}
          selected={isSelected}
          onClick={handleClick}
        />
      ) : (
        <SlideTray
          triggerComponent={
            <div>
              <ScrollTile
                title={title}
                subtitle="Symphony"
                value={value}
                icon={<img src={logo} alt={title} />}
              />
            </div>
          }
          title={title}
          showBottomBorder
        >
          <>
            <div className="text-center mb-2">
              <div className="truncate text-base font-medium text-neutral-1 line-clamp-1">
                Amount: <span className="text-blue">{value}</span>
              </div>
              <span className="text-grey-dark text-xs text-base">
                Current Chain: <span className="text-blue">Symphony</span>
              </span>
            </div>
          </>

          {/* Asset Information */}
          <div className="mb-4 min-h-[7.5rem] max-h-[7.5rem] overflow-hidden shadow-md bg-black p-2">
            <p>
              <strong>Ticker: </strong>
              {asset.symbol}
            </p>
            <p>
              <strong>Sub-unit: </strong>
              {asset.denom}
            </p>
            <p>
              <strong>Staking: </strong>
              {isStakingEnabled || isStablecoinStakingEnabled ? 'Available' : 'Unavailable'}
            </p>
            {/*
              TODO: include information such as...
              is stakeable,
              is IBC,
              is Token or native,
              native chain,
              current chain,
              native to which application,
              price,
              website,
              etc
            */}
          </div>

          {/* Action Buttons */}
          <div
            className={cn(
              'items-center justify-center grid  w-full gap-x-4 px-2',
              isStakingEnabled || isStablecoinStakingEnabled ? 'grid-cols-3' : 'grid-cols-2',
            )}
          >
            <Button size="medium" className={'w-full'} onClick={handleSendClick}>
              Send
            </Button>
            <ReceiveDialog buttonSize="medium" asset={asset} />
            {isStablecoinStakingEnabled && <StablecoinStakeDialog asset={asset} />}
            {isStakingEnabled && !isStablecoinStakingEnabled && (
              <Button size="medium" className={'w-full'} onClick={() => setActiveIndex(1)}>
                Stake
              </Button>
            )}
          </div>
        </SlideTray>
      )}
    </>
  );
};
