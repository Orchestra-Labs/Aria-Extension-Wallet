interface Window {
  aria?: {
    connect: (uri: string) => Promise<void>;
    openExtension: (pathname?: string) => Promise<void>;
    signTransaction: () => Promise<void>;
  };
}
