/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: process.env.CLOUDINARY_CLOUD_NAME ? [{ protocol: "https", hostname: "res.cloudinary.com", pathname: `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/**` }] : [],
  },
};

export default nextConfig;
