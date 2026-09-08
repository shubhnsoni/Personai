import { handleImageTo3dPost } from "./handler"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request): Promise<Response> {
  return handleImageTo3dPost(request)
}
