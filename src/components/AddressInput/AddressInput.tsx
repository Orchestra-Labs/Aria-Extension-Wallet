import { Input } from '@/ui-kit';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  addressValidationAtom,
  chainWalletAtom,
  fullChainRegistryAtom,
  networkLevelAtom,
  receiveStateAtom,
  recipientAddressAtom,
  resetTransactionRouteAtom,
  selectedAssetAtom,
  updateReceiveChainAtom,
} from '@/atoms';
import { useEffect, useState } from 'react';
import { InputStatus } from '@/constants';
import { cn } from '@/helpers';
import { QRCodeScannerDialog } from '@/components';
import { Asset } from '@/types';
import { bech32 } from 'bech32';

interface AddressInputProps {
  addBottomMargin?: boolean;
  updateReceiveAsset: (asset: Asset, propagateChanges: boolean) => void;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  addBottomMargin = true,
  updateReceiveAsset,
}) => {
  const selectedAsset = useAtomValue(selectedAssetAtom);
  const walletState = useAtomValue(chainWalletAtom(selectedAsset.chainId));
  const [recipientAddress, setRecipientAddress] = useAtom(recipientAddressAtom);
  const updateReceiveChain = useSetAtom(updateReceiveChainAtom);
  const [addressValidation, setAddressValidation] = useAtom(addressValidationAtom);
  const receiveState = useAtomValue(receiveStateAtom);
  const fullRegistry = useAtomValue(fullChainRegistryAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const resetTxRoute = useSetAtom(resetTransactionRouteAtom);

  const [allowValidateAddress, setAllowValidatePassword] = useState(false);

  const validAddressLength = 39;
  const placeholder = walletState?.address || 'Wallet Address or ICNS';

  const setStatus = (status: InputStatus = InputStatus.NEUTRAL, message: string = '') => {
    setAddressValidation({ status, message });
  };

  const validateAddress = () => {
    if (recipientAddress === '') {
      setStatus();
      return;
    }

    const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(recipientAddress);
    if (!isAlphanumeric) {
      setStatus(InputStatus.ERROR, 'Address contains invalid characters.');
      return;
    }

    try {
      const decoded = bech32.decode(recipientAddress);
      console.log('[AddressInput] Decoded address:', {
        prefix: decoded.prefix,
        words: decoded.words,
      });

      if (!decoded.prefix) {
        setStatus(InputStatus.ERROR, 'Missing prefix.');
        return;
      }

      // Log all available chains and their prefixes for debugging
      console.log('[AddressInput] Available chains:', {
        networkLevel,
        chains: Object.values(fullRegistry[networkLevel]).map(chain => ({
          chainId: chain.chain_id,
          prefix: chain.bech32_prefix,
          name: chain.chain_name,
        })),
      });

      // Find the chain info for this prefix
      const matchedChain = Object.values(fullRegistry[networkLevel]).find(
        chain => chain.bech32_prefix === decoded.prefix,
      );

      if (!matchedChain) {
        setStatus(InputStatus.WARNING, 'Prefix not known.');
        return;
      }
      console.log('[AddressInput] Matched chain:', matchedChain);

      setStatus(InputStatus.SUCCESS);
      console.log(
        '[DEBUG][AddressInput] Current receive chain id',
        receiveState.chainId,
        'and matched',
        matchedChain.chain_id,
      );
      if (receiveState.chainId !== matchedChain.chain_id) {
        console.log(
          '[DEBUG][AddressInput] Updating receive chain from',
          receiveState.chainId,
          'to',
          matchedChain.chain_id,
        );

        resetTxRoute();
        updateReceiveChain(matchedChain.chain_id);
      }
    } catch (error) {
      setStatus(InputStatus.ERROR, 'Invalid Bech32 encoding.');
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value.trim();
    setRecipientAddress(newAddress);

    if (newAddress.length >= validAddressLength && !allowValidateAddress) {
      setAllowValidatePassword(true);
    }

    // Reset validation when empty
    if (newAddress === '') {
      setAllowValidatePassword(false);
      setStatus();
      resetTxRoute();
    }

    if (allowValidateAddress) {
      if (Object.keys(fullRegistry[networkLevel]).length > 0 && recipientAddress) validateAddress();
      validateAddress();
    }
  };

  const handleAddressBlur = () => {
    if (recipientAddress.length > 0) {
      setAllowValidatePassword(true);
    }
    validateAddress();
  };

  const handleAddressPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').trim();
    setRecipientAddress(pastedText);

    // Start validating immediately after paste
    if (pastedText === '') {
      setStatus();
    } else {
      setAllowValidatePassword(true);
    }

    validateAddress();
  };

  useEffect(() => {
    // Only validate if we have the full registry data
    if (Object.keys(fullRegistry[networkLevel]).length > 0 && recipientAddress) validateAddress();
  }, [recipientAddress, fullRegistry]);

  return (
    <div className={cn(`flex items-baseline ${addBottomMargin ? 'mb-4' : ''} space-x-2`)}>
      <Input
        variant="primary"
        type="text"
        label="Send to:"
        labelPosition="left"
        status={addressValidation.status}
        showMessageText={true}
        messageText={addressValidation.message}
        placeholder={placeholder}
        icon={<QRCodeScannerDialog updateReceiveAsset={updateReceiveAsset} />}
        value={recipientAddress}
        onChange={handleAddressChange}
        onBlur={handleAddressBlur}
        onPaste={handleAddressPaste}
        className="text-white w-full"
      />
    </div>
  );
};
