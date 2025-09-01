
import autoCert from "anchor-pki/auto-cert/integrations/next";

 //@ts-expect-error - No type definitions available for anchor-pki
const withAutoCert = autoCert({
  enabledEnv: "development",
});

const nextConfig = {};

export default withAutoCert(nextConfig);