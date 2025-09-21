import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAtomValue, useSetAtom } from 'jotai';
import { usePermission } from 'react-use';
import { bech32 } from 'bech32';

import { QRCode } from '@/assets/icons';
import { recipientAddressAtom, symphonyAssetsAtom } from '@/atoms';
import { cn, openMediaOnboardingTab } from '@/helpers';
import { Asset } from '@/types';
import { Button, SlideTray, SlideTrayHandle } from '@/ui-kit';

interface QRCodeScannerDialogProps {
  updateReceiveAsset: (asset: Asset, propagateChanges: boolean) => void;
}

interface AriaQRCode {
  address: string;
  denom?: string;
  amount?: number;
}

export const QRCodeScannerDialog: React.FC<QRCodeScannerDialogProps> = ({ updateReceiveAsset }) => {
  const slideTrayRef = useRef<SlideTrayHandle>(null);
  const cameraContainerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<Html5Qrcode | null>(null);

  const setAddress = useSetAtom(recipientAddressAtom);
  const allAssets = useAtomValue(symphonyAssetsAtom);

  const [isDragOver, setIsDragOver] = useState(false);
  const [slideTrayIsOpen, setSlideTrayIsOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<'neutral' | 'success' | 'error'>('neutral');

  const permissionState = usePermission({ name: 'camera' });
  const cameraPermissionGranted = permissionState === 'granted';

  const isAriaQrCode = (data: any): data is AriaQRCode => {
    return (
      typeof data === 'object' &&
      typeof data.address === 'string' &&
      (data.denom === undefined || typeof data.denom === 'string') &&
      (data.amount === undefined || typeof data.amount === 'number')
    );
  };

  const isValidQrData = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);
      return isAriaQrCode(parsed);
    } catch {
      try {
        bech32.decode(text);
        return true;
      } catch {
        return false;
      }
    }
  };

  const handleScan = (result: string | null) => {
    if (!result) {
      setScanStatus('error');
      return;
    }

    if (!isValidQrData(result)) {
      setScanStatus('error');
      return;
    }

    setScanStatus('success');

    try {
      const parsed = JSON.parse(result);
      const preferredAsset = allAssets.find(
        asset => (asset.originDenom || asset.denom) === parsed.denom,
      );
      setAddress(parsed.address);
      if (preferredAsset) updateReceiveAsset(preferredAsset, true);
    } catch {
      setAddress(result);
    }
  };

  const decodeImageWithHtml5Qrcode = async (file: File): Promise<string> => {
    const html5Qr = new Html5Qrcode('temp-html5-file');
    try {
      const result = await html5Qr.scanFile(file, true);
      return result;
    } finally {
      try {
        await html5Qr.clear();
      } catch {}
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const resultText = await decodeImageWithHtml5Qrcode(file);
      handleScan(resultText);
    } catch (error) {
      console.error('Error scanning file:', error);
      setScanStatus('error');
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const resultText = await decodeImageWithHtml5Qrcode(file);
      handleScan(resultText);
    } catch (error) {
      console.error('Error scanning file:', error);
      setScanStatus('error');
    }
  };

  useEffect(() => {
    if (!slideTrayIsOpen || !cameraPermissionGranted || !cameraContainerRef.current) return;

    const html5Qr = new Html5Qrcode(cameraContainerRef.current.id);
    html5QrRef.current = html5Qr;

    html5Qr
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: 200 }, handleScan, () => {})
      .catch(err => {
        console.error('Failed to start camera', err);
      });

    return () => {
      try {
        html5Qr.stop();
        html5Qr.clear();
      } catch (err) {
        console.error('Failed to stop/clear scanner:', err);
      }
      html5QrRef.current = null;
    };
  }, [slideTrayIsOpen, cameraPermissionGranted]);

  useEffect(() => {
    if (!slideTrayIsOpen) {
      setScanStatus('neutral');
    }
  }, [slideTrayIsOpen]);

  useEffect(() => {
    if (scanStatus === 'success' || scanStatus === 'error') {
      const timeout = setTimeout(() => {
        if (scanStatus === 'success') slideTrayRef.current?.closeWithAnimation();
        setScanStatus('neutral');
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [scanStatus]);

  const borderColor = isDragOver
    ? 'border-blue'
    : scanStatus === 'success'
      ? 'border-success'
      : scanStatus === 'error'
        ? 'border-error'
        : 'border-neutral-3';

  const animationClass =
    scanStatus === 'success'
      ? 'animate-flash-success'
      : scanStatus === 'error'
        ? 'animate-flash-error'
        : '';

  return (
    <SlideTray
      ref={slideTrayRef}
      triggerComponent={
        <QRCode
          className="h-7 w-7 text-neutral-1 hover:bg-blue-hover hover:text-blue-dark cursor-pointer"
          width={20}
        />
      }
      title="Scan Address"
      showBottomBorder
      onOpenChange={setSlideTrayIsOpen}
    >
      <div className="flex flex-col items-center space-yt-4 yb-2">
        <div
          className="relative flex justify-center items-center bg-background-black rounded-lg w-[255px] h-[255px]"
          onDrop={handleDrop}
          onDragOver={e => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
        >
          {/* Camera container */}
          <div
            id="qr-html5-camera"
            ref={cameraContainerRef}
            className="w-full h-full overflow-hidden rounded-lg bg-background-black"
          />

          {/* Corner borders */}
          <div
            className={cn(
              'absolute z-10 top-0 left-0 w-[75px] h-[75px] border-t-4 border-l-4 rounded-tl-[8px]',
              animationClass,
              borderColor,
            )}
          />
          <div
            className={cn(
              'absolute z-10 top-0 right-0 w-[75px] h-[75px] border-t-4 border-r-4 rounded-tr-[8px]',
              animationClass,
              borderColor,
            )}
          />
          <div
            className={cn(
              'absolute z-10 bottom-0 left-0 w-[75px] h-[75px] border-b-4 border-l-4 rounded-bl-[8px]',
              animationClass,
              borderColor,
            )}
          />
          <div
            className={cn(
              'absolute z-10 bottom-0 right-0 w-[75px] h-[75px] border-b-4 border-r-4 rounded-br-[8px]',
              animationClass,
              borderColor,
            )}
          />

          {/* Fallback UI */}
          {!cameraPermissionGranted && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-auto">
              <button className="text-gray-dark text-center" onClick={openMediaOnboardingTab}>
                <span className="text-blue">Enable camera</span> or add file
              </button>
            </div>
          )}
        </div>

        <Button
          variant="secondary"
          size="small"
          onClick={() => {
            const fileInput = document.getElementById('qr-file-input') as HTMLInputElement;
            fileInput?.click();
          }}
          className="mt-3 px-4 py-1"
        >
          Use File
        </Button>

        <input
          id="qr-file-input"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        <div id="temp-html5-file" style={{ display: 'none' }} />
      </div>
    </SlideTray>
  );
};
