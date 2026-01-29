/// <reference types="miniprogram-api-typings" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo;
    /** 罗马柱拼柱状态 */
    columnBuildState?: import('../miniprogram/types/column').ColumnBuildState;
    /** 罗马柱方案结果 */
    columnSchemeResult?: import('../miniprogram/types/column').GenerateSchemeResponse;
  };
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback;
}
