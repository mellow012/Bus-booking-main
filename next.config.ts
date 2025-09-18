import autoCert from "anchor-pki/auto-cert/integrations/next";

const withAutoCert = autoCert({
  enabledEnv: "development", // Only enable in development
});

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Temporarily disable ESLint during builds
  },
};

export default process.env.NODE_ENV === "development" ? withAutoCert(nextConfig) : nextConfig;