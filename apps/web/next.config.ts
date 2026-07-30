import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sms/db", "@sms/shared-types"],
};

export default nextConfig;
