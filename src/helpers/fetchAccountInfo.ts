import { Uri } from '@/types';

export const getAccountInfo = async (
  address: string,
  restUris: Uri[],
): Promise<{ accountNumber: bigint; sequence: bigint }> => {
  for (const restUri of restUris) {
    try {
      const response = await fetch(`${restUri.address}/cosmos/auth/v1beta1/accounts/${address}`);
      if (response.ok) {
        const data = await response.json();
        const account = data.account;

        if (account['@type'] === '/cosmos.auth.v1beta1.BaseAccount') {
          return {
            accountNumber: BigInt(account.account_number),
            sequence: BigInt(account.sequence),
          };
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch account info from ${restUri.address}:`, error);
    }
  }

  throw new Error('Failed to fetch account information from any REST endpoint');
};
