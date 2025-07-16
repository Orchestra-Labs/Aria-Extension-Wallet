import { Input } from '@/ui-kit';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  addressVerifiedAtom,
  chainWalletAtom,
  receiveStateAtom,
  recipientAddressAtom,
  sendStateAtom,
} from '@/atoms';
import { useEffect, useState } from 'react';
import { InputStatus } from '@/constants';
import { cn, fetchBech32Prefixes } from '@/helpers';
import { QRCodeScannerDialog } from '@/components';
import { Asset, ChainData } from '@/types';
import { bech32 } from 'bech32';

interface AddressInputProps {
  addBottomMargin?: boolean;
  updateReceiveAsset: (asset: Asset, propagateChanges: boolean) => void;
  updateTransactionType: () => void;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  addBottomMargin = true,
  updateReceiveAsset,
  updateTransactionType,
}) => {
  const [address, setAddress] = useState('');
  const setRecipientAddress = useSetAtom(recipientAddressAtom);
  const setAddressVerified = useSetAtom(addressVerifiedAtom);
  const setReceiveState = useSetAtom(receiveStateAtom);
  const sendState = useAtomValue(sendStateAtom);

  const walletState = useAtomValue(chainWalletAtom(sendState.chainID));

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

      if (!decoded.prefix) {
        setAddressStatus(InputStatus.ERROR);
        setMessageText(`Missing prefix`);
        setAddressVerified(false);
        return;
      }

      // TODO: use net level of sending coin
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
      updateTransactionType();
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

    setAddress(newAddress);

    // Reset validation when empty
    if (newAddress === '') {
      setAllowValidatePassword(false);
      setAddressStatus(InputStatus.NEUTRAL);
      setRecipientAddress(walletState.address);
      setAddressVerified(true);
      updateTransactionType();
    } else {
      setRecipientAddress(trimmedAddress);
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
    setAddress(trimmedAddress);
    if (trimmedAddress === '') {
      setRecipientAddress(walletState.address);
    } else {
      setRecipientAddress(trimmedAddress);
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
      <Input
        variant="primary"
        type="text"
        label="Send to:"
        labelPosition="left"
        status={addressStatus}
        showMessageText={true}
        messageText={messageText}
        placeholder={walletState.address || 'Wallet Address or ICNS'}
        icon={<QRCodeScannerDialog updateReceiveAsset={updateReceiveAsset} />}
        value={address}
        onChange={handleAddressChange}
        onBlur={handleAddressBlur}
        onPaste={handleAddressPaste}
        className="text-white w-full"
      />
    </div>
  );
};
