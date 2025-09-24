// utils/cloudinary.js
export async function uploadToCloudinary(file) {
  if (!file) throw new Error("No file provided")

  const formData = new FormData()
  formData.append("file", file)
  formData.append(
    "upload_preset",
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  )

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  )

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || "Upload failed")

  return data.secure_url // ✅ ye URL backend/database me save hoga
}
