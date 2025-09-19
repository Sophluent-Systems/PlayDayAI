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
    return config;
  },
};
