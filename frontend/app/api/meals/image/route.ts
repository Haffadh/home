import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, errorResponse } from "@/lib/server/middleware";

const DISH_IMAGES: Record<string, string> = {
  "eggs": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&h=400&fit=crop",
  "foul": "https://images.unsplash.com/photo-1609167830220-7164aa7bf827?w=600&h=400&fit=crop",
  "avocado toast": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=600&h=400&fit=crop",
  "burrata": "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=600&h=400&fit=crop",
  "oatmeal": "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=600&h=400&fit=crop",
  "biscuits": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&h=400&fit=crop",
  "yogurt": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&h=400&fit=crop",
  "lasagna": "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=600&h=400&fit=crop",
  "pasta with mushroom sauce": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop",
  "saffron chicken": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&h=400&fit=crop",
  "spaghetti": "https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?w=600&h=400&fit=crop",
  "mushroom soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop",
  "vegetable soup": "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=400&fit=crop",
  "pumpkin soup": "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=600&h=400&fit=crop",
  "salmon": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&h=400&fit=crop",
  "chicken tikka": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop",
  "chicken mandi": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&h=400&fit=crop",
  "beef biryani": "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=400&fit=crop",
  "chicken biryani": "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=400&fit=crop",
  "pizza": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop",
  "chicken burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop",
  "dahl": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop",
  "noodles": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=400&fit=crop",
  "chickpeas": "https://images.unsplash.com/photo-1511690743698-d9d18f7e20f1?w=600&h=400&fit=crop",
  "balaleet": "https://images.unsplash.com/photo-1517244683847-7456b63c5969?w=600&h=400&fit=crop",
  "charcoal chicken": "https://images.unsplash.com/photo-1598103442097-8b74f0f9170c?w=600&h=400&fit=crop",
  "kofta": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&h=400&fit=crop",
  "chicken makhani": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&h=400&fit=crop",
  "halloumi": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=400&fit=crop",
  "mujadara": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&h=400&fit=crop",
  "shrimp": "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&h=400&fit=crop",
  "cajun shrimp": "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&h=400&fit=crop",
  "fish": "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=600&h=400&fit=crop",
  "steak": "https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=600&h=400&fit=crop",
  "beef": "https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=600&h=400&fit=crop",
  "rice": "https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=600&h=400&fit=crop",
  "chicken": "https://images.unsplash.com/photo-1598103442097-8b74f0f9170c?w=600&h=400&fit=crop",
  "machboos": "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=400&fit=crop",
  "rubyan": "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&h=400&fit=crop",
  "qaliya": "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&h=400&fit=crop",
  "dopiyaza": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&h=400&fit=crop",
  "chinese chicken": "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&h=400&fit=crop",
  "chinese cream shrimp": "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&h=400&fit=crop",
  "minced meat": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&h=400&fit=crop",
  "supreme fish": "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=600&h=400&fit=crop",
  "khoresh": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&h=400&fit=crop",
  "musakaa": "https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=600&h=400&fit=crop",
  "eggplant": "https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=600&h=400&fit=crop",
  "kebab": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&h=400&fit=crop",
  "beef bamiya": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&h=400&fit=crop",
  "creamy beef": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop",
  "pink pasta": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop",
  "mushroom chicken": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&h=400&fit=crop",
  "chicken breast pizza": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop",
  "halloumi mousaka": "https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=600&h=400&fit=crop",
  "chicken tikka with green sauce and mashed potatoes": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop",
  "pizza (vegetable / margherita)": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop",
  "halloumi in tomato sauce": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=400&fit=crop",
  "chicken burger (nawaf recipe)": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop",
  "rubyan qaloona": "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&h=400&fit=crop",
  "qaliya maslawiya": "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=600&h=400&fit=crop",
};

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const dish = request.nextUrl.searchParams.get("dish") || "";
  if (!dish) {
    return errorResponse(400, "dish query parameter is required");
  }

  const key = dish.toLowerCase().trim();

  // Exact match
  if (DISH_IMAGES[key]) {
    return NextResponse.json({ ok: true, url: DISH_IMAGES[key] });
  }

  // Partial match: check if any key is contained in the query or vice versa
  for (const [name, url] of Object.entries(DISH_IMAGES)) {
    if (key.includes(name) || name.includes(key)) {
      return NextResponse.json({ ok: true, url });
    }
  }

  // Try Unsplash API if access key is available
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplashKey) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(dish + " food")}&per_page=1&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${unsplashKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const photo = data?.results?.[0];
        if (photo?.urls?.regular) {
          return NextResponse.json({ ok: true, url: photo.urls.regular });
        }
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback to loremflickr
  const fallbackUrl = `https://loremflickr.com/600/400/${encodeURIComponent(dish)},food`;
  return NextResponse.json({ ok: true, url: fallbackUrl });
}
