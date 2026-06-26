import { ExpoConfig, ConfigContext } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

const DOOPUSH_APP_ID = IS_DEV
  ? process.env.EXPO_PUBLIC_DOOPUSH_APP_ID_DEV
  : process.env.EXPO_PUBLIC_DOOPUSH_APP_ID;
const DOOPUSH_API_KEY = IS_DEV
  ? process.env.EXPO_PUBLIC_DOOPUSH_API_KEY_DEV
  : process.env.EXPO_PUBLIC_DOOPUSH_API_KEY;

const config: ExpoConfig = {
  name: IS_DEV ? "一百件事(Dev)" : "一百件事",
  slug: "yibai",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  scheme: IS_DEV ? "moments100-dev" : "moments100",
  ios: {
    supportsTablet: true,
    bundleIdentifier: IS_DEV ? "com.hitosea.moments100.dev" : "com.hitosea.moments100",
    usesAppleSignIn: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#FFF5EE",
      foregroundImage: "./assets/android-icon-foreground.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    permissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    ],
    package: IS_DEV ? "com.hitosea.moments100.dev" : "com.hitosea.moments100",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-font",
    [
      "expo-image-picker",
      {
        photosPermission:
          "允许「一百件事」访问你的照片，把这些珍贵的瞬间留下来。",
        cameraPermission:
          "允许「一百件事」使用相机，拍下这个值得记住的时刻。",
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission:
          "允许「一百件事」使用麦克风，录下你想对孩子说的话。",
      },
    ],
    "expo-video",
    "expo-sharing",
    [
      "expo-media-library",
      {
        photosPermission:
          "允许「一百件事」访问你的照片，把这些珍贵的瞬间留下来。",
        savePhotosPermission:
          "允许「一百件事」把这一页存成图片，保存到你的相册里。",
        isAccessMediaLocationEnabled: false,
      },
    ],
    "expo-localization",
    "expo-asset",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFF5EE",
        image: "./assets/splash-icon.png",
        imageWidth: 180,
      },
    ],
    "expo-system-ui",
  ],
  locales: {
    zh: "./lang/zh.json",
    en: "./lang/en.json",
  },
  extra: {
    eas: {
      projectId: "068f5c93-dfff-445c-ba00-cb1fed6c4598",
    },
    // 把按环境选好的 DooPush 凭据带到运行时（APP_VARIANT 不会进 JS bundle）
    doopush: {
      appId: DOOPUSH_APP_ID,
      apiKey: DOOPUSH_API_KEY,
    },
  },
};

// DooPush 插件要求 appId/apiKey 必填。构建时这些值由 EAS 环境变量注入，
// 但在 eas env:push 等引导阶段尚未就绪——缺失时跳过插件以免 config 解析失败。
if (DOOPUSH_APP_ID && DOOPUSH_API_KEY) {
  config.plugins!.push([
    "doopush-react-native-sdk",
    {
      appId: DOOPUSH_APP_ID,
      apiKey: DOOPUSH_API_KEY,
      baseURL: "https://doopush.com/api/v1",
      ios: {
        mode: IS_DEV ? "development" : "production",
      },
    },
  ]);
}

export default config;
