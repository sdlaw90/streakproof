#!/usr/bin/env python3
"""Streakproof — generates the template-library migration.

    python3 supabase/tools/gen_seed.py > supabase/migrations/20260802000004_templates.sql

Everything this emits is a TEMPLATE: owner_id is null, is_template is true.
Users never edit these; picking one calls clone_plan(), which copies it into a
plan they own. That is the whole point of the v2 ownership change.

Gym and food template data both live in this file. Gym data used to be imported
from supabase/gen_seed.py, but that file was deleted as a "v1 leftover" in
628d992 and this generator has been broken ever since — nothing ran it, so
nothing noticed. The data is inlined below and there is no cross-file import.

To emit only some templates (for a delta migration on top of an already-applied
one):

    python3 supabase/tools/gen_seed.py --only bodyweight-anywhere,fat-loss-full-body
"""

import argparse
import re
import sys

PROGRAMS = [
    {
        "slug": "sean-fullbody",
        "name": "Sean — Full Body + Pool",
        "days": [
            {"key": "A", "title": "Day A · Squat", "subtitle": "Full body — squat focus", "exercises": [
                ("Barbell Back Squat", "3 × 6–8 · legs", "Bar on your traps, not your neck. Brace like someone's about to poke your gut, sit down & back (knees track over toes), drive up through mid-foot. Go to at least parallel."),
                ("Dumbbell Bench Press", "3 × 8–10 · push", "Slight arch, shoulder blades pinched back & down. Lower the dumbbells to chest level with elbows ~45°, press up and slightly together."),
                ("Lat Pulldown", "3 × 8–12 · pull", "Chest tall, pull the bar to your collarbone by driving elbows down toward your hips. Don't lean way back. Squeeze your back, don't just yank with arms."),
                ("Leg Press", "3 × 10–12 · legs", "Feet shoulder-width mid-platform. Lower until knees ~90°, keep lower back flat on the pad. Push through heels, don't lock knees hard at the top."),
                ("Plank", "3 × 30–45 sec · core", "Forearms down, body one straight line — no saggy hips, no piked butt. Squeeze glutes and abs. Breathe. Add time as it gets easy."),
                ("Optional: 10 min cardio", "finisher · conditioning", "Easy-to-moderate. Bike, row, or incline walk. Purely for the energy/mood boost and recovery — don't smoke yourself."),
            ]},
            {"key": "B", "title": "Day B · Hinge", "subtitle": "Full body — hinge focus", "exercises": [
                ("Romanian Deadlift (RDL)", "3 × 6–8 · hinge", "Soft knees, push hips BACK (not down) like closing a car door with your butt. Bar slides down your thighs, feel the hamstring stretch, then drive hips forward to stand tall. Flat back the whole time."),
                ("Overhead Press (DB or barbell)", "3 × 8–10 · push", "Brace core, squeeze glutes so you don't lean back. Press straight up, biceps ending near ears. Don't let it drift forward. If your lower back arches hard, lighten it."),
                ("Chest-Supported Row", "3 × 10–12 · pull", "Chest on the pad. Row the weight to your lower ribs by pulling elbows back and squeezing shoulder blades together. Pause a beat at the top. Controlled on the way down."),
                ("Walking Lunges", "3 × 10/leg · legs", "Long-ish step, drop the back knee toward the floor, torso upright. Push through the FRONT heel to stand. Great carryover to sprinting on the field."),
                ("Pallof Press", "3 × 10/side · core", "Cable at chest height, stand side-on. Press the handle straight out and resist it pulling you toward the machine. Anti-rotation = a bulletproof core for twisting/throwing."),
                ("Optional: intervals", "finisher · conditioning", "6–8 rounds: 20 sec hard (bike/row/assault), 40 sec easy. Big bang for fat loss and matches the stop-start of dodgeball."),
            ]},
            {"key": "C", "title": "Day C · Athletic", "subtitle": "Full body — athletic + conditioning", "exercises": [
                ("Trap-Bar Deadlift", "3 × 6–8 · hinge/legs", "Stand inside the trap bar, hips between squat and RDL height, flat back, chest up. Push the floor away with your feet and stand tall. Easiest deadlift to learn — very knee/back friendly."),
                ("Incline Dumbbell Press", "3 × 8–10 · push", "Bench at ~30°. Lower dumbbells to upper chest, elbows ~45°, press up. Hits the upper chest and shoulders — good for that athletic look."),
                ("Single-Arm Dumbbell Row", "3 × 10/arm · pull", "One hand & knee on a bench, flat back. Row the dumbbell to your hip, elbow close to your side, squeeze at the top. Don't twist your torso to cheat it up."),
                ("Face Pulls", "3 × 15 · pull/health", "Rope at face height, pull toward your forehead with elbows high, thumbs going back. Bulletproofs your shoulders for all that overhead throwing. Light weight, high reps."),
                ("Farmer Carry", "3 × ~30 m · core/grip", "Heavy dumbbell in each hand, stand tall, shoulders back, brace core, walk. Don't lean. Builds a rock-solid trunk and crushing grip — pure athlete fuel."),
                ("Hanging Knee Raises", "3 × 10–15 · core", "Hang from the bar, no swinging. Curl your knees up toward your chest using your abs (not momentum). Lower slow. Use an ab-strap station if grip gives out first."),
            ]},
            {"key": "P", "title": "Pool", "subtitle": "Bodyweight only — low-impact conditioning", "exercises": [
                ("Warm-up swim / water walk", "5 min · warm-up", "Easy laps of any stroke, or just walk/jog across the shallow end pushing through the water. Get your body temp up and shoulders loose before the harder stuff."),
                ("Aqua jog", "4 × 1 min · conditioning", "Run in place or across the deep end with no bottom contact (or high-knee run in chest-deep water). Drive knees up, pump arms. Water resistance = great engine work with zero joint pounding."),
                ("Pool jump squats", "3 × 12 · legs/power", "Chest-deep water, sink into a squat and explode UP as high as you can, letting the water slow your landing. Builds jumping power with almost no impact on the knees."),
                ("Lateral bounds / shuffles", "3 × 30 sec · agility", "Waist-to-chest deep, bound or shuffle side to side, pushing hard against the water. Trains the side-to-side dodge you use in dodgeball."),
                ("Pool-edge push-ups", "3 × 8–12 · push", "Hands on the pool deck/edge, press your torso up out of the water like a push-up/dip, then lower under control. Hits chest, shoulders and triceps."),
                ("Flutter kicks on the wall", "3 × 30 sec · core/legs", "Hold the edge, extend your body out behind you on the surface, and flutter kick from the hips. Keep your core tight so your hips don't sink."),
                ("Treading water", "3 × 45 sec · full-body", "Deep end, stay afloat using sculling arm circles and an eggbeater/flutter kick. For a challenge, hold hands out of the water so your legs do all the work."),
                ("Easy cool-down swim", "3–5 min · recovery", "Slow laps or a relaxed float. Let your heart rate come down. Pool time doubles as the mood/stress reset."),
            ]},
        ],
    },
    {
        "slug": "ely-pf-upperlower",
        "name": "Ely — Planet Fitness Upper/Lower",
        "days": [
            {"key": "UA", "title": "Upper A", "subtitle": "Upper body — push + pull", "exercises": [
                ("Smith Machine Bench Press", "3 × 8–10 · chest", "Set the bench so the bar lines up with your mid-chest. Twist to unrack, lower to your chest with elbows about 45°, press up. The fixed bar path makes this safe to push solo."),
                ("Lat Pulldown", "3 × 10–12 · back", "Grip a bit wider than shoulders, chest tall, pull the bar to your collarbone by driving your elbows down toward your hips. Squeeze your back — don't lean way back or yank with just the arms."),
                ("Dumbbell Shoulder Press", "3 × 10–12 · shoulders", "Seated with back support. Press from ear height to overhead without clanging the dumbbells together. Keep your ribs down so your lower back doesn't arch."),
                ("Seated Machine Row", "3 × 10–12 · back", "Chest on the pad, pull the handles to your torso leading with your elbows, squeeze your shoulder blades together, then control the return. No jerking with the lower back."),
                ("Dumbbell Lateral Raise", "3 × 12–15 · shoulders", "Slight bend in the elbows, raise the dumbbells out to the sides to shoulder height like pouring water, lead with the elbows. Light and smooth — this builds shoulder width."),
                ("Triceps Pushdown", "3 × 12–15 · arms", "Cable/machine, elbows pinned to your sides, push down until your arms are straight, control back up. Only the forearms move. Superset with the curls below."),
                ("Dumbbell Biceps Curl", "3 × 12–15 · arms", "Elbows at your sides, curl without swinging your torso, squeeze at the top, lower slowly. Superset with pushdowns to save time."),
                ("Optional: 12–15 min cardio", "finisher · fat loss", "Incline treadmill walk (try speed 3, incline 12), bike, or elliptical at moderate effort. Great for the fat-loss goal without hurting recovery."),
            ]},
            {"key": "LA", "title": "Lower A", "subtitle": "Lower body — quad focus", "exercises": [
                ("Smith Machine Squat", "3 × 8–10 · legs", "Bar on your traps (not your neck), feet slightly forward of the bar. Brace your core, sit down and back to at least parallel, drive up through mid-foot. The Smith lets you focus on depth without balancing a bar."),
                ("Leg Press", "3 × 10–12 · legs", "Feet shoulder-width, mid-platform. Lower until knees are ~90° keeping your lower back flat on the pad, press through your heels, don't slam the knees into a lock."),
                ("Seated Leg Curl", "3 × 10–12 · hamstrings", "Pad just above your heels, curl down and squeeze your hamstrings hard, then control the weight back up slowly — don't let it snap back."),
                ("Dumbbell Walking Lunges", "3 × 10/leg · legs", "A dumbbell in each hand, step out, drop the back knee toward the floor, torso tall, push through the front heel to stand. No walking space? Do reverse lunges in place."),
                ("Calf Raise", "3 × 15 · calves", "Balls of your feet on a step or the leg-press platform, rise up as high as you can, pause a beat at the top, lower slowly for a full stretch. Calves love the slow tempo."),
                ("Plank", "3 × 30–45 sec · core", "Forearms down, body in one straight line — no sagging hips, no piked butt. Squeeze glutes and abs and breathe. Add time as it gets easier."),
                ("Optional: 12–15 min cardio", "finisher · fat loss", "Keep it easy on leg day — bike or incline walk so you don't fry your legs. Skip it if they're toast; the lifting already did plenty."),
            ]},
            {"key": "UB", "title": "Upper B", "subtitle": "Upper body — back + arms", "exercises": [
                ("Incline Dumbbell Press", "3 × 8–10 · chest", "Bench at about 30°. Lower the dumbbells to your upper chest with elbows ~45°, press up and slightly together. Hits the upper chest for a fuller look."),
                ("Assisted Pull-Up", "3 × 8–10 · back", "Use the assist machine — set enough help to get 8–10 clean reps, pull your chin over the bar, control down. No assist machine at your location? Do close-grip lat pulldowns instead."),
                ("Machine Chest Press", "3 × 10–12 · chest", "Handles at mid-chest height, press out without locking hard, control back to a slight stretch. A safe way to push close to failure when you're training solo."),
                ("Reverse Pec Deck", "3 × 12–15 · rear delts", "Face the pad, arms out to the sides squeezing your shoulder blades, lead with the elbows. Bulletproofs your posture and shoulders. No machine? Bent-over dumbbell rear-delt raises."),
                ("Dumbbell Biceps Curl", "3 × 10–12 · arms", "Elbows at your sides, curl without swinging, slow on the way down. Alternate arms or do both together."),
                ("Overhead Dumbbell Triceps Extension", "3 × 10–12 · arms", "One dumbbell held overhead in both hands, lower it behind your head by bending the elbows, then extend back up. Keep your elbows pointing forward, not flaring out."),
                ("Optional: 12–15 min cardio", "finisher · fat loss", "Incline walk, bike, or elliptical at a moderate pace. Or hit the stairs — anything that keeps you moving supports the lean-out."),
            ]},
            {"key": "LB", "title": "Lower B", "subtitle": "Lower body — hamstring + glute focus", "exercises": [
                ("Dumbbell Romanian Deadlift", "3 × 8–10 · hamstrings/glutes", "Dumbbells in front of your thighs, soft knees, push your hips BACK (not down) like closing a car door with your butt. Let the dumbbells slide down your legs until you feel the hamstring stretch, then drive your hips forward to stand tall. Flat back the whole time."),
                ("Leg Extension", "3 × 12–15 · quads", "Pad resting on top of your shins, extend to straight, squeeze your quads at the top, lower under control. A safe, joint-friendly quad builder."),
                ("Smith Machine Reverse Lunge", "3 × 10/leg · legs", "Bar on your traps, step one foot back and drop that knee toward the floor, push through the front heel to return. Easier on the knees than forward lunges. Or do dumbbell Bulgarian split squats."),
                ("Lying Leg Curl", "3 × 10–12 · hamstrings", "If a lying curl is free, use it for a different angle than Lower A; otherwise repeat the seated curl. Curl and squeeze, control the return."),
                ("Hip Abduction Machine", "3 × 15 · glutes", "Push your knees outward against the pads, squeeze your glutes at the end, control back in. Builds the glutes and hip stability."),
                ("Captain's Chair Knee Raise", "3 × 12–15 · core", "Forearms on the pads, back flat against the pad, raise your knees toward your chest using your abs — no swinging — then lower slowly. Or do decline-bench crunches."),
                ("Optional: 12–15 min cardio", "finisher · fat loss", "Keep it light on leg day — an easy bike or incline walk. Steps outside the gym matter more here than smashing cardio right after leg work."),
            ]},
        ],
    },
]

NEW_PROGRAMS = [
    {
        "slug": "bodyweight-anywhere",
        "name": "Bodyweight — anywhere, no kit",
        "days": [
            {"key": "A", "title": "Day A · Push", "subtitle": "Chest, shoulders, triceps — floor only", "exercises": [
                ("Push-up (or incline push-up)", "3 × 8–15 · push", "Hands under shoulders, body one line from ear to heel. Too hard? Put your hands on a counter or the arm of the sofa — that's not cheating, it's the same movement at a workable angle."),
                ("Pike Push-up", "3 × 6–10 · push", "Hips high, head between your hands like an upside-down V. Lower the crown of your head toward the floor. This is the closest thing to an overhead press without a weight."),
                ("Bench/Chair Dip", "3 × 8–12 · push", "Hands on a chair edge behind you, legs out in front. Lower until your upper arms are parallel to the floor. Stop if it pinches the front of your shoulder — walk your feet in instead."),
                ("Wall Sit", "3 × 30–45 sec · legs", "Back flat to the wall, thighs parallel to the floor, knees over ankles. It's meant to burn. Breathe through it."),
                ("Hollow Hold", "3 × 20–30 sec · core", "Lie on your back, press your lower back into the floor, lift shoulders and legs. If your back arches, raise your legs higher until it doesn't."),
                ("Optional: 10 min brisk walk", "finisher · conditioning", "Outside if you can. This is for the mood, not the calories."),
            ]},
            {"key": "B", "title": "Day B · Pull & legs", "subtitle": "Back, hamstrings, glutes", "exercises": [
                ("Doorway/Table Row", "3 × 8–12 · pull", "Lie under a sturdy table and pull your chest to the edge, or hold a doorframe and lean back with straight arms. Squeeze the shoulder blades together at the top."),
                ("Bulgarian Split Squat", "3 × 8–10 each · legs", "Back foot on a chair, front foot far enough forward that your knee stays over your ankle. Down slow, up strong. Brutal without any weight at all."),
                ("Glute Bridge", "3 × 12–15 · hinge", "On your back, heels close to your bum, drive hips up and squeeze at the top for a second. Ribs down — don't arch your lower back to get higher."),
                ("Single-leg Calf Raise", "3 × 12–15 each · legs", "Hold a wall for balance. Full range: heel all the way down, all the way up. Slow on the way down."),
                ("Superman Hold", "3 × 20–30 sec · core", "Face down, lift chest and thighs off the floor. Look at the floor, not forward — keep your neck neutral."),
                ("Optional: stretch, 5 min", "finisher · conditioning", "Hamstrings, hip flexors, chest. Not optional if you sit all day, but marked optional so a rushed day still counts."),
            ]},
            {"key": "C", "title": "Day C · Full body", "subtitle": "Everything, moving quickly", "exercises": [
                ("Squat", "3 × 15–20 · legs", "Feet shoulder-width, sit down and back, chest up. High reps here — this is conditioning as much as strength."),
                ("Push-up", "3 × 8–15 · push", "Same as Day A. If Day A's felt easy, slow the lowering phase to three seconds."),
                ("Reverse Lunge", "3 × 10 each · legs", "Step back, not forward — much kinder on the knees. Front shin stays vertical."),
                ("Doorway/Table Row", "3 × 8–12 · pull", "Pulling twice a week is the point; most bodyweight plans skip it entirely and people end up rounded forward."),
                ("Dead Bug", "3 × 10 each · core", "On your back, opposite arm and leg extend while your lower back stays glued to the floor. Slow. If your back lifts, shorten the range."),
                ("Optional: 10 min cardio", "finisher · conditioning", "Stairs, a walk, skipping, anything. Easy effort."),
            ]},
        ],
    },
    {
        "slug": "fat-loss-full-body",
        "name": "Lean Down — 3 days, full body",
        "days": [
            {"key": "A", "title": "Day A · Lower + carry", "subtitle": "Big movements, short rests", "exercises": [
                ("Goblet Squat", "3 × 10–12 · legs", "Hold one dumbbell at your chest like a goblet. Elbows inside your knees at the bottom. Easier to keep upright than a back squat, which is why it's here."),
                ("Dumbbell Romanian Deadlift", "3 × 10–12 · hinge", "Push your hips back, dumbbells sliding down your thighs. Stop when you feel the hamstring stretch — going lower just rounds your back."),
                ("Walking Lunge", "3 × 12 each · legs", "Long strides. If your balance is shaky, do reverse lunges in place instead."),
                ("Farmer's Carry", "3 × 40 m · core", "Heaviest dumbbells you can hold with a straight back. Walk. This is core work that doesn't feel like core work, and it burns more than it looks."),
                ("Incline Walk", "12 min · conditioning", "Treadmill at a real incline, or a hill. Brisk but conversational — this is not a sprint session and it is not meant to wreck you."),
            ]},
            {"key": "B", "title": "Day B · Upper + intervals", "subtitle": "Push, pull, then bike", "exercises": [
                ("Dumbbell Bench Press", "3 × 8–12 · push", "Shoulder blades pinched back into the bench. Elbows about 45 degrees from your body, not flared straight out."),
                ("Seated Cable Row", "3 × 10–12 · pull", "Chest tall, pull to your belly button, squeeze for a beat. Don't rock backwards to move more weight."),
                ("Dumbbell Shoulder Press", "3 × 10–12 · push", "Seated with back support. Press up, don't lean back to turn it into an incline press."),
                ("Lat Pulldown", "3 × 10–12 · pull", "Drive elbows down toward your hips. Wide grip, no swinging."),
                ("Bike Intervals", "8 × 30 sec hard / 90 sec easy · conditioning", "Hard means you couldn't hold a conversation. Easy means you fully recover. If you can't finish all eight, you went too hard on the first two."),
            ]},
            {"key": "C", "title": "Day C · Circuit", "subtitle": "Three rounds, minimal rest", "exercises": [
                ("Kettlebell/Dumbbell Swing", "3 × 15 · hinge", "Hips snap forward, the weight floats — it's a hinge, not a squat, and definitely not a front raise. Arms are rope."),
                ("Push-up", "3 × 10–15 · push", "Hands on a bench if the floor is too much today. Keep moving."),
                ("Dumbbell Row", "3 × 12 each · pull", "One hand on a bench, pull the dumbbell to your hip. Don't twist your torso to help."),
                ("Step-up", "3 × 12 each · legs", "Onto a bench about knee height. Push through the top foot, don't hop off the bottom one."),
                ("Plank", "3 × 30–45 sec · core", "Straight line, glutes tight. Rest 30 seconds between rounds and go again."),
                ("Optional: 10 min walk", "finisher · conditioning", "Cool down and let your heart rate come back to earth."),
            ]},
        ],
    },
    {
        "slug": "push-pull-legs-muscle",
        "name": "Push / Pull / Legs — build muscle",
        "days": [
            {"key": "A", "title": "Day A · Push", "subtitle": "Chest, shoulders, triceps", "exercises": [
                ("Barbell Bench Press", "4 × 6–8 · push", "Feet planted, shoulder blades retracted. Bar to mid-chest, elbows tucked to about 45 degrees. Have a spotter or use the safety pins."),
                ("Incline Dumbbell Press", "3 × 8–12 · push", "Bench at 30 degrees. Higher than that and it becomes a shoulder press."),
                ("Overhead Press", "3 × 6–10 · push", "Standing, squeeze your glutes so you don't lean back. Bar path goes past your face, not around it."),
                ("Cable Fly", "3 × 12–15 · push", "Slight bend in the elbows, held constant. Think about hugging a barrel. Squeeze at the middle."),
                ("Triceps Rope Pushdown", "3 × 12–15 · push", "Elbows pinned to your sides. Only the forearms move. Spread the rope at the bottom."),
                ("Lateral Raise", "3 × 15–20 · push", "Light. Lead with the elbows, stop at shoulder height. This is the one that actually makes shoulders look wider."),
            ]},
            {"key": "B", "title": "Day B · Pull", "subtitle": "Back, rear delts, biceps", "exercises": [
                ("Pull-up or Lat Pulldown", "4 × 6–10 · pull", "Full hang at the bottom, chin over the bar at the top. Use the assisted machine or a band rather than doing half reps."),
                ("Barbell Row", "4 × 8–10 · pull", "Torso about 45 degrees, pull to your belly button. If you're jerking the weight up with your lower back, it's too heavy."),
                ("Seated Cable Row", "3 × 10–12 · pull", "Chest proud, shoulder blades squeezing together at the end of each rep."),
                ("Face Pull", "3 × 15–20 · pull", "Rope to your forehead, elbows high, externally rotate at the end. This is the single best insurance policy for shoulders that bench a lot."),
                ("Dumbbell Curl", "3 × 10–12 · pull", "No swinging. If your elbows drift forward, the weight's too heavy."),
                ("Hammer Curl", "3 × 10–12 · pull", "Neutral grip, thumbs up. Hits the forearm and the part of the biceps that adds thickness."),
            ]},
            {"key": "C", "title": "Day C · Legs", "subtitle": "Quads, hamstrings, glutes, calves", "exercises": [
                ("Barbell Back Squat", "4 × 6–8 · legs", "Brace hard, sit down and back, at least parallel. This is the one exercise worth being fussy about form on."),
                ("Romanian Deadlift", "3 × 8–10 · hinge", "Hips back, flat back, bar close. Feel it in the hamstrings, not the lower back."),
                ("Leg Press", "3 × 10–12 · legs", "Don't lock out hard at the top and don't let your lower back round off the pad at the bottom."),
                ("Leg Curl", "3 × 12–15 · legs", "Slow on the way back. Hamstrings respond well to the lowering half."),
                ("Walking Lunge", "3 × 10 each · legs", "Long strides, upright torso."),
                ("Standing Calf Raise", "4 × 12–15 · legs", "Full stretch at the bottom, pause at the top. Calves need the range, not the weight."),
            ]},
        ],
    },
]

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
    "bodyweight-anywhere": {
        "slug": "bodyweight-anywhere",
        "name": "Bodyweight — anywhere, no kit",
        "description": (
            "Three rotating days you can do in a hotel room, a garage or a "
            "living room. No equipment beyond a chair and a wall. Pulls are "
            "included, which most bodyweight plans skip."
        ),
    },
    "fat-loss-full-body": {
        "slug": "fat-loss-full-body",
        "name": "Lean Down — 3 days, full body",
        "description": (
            "Three full-body days with short rests and a conditioning finisher "
            "on each. Built for losing weight without living in the gym: "
            "compound lifts first, intervals last, nothing longer than an hour."
        ),
    },
    "push-pull-legs-muscle": {
        "slug": "push-pull-legs-muscle",
        "name": "Push / Pull / Legs — build muscle",
        "description": (
            "The classic hypertrophy split, run three or six days a week. "
            "Higher volume per muscle than the full-body plans. Needs a proper "
            "gym with barbells, cables and machines."
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


def set_count(scheme):
    """Parse the number of sets from a scheme like '3 × 8–10' -> 3.
    Falls back to 1 for warm-ups / finishers with no leading 'N ×'."""
    m = re.match(r"\s*(\d+)\s*[×x]", scheme or "")
    if m:
        n = int(m.group(1))
        return max(1, min(n, 6))
    return 1


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
                f"{set_count(scheme)}, {work_seconds(scheme)}, "
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


ALL_GYM_PROGRAMS = PROGRAMS + NEW_PROGRAMS


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--only",
        help=(
            "Comma-separated template slugs to emit. Use this to write a DELTA "
            "migration when the full template migration has already been "
            "applied — db push tracks migrations by filename and will not "
            "re-run one it has seen."
        ),
    )
    args = ap.parse_args()

    wanted = None
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        known = {GYM_TEMPLATE_META[p["slug"]]["slug"] for p in ALL_GYM_PROGRAMS}
        known.add(FOOD_TEMPLATE["slug"])
        unknown = wanted - known
        if unknown:
            sys.exit(f"unknown slug(s): {', '.join(sorted(unknown))}")

    out = [
        "-- ============================================================",
        "--  Streakproof — template library (generated by gen_seed.py)",
        "--  Applied by `supabase db push`. Safe to re-run: every insert is an",
        "--  upsert on the template slug, and user plans are never touched.",
        "--",
        "--  DO NOT EDIT BY HAND. Edit gen_seed.py and regenerate.",
        "-- ============================================================",
        "",
    ]

    for prog in ALL_GYM_PROGRAMS:
        slug = GYM_TEMPLATE_META[prog["slug"]]["slug"]
        if wanted is None or slug in wanted:
            emit_gym(out, prog)

    if wanted is None or FOOD_TEMPLATE["slug"] in wanted:
        emit_food(out, FOOD_TEMPLATE)

    print("\n".join(out))


if __name__ == "__main__":
    main()
