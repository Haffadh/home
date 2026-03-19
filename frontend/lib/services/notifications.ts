import { getSupabase } from "../supabaseClient";

export type NotificationType =
  | "urgent"
  | "reminder"
  | "expiration"
  | "completed"
  | "skipped"
  | "inventory_audit_due"
  | "device_health";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export type NotificationInsert = {
  type: NotificationType;
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
};

export async function fetchNotifications(unreadOnly?: boolean): Promise<NotificationRow[]> {
  const supabase = getSupabase();
  let q = supabase.from("notifications").select("*").order("created_at", { ascending: false });
  if (unreadOnly) q = q.eq("read", false);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationRow[];
}

export async function createNotification(row: NotificationInsert): Promise<NotificationRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      type: row.type,
      title: row.title,
      body: row.body ?? null,
      read: false,
      entity_type: row.entity_type ?? null,
      entity_id: row.entity_id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as NotificationRow;
}

export async function markNotificationRead(id: string): Promise<NotificationRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("notifications").update({ read: true }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as NotificationRow;
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("notifications").update({ read: true }).eq("read", false);
}
