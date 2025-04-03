interface Window {
  chrome?: typeof import('@types/chrome');
  browser?: typeof import('webextension-polyfill');
  // There are no types for Safari, so we have to write them here
  safari?: typeof import('webextension-polyfill') & {
    extension: (typeof import('webextension-polyfill'))['extension'] & {
      baseURI: string;
    };
  };
}
