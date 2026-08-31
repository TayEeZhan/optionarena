import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The Thetanuts SDK and ethers are server-only. Keeping them external stops
  // the bundler from pulling them into the browser, where the signer must
  // never go. See docs/decisions.md.
  serverExternalPackages: ['@thetanuts-finance/thetanuts-client', 'ethers'],
};

export default nextConfig;
