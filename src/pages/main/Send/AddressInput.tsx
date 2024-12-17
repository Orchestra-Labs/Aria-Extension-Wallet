import { Input } from '@/ui-kit';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  addressVerifiedAtom,
  receiveStateAtom,
  recipientAddressAtom,
  walletStateAtom,
} from '@/atoms';
import { useEffect, useState } from 'react';
import { InputStatus } from '@/constants';
import { cn, fetchBech32Prefixes } from '@/helpers';
import { QRCodeScannerDialog } from '@/components';
import { Asset, ChainData } from '@/types';
import { bech32 } from 'bech32';

interface AddressInputProps {
  addBottomMargin?: boolean;
  labelWidth?: string;
  updateSendAsset: (asset: Asset, propagateChanges: boolean) => void;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  addBottomMargin = true,
  labelWidth,
  updateSendAsset,
}) => {
  const [address, setAddress] = useAtom(recipientAddressAtom);
  const setAddressVerified = useSetAtom(addressVerifiedAtom);
  const setReceiveState = useSetAtom(receiveStateAtom);
  const walletState = useAtomValue(walletStateAtom);

  const [addressStatus, setAddressStatus] = useState<InputStatus>(InputStatus.NEUTRAL);
  const [messageText, setMessageText] = useState<string>('');
  const [allowValidateAddress, setAllowValidatePassword] = useState(false);
  const [testnetPrefixes, setTestnetPrefixes] = useState<ChainData[]>([]);

  const validAddressLength = 47;

  const validateAddress = () => {
    if (address === '') {
      setAddressStatus(InputStatus.NEUTRAL);
      setMessageText('');
      return;
    }

    const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(address);
    if (!isAlphanumeric) {
      setAddressStatus(InputStatus.ERROR);
      setMessageText('Address contains invalid characters.');
      setAddressVerified(false);
      return;
    }

    try {
      const decoded = bech32.decode(address);

      // TODO: check this verifies prefix presence properly
      console.log('found prefix', decoded.prefix);
      if (!decoded.prefix) {
        setAddressStatus(InputStatus.ERROR);
        setMessageText(`Missing prefix`);
        setAddressVerified(false);
        return;
      }

      // TODO: use net of sending coin
      const matchedChain = testnetPrefixes.find(chain => chain.testnet === decoded.prefix);

      if (!matchedChain) {
        setAddressStatus(InputStatus.WARNING);
        setMessageText('Prefix not known');
        setAddressVerified(false);
        return;
      }

      setAddressStatus(InputStatus.SUCCESS);
      setMessageText('');
      setAddressVerified(true);
      setReceiveState(prevState => ({
        ...prevState,
        chainName: matchedChain.coin.toLowerCase(),
      }));
    } catch (error) {
      setAddressStatus(InputStatus.ERROR);
      setMessageText('Invalid Bech32 encoding.');
      setAddressVerified(false);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    const trimmedAddress = newAddress.trim();
    setAddress(trimmedAddress);

    if (trimmedAddress.length >= validAddressLength && !allowValidateAddress) {
      setAllowValidatePassword(true);
    }

    // Reset validation when empty
    if (trimmedAddress === '') {
      setAllowValidatePassword(false);
      setAddressStatus(InputStatus.NEUTRAL);
    }

    if (allowValidateAddress) {
      validateAddress();
    }
  };

  const handleAddressBlur = () => {
    if (address.length > 0) {
      setAllowValidatePassword(true);
    }
    validateAddress();
  };

  const handleAddressPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const trimmedAddress = pastedText.trim();
    setAddress(trimmedAddress);

    // Start validating immediately after paste
    if (trimmedAddress.length > 0) {
      setAllowValidatePassword(true);
    }
    validateAddress();
  };

  useEffect(() => {
    validateAddress();
  }, [address]);

  useEffect(() => {
    setAddressVerified(addressStatus === 'success');
  }, [addressStatus]);

  useEffect(() => {
    const fetchPrefixes = async () => {
      const prefixes = await fetchBech32Prefixes();
      const testnets = prefixes.filter(chain => chain.testnet !== null);
      setTestnetPrefixes(testnets);
    };

    fetchPrefixes();
  }, []);

  return (
    <div className={cn(`flex items-baseline ${addBottomMargin ? 'mb-4' : ''} space-x-2`)}>
      <label className={cn(`text-sm text-neutral-1 whitespace-nowrap ${labelWidth}`)}>
        Send to:
      </label>
      <div className="flex-grow">
        <Input
          variant="primary"
          type="text"
          status={addressStatus}
          showMessageText={true}
          messageText={messageText}
          placeholder={walletState.address || 'Wallet Address or ICNS'}
          icon={<QRCodeScannerDialog updateSendAsset={updateSendAsset} />}
          value={address}
          onChange={handleAddressChange}
          onBlur={handleAddressBlur}
          onPaste={handleAddressPaste}
          className="text-white w-full"
        />
      </div>
    </div>
  );
};
