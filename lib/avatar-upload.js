const types = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatar(user, file) {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) throw new Error("Profile photo uploads are not configured.");
  if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024 || !types.includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP photo under 2 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!((file.type === "image/jpeg" && jpeg) || (file.type === "image/png" && png) || (file.type === "image/webp" && webp))) {
    throw new Error("The photo file is invalid.");
  }

  const upload = new FormData();
  upload.set("file", new Blob([bytes], { type: file.type }), "profile-avatar");
  upload.set("folder", "gharkabite/avatars");
  upload.set("public_id", String(user._id));
  upload.set("overwrite", "true");
  upload.set("invalidate", "true");
  upload.set("unique_filename", "false");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
    body: upload,
  });
  if (!response.ok) throw new Error("Profile photo upload failed.");
  const result = await response.json();
  if (result.public_id !== `gharkabite/avatars/${user._id}` || typeof result.secure_url !== "string" || !result.secure_url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`)) {
    throw new Error("Profile photo upload failed.");
  }
  user.avatarUrl = result.secure_url;
  await user.save();
  return user.avatarUrl;
}
