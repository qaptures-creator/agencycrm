import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Document uploads (client Documents tab) are a Server Action taking a
    // raw file up to 4MB per the UI's own copy; Next's default 1MB body
    // limit was silently rejecting anything bigger, surfacing to the
    // browser as a generic "Failed to fetch". Padded past 4MB for
    // multipart/form-data boundary overhead.
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
