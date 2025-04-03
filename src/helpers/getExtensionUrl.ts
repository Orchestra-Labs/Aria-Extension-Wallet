const getExtensionBaseUrl = (): string => {
  if ('chrome' in window) {
    return window.chrome?.runtime.getURL('index.html');
  }
  if ('browser' in window) {
    return window.browser?.runtime.getURL('index.html') as string;
  }
  if ('safari' in window) {
    return window.safari?.extension.baseURI as string;
  }
  return window.location.origin;
};

export const getExtensionUrl = (pathname: string = '/') => {
  const baseUrl = getExtensionBaseUrl();
  const url = new URL('index.html', baseUrl);
  url.hash = pathname;
  return url;
};
