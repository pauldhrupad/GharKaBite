import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

const cached = globalThis.mongooseConnection || { connection: null, promise: null };
globalThis.mongooseConnection = cached;

export default async function dbConnect() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (cached.connection) return cached.connection;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
  }

  try {
    cached.connection = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.connection;
}
