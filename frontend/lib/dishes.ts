export type DishGroup = { category: string; dishes: readonly string[] };

export const DISH_GROUPS: readonly DishGroup[] = [
  {
    category: "Soups",
    dishes: ["Mushroom soup", "Pumpkin soup", "Vegetable soup"],
  },
  {
    category: "Pasta & Noodles",
    dishes: ["Lasagna", "Noodles", "Pasta with mushroom sauce", "Spaghetti"],
  },
  {
    category: "Pizza",
    dishes: ["Chicken pizza", "Margarita pizza", "Vegetable pizza"],
  },
  {
    category: "Chicken",
    dishes: [
      "Biryani chicken",
      "Charcoal chicken",
      "Chicken burger (Nawaf recipe)",
      "Chicken dopiyaza",
      "Chicken makhani",
      "Chicken tikka with green sauce and mashed potatoes",
      "Chinese chicken",
      "Mendi chicken",
      "Mushroom chicken with mashed potatoes",
      "Saffron chicken",
    ],
  },
  {
    category: "Beef & Meat",
    dishes: [
      "Bamiya beef",
      "Biryani beef",
      "Kofta with hummus",
      "Kofta with white rice",
      "Kufta",
      "Minced meat with vegetables",
    ],
  },
  {
    category: "Seafood",
    dishes: [
      "Machboos rubyan",
      "Qaliya rubyan",
      "Roasted rubyan (Cajun)",
      "Rubyan 9aloona with white rice",
      "Rubyan dopiyaza",
      "Rubyan with cream sauce",
      "Salmon",
      "Supreme fish",
    ],
  },
  {
    category: "Vegetarian",
    dishes: [
      "Dahl",
      "Halloumi in tomato sauce",
      "Khoresh sabzy",
      "Mujadara",
      "Musaka'a with eggplant",
    ],
  },
  {
    category: "Sandwiches",
    dishes: ["Fetah with hummus", "Labneh sandwich"],
  },
];
