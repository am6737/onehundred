import { ExpoConfig, ConfigContext } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

const config: ExpoConfig = {
  name: IS_DEV ? "一百件事(Dev)" : "yibai",
  slug: "100moments",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  scheme: IS_DEV ? "100moments-dev" : "100moments",
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
  extra: {
    eas: {
      projectId: "068f5c93-dfff-445c-ba00-cb1fed6c4598",
    },
  },
};

export default config;
