
/*
import autoCert from "anchor-pki/auto-cert/integrations/next";

const withAutoCert = autoCert({
  enabledEnv: "development", // Only enable in development
});

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Temporarily disable ESLint during builds
  },
  webpack(config) {
    // Exclude the functions directory from the build
    config.resolve.modules.push(__dirname + '/functions');
    config.plugins.push(
      new (require('webpack').IgnorePlugin)({
        resourceRegExp: /^\.\/functions\/.*$/,
      })
    );
    return config;
  },
};

export default process.env.NODE_ENV === "development" ? withAutoCert(nextConfig) : nextConfig;
*/
import type { Configuration } from 'webpack';

const nextConfig = {
  eslint: {
    // Temporarily disable ESLint during builds to bypass current issues
    ignoreDuringBuilds: true, 
  },
  webpack(config: Configuration) {
    // --- FIX STARTS HERE ---

    // 1. Safely initialize config.resolve if it's undefined
    if (!config.resolve) {
      config.resolve = {};
    }
    // 2. Safely initialize config.resolve.modules if it's undefined
    if (!config.resolve.modules) {
      config.resolve.modules = [];
    }
    // Now it's safe to push to the modules array
    config.resolve.modules.push(__dirname + '/functions');

    // 3. Safely initialize config.plugins for good practice
    if (!config.plugins) {
        config.plugins = [];
    }
    // Now it's safe to push to the plugins array
    config.plugins.push(
      new (require('webpack').IgnorePlugin)({
        resourceRegExp: /^\.\/functions\/.*$/,
      })
    );

    // --- FIX ENDS HERE ---

    return config;
  },
};

export default nextConfig;