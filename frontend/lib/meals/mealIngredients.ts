/**
 * Meal-to-ingredients map for rule-based suggestions.
 * Ingredients are lowercase for matching against inventory (case-insensitive).
 * Every dish from data/menu.ts should have a mapping here.
 */

export const MEAL_INGREDIENTS: Record<string, string[]> = {
  // ─── Breakfast ───
  Eggs: ["eggs", "butter", "salt", "pepper"],
  Foul: ["fava beans", "olive oil", "lemon", "garlic"],
  "Avocado Toast": ["bread", "avocado", "salt", "pepper", "lemon"],
  Burrata: ["burrata", "tomato", "olive oil", "basil"],
  Oatmeal: ["oats", "milk", "honey"],
  Biscuits: ["flour", "butter", "milk", "sugar"],
  Yogurt: ["yogurt"],

  // ─── Lunch ───
  Lasagna: ["pasta", "tomato", "cheese", "minced meat", "onion", "garlic"],
  "Pasta with Mushroom Sauce": ["pasta", "mushrooms", "cream", "garlic", "parmesan"],
  "Saffron Chicken": ["chicken", "rice", "saffron", "onion"],
  Spaghetti: ["pasta", "tomato", "garlic", "olive oil"],
  "Mushroom Soup": ["mushrooms", "cream", "onion", "garlic"],
  "Vegetable Soup": ["vegetables", "tomato", "onion", "carrot"],
  "Pumpkin Soup": ["pumpkin", "cream", "onion"],
  "Machboos Rubyan": ["shrimp", "rice", "spices", "onion", "tomato"],
  "Rubyan Qaloona with Rice": ["shrimp", "rice", "onion", "garlic", "spices"],
  "Kofta with Rice": ["minced meat", "rice", "onion", "spices"],
  "Kofta with Hummus": ["minced meat", "chickpeas", "tahini", "lemon"],
  "Cajun Shrimp": ["shrimp", "spices", "butter", "garlic", "lemon"],
  Salmon: ["salmon", "lemon", "herbs", "olive oil"],
  "Pizza (Vegetable / Margherita)": ["flour", "tomato", "cheese", "yeast", "vegetables"],
  "Chicken Tikka with Green Sauce and Mashed Potatoes": ["chicken", "yogurt", "potatoes", "herbs", "spices"],
  "Chicken Mandi": ["chicken", "rice", "spices", "onion"],
  "Beef Biryani": ["beef", "rice", "onion", "spices", "yogurt"],
  "Chicken Biryani": ["chicken", "rice", "onion", "spices", "yogurt"],
  "Beef Bamiya": ["beef", "okra", "tomato", "onion", "spices"],
  "Mushroom Chicken with Mashed Potatoes": ["chicken", "mushrooms", "potatoes", "cream"],
  "Chinese Chicken": ["chicken", "soy sauce", "vegetables", "garlic", "ginger"],
  "Chicken Makhani": ["chicken", "tomato", "cream", "butter", "spices"],
  "Shrimp Dopiyaza": ["shrimp", "onion", "tomato", "spices", "garlic"],
  "Chicken Dopiyaza": ["chicken", "onion", "tomato", "spices", "garlic"],
  "Chinese Cream Shrimp": ["shrimp", "cream", "garlic", "soy sauce", "vegetables"],
  "Minced Meat with Vegetables": ["minced meat", "vegetables", "onion", "tomato", "spices"],
  "Supreme Fish": ["fish", "lemon", "herbs", "butter", "garlic"],
  "Chicken Burger (Nawaf Recipe)": ["chicken", "bread", "lettuce", "tomato", "cheese"],
  "Khoresh Sabzi": ["herbs", "beef", "kidney beans", "lemon", "onion"],
  "Qaliya Rubyan": ["shrimp", "onion", "tomato", "garlic", "spices"],
  "Halloumi in Tomato Sauce": ["halloumi", "tomato", "onion", "garlic", "herbs"],
  Dahl: ["lentils", "onion", "garlic", "spices"],
  "Charcoal Chicken": ["chicken", "spices", "lemon", "garlic"],
  "Musakaa with Eggplant": ["eggplant", "tomato", "minced meat", "onion", "cheese"],
  "Kufta Kebab": ["minced meat", "onion", "spices", "herbs"],
  Mujadara: ["lentils", "rice", "onion", "olive oil"],
  "Chicken Breast Pizza": ["chicken", "flour", "tomato", "cheese", "yeast"],
  Noodles: ["noodles", "vegetables", "soy sauce"],
  "Qaliya Maslawiya": ["fish", "rice", "onion", "spices", "tomato"],
  "Creamy Beef Pink Pasta": ["beef", "pasta", "cream", "tomato", "garlic"],

  // ─── Dinner ───
  Chickpeas: ["chickpeas", "tahini", "lemon", "garlic"],
  Balaleet: ["vermicelli", "eggs", "sugar", "cardamom"],
  "Halloumi Mousaka": ["halloumi", "eggplant", "tomato", "onion"],
};

/** All meal names that have an ingredients mapping. */
export function getMealsWithIngredients(): string[] {
  return Object.keys(MEAL_INGREDIENTS);
}
