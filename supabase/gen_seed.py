#!/usr/bin/env python3
"""Generates seed.sql from the program definitions below.
Run:  python3 gen_seed.py > seed.sql
Kept in the repo so the programs are easy to edit and regenerate."""

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


import re


def q(s):
    """SQL-escape a string literal."""
    if s is None:
        return "null"
    return "'" + s.replace("'", "''") + "'"


def set_count(scheme):
    """Parse the number of sets from a scheme like '3 × 8–10' -> 3.
    Falls back to 1 for warm-ups / finishers with no leading 'N ×'."""
    m = re.match(r"\s*(\d+)\s*[×x]", scheme or "")
    if m:
        n = int(m.group(1))
        return max(1, min(n, 6))
    return 1


def main():
    out = []
    out.append("-- ============================================================")
    out.append("--  Gym Tracker — seed data (workout programs)")
    out.append("--  Run AFTER schema.sql. Safe to re-run (idempotent upserts).")
    out.append("-- ============================================================\n")

    # Programs
    out.append("insert into programs (slug, name) values")
    rows = [f"  ({q(p['slug'])}, {q(p['name'])})" for p in PROGRAMS]
    out.append(",\n".join(rows) + "\non conflict (slug) do update set name = excluded.name;\n")

    # Days
    out.append("insert into days (program_id, key, title, subtitle, sort)")
    out.append("select p.id, d.key, d.title, d.subtitle, d.sort")
    out.append("from programs p join (values")
    drows = []
    for p in PROGRAMS:
        for i, d in enumerate(p["days"], start=1):
            drows.append(
                f"  ({q(p['slug'])}, {q(d['key'])}, {q(d['title'])}, {q(d['subtitle'])}, {i})"
            )
    out.append(",\n".join(drows))
    out.append(") as d(slug, key, title, subtitle, sort) on d.slug = p.slug")
    out.append("on conflict (program_id, key) do update")
    out.append("  set title = excluded.title, subtitle = excluded.subtitle, sort = excluded.sort;\n")

    # Exercises
    out.append("insert into exercises (day_id, name, scheme, cue, sets, sort)")
    out.append("select dd.id, e.name, e.scheme, e.cue, e.sets, e.sort")
    out.append("from (values")
    erows = []
    for p in PROGRAMS:
        for d in p["days"]:
            for i, (name, scheme, cue) in enumerate(d["exercises"], start=1):
                erows.append(
                    f"  ({q(p['slug'])}, {q(d['key'])}, {q(name)}, {q(scheme)}, {q(cue)}, {set_count(scheme)}, {i})"
                )
    out.append(",\n".join(erows))
    out.append(") as e(slug, day_key, name, scheme, cue, sets, sort)")
    out.append("join programs p on p.slug = e.slug")
    out.append("join days dd on dd.program_id = p.id and dd.key = e.day_key")
    out.append("on conflict (day_id, name) do update")
    out.append("  set scheme = excluded.scheme, cue = excluded.cue, sets = excluded.sets, sort = excluded.sort;")

    print("\n".join(out))


if __name__ == "__main__":
    main()
