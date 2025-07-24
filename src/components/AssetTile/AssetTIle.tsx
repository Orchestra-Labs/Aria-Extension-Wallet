import { Asset } from '@/types';
import { SlideTray, Button } from '@/ui-kit';
import { ScrollTile } from '../ScrollTile';
import { ReceiveDialog } from '../ReceiveDialog';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants';
import {
  swiperIndexState,
  selectedAssetAtom,
  dialogSelectedAssetAtom,
  sendStateAtom,
  selectedCoinListAtom,
  receiveStateAtom,
} from '@/atoms/';
import { formatBalanceDisplay } from '@/helpers';
import { IconContainer } from '@/assets/icons';
import { InfoPanel, InfoPanelRow } from '../InfoPanel';

interface AssetTileProps {
  asset: Asset;
  isSelectable?: boolean;
  isReceiveDialog?: boolean;
  multiSelectEnabled?: boolean;
  onClick?: (asset: Asset) => void;
}

export const AssetTile = ({
  asset,
  isSelectable = false,
  isReceiveDialog = false,
  multiSelectEnabled = false,
  onClick,
}: AssetTileProps) => {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;

  const [dialogSelectedAsset, setDialogSelectedAsset] = useAtom(dialogSelectedAssetAtom);
  const setActiveIndex = useSetAtom(swiperIndexState);
  const setSelectedAsset = useSetAtom(selectedAssetAtom);
  const currentState = useAtomValue(isReceiveDialog ? receiveStateAtom : sendStateAtom);
  const selectedCoins = useAtomValue(selectedCoinListAtom);

  const isChainSubscriptionsPage = pathname === ROUTES.APP.EDIT_COIN_LIST;
  const isReceivePage = pathname === ROUTES.APP.RECEIVE;
  const isSendPage = pathname === ROUTES.APP.SEND;

  // TODO: some IBC assets come through with no name.  need to parse those based on others that match on denom
  const title = asset?.name || asset?.denom || 'Unknown Asset';
  const symbol = asset?.symbol || asset?.denom || '???';
  const denom = asset?.denom || 'unknown';
  const logo = asset?.logo || '';

  const network = asset.networkName.charAt(0).toUpperCase() + asset.networkName.slice(1);
  const subtitle = isChainSubscriptionsPage ? symbol : network || 'Unknown Network';

  const hasZeroBalance = asset.amount === '0';

  let value = '';
  if (isChainSubscriptionsPage) {
    value = network || 'Unknown Network';
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
    ? selectedCoins.some(selected => selected === asset)
    : isSendPage
      ? asset === currentState.asset
      : asset === dialogSelectedAsset;

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
      title={title}
      subtitle={subtitle}
      value={value}
      icon={<IconContainer src={logo} alt={symbol} />}
      selected={isSelectable ? isSelected : undefined}
      onClick={isSelectable ? handleClick : undefined}
    />
  );

  return isSelectable ? (
    scrollTile
  ) : (
    <SlideTray triggerComponent={<div>{scrollTile}</div>} title={title} showBottomBorder>
      <div className="text-center mb-2">
        <div className="truncate text-base font-medium text-neutral-1 line-clamp-1">
          Amount: <span className="text-blue">{value}</span>
        </div>
        <span className="text-grey-dark text-xs text-base">
          Current Chain: <span className="text-blue">{network}</span>
        </span>
      </div>

      {/* Asset Information */}
      <InfoPanel>
        <InfoPanelRow label="Name" value={title} />
        <InfoPanelRow label="Ticker" value={symbol} />
        <InfoPanelRow label="Sub-unit" value={denom} />
      </InfoPanel>

      <div className="flex flex-col items-center justify-center grid grid-cols-3 w-full gap-x-4 px-2">
        <Button
          size="medium"
          className="w-full"
          disabled={hasZeroBalance}
          onClick={handleSendClick}
        >
          Send
        </Button>
        <ReceiveDialog buttonSize="medium" asset={asset} chainId={asset.networkID} />
        <Button
          size="medium"
          className="w-full"
          disabled={hasZeroBalance}
          onClick={() => setActiveIndex(1)}
        >
          Stake
        </Button>
      </div>
    </SlideTray>
  );
};
