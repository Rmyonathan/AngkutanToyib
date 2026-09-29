/** True when UploadThing server token is configured (Railway / production). */
export function isUploadThingConfigured(): boolean {
  return Boolean(process.env.UPLOADTHING_TOKEN?.trim());
}
