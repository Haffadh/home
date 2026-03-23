import { NextResponse } from "next/server";

const WEATHER_CODE_MAP: Record<number, { condition: string; icon: string }> = {};
for (const code of [1, 2, 3]) WEATHER_CODE_MAP[code] = { condition: "Cloudy", icon: "cloud" };
for (const code of [45, 48]) WEATHER_CODE_MAP[code] = { condition: "Fog", icon: "cloud" };
for (const code of [51, 53, 55, 61, 63, 65, 80, 81, 82]) WEATHER_CODE_MAP[code] = { condition: "Rain", icon: "rain" };

const DEFAULTS = { tempC: 24, condition: "Clear", icon: "sun", location: "Bahrain" };

/**
 * GET /api/weather
 * Fetch current weather for Bahrain from Open-Meteo — no auth required.
 */
export async function GET() {
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=26.2235&longitude=50.5876&current=temperature_2m,weather_code",
      { next: { revalidate: 600 } }
    );

    if (!res.ok) {
      return NextResponse.json(DEFAULTS);
    }

    const json = await res.json();
    const current = json?.current;
    if (!current) {
      return NextResponse.json(DEFAULTS);
    }

    const tempC = Math.round(current.temperature_2m ?? 24);
    const weatherCode = current.weather_code ?? 0;
    const mapped = WEATHER_CODE_MAP[weatherCode] || { condition: "Clear", icon: "sun" };

    return NextResponse.json({
      tempC,
      condition: mapped.condition,
      icon: mapped.icon,
      location: "Bahrain",
    });
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}
