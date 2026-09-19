// DooPush currently installs its iOS SDK and AppDelegate subscriber whenever
// the upstream plugin runs. Keep the native integration Android-only so iOS
// launch does not let the push SDK replace UNUserNotificationCenter.delegate.
const { validatePluginConfig } = require("doopush-react-native-sdk/plugin/build/schema");
const { withAndroid } = require("doopush-react-native-sdk/plugin/build/android/withAndroid");

module.exports = function withDooPushAndroid(config, options) {
  return withAndroid(config, validatePluginConfig(options));
};
