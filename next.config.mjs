import path from "path";

export default {
  reactStrictMode: true,
  output: "standalone",
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};
    config.resolve.alias["next/router"] = path.resolve("./src/client/nextRouterShim.js");
    return config;
  },
};
