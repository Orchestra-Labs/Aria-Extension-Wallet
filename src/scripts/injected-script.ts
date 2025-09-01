import { Aria } from '@/providers/wallet/core';
import { injectAriaToWindow } from '@/providers/wallet/inject';

const aria = new Aria();
console.log('INJECT: ARIA DEFINE');
injectAriaToWindow(aria);
