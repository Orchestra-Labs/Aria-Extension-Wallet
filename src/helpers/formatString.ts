export const safeTrimLowerCase = (str: string | undefined): string => {
  return (str || '').trim().toLowerCase();
};

export const removeTrailingZeroes = (num: string | number): string => {
  const numberString = String(num);
  const cleanedNumber = parseFloat(numberString).toString();

  return cleanedNumber;
};

export function stripNonAlphanumerics(input: string): string {
  return input.replace(/[^a-z0-9]/gi, '');
}

// Helper function to remove all non-numeric characters (except decimal points)
export const stripNonNumerics = (value: string) => {
  return value.replace(/[^\d.]/g, '');
};

// Format the number with commas
export const formatNumberWithCommas = (value: string | number): string => {
  const stringValue = String(value);
  const [integerPart, decimalPart] = stringValue.split('.') || ['', ''];
  const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formattedNumber =
    decimalPart !== undefined ? `${formattedIntegerPart}.${decimalPart}` : formattedIntegerPart;

  return formattedNumber;
};

export const formatBalanceDisplay = (number: string, symbol: string): string => {
  // Remove non-numeric characters except for the decimal point
  const cleanedNumber = number.replace(/[^\d.]/g, '');

  // Separate integer part and fractional part (if any)
  const [integerPart, fractionalPart] = cleanedNumber.split('.');

  // Count total digits and calculate how many digits can be kept after the decimal
  const remainingDigits = 7 - integerPart.length;

  const returnInteger = integerPart.length >= 7 || !fractionalPart;
  // Combine integer and truncated fractional part to maintain up to 7 digits
  const stringToFormat = returnInteger
    ? integerPart
    : `${integerPart}.${fractionalPart.slice(0, remainingDigits)}`;

  const formattedAmount = formatNumberWithCommas(removeTrailingZeroes(stringToFormat));
  return `${formattedAmount} ${symbol}`;
};

export const formatLowBalanceDisplay = (number: string, symbol: string): string => {
  const num = parseFloat(number);

  console.log('Before formatting:', {
    rawNumber: number,
    parsedNumber: num,
    symbol,
  });

  if (num > 0 && num < 1) {
    return num.toFixed(4) + ' ' + symbol;
  } else if (num < 10) {
    return num.toFixed(2) + ' ' + symbol;
  }

  return formatBalanceDisplay(number, symbol);
};
