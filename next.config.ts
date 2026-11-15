import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The OCR engine and the Thai model are byte-identical for a given
        // release and add up to ~2.3 MB, so a seller should download them once
        // and never revalidate them again.
        source: "/ocr/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
