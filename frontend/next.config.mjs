/** @type {import('next').NextConfig} */
const canonicalHost = (process.env.NEXT_PUBLIC_CANONICAL_HOST || "").trim();
const enforceCanonical = canonicalHost.length > 0;
const wwwHost = canonicalHost.startsWith("www.") ? canonicalHost : `www.${canonicalHost}`;
const bareHost = canonicalHost.startsWith("www.") ? canonicalHost.replace(/^www\./, "") : canonicalHost;

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    if (!enforceCanonical) return [];
    if (process.env.NODE_ENV !== "production") return [];
    const sourceHost = canonicalHost.startsWith("www.") ? bareHost : wwwHost;
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: sourceHost }],
        destination: `https://${canonicalHost}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
