import { Asset } from '@/types';
import { SlideTray, Button } from '@/ui-kit';
import { ScrollTile } from '../ScrollTile';
import { ReceiveDialog } from '../ReceiveDialog';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate, useLocation } from 'react-router-dom';
import { DEFAULT_MAINNET_ASSET, LOCAL_MAINNET_ASSET_REGISTRY, ROUTES } from '@/constants';
import {
  swiperIndexState,
  selectedAssetAtom,
  dialogSelectedAssetAtom,
  sendStateAtom,
  selectedCoinListAtom,
  receiveStateAtom,
} from '@/atoms/';
import { formatBalanceDisplay } from '@/helpers';

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
  const pathname = useLocation().pathname;

  const isEditPage = pathname === ROUTES.APP.EDIT_COIN_LIST;
  const isReceivePage = pathname === ROUTES.APP.RECEIVE;
  const isSendPage = pathname === ROUTES.APP.SEND;

  const symbol = asset.symbol || DEFAULT_MAINNET_ASSET.symbol || 'MLD';
  const denom = asset.denom || 'Unknown Denom';
  const logo = asset.logo || LOCAL_MAINNET_ASSET_REGISTRY.note.logo;

  const subtitle = isEditPage ? denom : asset.networkName || 'Unknown Network';

  let value = '';
  if (isEditPage) {
    value = asset.networkName || 'Unknown Network';
  } else if (isReceivePage) {
    const sendState = useAtomValue(sendStateAtom);
    const unitSymbol = sendState.asset.symbol || 'MLD';
    value = isNaN(parseFloat(asset.exchangeRate || '0'))
      ? '-'
      : formatBalanceDisplay(asset.exchangeRate || '1', unitSymbol);
  } else {
    value = formatBalanceDisplay(asset.amount, symbol);
  }

  const isSelected = multiSelectEnabled
    ? selectedCoins.some(selected => selected.denom === asset.denom)
    : isSendPage
      ? asset.denom === currentState.asset.denom
      : asset.denom === dialogSelectedAsset.denom;

  const handleSendClick = () => {
    setSelectedAsset(asset);
    navigate(ROUTES.APP.SEND);
  };

  const handleClick = () => {
    if (onClick) {
      setDialogSelectedAsset(asset);
      onClick(asset);
    }
  };

  const scrollTile = (
    <ScrollTile
      title={symbol}
      subtitle={subtitle}
      value={value}
      icon={<img src={logo} alt={symbol} />}
      selected={isSelectable ? isSelected : undefined}
      onClick={isSelectable ? handleClick : undefined}
    />
  );

  return isSelectable ? (
    scrollTile
  ) : (
    <SlideTray triggerComponent={<div>{scrollTile}</div>} title={symbol} showBottomBorder>
      <div className="text-center mb-2">
        <div className="truncate text-base font-medium text-neutral-1 line-clamp-1">
          Amount: <span className="text-blue">{value}</span>
        </div>
        <span className="text-grey-dark text-xs text-base">
          Current Chain: <span className="text-blue">{asset.networkName}</span>
        </span>
      </div>

      <div className="mb-4 min-h-[7.5rem] max-h-[7.5rem] overflow-hidden shadow-md bg-black p-2">
        <p>
          <strong>Ticker: </strong>
          {asset.symbol}
        </p>
        <p>
          <strong>Sub-unit: </strong>
          {asset.denom}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center grid grid-cols-3 w-full gap-x-4 px-2">
        <Button size="medium" className="w-full" onClick={handleSendClick}>
          Send
        </Button>
        <ReceiveDialog buttonSize="medium" asset={asset} />
        <Button size="medium" className="w-full" onClick={() => setActiveIndex(1)}>
          Stake
        </Button>
      </div>
    </SlideTray>
  );
};
