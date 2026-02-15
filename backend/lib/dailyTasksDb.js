/**
 * Daily tasks DB layer: materialize instances and CRUD.
 * Date strings are YYYY-MM-DD (interpreted in task timezone for recurrence; API passes calendar date).
 */

function parseDateOnly(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : str;
}

function dayOfWeekForDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.getUTCDay();
}

export async function ensureInstancesForDate(db, staffUserId, dateStr) {
  const date = parseDateOnly(dateStr);
  if (!date) return;

  const { rows: tasks } = await db.query(
    `SELECT id, recurrence, recurrence_days, start_date, end_date
     FROM daily_tasks
     WHERE staff_user_id = $1 AND is_active = true
       AND start_date <= $2
       AND (end_date IS NULL OR end_date >= $2)`,
    [staffUserId, date]
  );

  const day = dayOfWeekForDate(date);

  for (const t of tasks) {
    let shouldHave = false;
    if (t.recurrence === "none") {
      shouldHave = t.start_date === date;
    } else if (t.recurrence === "daily") {
      shouldHave = true;
    } else if (t.recurrence === "weekly" && Array.isArray(t.recurrence_days)) {
      shouldHave = t.recurrence_days.includes(day);
    }

    if (!shouldHave) continue;

    await db.query(
      `INSERT INTO daily_task_instances (task_id, due_date, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (task_id, due_date) DO NOTHING`,
      [t.id, date]
    );
  }
}

export async function getTasksWithInstances(db, staffUserId, dateStr) {
  const date = parseDateOnly(dateStr);
  if (!date) return { tasks: [], staffUserId, date: null };

  await ensureInstancesForDate(db, staffUserId, date);

  const { rows: tasks } = await db.query(
    `SELECT id, staff_user_id, title, notes, window_start, window_end, timezone,
            recurrence, recurrence_days, start_date, end_date, is_active, created_at, updated_at
     FROM daily_tasks
     WHERE staff_user_id = $1 AND is_active = true
       AND start_date <= $2 AND (end_date IS NULL OR end_date >= $2)
     ORDER BY window_start, id`,
    [staffUserId, date]
  );

  const day = dayOfWeekForDate(date);
  const taskIds = tasks.map((t) => t.id);

  if (taskIds.length === 0) {
    return { tasks: [], staffUserId, date };
  }

  const { rows: instances } = await db.query(
    `SELECT id, task_id, due_date, status, completed_at, created_at
     FROM daily_task_instances
     WHERE task_id = ANY($1) AND due_date = $2`,
    [taskIds, date]
  );

  const instanceByTaskId = {};
  for (const i of instances) instanceByTaskId[i.task_id] = i;

  const filtered = tasks.filter((t) => {
    if (t.recurrence === "none") return t.start_date === date;
    if (t.recurrence === "daily") return true;
    if (t.recurrence === "weekly" && Array.isArray(t.recurrence_days)) return t.recurrence_days.includes(day);
    return false;
  });

  const result = filtered.map((t) => ({
    ...t,
    instance: instanceByTaskId[t.id] || null,
  }));

  return { tasks: result, staffUserId, date };
}

export async function createDailyTask(db, payload) {
  const {
    staff_user_id,
    title,
    notes = "",
    window_start,
    window_end,
    timezone = "Asia/Bahrain",
    recurrence = "none",
    recurrence_days = null,
    start_date,
    end_date = null,
  } = payload;

  const { rows } = await db.query(
    `INSERT INTO daily_tasks (
      staff_user_id, title, notes, window_start, window_end, timezone,
      recurrence, recurrence_days, start_date, end_date, is_active, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, now())
    RETURNING *`,
    [
      staff_user_id,
      title,
      notes,
      window_start,
      window_end,
      timezone,
      recurrence,
      recurrence_days && recurrence_days.length ? recurrence_days : null,
      start_date,
      end_date || null,
    ]
  );
  return rows[0];
}

export async function updateDailyTask(db, id, payload) {
  const allowed = [
    "title",
    "notes",
    "window_start",
    "window_end",
    "timezone",
    "recurrence",
    "recurrence_days",
    "start_date",
    "end_date",
    "is_active",
  ];
  const fields = [];
  const values = [];
  let i = 1;
  for (const key of allowed) {
    if (!(key in payload)) continue;
    const v = payload[key];
    if (key === "recurrence_days") {
      fields.push(`recurrence_days = $${i++}`);
      values.push(v && Array.isArray(v) && v.length ? v : null);
    } else if (key === "is_active") {
      fields.push(`is_active = $${i++}`);
      values.push(Boolean(v));
    } else if (["title", "notes", "timezone"].includes(key)) {
      fields.push(`${key} = $${i++}`);
      values.push(v != null ? String(v) : null);
    } else if (["window_start", "window_end"].includes(key)) {
      fields.push(`${key} = $${i++}`);
      values.push(v != null ? String(v) : null);
    } else if (key === "recurrence") {
      fields.push(`recurrence = $${i++}`);
      values.push(v != null ? String(v) : "none");
    } else if (["start_date", "end_date"].includes(key)) {
      fields.push(`${key} = $${i++}`);
      values.push(v || null);
    }
  }
  if (fields.length === 0) return null;
  fields.push("updated_at = now()");
  values.push(id);
  const { rows } = await db.query(
    `UPDATE daily_tasks SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function getDailyTaskById(db, id) {
  const { rows } = await db.query("SELECT * FROM daily_tasks WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function completeInstance(db, taskId, dateStr) {
  const date = parseDateOnly(dateStr);
  if (!date) return null;
  const task = await getDailyTaskById(db, taskId);
  if (!task) return null;
  await ensureInstancesForDate(db, task.staff_user_id, date);

  const { rows } = await db.query(
    `UPDATE daily_task_instances
     SET status = 'done', completed_at = now()
     WHERE task_id = $1 AND due_date = $2
     RETURNING *`,
    [taskId, date]
  );
  if (rows[0]) return rows[0];
  const { rows: inserted } = await db.query(
    `INSERT INTO daily_task_instances (task_id, due_date, status, completed_at)
     VALUES ($1, $2, 'done', now())
     ON CONFLICT (task_id, due_date) DO UPDATE SET status = 'done', completed_at = now()
     RETURNING *`,
    [taskId, date]
  );
  return inserted[0] || null;
}

export async function skipInstance(db, taskId, dateStr) {
  const date = parseDateOnly(dateStr);
  if (!date) return null;
  const task = await getDailyTaskById(db, taskId);
  if (!task) return null;
  await ensureInstancesForDate(db, task.staff_user_id, date);

  const { rows } = await db.query(
    `UPDATE daily_task_instances
     SET status = 'skipped'
     WHERE task_id = $1 AND due_date = $2
     RETURNING *`,
    [taskId, date]
  );
  if (rows[0]) return rows[0];
  const { rows: inserted } = await db.query(
    `INSERT INTO daily_task_instances (task_id, due_date, status)
     VALUES ($1, $2, 'skipped')
     ON CONFLICT (task_id, due_date) DO UPDATE SET status = 'skipped'
     RETURNING *`,
    [taskId, date]
  );
  return inserted[0] || null;
}
