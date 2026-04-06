declare namespace WechatMiniprogram {
  interface DeviceInfoCompat {
    benchmarkLevel?: number;
    platform?: string;
  }

  interface RequirePrivacyAuthorizeOptionCompat {
    complete?: () => void;
    fail?: (error: { errMsg?: string }) => void;
    success?: (result?: unknown) => void;
  }

  interface OpenPrivacyContractOptionCompat {
    complete?: () => void;
    fail?: (error?: unknown) => void;
    success?: (result?: unknown) => void;
  }

  interface Wx {
    getDeviceInfo?: () => DeviceInfoCompat;
    onNeedPrivacyAuthorization?: (
      callback: (resolve: (buttonId?: string) => void) => void
    ) => void;
    openPrivacyContract?: (
      options?: OpenPrivacyContractOptionCompat
    ) => void;
    requirePrivacyAuthorize?: (
      options: RequirePrivacyAuthorizeOptionCompat
    ) => void;
  }
}
