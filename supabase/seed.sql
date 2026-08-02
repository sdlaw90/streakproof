-- ============================================================
--  Gym Tracker — seed data (workout programs)
--  Run AFTER schema.sql. Safe to re-run (idempotent upserts).
-- ============================================================

insert into programs (slug, name) values
  ('sean-fullbody', 'Sean — Full Body + Pool'),
  ('ely-pf-upperlower', 'Ely — Planet Fitness Upper/Lower')
on conflict (slug) do update set name = excluded.name;

insert into days (program_id, key, title, subtitle, sort)
select p.id, d.key, d.title, d.subtitle, d.sort
from programs p join (values
  ('sean-fullbody', 'A', 'Day A · Squat', 'Full body — squat focus', 1),
  ('sean-fullbody', 'B', 'Day B · Hinge', 'Full body — hinge focus', 2),
  ('sean-fullbody', 'C', 'Day C · Athletic', 'Full body — athletic + conditioning', 3),
  ('sean-fullbody', 'P', 'Pool', 'Bodyweight only — low-impact conditioning', 4),
  ('ely-pf-upperlower', 'UA', 'Upper A', 'Upper body — push + pull', 1),
  ('ely-pf-upperlower', 'LA', 'Lower A', 'Lower body — quad focus', 2),
  ('ely-pf-upperlower', 'UB', 'Upper B', 'Upper body — back + arms', 3),
  ('ely-pf-upperlower', 'LB', 'Lower B', 'Lower body — hamstring + glute focus', 4)
) as d(slug, key, title, subtitle, sort) on d.slug = p.slug
on conflict (program_id, key) do update
  set title = excluded.title, subtitle = excluded.subtitle, sort = excluded.sort;

insert into exercises (day_id, name, scheme, cue, sets, sort)
select dd.id, e.name, e.scheme, e.cue, e.sets, e.sort
from (values
  ('sean-fullbody', 'A', 'Barbell Back Squat', '3 × 6–8 · legs', 'Bar on your traps, not your neck. Brace like someone''s about to poke your gut, sit down & back (knees track over toes), drive up through mid-foot. Go to at least parallel.', 3, 1),
  ('sean-fullbody', 'A', 'Dumbbell Bench Press', '3 × 8–10 · push', 'Slight arch, shoulder blades pinched back & down. Lower the dumbbells to chest level with elbows ~45°, press up and slightly together.', 3, 2),
  ('sean-fullbody', 'A', 'Lat Pulldown', '3 × 8–12 · pull', 'Chest tall, pull the bar to your collarbone by driving elbows down toward your hips. Don''t lean way back. Squeeze your back, don''t just yank with arms.', 3, 3),
  ('sean-fullbody', 'A', 'Leg Press', '3 × 10–12 · legs', 'Feet shoulder-width mid-platform. Lower until knees ~90°, keep lower back flat on the pad. Push through heels, don''t lock knees hard at the top.', 3, 4),
  ('sean-fullbody', 'A', 'Plank', '3 × 30–45 sec · core', 'Forearms down, body one straight line — no saggy hips, no piked butt. Squeeze glutes and abs. Breathe. Add time as it gets easy.', 3, 5),
  ('sean-fullbody', 'A', 'Optional: 10 min cardio', 'finisher · conditioning', 'Easy-to-moderate. Bike, row, or incline walk. Purely for the energy/mood boost and recovery — don''t smoke yourself.', 1, 6),
  ('sean-fullbody', 'B', 'Romanian Deadlift (RDL)', '3 × 6–8 · hinge', 'Soft knees, push hips BACK (not down) like closing a car door with your butt. Bar slides down your thighs, feel the hamstring stretch, then drive hips forward to stand tall. Flat back the whole time.', 3, 1),
  ('sean-fullbody', 'B', 'Overhead Press (DB or barbell)', '3 × 8–10 · push', 'Brace core, squeeze glutes so you don''t lean back. Press straight up, biceps ending near ears. Don''t let it drift forward. If your lower back arches hard, lighten it.', 3, 2),
  ('sean-fullbody', 'B', 'Chest-Supported Row', '3 × 10–12 · pull', 'Chest on the pad. Row the weight to your lower ribs by pulling elbows back and squeezing shoulder blades together. Pause a beat at the top. Controlled on the way down.', 3, 3),
  ('sean-fullbody', 'B', 'Walking Lunges', '3 × 10/leg · legs', 'Long-ish step, drop the back knee toward the floor, torso upright. Push through the FRONT heel to stand. Great carryover to sprinting on the field.', 3, 4),
  ('sean-fullbody', 'B', 'Pallof Press', '3 × 10/side · core', 'Cable at chest height, stand side-on. Press the handle straight out and resist it pulling you toward the machine. Anti-rotation = a bulletproof core for twisting/throwing.', 3, 5),
  ('sean-fullbody', 'B', 'Optional: intervals', 'finisher · conditioning', '6–8 rounds: 20 sec hard (bike/row/assault), 40 sec easy. Big bang for fat loss and matches the stop-start of dodgeball.', 1, 6),
  ('sean-fullbody', 'C', 'Trap-Bar Deadlift', '3 × 6–8 · hinge/legs', 'Stand inside the trap bar, hips between squat and RDL height, flat back, chest up. Push the floor away with your feet and stand tall. Easiest deadlift to learn — very knee/back friendly.', 3, 1),
  ('sean-fullbody', 'C', 'Incline Dumbbell Press', '3 × 8–10 · push', 'Bench at ~30°. Lower dumbbells to upper chest, elbows ~45°, press up. Hits the upper chest and shoulders — good for that athletic look.', 3, 2),
  ('sean-fullbody', 'C', 'Single-Arm Dumbbell Row', '3 × 10/arm · pull', 'One hand & knee on a bench, flat back. Row the dumbbell to your hip, elbow close to your side, squeeze at the top. Don''t twist your torso to cheat it up.', 3, 3),
  ('sean-fullbody', 'C', 'Face Pulls', '3 × 15 · pull/health', 'Rope at face height, pull toward your forehead with elbows high, thumbs going back. Bulletproofs your shoulders for all that overhead throwing. Light weight, high reps.', 3, 4),
  ('sean-fullbody', 'C', 'Farmer Carry', '3 × ~30 m · core/grip', 'Heavy dumbbell in each hand, stand tall, shoulders back, brace core, walk. Don''t lean. Builds a rock-solid trunk and crushing grip — pure athlete fuel.', 3, 5),
  ('sean-fullbody', 'C', 'Hanging Knee Raises', '3 × 10–15 · core', 'Hang from the bar, no swinging. Curl your knees up toward your chest using your abs (not momentum). Lower slow. Use an ab-strap station if grip gives out first.', 3, 6),
  ('sean-fullbody', 'P', 'Warm-up swim / water walk', '5 min · warm-up', 'Easy laps of any stroke, or just walk/jog across the shallow end pushing through the water. Get your body temp up and shoulders loose before the harder stuff.', 1, 1),
  ('sean-fullbody', 'P', 'Aqua jog', '4 × 1 min · conditioning', 'Run in place or across the deep end with no bottom contact (or high-knee run in chest-deep water). Drive knees up, pump arms. Water resistance = great engine work with zero joint pounding.', 4, 2),
  ('sean-fullbody', 'P', 'Pool jump squats', '3 × 12 · legs/power', 'Chest-deep water, sink into a squat and explode UP as high as you can, letting the water slow your landing. Builds jumping power with almost no impact on the knees.', 3, 3),
  ('sean-fullbody', 'P', 'Lateral bounds / shuffles', '3 × 30 sec · agility', 'Waist-to-chest deep, bound or shuffle side to side, pushing hard against the water. Trains the side-to-side dodge you use in dodgeball.', 3, 4),
  ('sean-fullbody', 'P', 'Pool-edge push-ups', '3 × 8–12 · push', 'Hands on the pool deck/edge, press your torso up out of the water like a push-up/dip, then lower under control. Hits chest, shoulders and triceps.', 3, 5),
  ('sean-fullbody', 'P', 'Flutter kicks on the wall', '3 × 30 sec · core/legs', 'Hold the edge, extend your body out behind you on the surface, and flutter kick from the hips. Keep your core tight so your hips don''t sink.', 3, 6),
  ('sean-fullbody', 'P', 'Treading water', '3 × 45 sec · full-body', 'Deep end, stay afloat using sculling arm circles and an eggbeater/flutter kick. For a challenge, hold hands out of the water so your legs do all the work.', 3, 7),
  ('sean-fullbody', 'P', 'Easy cool-down swim', '3–5 min · recovery', 'Slow laps or a relaxed float. Let your heart rate come down. Pool time doubles as the mood/stress reset.', 1, 8),
  ('ely-pf-upperlower', 'UA', 'Smith Machine Bench Press', '3 × 8–10 · chest', 'Set the bench so the bar lines up with your mid-chest. Twist to unrack, lower to your chest with elbows about 45°, press up. The fixed bar path makes this safe to push solo.', 3, 1),
  ('ely-pf-upperlower', 'UA', 'Lat Pulldown', '3 × 10–12 · back', 'Grip a bit wider than shoulders, chest tall, pull the bar to your collarbone by driving your elbows down toward your hips. Squeeze your back — don''t lean way back or yank with just the arms.', 3, 2),
  ('ely-pf-upperlower', 'UA', 'Dumbbell Shoulder Press', '3 × 10–12 · shoulders', 'Seated with back support. Press from ear height to overhead without clanging the dumbbells together. Keep your ribs down so your lower back doesn''t arch.', 3, 3),
  ('ely-pf-upperlower', 'UA', 'Seated Machine Row', '3 × 10–12 · back', 'Chest on the pad, pull the handles to your torso leading with your elbows, squeeze your shoulder blades together, then control the return. No jerking with the lower back.', 3, 4),
  ('ely-pf-upperlower', 'UA', 'Dumbbell Lateral Raise', '3 × 12–15 · shoulders', 'Slight bend in the elbows, raise the dumbbells out to the sides to shoulder height like pouring water, lead with the elbows. Light and smooth — this builds shoulder width.', 3, 5),
  ('ely-pf-upperlower', 'UA', 'Triceps Pushdown', '3 × 12–15 · arms', 'Cable/machine, elbows pinned to your sides, push down until your arms are straight, control back up. Only the forearms move. Superset with the curls below.', 3, 6),
  ('ely-pf-upperlower', 'UA', 'Dumbbell Biceps Curl', '3 × 12–15 · arms', 'Elbows at your sides, curl without swinging your torso, squeeze at the top, lower slowly. Superset with pushdowns to save time.', 3, 7),
  ('ely-pf-upperlower', 'UA', 'Optional: 12–15 min cardio', 'finisher · fat loss', 'Incline treadmill walk (try speed 3, incline 12), bike, or elliptical at moderate effort. Great for the fat-loss goal without hurting recovery.', 1, 8),
  ('ely-pf-upperlower', 'LA', 'Smith Machine Squat', '3 × 8–10 · legs', 'Bar on your traps (not your neck), feet slightly forward of the bar. Brace your core, sit down and back to at least parallel, drive up through mid-foot. The Smith lets you focus on depth without balancing a bar.', 3, 1),
  ('ely-pf-upperlower', 'LA', 'Leg Press', '3 × 10–12 · legs', 'Feet shoulder-width, mid-platform. Lower until knees are ~90° keeping your lower back flat on the pad, press through your heels, don''t slam the knees into a lock.', 3, 2),
  ('ely-pf-upperlower', 'LA', 'Seated Leg Curl', '3 × 10–12 · hamstrings', 'Pad just above your heels, curl down and squeeze your hamstrings hard, then control the weight back up slowly — don''t let it snap back.', 3, 3),
  ('ely-pf-upperlower', 'LA', 'Dumbbell Walking Lunges', '3 × 10/leg · legs', 'A dumbbell in each hand, step out, drop the back knee toward the floor, torso tall, push through the front heel to stand. No walking space? Do reverse lunges in place.', 3, 4),
  ('ely-pf-upperlower', 'LA', 'Calf Raise', '3 × 15 · calves', 'Balls of your feet on a step or the leg-press platform, rise up as high as you can, pause a beat at the top, lower slowly for a full stretch. Calves love the slow tempo.', 3, 5),
  ('ely-pf-upperlower', 'LA', 'Plank', '3 × 30–45 sec · core', 'Forearms down, body in one straight line — no sagging hips, no piked butt. Squeeze glutes and abs and breathe. Add time as it gets easier.', 3, 6),
  ('ely-pf-upperlower', 'LA', 'Optional: 12–15 min cardio', 'finisher · fat loss', 'Keep it easy on leg day — bike or incline walk so you don''t fry your legs. Skip it if they''re toast; the lifting already did plenty.', 1, 7),
  ('ely-pf-upperlower', 'UB', 'Incline Dumbbell Press', '3 × 8–10 · chest', 'Bench at about 30°. Lower the dumbbells to your upper chest with elbows ~45°, press up and slightly together. Hits the upper chest for a fuller look.', 3, 1),
  ('ely-pf-upperlower', 'UB', 'Assisted Pull-Up', '3 × 8–10 · back', 'Use the assist machine — set enough help to get 8–10 clean reps, pull your chin over the bar, control down. No assist machine at your location? Do close-grip lat pulldowns instead.', 3, 2),
  ('ely-pf-upperlower', 'UB', 'Machine Chest Press', '3 × 10–12 · chest', 'Handles at mid-chest height, press out without locking hard, control back to a slight stretch. A safe way to push close to failure when you''re training solo.', 3, 3),
  ('ely-pf-upperlower', 'UB', 'Reverse Pec Deck', '3 × 12–15 · rear delts', 'Face the pad, arms out to the sides squeezing your shoulder blades, lead with the elbows. Bulletproofs your posture and shoulders. No machine? Bent-over dumbbell rear-delt raises.', 3, 4),
  ('ely-pf-upperlower', 'UB', 'Dumbbell Biceps Curl', '3 × 10–12 · arms', 'Elbows at your sides, curl without swinging, slow on the way down. Alternate arms or do both together.', 3, 5),
  ('ely-pf-upperlower', 'UB', 'Overhead Dumbbell Triceps Extension', '3 × 10–12 · arms', 'One dumbbell held overhead in both hands, lower it behind your head by bending the elbows, then extend back up. Keep your elbows pointing forward, not flaring out.', 3, 6),
  ('ely-pf-upperlower', 'UB', 'Optional: 12–15 min cardio', 'finisher · fat loss', 'Incline walk, bike, or elliptical at a moderate pace. Or hit the stairs — anything that keeps you moving supports the lean-out.', 1, 7),
  ('ely-pf-upperlower', 'LB', 'Dumbbell Romanian Deadlift', '3 × 8–10 · hamstrings/glutes', 'Dumbbells in front of your thighs, soft knees, push your hips BACK (not down) like closing a car door with your butt. Let the dumbbells slide down your legs until you feel the hamstring stretch, then drive your hips forward to stand tall. Flat back the whole time.', 3, 1),
  ('ely-pf-upperlower', 'LB', 'Leg Extension', '3 × 12–15 · quads', 'Pad resting on top of your shins, extend to straight, squeeze your quads at the top, lower under control. A safe, joint-friendly quad builder.', 3, 2),
  ('ely-pf-upperlower', 'LB', 'Smith Machine Reverse Lunge', '3 × 10/leg · legs', 'Bar on your traps, step one foot back and drop that knee toward the floor, push through the front heel to return. Easier on the knees than forward lunges. Or do dumbbell Bulgarian split squats.', 3, 3),
  ('ely-pf-upperlower', 'LB', 'Lying Leg Curl', '3 × 10–12 · hamstrings', 'If a lying curl is free, use it for a different angle than Lower A; otherwise repeat the seated curl. Curl and squeeze, control the return.', 3, 4),
  ('ely-pf-upperlower', 'LB', 'Hip Abduction Machine', '3 × 15 · glutes', 'Push your knees outward against the pads, squeeze your glutes at the end, control back in. Builds the glutes and hip stability.', 3, 5),
  ('ely-pf-upperlower', 'LB', 'Captain''s Chair Knee Raise', '3 × 12–15 · core', 'Forearms on the pads, back flat against the pad, raise your knees toward your chest using your abs — no swinging — then lower slowly. Or do decline-bench crunches.', 3, 6),
  ('ely-pf-upperlower', 'LB', 'Optional: 12–15 min cardio', 'finisher · fat loss', 'Keep it light on leg day — an easy bike or incline walk. Steps outside the gym matter more here than smashing cardio right after leg work.', 1, 7)
) as e(slug, day_key, name, scheme, cue, sets, sort)
join programs p on p.slug = e.slug
join days dd on dd.program_id = p.id and dd.key = e.day_key
on conflict (day_id, name) do update
  set scheme = excluded.scheme, cue = excluded.cue, sets = excluded.sets, sort = excluded.sort;
