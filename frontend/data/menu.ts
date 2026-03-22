/**
 * Menu system: breakfast, lunch, dinner, drinks.
 * Admin can add new dishes (stored in House Brain or separate list).
 * Eggs and Yogurt trigger additional prompts.
 */

export const BREAKFAST_ITEMS = [
  "Eggs",
  "Foul",
  "Avocado Toast",
  "Burrata",
  "Oatmeal",
  "Biscuits",
  "Yogurt",
] as const;

export const LUNCH_ITEMS = [
  "Lasagna",
  "Pasta with Mushroom Sauce",
  "Saffron Chicken",
  "Spaghetti",
  "Mushroom Soup",
  "Vegetable Soup",
  "Pumpkin Soup",
  "Machboos Rubyan",
  "Rubyan Qaloona with Rice",
  "Kofta with Rice",
  "Kofta with Hummus",
  "Cajun Shrimp",
  "Salmon",
  "Pizza (Vegetable / Margherita)",
  "Chicken Tikka with Green Sauce and Mashed Potatoes",
  "Chicken Mandi",
  "Beef Biryani",
  "Chicken Biryani",
  "Beef Bamiya",
  "Mushroom Chicken with Mashed Potatoes",
  "Chinese Chicken",
  "Chicken Makhani",
  "Shrimp Dopiyaza",
  "Chicken Dopiyaza",
  "Chinese Cream Shrimp",
  "Minced Meat with Vegetables",
  "Supreme Fish",
  "Chicken Burger (Nawaf Recipe)",
  "Khoresh Sabzi",
  "Qaliya Rubyan",
  "Halloumi in Tomato Sauce",
  "Dahl",
  "Charcoal Chicken",
  "Musakaa with Eggplant",
  "Kufta Kebab",
  "Mujadara",
  "Chicken Breast Pizza",
  "Noodles",
  "Qaliya Maslawiya",
  "Creamy Beef Pink Pasta",
] as const;

export const DINNER_ITEMS = [
  "Chickpeas",
  "Eggs",
  "Balaleet",
  "Halloumi Mousaka",
  "Yogurt",
] as const;

export const DRINK_OPTIONS = [
  "Water",
  "Sparkling Water",
  "Tea",
  "Coffee",
  "Juice",
  "Soft Drinks",
] as const;

/** Items that require extra prompts when selected */
export const ITEMS_WITH_PROMPTS: Record<string, { label: string; fields: string[] }> = {
  Eggs: {
    label: "Eggs",
    fields: ["cookingStyle", "quantity", "toppings"],
  },
  Yogurt: {
    label: "Yogurt",
    fields: ["toppings"],
  },
};

/** Sub-options for ambiguous dishes.
 *  `showOnCard: true` → the choice appears on the main card (e.g. side dish)
 *  `showOnCard: false` → only shown in long-press detail (e.g. cooking style)
 */
export type DishSubOption = { question: string; options: string[]; showOnCard: boolean };

export const DISH_SUB_OPTIONS: Record<string, DishSubOption[]> = {
  Eggs: [
    { question: "How would you like them?", options: ["Omelette", "Scrambled", "Fried", "Boiled", "Poached"], showOnCard: false },
    { question: "How done?", options: ["Runny", "Medium", "Well done"], showOnCard: false },
  ],
  Salmon: [
    { question: "How would you like it?", options: ["Grilled", "Baked", "Pan-seared", "Poached"], showOnCard: false },
    { question: "How done?", options: ["Medium rare", "Medium", "Well done"], showOnCard: false },
    { question: "Side?", options: ["Rice", "Mashed potatoes", "Salad", "Vegetables"], showOnCard: true },
  ],
  "Cajun Shrimp": [
    { question: "Side?", options: ["Rice", "Pasta", "Bread", "Salad"], showOnCard: true },
  ],
  "Supreme Fish": [
    { question: "Side?", options: ["Rice", "Mashed potatoes", "Salad", "Fries"], showOnCard: true },
  ],
  "Charcoal Chicken": [
    { question: "Side?", options: ["Rice", "Bread", "Fries", "Hummus & pickles"], showOnCard: true },
  ],
  "Kofta with Hummus": [
    { question: "Side?", options: ["Rice", "Bread", "Salad"], showOnCard: true },
  ],
  "Kufta Kebab": [
    { question: "Side?", options: ["Rice", "Bread", "Hummus", "Salad"], showOnCard: true },
  ],
  "Chicken Makhani": [
    { question: "Side?", options: ["Rice", "Naan bread", "Roti"], showOnCard: true },
  ],
  "Shrimp Dopiyaza": [
    { question: "Side?", options: ["Rice", "Naan bread", "Roti"], showOnCard: true },
  ],
  "Chicken Dopiyaza": [
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
  "Beef Bamiya": [
    { question: "Side?", options: ["Rice", "Bread"], showOnCard: true },
  ],
  "Minced Meat with Vegetables": [
    { question: "Side?", options: ["Rice", "Bread", "Mashed potatoes"], showOnCard: true },
  ],
  Chickpeas: [
    { question: "Side?", options: ["Rice", "Bread", "Plain"], showOnCard: true },
  ],
  Yogurt: [
    { question: "Any toppings?", options: ["Plain", "Honey & granola", "Fruits", "Nuts & seeds"], showOnCard: true },
  ],
};

export type BreakfastItem = (typeof BREAKFAST_ITEMS)[number];
export type LunchItem = (typeof LUNCH_ITEMS)[number];
export type DinnerItem = (typeof DINNER_ITEMS)[number];
export type DrinkOption = (typeof DRINK_OPTIONS)[number];

/** RequestedBy options for meal selection */
export const MEAL_REQUESTED_BY = ["Baba", "Mama", "Nawaf", "Ahmed", "Mariam"] as const;
export type MealRequestedBy = (typeof MEAL_REQUESTED_BY)[number];
