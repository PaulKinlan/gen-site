import { BaseHandler } from "@makemy/routes/base.ts";
import { authenticated } from "@makemy/routes/decorators/authenticated.ts";
import { StorageService } from "@makemy/core/storage.ts";
import { db } from "@makemy/core/db.ts";
import { UserImage } from "@makemy/types.ts";
export default new (class extends BaseHandler {
  @authenticated({ redirect: "/login" })
  override async get(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const subdomain = url.searchParams.get("subdomain")?.toString();
    if (!subdomain) {
      return new Response("Subdomain required", { status: 400 });
    }
    const imageId = url.searchParams.get("id");
    if (imageId) {
      // Get specific image.
      const image = await db.getUserImage(subdomain, imageId);
      console.log(image);
      if (!image || image.subdomain !== subdomain) {
        return new Response("Image not found", { status: 404 });
      }

      // Get image data from storage
      const data = await StorageService.downloadImage(subdomain, image.id);
      if (!data) {
        return new Response("Image not found in storage", { status: 404 });
      }

      return new Response(data, {
        headers: {
          "Content-Type": image.mimeType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } else {
      // List all images
      const images = await db.getUserImages(subdomain);
      return new Response(JSON.stringify(images), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  @authenticated({ redirect: "/login" })
  override async post(req: Request): Promise<Response> {
    if (!req.extraInformation?.userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const formData = await req.formData();
      const file = formData.get("image") as File;
      const subdomain = formData.get("subdomain") as string;

      if (!file) {
        return new Response("No image provided", { status: 400 });
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        return new Response("Invalid file type", { status: 400 });
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        return new Response("File too large (max 10MB)", { status: 400 });
      }

      const imageId = crypto.randomUUID();
      const imageData = await file.arrayBuffer();

      // Store image metadata
      const image: UserImage = {
        id: imageId,
        subdomain: subdomain,
        filename: file.name,
        mimeType: file.type,
        createdAt: new Date(),
      };

      // Upload to storage with resizing
      await StorageService.uploadImage(
        subdomain,
        image.id,
        new Uint8Array(imageData),
        file.type,
        {
          width: 1568, // Always resize to max dimensions on upload
          height: 1568,
        }
      );

      // Save metadata after successful upload
      await db.saveUserImage(image);

      return new Response(JSON.stringify(image), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }

  @authenticated({ redirect: "/login" })
  override async delete(req: Request): Promise<Response> {
    if (!req.extraInformation?.userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const imageId = url.searchParams.get("id");
    const subdomain = url.searchParams.get("subdomain");

    if (!subdomain) {
      return new Response("Subdomain required", { status: 400 });
    }

    if (!imageId) {
      return new Response("Image ID required", { status: 400 });
    }

    try {
      const image = await db.getUserImage(subdomain, imageId);
      if (!image || image.subdomain !== subdomain) {
        return new Response("Image not found", { status: 404 });
      }

      // Delete from storage
      await StorageService.deleteImage(subdomain, image.id);

      // Delete metadata
      await db.deleteUserImage(subdomain, imageId);

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error("Error deleting image:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }
})();
