#!/usr/bin/env python3
"""Streakproof — generates 04_seed.sql (the template library).

    python3 gen_seed.py > 04_seed.sql

Everything this emits is a TEMPLATE: owner_id is null, is_template is true.
Users never edit these; picking one calls clone_plan(), which copies it into a
plan they own. That is the whole point of the v2 ownership change.

Gym program data is imported from the v1 generator so there is one source of
truth for the exercise text. The food template is defined here.
"""

import importlib.util
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
V1 = os.path.join(os.path.dirname(HERE), "gen_seed.py")

_spec = importlib.util.spec_from_file_location("v1_seed", V1)
_v1 = importlib.util.module_from_spec(_spec)
sys.modules["v1_seed"] = _v1
_spec.loader.exec_module(_v1)

# --- Gym templates ----------------------------------------------------------
# Same day/exercise content as v1, but renamed: these are now library entries
# anyone can clone, so the names describe the plan rather than the person.
GYM_TEMPLATE_META = {
    "sean-fullbody": {
        "slug": "full-body-pool",
        "name": "Full Body + Pool — 3-4 days",
        "description": (
            "Three rotating full-body days (squat / hinge / athletic) plus a "
            "zero-impact pool day for bad knees, hot weeks, or the day before "
            "a game. Needs a full gym."
        ),
    },
    "ely-pf-upperlower": {
        "slug": "upper-lower-no-barbell",
        "name": "Upper/Lower — no barbells",
        "description": (
            "Four-day upper/lower split built for gyms without barbells or "
            "racks: Smith machine, dumbbells and machines only."
        ),
    },
}

# --- Food template ----------------------------------------------------------
# Component-based rather than meal-based on purpose: the base stays constant
# and the sauce carries the variety, so nothing gets boring by Wednesday.
FOOD_TEMPLATE = {
    "slug": "bowl-rotation-asian-latin",
    "name": "Bowl Rotation — Asian & Latin",
    "description": (
        "Batch a few components twice a week, then assemble bowls in five "
        "minutes. Four rotating flavour profiles so nothing repeats, plus a "
        "designed four-minute fallback for days when nothing got prepped."
    ),
    "tracking_mode": "none",
    "items": [
        # (name, role, batch_cooked, shelf_life_days)
        ("Shredded chicken",          "protein", True,  4),
        ("Ground beef",               "protein", True,  4),
        ("Shrimp",                    "protein", False, 2),
        ("Hard-boiled eggs",          "protein", True,  7),
        ("Rotisserie chicken",        "protein", False, 4),
        ("Greek yogurt",              "protein", False, 14),
        ("Jasmine rice",              "base",    True,  5),
        ("Rice noodles",              "base",    False, 365),
        ("Naan",                      "base",    False, 7),
        ("Tortillas",                 "base",    False, 21),
        ("Frozen stir-fry veg",       "veg",     False, 365),
        ("Peppers & onions, roasted", "veg",     True,  5),
        ("Broccoli slaw",             "veg",     False, 7),
        ("Edamame",                   "veg",     False, 365),
        ("Bagged salad",              "veg",     False, 5),
        ("Cucumber, herbs & lime",    "veg",     False, 5),
        ("Soy-ginger-garlic sauce",   "sauce",   False, 30),
        ("Peanut sauce",              "sauce",   False, 30),
        ("Gochujang sauce",           "sauce",   False, 60),
        ("Chipotle-lime sauce",       "sauce",   False, 21),
        ("Salsa verde",               "sauce",   False, 14),
        ("Tikka masala sauce (jar)",  "sauce",   False, 365),
        ("Pho-style broth",           "sauce",   False, 5),
        ("Chili crisp",               "extra",   False, 365),
        ("Cheese",                    "extra",   False, 21),
    ],
    "builds": [
        {
            "key": "A", "title": "Asian bowl", "sort": 1, "est_minutes": 6,
            "subtitle": "Rice, protein, veg, and whichever sauce you feel like.",
            "items": ["Jasmine rice", "Shredded chicken", "Frozen stir-fry veg",
                      "Soy-ginger-garlic sauce", "Chili crisp"],
        },
        {
            "key": "B", "title": "Latin bowl", "sort": 2, "est_minutes": 6,
            "subtitle": "Burrito bowl shape. Swap rice for tortillas whenever.",
            "items": ["Jasmine rice", "Ground beef", "Peppers & onions, roasted",
                      "Chipotle-lime sauce", "Cheese"],
        },
        {
            "key": "C", "title": "Tikka masala", "sort": 3, "est_minutes": 15,
            "subtitle": "Jarred sauce is genuinely good. Naan stays.",
            "items": ["Jasmine rice", "Shredded chicken", "Tikka masala sauce (jar)",
                      "Naan"],
        },
        {
            "key": "D", "title": "Broth bowl", "sort": 4, "est_minutes": 8,
            "subtitle": "Pho/ramen shape — the highest-volume, most filling option.",
            "items": ["Rice noodles", "Pho-style broth", "Shrimp",
                      "Cucumber, herbs & lime", "Broccoli slaw"],
        },
        {
            "key": "FALLBACK", "title": "The four-minute meal", "sort": 5,
            "est_minutes": 4, "is_fallback": True,
            "subtitle": "Nothing prepped, no energy. This still counts as following the plan.",
            "items": ["Rotisserie chicken", "Bagged salad", "Jasmine rice"],
        },
        {
            "key": "GRAB", "title": "Grab-and-go protein", "sort": 6,
            "est_minutes": 1, "is_fallback": True,
            "subtitle": "For the front fridge shelf. Zero assembly, zero decisions.",
            "items": ["Greek yogurt", "Hard-boiled eggs"],
        },
    ],
    "prep": [
        {
            "key": "sun", "title": "Sunday — the big one", "weekday": 0,
            "est_minutes": 50, "sort": 1,
            "tasks": [
                ("Podcast on, oven to 425, big pot of water on", None),
                ("Cook a batch of rice", "Jasmine rice"),
                ("Cook and shred the chicken", "Shredded chicken"),
                ("Roast a tray of peppers and onions", "Peppers & onions, roasted"),
                ("Hard-boil a half dozen eggs", "Hard-boiled eggs"),
                ("Portion into clear containers, front shelf of the fridge", None),
            ],
        },
        {
            "key": "wed", "title": "Wednesday — after the gym", "weekday": 3,
            "est_minutes": 35, "sort": 2,
            "tasks": [
                ("Brown the ground beef", "Ground beef"),
                ("Restock the grab-and-go shelf", None),
                ("Chop cucumber, herbs and lime for the week", "Cucumber, herbs & lime"),
                ("Anything from Sunday gone off? Bin it now, not Friday", None),
            ],
        },
    ],
}


def q(s):
    """SQL-escape a string literal."""
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def b(v):
    return "true" if v else "false"


def rest_seconds(scheme, index):
    """Rest between sets, in seconds.

    Heuristic, and documented as one: the first two lifts of a day are the
    heavy compounds and get 2.5 min; accessories get 90s; anything tagged as a
    finisher or conditioning gets 60s. The point is a usable duration estimate,
    not a prescription -- users can edit it.
    """
    s = (scheme or "").lower()
    if "finisher" in s or "conditioning" in s or "warm-up" in s:
        return 60
    return 150 if index <= 2 else 90


def work_seconds(scheme):
    """Rough time under tension per set."""
    s = (scheme or "").lower()
    if "sec" in s:
        return 45
    if "min" in s:
        return 60
    return 45


def emit_gym(out, prog):
    meta = GYM_TEMPLATE_META[prog["slug"]]
    out.append(f"-- ---------- {meta['name']} " + "-" * 30)
    out.append("do $$")
    out.append("declare v_plan uuid;")
    out.append("begin")
    out.append("  insert into plans (owner_id, is_template, kind, slug, name, description, source, visibility)")
    out.append(
        f"  values (null, true, 'gym', {q(meta['slug'])}, {q(meta['name'])}, "
        f"{q(meta['description'])}, 'template', 'public')"
    )
    out.append("  on conflict (slug) where is_template do update")
    out.append("    set name = excluded.name, description = excluded.description")
    out.append("  returning id into v_plan;")
    out.append("")
    out.append("  -- Templates are regenerated wholesale; user plans are untouched.")
    out.append("  delete from days where plan_id = v_plan;")
    out.append("")

    for di, d in enumerate(prog["days"], start=1):
        out.append("  with d as (")
        out.append("    insert into days (plan_id, key, title, subtitle, sort)")
        out.append(
            f"    values (v_plan, {q(d['key'])}, {q(d['title'])}, {q(d['subtitle'])}, {di})"
            "    returning id"
        )
        out.append("  )")
        out.append("  insert into exercises (day_id, name, scheme, cue, sets, work_seconds, rest_seconds, optional, sort)")
        rows = []
        for ei, (name, scheme, cue) in enumerate(d["exercises"], start=1):
            optional = name.lower().startswith("optional")
            rows.append(
                f"    select id, {q(name)}, {q(scheme)}, {q(cue)}, "
                f"{_v1.set_count(scheme)}, {work_seconds(scheme)}, "
                f"{rest_seconds(scheme, ei)}, {b(optional)}, {ei} from d"
            )
        out.append("\n    union all\n".join(rows) + ";")
        out.append("")

    out.append("  perform public.refresh_plan_estimates(v_plan);")
    out.append("end $$;\n")


def emit_food(out, t):
    out.append(f"-- ---------- {t['name']} " + "-" * 30)
    out.append("do $$")
    out.append("declare v_plan uuid; v_build uuid; v_prep uuid;")
    out.append("begin")
    out.append("  insert into plans (owner_id, is_template, kind, slug, name, description, source, visibility, tracking_mode)")
    out.append(
        f"  values (null, true, 'food', {q(t['slug'])}, {q(t['name'])}, "
        f"{q(t['description'])}, 'template', 'public', {q(t['tracking_mode'])})"
    )
    out.append("  on conflict (slug) where is_template do update")
    out.append("    set name = excluded.name, description = excluded.description")
    out.append("  returning id into v_plan;")
    out.append("")
    out.append("  delete from food_items    where plan_id = v_plan;")
    out.append("  delete from builds        where plan_id = v_plan;")
    out.append("  delete from prep_sessions where plan_id = v_plan;")
    out.append("")

    out.append("  insert into food_items (plan_id, name, role, batch_cooked, shelf_life_days, sort) values")
    rows = [
        f"    (v_plan, {q(n)}, {q(role)}, {b(batch)}, {life}, {i})"
        for i, (n, role, batch, life) in enumerate(t["items"], start=1)
    ]
    out.append(",\n".join(rows) + ";")
    out.append("")

    for bl in t["builds"]:
        out.append("  insert into builds (plan_id, key, title, subtitle, is_fallback, est_minutes, sort)")
        out.append(
            f"  values (v_plan, {q(bl['key'])}, {q(bl['title'])}, {q(bl.get('subtitle'))}, "
            f"{b(bl.get('is_fallback'))}, {bl['est_minutes']}, {bl['sort']})"
        )
        out.append("  returning id into v_build;")
        out.append("  insert into build_items (build_id, food_item_id, sort)")
        out.append("  select v_build, fi.id, x.sort from (values")
        rows = [f"    ({q(n)}, {i})" for i, n in enumerate(bl["items"], start=1)]
        out.append(",\n".join(rows))
        out.append("  ) as x(name, sort)")
        out.append("  join food_items fi on fi.plan_id = v_plan and fi.name = x.name;")
        out.append("")

    for pr in t["prep"]:
        out.append("  insert into prep_sessions (plan_id, key, title, weekday, est_minutes, sort)")
        out.append(
            f"  values (v_plan, {q(pr['key'])}, {q(pr['title'])}, {pr['weekday']}, "
            f"{pr['est_minutes']}, {pr['sort']})"
        )
        out.append("  returning id into v_prep;")
        out.append("  insert into prep_tasks (prep_session_id, text, food_item_id, sort)")
        out.append("  select v_prep, x.text, fi.id, x.sort from (values")
        rows = [
            f"    ({q(text)}, {q(item)}, {i})"
            for i, (text, item) in enumerate(pr["tasks"], start=1)
        ]
        out.append(",\n".join(rows))
        out.append("  ) as x(text, item_name, sort)")
        out.append("  left join food_items fi on fi.plan_id = v_plan and fi.name = x.item_name;")
        out.append("")

    out.append("end $$;\n")


def main():
    out = [
        "-- ============================================================",
        "--  Streakproof — template library (generated by gen_seed.py)",
        "--  Run AFTER 03_rls.sql. Safe to re-run.",
        "--",
        "--  DO NOT EDIT BY HAND. Edit gen_seed.py and regenerate:",
        "--      python3 gen_seed.py > 04_seed.sql",
        "-- ============================================================",
        "",
    ]
    for prog in _v1.PROGRAMS:
        emit_gym(out, prog)
    emit_food(out, FOOD_TEMPLATE)
    print("\n".join(out))


if __name__ == "__main__":
    main()
