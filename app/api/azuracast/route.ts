import { services } from "@/server/container";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const { auth, broadcast } = services();
  if (!(await auth.currentUser())) return json({ error: "authentication_required" }, 401);
  const { httpStatus, body } = await broadcast.status();
  return json(body, httpStatus);
}
