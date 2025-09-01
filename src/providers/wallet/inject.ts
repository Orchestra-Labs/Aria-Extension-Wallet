import { Aria } from './types/aria';

function defineUnwritableProperty<T, U>(object: T, property: string, value: U) {
  const descriptor = Object.getOwnPropertyDescriptor(object, property);
  if (descriptor && !descriptor.configurable) {
    /*eslint-disable no-console*/
    console.warn(`Cannot redefine non-configurable property '${property}'.`);
    return false;
  }
  Object.defineProperty(object, property, {
    value: value,
    writable: false,
  });
  return true;
}

export function injectAriaToWindow(value: Aria): void {
  console.log('INJECT: start');
  defineUnwritableProperty<Window, Aria>(window, 'aria', value);
}
