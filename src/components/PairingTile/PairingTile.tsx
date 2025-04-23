import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { GetWCPairingsResponse, useDeleteWCPairingMutation } from '@/queries';
import { Button } from '@/ui-kit';

type PairingTileProps = {
  pairing: GetWCPairingsResponse[number];
};

export const PairingTile = ({ pairing }: PairingTileProps) => {
  const { name, url, icons } = pairing.peerMetadata || {};
  const formattedUrl = url ? new URL(url).hostname : undefined;

  const iconSrc = useMemo(() => icons?.[0], [icons]);

  const { mutate: deletePairing, isPending: deletingPairing } = useDeleteWCPairingMutation();

  const onDeleteClick = () => deletePairing({ pairing });

  return (
    <div
      className={
        'p-2 min-h-[52px] rounded-md flex items-center cursor-pointer border border-neutral-2'
      }
    >
      <div className="rounded-full h-9 w-9 bg-neutral-2 p-1 flex items-center justify-center select-none">
        {iconSrc && <img src={iconSrc} alt={`${name} icon`} />}
      </div>
      <div className="flex flex-col ml-3 select-none">
        <h6 className={`text-base text-left line-clamp-1 select-none`}>{name}</h6>
        {formattedUrl && (
          <p className={`text-xs text-left line-clamp-1 select-none`}>{formattedUrl}</p>
        )}
      </div>
      <div className="flex-1" />
      <div className="grid place-items-center">
        <Button variant="transparent" disabled={deletingPairing} onClick={onDeleteClick}>
          <Trash2 />
        </Button>
      </div>
    </div>
  );
};
