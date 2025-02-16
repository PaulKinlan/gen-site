import { Storage } from "@google-cloud/storage";
import {
  ImageMagick,
  initializeImageMagick,
  MagickGeometry,
} from "@imagemagick/magick-wasm";
import { ImageResizeOptions } from "@makemy/types.ts";

const BUCKET_NAME = Deno.env.get("USER_IMAGES_BUCKET") || "";
const storageAuth = JSON.parse(Deno.env.get("GOOGLE_CLOUD_KEY_FILE") || "{}");
const storage = new Storage({
  projectId: storageAuth.project_id,
  credentials: {
    type: "service_account",
    projectId: storageAuth.project_id,
    client_email: storageAuth.client_email,
    private_key: storageAuth.private_key,
  },
  keyFile: Deno.env.get("GOOGLE_CLOUD_KEY_FILE"),
});
const bucket = storage.bucket(BUCKET_NAME);

const wasm = await Deno.readFile(
  new URL("magick.wasm", import.meta.resolve("@imagemagick/magick-wasm"))
);
await initializeImageMagick(wasm);

const userImageCache = await caches.open("user-images");

export class StorageService {
  static async uploadImage(
    subdomain: string,
    imageId: string,
    data: Uint8Array,
    contentType: string,
    options?: ImageResizeOptions
  ): Promise<void> {
    let processedData = data;

    // Resize image if needed
    if (options?.width || options?.height) {
      const width = Math.min(options.width || 1568, 1568);
      const height = Math.min(options.height || 1568, 1568);
      const mode = "resize";

      const sizingData = new MagickGeometry(width, height);

      sizingData.greater = true; // only resize down, not up.

      const resized = await new Promise<Uint8Array>((resolve) => {
        ImageMagick.read(data, (image) => {
          if (mode === "resize") {
            image.resize(sizingData);
          } else {
            image.crop(sizingData);
          }
          image.write((data) => resolve(data));
        });
      });

      if (resized.length > 0) {
        processedData = resized;
      }
    }

    const file = bucket.file(`users/${subdomain}/${imageId}`);
    await file.save(processedData, {
      metadata: {
        contentType: "image/jpeg", // Always save as JPEG after processing
      },
    });

    // Cache the image in the user-images cache
    console.log("Caching user-image", subdomain, imageId);
    userImageCache.put(
      `https://users/${subdomain}/${imageId}`,
      new Response(processedData)
    );
  }

  static async downloadImage(
    subdomain: string,
    imageId: string
  ): Promise<Uint8Array | null> {
    try {
      const cachedImage = await userImageCache.match(
        `https://users/${subdomain}/${imageId}`
      );

      if (cachedImage) {
        console.log("Returning cached user-image", subdomain, imageId);
        return new Uint8Array(await cachedImage.arrayBuffer());
      }

      const file = bucket.file(`users/${subdomain}/${imageId}`);
      const [exists] = await file.exists();
      if (!exists) return null;

      const [data] = await file.download();
      return data;
    } catch (error) {
      console.error("Error downloading image:", error);
      return null;
    }
  }

  static async deleteImage(subdomain: string, imageId: string): Promise<void> {
    const file = bucket.file(`users/${subdomain}/${imageId}`);
    try {
      await file.delete();
    } catch (error: unknown) {
      // Ignore error if file doesn't exist
      if (error instanceof Error && "code" in error && error.code !== 404) {
        throw error;
      }
    }
  }

  static getImageUrl(subdomain: string, imageId: string): string {
    return `/api/user-images?id=${imageId}`;
  }
}
