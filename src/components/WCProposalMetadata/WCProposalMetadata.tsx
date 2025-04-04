import { CoreTypes, Verify } from '@walletconnect/types';
import { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  metadata: CoreTypes.Metadata;
  verifyContext: Verify.Context;
}>;

export const WCProposalMetadata = ({ metadata, verifyContext, children }: Props) => {
  const { icons, name, url } = metadata;

  const iconSrc = icons[0];

  const validation = verifyContext.verified.validation;

  const verificationStatus = (() => {
    if (verifyContext.verified.isScam) return 'IS_SCAM';
    if (validation === 'INVALID') return 'INVALID';
    if (validation === 'VALID') return 'VALID';
    return 'UNKNOWN';
  })();

  const verificationStatusLabel = (() => {
    if (verificationStatus === 'IS_SCAM') return 'Potential threat ⚠️';
    if (verificationStatus === 'INVALID') return 'Invalid Domain ⚠️';
    if (verificationStatus === 'VALID') return 'Verified ✅';
    return 'Cannot Verify Domain';
  })();

  return (
    <div className="flex flex-col items-center">
      <img
        src={iconSrc}
        alt={`${name} wallet icon`}
        className="h-32 aspect-[1/1] mt-2 object-contain border-2 border-neutral-4 rounded-md"
      />
      <div className="my-2.5 text-center">
        <a href={url} className="text-base text-blue">
          {url}
        </a>
        <div className="text-base mt-0.5">{verificationStatusLabel}</div>
        {children}
      </div>
    </div>
  );
};
