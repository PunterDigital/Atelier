import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (docker-compose
  // self-host is a first-class target).
  output: "standalone",
};

export default nextConfig;
