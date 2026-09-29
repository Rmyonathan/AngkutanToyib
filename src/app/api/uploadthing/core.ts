import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getCurrentSession } from "@/lib/auth/session";
import { canSubmitFieldDocs } from "@/lib/auth/rbac";

const f = createUploadthing();

/**
 * UploadThing file router — field document photos from Supir / Admin.
 * Requires UPLOADTHING_TOKEN in .env (https://uploadthing.com/dashboard).
 * When token is missing, the UI falls back to /api/upload/local.
 */
export const ourFileRouter = {
  fieldDocUploader: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await getCurrentSession();
      if (!session?.user?.id || !canSubmitFieldDocs(session.user.role)) {
        throw new Error("Unauthorized");
      }
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      const url = file.ufsUrl ?? file.url;
      return { url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
