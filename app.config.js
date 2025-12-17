const appJson = require('./app.json');

module.exports = ({ config }) => {
  const baseConfig = appJson && appJson.expo ? appJson.expo : (config || {});
  const extra = baseConfig && baseConfig.extra ? baseConfig.extra : {};

  const gitCommitHash =
    process.env.EAS_BUILD_GIT_COMMIT_HASH ||
    process.env.EXPO_PUBLIC_GIT_SHA ||
    process.env.GIT_COMMIT_HASH ||
    '';

  return {
    ...baseConfig,
    extra: {
      ...extra,
      gitCommitHash,
    },
  };
};
