// The food intake: what you like, and what you can't eat.
//
// Replaces "here's a bowl rotation, take it or leave it" as the first thing the
// food side asks. Cuisines because the sauce carries the variety and the wrong
// four sauces make a plan you abandon by Wednesday
// (docs/MEAL-FRAMEWORK.md §3); allergies because a plan containing something
// you can't eat isn't a plan.
//
// Stored in builder_profiles with kind = 'food', the same table the gym intake
// uses. Pure module — no DB access, unit tested.

export const FOOD_INTAKE_VERSION = 1;

export type Cuisine = {
  id: string;
  label: string;
  hint: string;
};

/**
 * Genres, not dishes.
 *
 * Each of these is a *sauce and base family* rather than a cuisine in any
 * culinary sense — the question being answered is "what should the four
 * rotating flavours be", so the useful granularity is the one that changes what
 * goes in the fridge.
 */
export const CUISINES: Cuisine[] = [
  { id: "east_asian", label: "East & Southeast Asian", hint: "Soy-ginger, sesame, gochujang, peanut" },
  { id: "latin", label: "Latin & Mexican", hint: "Chipotle-lime, salsa verde, burrito bowls" },
  { id: "south_asian", label: "Indian & South Asian", hint: "Tikka masala, curry, dal, naan" },
  { id: "broth", label: "Broth bowls", hint: "Pho, ramen — high volume, very filling" },
  { id: "mediterranean", label: "Mediterranean & Middle Eastern", hint: "Lemon-herb, tahini, feta, grain bowls" },
  { id: "italian", label: "Italian", hint: "Pasta, tomato, garlic, parmesan" },
  { id: "american", label: "American comfort", hint: "Grill, BBQ, sandwiches, big salads" },
];

export type Allergen = {
  id: string;
  label: string;
  /**
   * Lowercase substrings that suggest an ingredient contains this. Matching is
   * a hint for the user to check, never a safety guarantee — see
   * `flagAllergens()`.
   */
  keywords: string[];
  /**
   * Substrings that override a keyword match. "Rice noodles" contains
   * "noodle" and contains no wheat; "gluten-free bread" contains "bread".
   * Without these the flags are wrong on obvious cases, and a flag that's
   * obviously wrong is one people stop reading — which costs more than the
   * over-matching bought.
   */
  exceptKeywords?: string[];
};

/**
 * The nine major allergens the US requires labelling for, plus gluten, which
 * isn't one of them but behaves like one for anyone avoiding it.
 */
export const ALLERGENS: Allergen[] = [
  { id: "milk", label: "Milk & dairy", keywords: ["milk", "cheese", "yogurt", "butter", "cream", "ghee", "parmesan", "feta"] },
  { id: "egg", label: "Egg", keywords: ["egg", "mayo", "mayonnaise", "aioli"] },
  { id: "fish", label: "Fish", keywords: ["fish", "salmon", "tuna", "cod", "anchovy", "anchovies", "worcestershire"] },
  { id: "shellfish", label: "Shellfish", keywords: ["shrimp", "prawn", "crab", "lobster", "scallop", "oyster", "clam", "mussel"] },
  { id: "tree_nut", label: "Tree nuts", keywords: ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "nut butter"] },
  { id: "peanut", label: "Peanut", keywords: ["peanut"] },
  // "soy sauce" is here because it is usually wheat-brewed, and the variants
  // are listed because a pantry rarely calls it that — the seeded template says
  // "Soy-ginger-garlic sauce". Deliberately NOT a bare "soy": tofu and edamame
  // are gluten-free, and a flag that cries wolf stops being read.
  {
    id: "wheat",
    label: "Wheat",
    keywords: ["wheat", "bread", "naan", "tortilla", "pasta", "noodle", "ramen", "udon", "flour", "couscous", "panko", "soy sauce", "soy-ginger", "hoisin", "teriyaki", "seitan"],
    exceptKeywords: ["rice noodle", "rice paper", "glass noodle", "corn tortilla", "almond flour", "rice flour", "gluten-free", "gluten free", "wheat-free"],
  },
  { id: "soy", label: "Soy", keywords: ["soy", "tofu", "edamame", "miso", "tamari", "tempeh"] },
  { id: "sesame", label: "Sesame", keywords: ["sesame", "tahini", "hummus"] },
  {
    id: "gluten",
    label: "Gluten",
    keywords: ["wheat", "bread", "naan", "tortilla", "pasta", "noodle", "ramen", "udon", "barley", "rye", "flour", "couscous", "panko", "soy sauce", "soy-ginger", "hoisin", "teriyaki", "seitan"],
    exceptKeywords: ["rice noodle", "rice paper", "glass noodle", "corn tortilla", "almond flour", "rice flour", "gluten-free", "gluten free"],
  },
];

export type FoodIntake = {
  version: number;
  cuisines: string[];
  allergens: string[];
  /** Anything else to avoid, in the user's own words. */
  avoidNote: string;
  /** Things they want written in by name — the load-bearing favourites. */
  favouritesNote: string;
};

export function emptyFoodIntake(): FoodIntake {
  return {
    version: FOOD_INTAKE_VERSION,
    cuisines: [],
    allergens: [],
    avoidNote: "",
    favouritesNote: "",
  };
}

/** At least one cuisine, or there's nothing to build a rotation from. */
export function validateFoodIntake(intake: FoodIntake): string | null {
  if (!intake.cuisines.length) {
    return "Pick at least one kind of food you actually want to eat.";
  }
  if (intake.avoidNote.length > 500 || intake.favouritesNote.length > 500) {
    return "Keep the notes under 500 characters.";
  }
  return null;
}

/**
 * Which declared allergens an ingredient name might contain.
 *
 * **This flags, it does not filter, and it is not a safety check.** It matches
 * substrings in a name someone typed — it cannot know that a jarred sauce
 * contains fish, or that "naan" was made without wheat, and it will miss things
 * a label would catch. The UI has to say so wherever this is used, and the
 * user has to be the one who decides.
 *
 * Biased toward false positives, but only up to a point: flagging soy sauce for
 * a wheat allergy is a mild annoyance and missing it is not — while flagging
 * rice noodles is just wrong, and being wrong on an obvious case is how the
 * flags stop being read at all. `exceptKeywords` holds that line.
 */
export function flagAllergens(
  ingredientName: string,
  declaredAllergenIds: string[]
): string[] {
  const name = ingredientName.toLowerCase();
  const declared = new Set(declaredAllergenIds);

  return ALLERGENS.filter((a) => {
    if (!declared.has(a.id)) return false;
    if (a.exceptKeywords?.some((k) => name.includes(k))) return false;
    return a.keywords.some((k) => name.includes(k));
  }).map((a) => a.id);
}

/** Human-readable labels for a set of allergen ids. */
export function allergenLabels(ids: string[]): string[] {
  return ALLERGENS.filter((a) => ids.includes(a.id)).map((a) => a.label);
}
