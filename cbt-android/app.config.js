module.exports = ({ config }) => ({
  ...config,
  name: 'CBT Android',
  slug: 'cbt-android',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'cbt-android',
  plugins: [
    'expo-router',
    'expo-status-bar'
  ],
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID
    }
  }
});