import path from "path";

export default {
  reactStrictMode: true,
  output: "standalone",
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};
    config.resolve.alias["next/router"] = path.resolve("./packages/shared/src/client/nextRouterShim.js");
    config.resolve.alias["@src"] = path.resolve("./packages/shared/src");
    config.resolve.alias["@components"] = path.resolve("./packages/shared/src/client/components");

    const vadOnnxRuntimeWarningPattern = /onnxruntime-web[\\/]+dist[\\/]ort\.min\.js/;

    config.ignoreWarnings = config.ignoreWarnings ?? [];
    config.ignoreWarnings.push({
      module: vadOnnxRuntimeWarningPattern,
      message: /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
    });

    const existingNoParse = config.module?.noParse;
    if (Array.isArray(existingNoParse)) {
      existingNoParse.push(vadOnnxRuntimeWarningPattern);
    } else {
      config.module = config.module ?? {};
      config.module.noParse = existingNoParse
        ? [existingNoParse, vadOnnxRuntimeWarningPattern]
        : [vadOnnxRuntimeWarningPattern];
    }

    return config;
  },
};
