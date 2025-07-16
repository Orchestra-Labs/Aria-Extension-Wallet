import { EnglishMnemonic } from '@cosmjs/crypto';
import { useDrag } from '@use-gesture/react';
import { useAtom, useSetAtom } from 'jotai';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { EyeClose, EyeOpen } from '@/assets/icons';
import { mnemonic12State, mnemonic24State, mnemonicVerifiedState, use24WordsState } from '@/atoms';
import { cn } from '@/helpers/utils';
import { Button, CopyTextField, Input } from '@/ui-kit';

type RecoveryPhraseGridProps = {
  isVerifyMode?: boolean;
  hiddenIndices?: number[];
  isEditable?: boolean;
  singleWordCount?: boolean;
};

export const RecoveryPhraseGrid: React.FC<RecoveryPhraseGridProps> = ({
  isVerifyMode = false,
  hiddenIndices: hiddenWordIndices = [],
  isEditable = false,
  singleWordCount = false,
}) => {
  const [mnemonic12, setMnemonic12] = useAtom(mnemonic12State);
  const [mnemonic24, setMnemonic24] = useAtom(mnemonic24State);
  const [use24Words, setUse24Words] = useAtom(use24WordsState);
  const setMnemonicVerified = useSetAtom(mnemonicVerifiedState);

  // User input state tracking
  const [localMnemonic, setLocalMnemonic] = useState<string[]>([]);
  const [isShown, setIsShown] = useState<boolean>(false);
  const [shadow, setShadow] = useState<string>('');
  const phraseBoxRef = useRef<HTMLDivElement>(null);

  // State for border colors and validation allowance
  const [inputBorderColors12, setInputBorderColors12] = useState<{ [key: number]: string }>({});
  const [inputBorderColors24, setInputBorderColors24] = useState<{ [key: number]: string }>({});
  const [allowValidation12, setAllowValidation12] = useState<{ [key: number]: boolean }>({});
  const [allowValidation24, setAllowValidation24] = useState<{ [key: number]: boolean }>({});
  const [isFocused, setIsFocused] = useState<number | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const getCurrentMnemonic = () => (use24Words ? mnemonic24 : mnemonic12);
  const maxWords = use24Words ? 24 : 12;

  const inputBorderColors = use24Words ? inputBorderColors24 : inputBorderColors12;
  const setInputBorderColors = use24Words ? setInputBorderColors24 : setInputBorderColors12;

  const allowValidation = use24Words ? allowValidation24 : allowValidation12;
  const setAllowValidation = use24Words ? setAllowValidation24 : setAllowValidation12;

  const handleShowPhrase = () => setIsShown(prev => !prev);

  const validateWord = (word: string, index?: number) => {
    const isValidInWordlist = EnglishMnemonic.wordlist.includes(word);

    // If index is supplied, check if the word matches the correct order
    if (typeof index === 'number') {
      const correctMnemonic = getCurrentMnemonic(); // Get the correct mnemonic array (12 or 24 words)
      const isCorrectOrder = word === correctMnemonic[index];
      return isValidInWordlist && isCorrectOrder;
    }

    // If no index is provided, just check if it's a valid word
    return isValidInWordlist;
  };

  // Copy local state to global state
  const updateMnemonic = (mnemonic: string[]) => {
    use24Words ? setMnemonic24(mnemonic) : setMnemonic12(mnemonic);
  };

  const validateFullMnemonic = () => {
    const correctMnemonic = getCurrentMnemonic();

    try {
      new EnglishMnemonic(localMnemonic.join(' '));
      setMnemonicVerified(true);

      if (isVerifyMode) {
        // If verify mode is on, check each word’s order
        const isCorrectOrder = localMnemonic.every(
          (word, index) => word === correctMnemonic[index],
        );

        // Set the border colors based on order correctness
        setInputBorderColors(
          localMnemonic.reduce(
            (acc, _, index) => ({
              ...acc,
              [index]: isCorrectOrder
                ? 'border-success'
                : localMnemonic[index] === correctMnemonic[index]
                  ? 'border-success'
                  : 'border-error',
            }),
            {},
          ),
        );

        // Update mnemonic verified status based on order
        setMnemonicVerified(isCorrectOrder);
      } else {
        // Mnemonic already checked for validity, no need to check order
        setInputBorderColors(
          localMnemonic.reduce((acc, _, index) => ({ ...acc, [index]: 'border-success' }), {}),
        );
      }
    } catch (error) {
      // Case of invalid mnemonic
      setMnemonicVerified(false);
      setInputBorderColors(
        localMnemonic.reduce((acc, _, index) => ({ ...acc, [index]: 'border-error' }), {}),
      );
    }
  };

  // Specific case: Validate all of hidden words
  const checkAllHiddenWordsVerified = () => {
    const allHiddenWordsVerified = hiddenWordIndices.every(
      index => localMnemonic[index] === getCurrentMnemonic()[index],
    );

    setMnemonicVerified(allHiddenWordsVerified);
  };

  // Route logic.  Check full mnemonic both hidden and editable
  const checkFullMnemonic = () => {
    // In verify mode, check the hidden indexes
    if (isVerifyMode) {
      checkAllHiddenWordsVerified();
    } else {
      // Check if all words are valid and form a complete mnemonic
      const isComplete = localMnemonic.every(word => word.trim().length > 0 && validateWord(word));
      // If all words are valid, mark the mnemonic as verified
      if (isComplete) {
        validateFullMnemonic();
      } else {
        setMnemonicVerified(false);
      }
    }
  };

  // Update local mnemonic with global state
  useEffect(() => {
    setLocalMnemonic(
      getCurrentMnemonic().map((word, index) => (hiddenWordIndices.includes(index) ? '' : word)),
    );
  }, [isVerifyMode, use24Words]);

  // Verify full mnemonic on change
  useEffect(() => {
    if (!isVerifyMode) {
      updateMnemonic(localMnemonic);
    }
    checkFullMnemonic();
  }, [localMnemonic]);

  // For each singular word update, check if verification is allowed and verify word
  const updateSingleWordVerification = (index: number, value: string, isValidWord: boolean) => {
    if (value === '') {
      setAllowValidation(prev => ({
        ...prev,
        [index]: false,
      }));
      setInputBorderColors(prev => ({
        ...prev,
        [index]: '',
      }));
    } else {
      setInputBorderColors(prev => ({
        ...prev,
        [index]: isValidWord ? 'border-success' : 'border-error',
      }));
      setAllowValidation(prev => ({
        ...prev,
        [index]: true,
      }));
    }
  };

  // Update allow validation status for specific index
  const checkVerifyStatus = (index: number, value: string) => {
    const isValidWord = validateWord(value, isVerifyMode ? index : undefined);
    updateSingleWordVerification(index, value, isValidWord);

    if (!allowValidation[index] && (isValidWord || value.length > 3)) {
      // Allow validation if word is valid or if word length exceeds 3
      setAllowValidation(prev => ({
        ...prev,
        [index]: true,
      }));
    }
  };

  const onChangeInput = (index: number, value: string) => {
    const trimmedValue = value.trim();

    setLocalMnemonic(prev => {
      const updated = [...prev];
      updated[index] = trimmedValue;
      return updated;
    });

    const isValid = validateWord(trimmedValue, isVerifyMode ? index : undefined);
    updateSingleWordVerification(index, value, isValid);

    checkVerifyStatus(index, trimmedValue);
    checkFullMnemonic();
  };

  const handlePaste = (userSelectIndex: number, pastedValue: string) => {
    const words = pastedValue.trim().split(/\s+/);
    let currentWordIndex = 0;

    // If pasting more words than available slots, start from index 0
    const maxNumSlots = isVerifyMode ? hiddenWordIndices.length : maxWords;
    const fillingAllSlots = words.length >= maxNumSlots;

    // Target indices start as the set of hidden indices or all indices
    let targetIndices = isVerifyMode
      ? hiddenWordIndices
      : Array.from({ length: maxWords }, (_, i) => i);
    // If not filling all slots, cut target indices to only relevant ones
    if (!fillingAllSlots) {
      const pasteStartIndex = targetIndices.indexOf(userSelectIndex);
      const numRemainingIndices = targetIndices.length - pasteStartIndex;
      targetIndices = targetIndices.slice(pasteStartIndex, pasteStartIndex + numRemainingIndices);
    }

    const pastedIndices: number[] = [];
    setLocalMnemonic(prev => {
      const updated = [...prev];
      for (let i = 0; i < targetIndices.length && currentWordIndex < words.length; i++) {
        const targetIndex = targetIndices[i];
        updated[targetIndex] = words[currentWordIndex++];
        pastedIndices.push(targetIndex);
      }

      updated.forEach((word, idx) => {
        if (pastedIndices.includes(idx)) {
          const isValid = validateWord(word, isVerifyMode ? idx : undefined);
          updateSingleWordVerification(idx, word, isValid);
        }
      });

      return updated;
    });

    checkFullMnemonic();
  };

  const handlePasteEvent = (index: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    // Extract the pasted text
    const pastedText = e.clipboardData.getData('text');

    // Call your custom handlePaste function
    handlePaste(index, pastedText);
  };

  const handleBlur = (index: number, value: string) => {
    const trimmedValue = value.trim();
    setIsFocused(null);

    const isValidWord = validateWord(trimmedValue, isVerifyMode ? index : undefined);
    updateSingleWordVerification(index, value, isValidWord);

    if (!isValidWord) {
      setMnemonicVerified(false);
    }

    checkFullMnemonic();
  };

  const handleFocus = (index: number) => setIsFocused(index);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      handleBlur(index, localMnemonic[index] || '');
    }
  };

  const bind = useDrag(
    ({ movement: [, my], memo = phraseBoxRef.current?.scrollTop || 0 }) => {
      if (isMouseDown && phraseBoxRef.current) {
        phraseBoxRef.current.scrollTop = memo - my;
      }
      return memo;
    },
    { filterTaps: true },
  );

  const handleMouseDown = () => setIsMouseDown(true);
  const handleMouseUp = () => setIsMouseDown(false);

  useEffect(() => {
    const resetDrag = () => setIsMouseDown(false);
    window.addEventListener('mouseup', resetDrag);
    return () => window.removeEventListener('mouseup', resetDrag);
  }, []);

  useLayoutEffect(() => {
    const handleScroll = () => {
      const el = phraseBoxRef.current;
      if (!el) return;

      const canScrollUp = el.scrollTop > 0;
      const canScrollDown = el.scrollTop + el.clientHeight < el.scrollHeight;

      const topShadow = canScrollUp ? 'inset 0 12px 10px -8px rgba(255, 255, 255, 0.8)' : '';
      const bottomShadow = canScrollDown ? 'inset 0 -12px 10px -8px rgba(255, 255, 255, 0.8)' : '';

      setShadow([topShadow, bottomShadow].filter(Boolean).join(', '));
    };

    const applyShadowWithDelay = () => {
      // Delay to ensure DOM fully updates before checking heights
      setTimeout(() => {
        const el = phraseBoxRef.current;
        if (!el) return;

        const canScrollDown = el.scrollHeight > el.clientHeight;
        setShadow(canScrollDown ? 'inset 0 -12px 10px -8px rgba(255, 255, 255, 0.8)' : '');
      }, 50);
    };

    const el = phraseBoxRef.current;
    el?.addEventListener('scroll', handleScroll);

    // Apply shadow after a slight delay to ensure proper layout
    applyShadowWithDelay();

    return () => el?.removeEventListener('scroll', handleScroll);
  }, [use24Words]);

  return (
    <>
      {/* 12 Words vs 24 Words selection */}
      {!isVerifyMode && !singleWordCount && (
        <div className="flex justify-center mt-5">
          <Button
            variant={!use24Words ? 'selected' : 'unselected'}
            onClick={() => setUse24Words(false)}
            className="ml-4"
          >
            12 Words
          </Button>
          <Button
            variant={use24Words ? 'selected' : 'unselected'}
            onClick={() => setUse24Words(true)}
          >
            24 Words
          </Button>
        </div>
      )}
      {singleWordCount && (
        <div className="flex justify-center mt-5">
          <p className="text-blue bg-transparent text-sm">{use24Words ? '24 ' : '12 '} Words</p>
        </div>
      )}
      <div className="mt-3 flex-1">
        <div className="w-full">
          <div
            ref={phraseBoxRef}
            className="overflow-auto min-h-[160px] max-h-[160px] border border-grey rounded-lg p-2.5 hide-scrollbar"
            style={{ boxShadow: shadow }}
            {...bind()}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          >
            <ul className="grid grid-cols-3 gap-y-3.5 gap-x-2.5">
              {localMnemonic.map((word, index) => (
                <li key={index} className="inline-flex items-center max-w-full">
                  <span className="mr-1 text-sm/[24px] text-white w-5 text-left">{index + 1}.</span>

                  {isEditable || (isVerifyMode && hiddenWordIndices.includes(index)) ? (
                    <Input
                      type="text"
                      onChange={e => onChangeInput(index, e.target.value)}
                      onPaste={handlePasteEvent(index)}
                      onBlur={() => handleBlur(index, localMnemonic[index])}
                      onFocus={() => handleFocus(index)}
                      onKeyDown={e => handleKeyDown(e, index)}
                      value={
                        isShown || isFocused === index
                          ? localMnemonic[index]
                          : localMnemonic[index]
                            ? '*****'
                            : ''
                      }
                      className={cn(
                        'border text-white text-sm rounded-3xl h-6 px-2 py-1 pb-[5px] w-full focus:outline-0 text-center',
                        inputBorderColors[index] ||
                          (isFocused === index ? 'border-blue' : 'border-gray-500'),
                      )}
                    />
                  ) : (
                    <Input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      className="border border-white text-white text-sm rounded-3xl h-6 px-2 py-1 pb-[5px] w-full focus:outline-0 text-center cursor-default"
                      value={isShown ? word : '*****'}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className={`flex ${isVerifyMode ? 'justify-center' : 'justify-between px-5'} mt-3`}>
            <Button variant="transparent" size="small" onClick={handleShowPhrase}>
              {isShown ? <EyeClose height={20} /> : <EyeOpen height={20} />}
              <span className="ml-2.5 text-base">{isShown ? 'Hide' : 'Show'} seed phrase</span>
            </Button>
            {!isVerifyMode && (
              <CopyTextField
                variant="text"
                displayText={'Copy to clipboard'}
                copyText={localMnemonic.join(' ')}
                iconHeight={20}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
