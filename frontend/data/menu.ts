/**
 * Menu system: breakfast, lunch (categorized by protein), dinner, drinks.
 * Soups are appetizers — paired with a main dish when selected.
 */

export const BREAKFAST_ITEMS = [
  "Avocado Toast",
  "Biscuits",
  "Burrata",
  "Eggs",
  "Foul",
  "Oatmeal",
  "Yogurt",
] as const;

/** Soups / appetizers — when selected, user picks a main dish to pair with */
export const SOUP_ITEMS = [
  "Mushroom Soup",
  "Pumpkin Soup",
  "Vegetable Soup",
] as const;

/** Main lunch dishes organized by protein, alphabetical within each group */
export const LUNCH_ITEMS_BY_PROTEIN = {
  "Chicken": [
    "Charcoal Chicken",
    "Chicken Biryani",
    "Chicken Breast Pizza",
    "Chicken Burger (Nawaf Recipe)",
    "Chicken Dopiyaza",
    "Chicken Makhani",
    "Chicken Mandi",
    "Chicken Tikka with Green Sauce and Mashed Potatoes",
    "Chinese Chicken",
    "Mushroom Chicken with Mashed Potatoes",
    "Saffron Chicken",
  ],
  "Beef & Lamb": [
    "Beef Bamiya",
    "Beef Biryani",
    "Creamy Beef Pink Pasta",
    "Khoresh Sabzi",
    "Kofta with Hummus",
    "Kofta with Rice",
    "Kufta Kebab",
    "Minced Meat with Vegetables",
    "Musakaa with Eggplant",
  ],
  "Seafood": [
    "Cajun Shrimp",
    "Chinese Cream Shrimp",
    "Machboos Rubyan",
    "Qaliya Maslawiya",
    "Qaliya Rubyan",
    "Rubyan Qaloona with Rice",
    "Salmon",
    "Shrimp Dopiyaza",
    "Supreme Fish",
  ],
  "Vegetarian": [
    "Dahl",
    "Halloumi in Tomato Sauce",
    "Lasagna",
    "Mujadara",
    "Noodles",
    "Pasta with Mushroom Sauce",
    "Pizza (Vegetable / Margherita)",
    "Spaghetti",
  ],
} as const;

/** Flat list of all lunch items (soups + mains) for backward compat */
export const LUNCH_ITEMS = [
  ...SOUP_ITEMS,
  ...Object.values(LUNCH_ITEMS_BY_PROTEIN).flat(),
] as const;

export const DINNER_ITEMS = [
  "Balaleet",
  "Chickpeas",
  "Eggs",
  "Halloumi Mousaka",
  "Yogurt",
] as const;

export const DRINK_OPTIONS = [
  "Coffee",
  "Juice",
  "Soft Drinks",
  "Sparkling Water",
  "Tea",
  "Water",
] as const;

/** Items that require extra prompts when selected */
export const ITEMS_WITH_PROMPTS: Record<string, { label: string; fields: string[] }> = {
  Eggs: { label: "Eggs", fields: ["cookingStyle", "quantity", "toppings"] },
  Yogurt: { label: "Yogurt", fields: ["toppings"] },
};

/** Sub-options for dishes.
 *  `showOnCard: true` → choice appears on main card (e.g. side dish)
 *  `showOnCard: false` → only shown in long-press detail (e.g. cooking style)
 */
export type DishSubOption = { question: string; options: string[]; showOnCard: boolean };

export const DISH_SUB_OPTIONS: Record<string, DishSubOption[]> = {
  // Cooking style dishes
  Eggs: [
    { question: "How would you like them?", options: ["Omelette", "Scrambled", "Fried", "Boiled", "Poached"], showOnCard: false },
    { question: "How done?", options: ["Runny", "Medium", "Well done"], showOnCard: false },
  ],
  Salmon: [
    { question: "How would you like it?", options: ["Grilled", "Baked", "Pan-seared", "Poached"], showOnCard: false },
    { question: "How done?", options: ["Medium rare", "Medium", "Well done"], showOnCard: false },
    { question: "Side?", options: ["Rice", "Mashed potatoes", "Salad", "Vegetables"], showOnCard: true },
  ],
  // Side dish — no carb/base
  "Beef Bamiya": [
    { question: "Side?", options: ["Rice", "Bread"], showOnCard: true },
  ],
  "Cajun Shrimp": [
    { question: "Side?", options: ["Rice", "Pasta", "Bread", "Salad"], showOnCard: true },
  ],
  "Charcoal Chicken": [
    { question: "Side?", options: ["Rice", "Bread", "Fries", "Hummus & pickles"], showOnCard: true },
  ],
  Chickpeas: [
    { question: "Side?", options: ["Rice", "Bread", "Plain"], showOnCard: true },
  ],
  "Chicken Dopiyaza": [
    { question: "Side?", options: ["Rice", "Naan bread", "Roti"], showOnCard: true },
  ],
  "Chicken Makhani": [
    { question: "Side?", options: ["Rice", "Naan bread", "Roti"], showOnCard: true },
  ],
  "Chinese Chicken": [
    { question: "Side?", options: ["Rice", "Noodles", "Fried rice"], showOnCard: true },
  ],
  "Chinese Cream Shrimp": [
    { question: "Side?", options: ["Rice", "Noodles", "Fried rice"], showOnCard: true },
  ],
  Dahl: [
    { question: "Side?", options: ["Rice", "Naan bread", "Roti"], showOnCard: true },
  ],
  "Halloumi in Tomato Sauce": [
    { question: "Side?", options: ["Rice", "Bread", "Salad"], showOnCard: true },
  ],
  "Khoresh Sabzi": [
    { question: "Side?", options: ["Rice", "Bread"], showOnCard: true },
  ],
  "Kofta with Hummus": [
    { question: "Side?", options: ["Rice", "Bread", "Salad"], showOnCard: true },
  ],
  "Kufta Kebab": [
    { question: "Side?", options: ["Rice", "Bread", "Hummus", "Salad"], showOnCard: true },
  ],
  "Minced Meat with Vegetables": [
    { question: "Side?", options: ["Rice", "Bread", "Mashed potatoes"], showOnCard: true },
  ],
  "Shrimp Dopiyaza": [
    { question: "Side?", options: ["Rice", "Naan bread", "Roti"], showOnCard: true },
  ],
  "Supreme Fish": [
    { question: "Side?", options: ["Rice", "Mashed potatoes", "Salad", "Fries"], showOnCard: true },
  ],
  Yogurt: [
    { question: "Any toppings?", options: ["Plain", "Honey & granola", "Fruits", "Nuts & seeds"], showOnCard: true },
  ],
  // Soups — pair with a main dish
  "Mushroom Soup": [
    { question: "Pair with?", options: ["Bread", "Salad", "As starter only"], showOnCard: true },
  ],
  "Pumpkin Soup": [
    { question: "Pair with?", options: ["Bread", "Salad", "As starter only"], showOnCard: true },
  ],
  "Vegetable Soup": [
    { question: "Pair with?", options: ["Bread", "Salad", "As starter only"], showOnCard: true },
  ],
};

export type BreakfastItem = (typeof BREAKFAST_ITEMS)[number];
export type LunchItem = (typeof LUNCH_ITEMS)[number];
export type DinnerItem = (typeof DINNER_ITEMS)[number];
export type DrinkOption = (typeof DRINK_OPTIONS)[number];

/** RequestedBy options for meal selection */
export const MEAL_REQUESTED_BY = ["Baba", "Mama", "Nawaf", "Ahmed", "Mariam"] as const;
export type MealRequestedBy = (typeof MEAL_REQUESTED_BY)[number];
