import { Asset } from '@/types';
import { SlideTray, Button, SlideTrayHandle } from '@/ui-kit';
import { ScrollTile } from '../ScrollTile';
import { ReceiveDialog } from '../ReceiveDialog';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate, useLocation } from 'react-router-dom';
import { ICON_CHANGEOVER_TIMEOUT, Position, ROUTES } from '@/constants';
import {
  swiperIndexState,
  selectedAssetAtom,
  dialogSelectedAssetAtom,
  sendStateAtom,
  selectedCoinListAtom,
  receiveStateAtom,
  chainWalletAtom,
  chainInfoAtom,
} from '@/atoms/';
import { formatBalanceDisplay, truncateWalletAddress } from '@/helpers';
import { IconContainer, VerifySuccess } from '@/assets/icons';
import { InfoPanel, InfoPanelRow } from '../InfoPanel';
import { Copy } from 'lucide-react';
import { useRef, useState } from 'react';
import { Tooltip } from '../Tooltip';

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
  const slideTrayRef = useRef<SlideTrayHandle>(null);

  const navigate = useNavigate();
  const pathname = useLocation().pathname;

  // TODO: dialogSelectedAssetAtom only used here.  make state instead of atom
  const [dialogSelectedAsset, setDialogSelectedAsset] = useAtom(dialogSelectedAssetAtom);
  const setActiveIndex = useSetAtom(swiperIndexState);
  const setSelectedAsset = useSetAtom(selectedAssetAtom);
  const currentState = useAtomValue(isReceiveDialog ? receiveStateAtom : sendStateAtom);
  const selectedCoins = useAtomValue(selectedCoinListAtom);
  const walletState = useAtomValue(chainWalletAtom(asset.chainId));
  const getChainInfo = useAtomValue(chainInfoAtom);

  const [copied, setCopied] = useState(false);

  const chain = getChainInfo(asset.chainId);
  const prefix = chain?.bech32_prefix;
  const truncatedAddress = prefix ? truncateWalletAddress(prefix, walletState.address) : '';

  const isChainSubscriptionsPage = pathname === ROUTES.APP.EDIT_COIN_LIST;
  const isReceivePage = pathname === ROUTES.APP.RECEIVE;
  const isSendPage = pathname === ROUTES.APP.SEND;

  const title = asset?.name || asset?.originDenom || asset?.denom || 'Unknown Asset';
  const symbol = asset?.symbol || asset?.originDenom || asset?.denom || '???';
  const denom = asset?.originDenom || asset?.denom || 'unknown';
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
    console.log('[AssetTile] Asset details:', {
      displayAmount: asset.displayAmount,
      symbol,
      asset,
    });

    value = formatBalanceDisplay(asset.displayAmount || '0', symbol);
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

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    navigator.clipboard.writeText(walletState.address);
    setCopied(true);
    // Reset after the icon changeover timeout
    setTimeout(() => setCopied(false), ICON_CHANGEOVER_TIMEOUT);
  };

  const scrollTile = (
    <div
      onClick={e => {
        // Only handle click if it's not coming from a prevented element
        const target = e.target as HTMLElement;
        const isPreventedButton = target.closest('[data-prevent-tray-open]');

        if (!isPreventedButton && !isSelectable) {
          // For non-selectable tiles, let SlideTray handle the opening
          return;
        }

        if (!isPreventedButton && isSelectable) {
          handleClick();
        }
      }}
    >
      <ScrollTile
        title={title}
        value={value}
        subtitle={subtitle}
        subtitleClickOption={
          isSelectable ? undefined : (
            <Tooltip tooltipText={truncatedAddress} position={Position.BOTTOM}>
              <Button
                variant="secondaryReactiveIcon"
                size="blank"
                onClick={handleCopy}
                className="w-5 h-5 p-0"
                data-prevent-tray-open
              >
                {copied ? (
                  <VerifySuccess className="text-success animate-scale-up h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </Tooltip>
          )
        }
        icon={<IconContainer src={logo || chain?.logo_uri || undefined} alt={symbol} />}
        selected={isSelectable ? isSelected : undefined}
        onClick={undefined}
      />
    </div>
  );

  return isSelectable ? (
    scrollTile
  ) : (
    <SlideTray ref={slideTrayRef} triggerComponent={scrollTile} title={title} showBottomBorder>
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
        <ReceiveDialog buttonSize="medium" asset={asset} chainId={asset.chainId} />
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
