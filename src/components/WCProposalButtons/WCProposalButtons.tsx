import { PropsWithChildren } from 'react';

import { Button, Separator } from '@/ui-kit';

type Props = PropsWithChildren<{
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}>;

export const WCProposalButtons = ({ disabled, onApprove, onReject }: Props) => {
  return (
    <div className="pb-4 flex flex-col gap-2">
      <Separator variant="top" />
      <div className="flex justify-center items-center gap-x-5 w-[85%] mx-auto">
        <Button variant="secondary" className="w-full" onClick={onReject} disabled={disabled}>
          Reject
        </Button>
        <Button className="w-full" onClick={onApprove} disabled={disabled}>
          Approve
        </Button>
      </div>
    </div>
  );
};
