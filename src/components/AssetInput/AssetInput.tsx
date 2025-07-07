import { Input } from '@/ui-kit';
import { AssetSelectDialog } from '@/components';
import { cn, getRegexForDecimals, formatNumberWithCommas, stripNonNumerics } from '@/helpers';
import { Asset } from '@/types';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { GREATER_EXPONENT_DEFAULT, InputStatus } from '@/constants';

interface AssetInputProps {
  isDisabled?: boolean;
  placeholder: string;
  variant?: 'send' | 'receive' | 'stake';
  status?: InputStatus;
  messageText?: string;
  assetState: Asset | null;
  amountState: number;
  reducedHeight?: boolean;
  includeBottomMargin?: boolean;
  labelWidth?: string;
  updateAsset?: (newAsset: Asset, propagateChanges?: boolean) => void;
  updateAmount: (newAmount: number, propagateChanges?: boolean) => void;
  showClearAndMax?: boolean;
  showEndButton?: boolean;
  disableButtons?: boolean;
  onClear?: () => void;
  onMax?: () => void;
  onEndButtonClick?: () => void;
  endButtonTitle?: string;
  className?: string;
  addClearMaxMargin?: boolean;
}

export const AssetInput: React.FC<AssetInputProps> = ({
  isDisabled = false,
  placeholder = '',
  variant = 'stake',
  status = InputStatus.NEUTRAL,
  messageText = '',
  assetState,
  amountState,
  reducedHeight = false,
  includeBottomMargin = true,
  labelWidth,
  updateAsset,
  updateAmount,
  showClearAndMax = false,
  showEndButton = false,
  disableButtons = true,
  onClear,
  onMax,
  onEndButtonClick,
  endButtonTitle = '',
  className,
  addClearMaxMargin = false,
  ...props
}) => {
  const [localInputValue, setLocalInputValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const prevValueRef = useRef<string>('');
  const currentAsset = assetState;
  const currentExponent = currentAsset?.exponent ?? GREATER_EXPONENT_DEFAULT;

  const onAmountValueChange = (value: number) => {
    const roundedValue = parseFloat(value.toFixed(currentExponent));
    updateAmount(roundedValue, true); // Propagate the change
  };

  useEffect(() => {
    if (!isNaN(amountState) && amountState !== null && amountState !== 0) {
      const formattedNumber = formatNumberWithCommas(amountState || 0);
      setLocalInputValue(formattedNumber);
    } else {
      setLocalInputValue('');
    }
  }, [amountState]);

  // Handle user input change, strip non-numerics, add the new character, and reformat
  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    const caretPosition = event.target.selectionStart || 0;
    const regex = getRegexForDecimals(currentExponent);

    // Remove commas and non-numeric characters for accurate processing
    const rawValue = stripNonNumerics(inputValue);

    // Split the input into the integer and decimal parts
    const [integerPart, decimalPart] = rawValue.split('.');

    // Check if decimal part exceeds 6 digits and truncate if necessary
    let processedValue = rawValue;
    if (decimalPart && decimalPart.length > currentExponent) {
      processedValue = `${integerPart}.${decimalPart.slice(0, currentExponent)}`;
    }

    const numericValue = parseFloat(processedValue);

    if (!isNaN(numericValue) || !regex.test(inputValue) || inputValue === '') {
      onAmountValueChange(numericValue);
    } else {
      onAmountValueChange(0);
    }

    // Update the input with the formatted value
    const formattedValue = formatNumberWithCommas(processedValue || 0);
    setLocalInputValue(formattedValue);

    const previousRawValue = stripNonNumerics(prevValueRef.current);
    const previousFormattedValue = formatNumberWithCommas(parseFloat(previousRawValue));

    // Reposition the caret
    setTimeout(() => {
      if (inputRef.current) {
        // Compare the previous value with the new one to determine if it's an addition or removal
        let characterWasAdded = false;
        if (rawValue.length > previousRawValue.length) {
          characterWasAdded = true;
        } else if (rawValue.length < previousRawValue.length) {
          characterWasAdded = false;
        } else {
          characterWasAdded = false;
        }

        let newCaretPosition = caretPosition;
        if (characterWasAdded) {
          if (formattedValue.length - rawValue.length > 1) {
            newCaretPosition += 1;
          } else if (
            rawValue.length > previousFormattedValue.length &&
            formattedValue.length !== rawValue.length
          ) {
            newCaretPosition += 1;
          }
        } else if (!characterWasAdded) {
          if (previousFormattedValue.length - formattedValue.length > 1) {
            newCaretPosition -= 1;
          } else if (formattedValue.length === previousRawValue.length) {
            // Do nothing
          }
        }

        prevValueRef.current = processedValue;

        // Ensure caret assignment happens after the DOM is updated
        setTimeout(() => {
          inputRef.current?.setSelectionRange(newCaretPosition, newCaretPosition);
        }, 0);
      }
    }, 0);
  };

  // Handle formatting the input when the user finishes typing (on blur)
  const handleBlur = () => {
    const value = parseFloat(stripNonNumerics(localInputValue));

    if (!isNaN(value)) {
      setLocalInputValue(formatNumberWithCommas(value));
    }
  };

  console.log('asset input page add margin?', addClearMaxMargin);
  const label = variant === 'receive' ? 'Receiving:' : variant === 'send' ? 'Sending:' : undefined;
  return (
    <div
      className={cn(
        variant === 'stake'
          ? 'w-[95%]'
          : `flex items-center ${includeBottomMargin ? 'mb-4' : ''} space-x-2`,
      )}
    >
      <div className="flex-grow">
        <Input
          variant="primary"
          type="text"
          ref={inputRef}
          status={status}
          messageText={messageText}
          showMessageText={!!messageText}
          label={label}
          labelPosition="left"
          placeholder={placeholder}
          step={currentExponent}
          value={localInputValue || ''}
          onChange={handleAmountChange}
          onBlur={handleBlur}
          disabled={isDisabled}
          icon={
            updateAsset ? (
              <AssetSelectDialog isReceiveDialog={variant === 'receive'} onClick={updateAsset} />
            ) : null
          }
          reducedHeight={reducedHeight}
          showClearAndMax={showClearAndMax}
          showEndButton={showEndButton}
          disableButtons={disableButtons}
          onClear={onClear}
          onMax={onMax}
          onEndButtonClick={onEndButtonClick}
          endButtonTitle={endButtonTitle}
          addClearMaxMargin={addClearMaxMargin}
          className={cn(
            className,
            variant === 'stake'
              ? 'text-white mx-1'
              : 'text-white border border-neutral-2 rounded-md w-full h-10',
          )}
          {...props}
        />
      </div>
    </div>
  );
};
