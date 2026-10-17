import { requireUser } from "@/lib/auth";
import { guard, json } from "@/lib/api";
import { getDb, logActivity } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { createShare, getShare, revokeShare } from "@/lib/shares";

async function ownedProject(userId: string, id: string) {
  const row = getDb()
    .prepare("SELECT id, name FROM projects WHERE id = ? AND user_id = ?")
    .get(id, userId) as { id: string; name: string } | undefined;
  if (!row) throw new ApiError(404, "Project not found.");
  return row;
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    await ownedProject(user.id, id);
    return json({ share: getShare(user.id, id) });
  });
}

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const project = await ownedProject(user.id, id);
    const existing = getShare(user.id, id);
    const share = createShare(user.id, id);
    if (!existing) logActivity(user.id, "share", `Published ${project.name}`, id);
    return json({ share }, existing ? 200 : 201);
  });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const project = await ownedProject(user.id, id);
    revokeShare(user.id, id);
    logActivity(user.id, "share", `Unpublished ${project.name}`, id);
    return json({ ok: true });
  });
}
