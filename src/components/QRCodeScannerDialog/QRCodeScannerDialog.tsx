import { BrowserQRCodeReader } from '@zxing/browser';
import { useAtomValue, useSetAtom } from 'jotai';
import React, { useRef, useState } from 'react';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
import { usePermission } from 'react-use';

import { QRCode } from '@/assets/icons';
import { filteredAssetsAtom, recipientAddressAtom } from '@/atoms';
import { cn, openMediaOnboardingTab } from '@/helpers';
import { Asset } from '@/types';
import { Button, SlideTray } from '@/ui-kit';

interface QRCodeScannerDialogProps {
  updateReceiveAsset: (asset: Asset, propagateChanges: boolean) => void;
}

export const QRCodeScannerDialog: React.FC<QRCodeScannerDialogProps> = ({ updateReceiveAsset }) => {
  const slideTrayRef = useRef<{ isOpen: () => void; closeWithAnimation: () => void }>(null);

  const setAddress = useSetAtom(recipientAddressAtom);
  const filteredAssets = useAtomValue(filteredAssetsAtom);

  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const cameraPermissionState = usePermission({ name: 'camera' });

  const cameraPermissionGranted = cameraPermissionState === 'granted';

  const qrCodeReader = new BrowserQRCodeReader();
  const [slideTrayIsOpen, setSlideTrayIsOpen] = useState(false);

  const handleScan = (result: string | null) => {
    console.log('[QR SCAN] handleScan() called with:', result);
    if (result) {
      try {
        const parsedResult = JSON.parse(result);
        console.log('[QR SCAN] Parsed result:', parsedResult);
        if (parsedResult.address && parsedResult.denom) {
          console.log('[QR SCAN] Searching for asset with denom:', parsedResult.denom);
          const preferredAsset = filteredAssets.find(asset => asset.denom === parsedResult.denom);
          console.log('[QR SCAN] Matched asset:', preferredAsset);

          setAddress(parsedResult.address);
          updateReceiveAsset(preferredAsset as Asset, true);
        } else {
          setAddress(result);
        }
      } catch (err) {
        setAddress(result);
      }

      slideTrayRef.current?.closeWithAnimation();
    }
  };

  const handleError = (error: any) => {
    console.error('QR Scanner Error:', error);
    if (error.name === 'NotAllowedError') {
      setPermissionDenied(true);
    }
  };

  const onRequestCameraPermission = openMediaOnboardingTab;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      try {
        const url = URL.createObjectURL(file);
        const result = await qrCodeReader.decodeFromImageUrl(url);
        handleScan(result.getText());
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error scanning file:', error);
      }
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      const url = URL.createObjectURL(file);
      try {
        const result = await qrCodeReader.decodeFromImageUrl(url);
        handleScan(result.getText());
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error scanning file:', error);
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const borderColor = isDragOver
    ? 'border-blue-pressed'
    : slideTrayIsOpen && !permissionDenied
      ? 'border-blue'
      : 'border-neutral-3';

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
        {/* Camera View & Drag/Drop Area */}
        <div
          className={`relative flex justify-center items-center bg-background-black rounded-lg w-[255px] h-[255px]`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {/* Decorative Borders */}
          <div
            className={cn(
              `absolute top-[-0px] left-[-0px] w-[75px] h-[75px] border-t-4 border-l-4 ${borderColor} rounded-tl-[8px]`,
            )}
          />
          <div
            className={cn(
              `absolute top-[-0px] right-[-0px] w-[75px] h-[75px] border-t-4 border-r-4 ${borderColor} rounded-tr-[8px]`,
            )}
          />
          <div
            className={cn(
              `absolute bottom-[-0px] left-[-0px] w-[75px] h-[75px] border-b-4 border-l-4 ${borderColor} rounded-bl-[8px]`,
            )}
          />
          <div
            className={cn(
              `absolute bottom-[-0px] right-[-0px] w-[75px] h-[75px] border-b-4 border-r-4 ${borderColor} rounded-br-[8px]`,
            )}
          />

          {cameraPermissionGranted && (
            <BarcodeScannerComponent
              onUpdate={(error, result) => {
                const textResult = (result as { getText: () => string })?.getText();
                if (textResult) handleScan(textResult);
                if (error) handleError(error);
              }}
              stopStream={!slideTrayIsOpen}
            />
          )}
          {!cameraPermissionGranted && (
            <button className="text-gray-dark text-center" onClick={onRequestCameraPermission}>
              <span className="text-blue">Enable camera</span> or add file
            </button>
          )}
        </div>
        {/* File Explorer Button */}
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

        {/* Hidden File Input */}
        <input
          id="qr-file-input"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>
    </SlideTray>
  );
};
