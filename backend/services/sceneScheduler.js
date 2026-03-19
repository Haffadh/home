/**
 * Scene scheduler: runs scenes automatically when their schedule matches current time and day.
 * Uses a 60s interval. Designed for future triggers: sunset, sunrise, location (schedule.type).
 */

import * as sceneService from "./sceneService.js";

const CHECK_INTERVAL_MS = 60_000;
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Normalize "9:30" or "22:30" to "HH:mm" for comparison */
function toHHmm(str) {
  if (typeof str !== "string") return "";
  const parts = str.trim().split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getCurrentHHmm() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getCurrentDayName() {
  return DAY_NAMES[new Date().getDay()];
}

/**
 * Returns true if schedule matches current time and day.
 * Schedule: { enabled, time "HH:mm", daysOfWeek ["mon",...] }.
 * Future: schedule.type "sunset" | "sunrise" | "location" can be checked here.
 */
function scheduleMatchesNow(schedule) {
  if (!schedule || schedule.enabled !== true) return false;
  const type = schedule.type || "time";
  if (type !== "time") {
    return false;
  }
  const nowTime = getCurrentHHmm();
  const scheduledTime = toHHmm(schedule.time);
  if (scheduledTime === "" || nowTime !== scheduledTime) return false;
  const days = schedule.daysOfWeek;
  if (!Array.isArray(days) || days.length === 0) return false;
  const today = getCurrentDayName();
  const todayLower = today.toLowerCase();
  const match = days.some((d) => String(d).toLowerCase() === todayLower);
  return match;
}

/**
 * Prevents the same scene from running more than once per minute.
 * Key: sceneId + ":" + "YYYY-MM-DD-HH-MM". Old keys are pruned when minute rolls over.
 */
const lastRunMinuteByScene = new Map();
let lastPruneMinute = "";

function minuteKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}`;
}

function didRunThisMinute(sceneId) {
  const key = minuteKey();
  const runKey = `${sceneId}:${key}`;
  return lastRunMinuteByScene.has(runKey);
}

function markRunThisMinute(sceneId) {
  const key = minuteKey();
  lastRunMinuteByScene.set(`${sceneId}:${key}`, true);
  if (key !== lastPruneMinute) {
    lastPruneMinute = key;
    for (const k of lastRunMinuteByScene.keys()) {
      if (!k.endsWith(key)) lastRunMinuteByScene.delete(k);
    }
  }
}

let intervalId = null;

/**
 * Start the scheduler. Call once at server startup.
 * @param {import("pg").Pool} db
 * @param {{ createUrgentTask: (opts: object) => Promise<unknown>; logActivity: (opts: object) => Promise<void>; getActor: (req: object) => object; broadcast: (event: string, payload?: object) => void }} deps
 */
export function start(db, deps) {
  if (intervalId != null) return;

  const systemRequest = { body: { actorRole: "scheduler", actorName: "system" } };

  async function tick() {
    try {
      const scenes = await sceneService.getScenesWithSchedules(db);
      const nowTime = getCurrentHHmm();
      const nowDay = getCurrentDayName();

      for (const scene of scenes) {
        if (!scheduleMatchesNow(scene.schedule)) continue;
        if (didRunThisMinute(scene.id)) continue;

        try {
          await sceneService.runScene(db, scene.id, deps, systemRequest, deps.broadcast);
          markRunThisMinute(scene.id);
          console.log(`[sceneScheduler] ran scene: ${scene.id} (${scene.name}) at ${nowTime} ${nowDay}`);
        } catch (e) {
          console.error(`[sceneScheduler] scene ${scene.id} failed:`, e?.message || e);
        }
      }
    } catch (e) {
      console.error("[sceneScheduler] tick failed:", e?.message || e);
    }
  }

  intervalId = setInterval(tick, CHECK_INTERVAL_MS);
  tick();
  console.log("[sceneScheduler] started (interval 60s)");
}

/**
 * Stop the scheduler (e.g. for tests or graceful shutdown).
 */
export function stop() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[sceneScheduler] stopped");
  }
}
