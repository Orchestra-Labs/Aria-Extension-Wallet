import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getValidFeeDenom } from '@/helpers/feeDenom';
import { queryRpcNode } from '@/helpers/queryNodes';
import * as transactionModule from '@/helpers/sendTransactions';

vi.mock('@/helpers/queryNodes', () => ({
  queryRpcNode: vi.fn(),
}));

vi.mock('@/helpers/feeDenom', () => ({
  getValidFeeDenom: vi.fn(),
}));

describe('sendTransactions helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidSend', () => {
    it('returns true when denoms match', () => {
      const sendAsset = { denom: 'tokenA' };
      const receiveAsset = { denom: 'tokenA' };
      expect(transactionModule.isValidSend({ sendAsset, receiveAsset })).toBe(true);
    });

    it('returns false when denoms differ', () => {
      const sendAsset = { denom: 'tokenA' };
      const receiveAsset = { denom: 'tokenB' };
      expect(transactionModule.isValidSend({ sendAsset, receiveAsset })).toBe(false);
    });
  });

  describe('sendTransaction', () => {
    it('calls queryRpcNode and returns success on success', async () => {
      (getValidFeeDenom as any).mockReturnValue('tokenA');
      (queryRpcNode as any).mockResolvedValue({ txHash: 'ABC123', code: 0 });

      const fromAddress = 'addr1';
      const sendObject = {
        recipientAddress: 'addr2',
        denom: 'tokenA',
        amount: '100',
        symphonyAssets: [],
      };

      const result = await transactionModule.sendTransaction(fromAddress, sendObject);

      expect(getValidFeeDenom).toHaveBeenCalledWith('tokenA', []);
      expect(queryRpcNode).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Transaction sent successfully!');
      expect(result.data.txHash).toBe('ABC123');
    });

    it('returns success with simulation flag', async () => {
      (getValidFeeDenom as any).mockReturnValue('tokenA');
      (queryRpcNode as any).mockResolvedValue({ gasWanted: '1000', code: 0 });

      const fromAddress = 'addr1';
      const sendObject = {
        recipientAddress: 'addr2',
        denom: 'tokenA',
        amount: '50',
        symphonyAssets: [],
      };

      const result = await transactionModule.sendTransaction(fromAddress, sendObject, true);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Simulation completed successfully!');
      expect(result.data.gasWanted).toBe('1000');
    });

    it('returns failure object on error', async () => {
      (getValidFeeDenom as any).mockReturnValue('tokenA');
      const error = new Error('Test error');
      (queryRpcNode as any).mockRejectedValue(error);

      const fromAddress = 'addr1';
      const sendObject = {
        recipientAddress: 'addr2',
        denom: 'tokenA',
        amount: '100',
        symphonyAssets: [],
      };

      const result = await transactionModule.sendTransaction(fromAddress, sendObject);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error sending transaction. Please try again.');
      expect(result.data.message).toBe('Test error');
    });
  });

  describe('multiSendTransaction', () => {
    it('calls queryRpcNode and returns success on multiple sends', async () => {
      (getValidFeeDenom as any).mockReturnValue('tokenA');
      (queryRpcNode as any).mockResolvedValue({ txHash: 'MULTI123', code: 0 });

      const fromAddress = 'addr1';
      const sendObjects = [
        {
          recipientAddress: 'addr2',
          denom: 'tokenA',
          amount: '100',
          symphonyAssets: [],
        },
        {
          recipientAddress: 'addr3',
          denom: 'tokenA',
          amount: '200',
          symphonyAssets: [],
        },
      ];

      const result = await transactionModule.multiSendTransaction(fromAddress, sendObjects);

      expect(getValidFeeDenom).toHaveBeenCalledWith('tokenA', []);
      expect(queryRpcNode).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Transactions sent successfully to all recipients!');
      expect(result.data.txHash).toBe('MULTI123');
    });

    it('returns success with simulation flag for multi-send', async () => {
      (getValidFeeDenom as any).mockReturnValue('tokenA');
      (queryRpcNode as any).mockResolvedValue({ gasWanted: '2000', code: 0 });

      const fromAddress = 'addr1';
      const sendObjects = [
        {
          recipientAddress: 'addr2',
          denom: 'tokenA',
          amount: '100',
          symphonyAssets: [],
        },
      ];

      const result = await transactionModule.multiSendTransaction(fromAddress, sendObjects, true);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Simulation of multi-send completed successfully!');
      expect(result.data.gasWanted).toBe('2000');
    });

    it('returns failure on error during multi-send', async () => {
      (getValidFeeDenom as any).mockReturnValue('tokenA');
      const error = new Error('Multi-send error');
      (queryRpcNode as any).mockRejectedValue(error);

      const fromAddress = 'addr1';
      const sendObjects = [
        {
          recipientAddress: 'addr2',
          denom: 'tokenA',
          amount: '100',
          symphonyAssets: [],
        },
      ];

      const result = await transactionModule.multiSendTransaction(fromAddress, sendObjects);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error sending transactions. Please try again.');
      expect(result.data.message).toBe('Multi-send error');
    });
  });
});
