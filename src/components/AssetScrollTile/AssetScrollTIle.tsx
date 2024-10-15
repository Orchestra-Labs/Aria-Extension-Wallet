import { Asset } from '@/types';
import { SlideTray, Button } from '@/ui-kit';
import { ScrollTile } from '../ScrollTile';
import { ReceiveDialog } from '../ReceiveDialog';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/constants';

interface AssetScrollTileProps {
  asset: Asset;
}

export const AssetScrollTile = ({ asset }: AssetScrollTileProps) => {
  const title = asset.symbol || 'Unknown Asset';
  const value = `${asset.amount} ${asset.symbol}`;
  const logo = asset.logo;

  return (
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
          <div className="truncate text-base font-medium text-neutral-1">
            Amount: <span className="text-blue">{asset.amount}</span>
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
      <div className="flex flex-col items-center justify-center grid grid-cols-2 w-full gap-x-4 px-2">
        <ReceiveDialog />
        <Button className={'w-full'} asChild>
          <NavLink to={ROUTES.APP.SEND}>Send</NavLink>
        </Button>
      </div>
    </SlideTray>
  );
};
