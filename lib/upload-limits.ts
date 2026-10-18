// Shared by the server (validation) and the browser (shrinking photos before upload).
// Vercel functions accept request bodies up to 4.5 MB, so uploads stay under 4 MB everywhere.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
