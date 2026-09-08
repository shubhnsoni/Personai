import { constants } from "node:fs"
import { lstat, open, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"

export function bundledUploadsDirectory(cwd = process.cwd()): string {
    return resolve(cwd, "public", "uploads")
}

/** Relative configuration is resolved against the app's working directory. */
export function uploadsDirectory(configured = process.env.UPLOADS_DIR, cwd = process.cwd()): string {
    return configured?.trim() ? resolve(cwd, configured.trim()) : bundledUploadsDirectory(cwd)
}

export function uploadReadDirectories(): string[] {
    return [...new Set([uploadsDirectory(), bundledUploadsDirectory()])]
}

export function validUploadSegments(segments: readonly string[]): boolean {
    return segments.length > 0 && segments.every((segment) => (
        /^[a-z0-9_-][a-z0-9._-]*$/i.test(segment)
        && !segment.endsWith(".")
        && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)
    ))
}

function inside(root: string, candidate: string): boolean {
    const path = relative(root, candidate)
    return Boolean(path) && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

function missingUpload(): Error & { code: string } {
    return Object.assign(new Error("Upload not found"), { code: "ENOENT" })
}

async function openUploadFile(segments: readonly string[], directory: string) {
    if (!validUploadSegments(segments)) throw missingUpload()
    const root = resolve(directory)
    const rootStat = await lstat(root)
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw missingUpload()
    const realRoot = await realpath(root)
    const candidate = resolve(root, ...segments)
    if (!inside(root, candidate)) throw missingUpload()

    // Reject links in every component, including Windows directory junctions.
    let current = root
    for (const segment of segments) {
        current = resolve(current, segment)
        if ((await lstat(current)).isSymbolicLink()) throw missingUpload()
    }
    const realFile = await realpath(candidate)
    if (!inside(realRoot, realFile)) throw missingUpload()
    const checkedStat = await lstat(realFile)
    if (!checkedStat.isFile() || checkedStat.isSymbolicLink()) throw missingUpload()

    const file = await open(realFile, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    try {
        const stat = await file.stat()
        // Pin the checked file to its descriptor and refuse a replaced path.
        if (!stat.isFile() || stat.dev !== checkedStat.dev || stat.ino !== checkedStat.ino) throw missingUpload()
        if (!inside(realRoot, await realpath(candidate))) throw missingUpload()
        return { file, stat }
    } catch (error) {
        await file.close()
        throw error
    }
}

/** Prefer persisted assets, then allow committed assets from the build. */
export async function openStoredUploadFile(segments: readonly string[], directories = uploadReadDirectories()) {
    for (const directory of directories) {
        try {
            return await openUploadFile(segments, directory)
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code
            if (code !== "ENOENT" && code !== "ENOTDIR") throw error
        }
    }
    throw missingUpload()
}

export async function readUploadedFile(segments: readonly string[], directories = uploadReadDirectories()): Promise<Buffer> {
    const { file } = await openStoredUploadFile(segments, directories)
    try {
        return await file.readFile()
    } finally {
        await file.close()
    }
}
