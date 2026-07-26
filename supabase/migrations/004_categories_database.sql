-- Moves word categories from hardcoded client-side arrays (src/data/categories.ts
-- in this repo, App.tsx's defaultCategories in the web repo) into the database,
-- so both platforms read from one source of truth and word-list edits no longer
-- require an app-store resubmission (iOS) or a redeploy (web) for every change.
--
-- Schema is unified for free AND premium categories, per the monetization brief's
-- packs/entitlements plan -- rather than building a separate packs/pack_words
-- system later, premium categories are just rows here with is_premium = true.
-- This is intentional: adding entitlement-gated premium categories later only
-- means adding rows + wiring up a secure serving RPC (mirroring
-- 001_private_round_secrets.sql's round_secrets pattern), not reshaping this
-- table -- staying consistent with the "additive only, never reshape" rule.
--
-- RLS split: `categories` metadata (id/label/premium flag/price) is not secret,
-- so it's openly readable -- both apps need to list what's available, including
-- a future "buy this pack" catalog. `category_words` content is openly readable
-- ONLY for non-premium categories; premium category words stay hidden from
-- direct anon SELECT until a future entitlement-checked round-start function
-- serves them (a premium category simply returns zero word rows to anon until
-- then -- safe, not a functional regression since no premium categories exist
-- yet).
--
-- Fully additive. Seeds the 12 existing free categories (440 words total),
-- generated programmatically from src/data/categories.ts to guarantee the
-- content exactly matches what's already shipped -- no manual transcription.
--
-- Safe to run multiple times.

create table if not exists public.categories (
  id text primary key,
  label text not null,
  is_premium boolean not null default false,
  price_cents int,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.category_words (
  id bigint generated always as identity primary key,
  category_id text not null references public.categories(id) on delete cascade,
  word text not null,
  unique (category_id, word)
);

alter table public.categories enable row level security;
alter table public.category_words enable row level security;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
  for select
  using (active = true);

drop policy if exists "category_words_public_read_free_only" on public.category_words;
create policy "category_words_public_read_free_only" on public.category_words
  for select
  using (
    exists (
      select 1 from public.categories c
      where c.id = category_words.category_id
        and c.is_premium = false
        and c.active = true
    )
  );

grant select on public.categories to anon;
grant select on public.category_words to anon;

-- ---------------------------------------------------------------------
-- Seed data generated programmatically from src/data/categories.ts to
-- guarantee exact fidelity with the currently-shipped word lists.
-- ---------------------------------------------------------------------

insert into public.categories (id, label, is_premium, active, sort_order) values ('animals', 'Animals', false, true, 0) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('animals', 'giraffe'),
  ('animals', 'lion'),
  ('animals', 'otter'),
  ('animals', 'falcon'),
  ('animals', 'horse'),
  ('animals', 'elephant'),
  ('animals', 'tiger'),
  ('animals', 'penguin'),
  ('animals', 'dolphin'),
  ('animals', 'shark'),
  ('animals', 'koala'),
  ('animals', 'kangaroo'),
  ('animals', 'zebra'),
  ('animals', 'rhinoceros'),
  ('animals', 'hippopotamus'),
  ('animals', 'cheetah'),
  ('animals', 'wolf'),
  ('animals', 'fox'),
  ('animals', 'bear'),
  ('animals', 'panda'),
  ('animals', 'eagle'),
  ('animals', 'owl'),
  ('animals', 'parrot'),
  ('animals', 'crocodile'),
  ('animals', 'turtle'),
  ('animals', 'octopus'),
  ('animals', 'jellyfish'),
  ('animals', 'seahorse'),
  ('animals', 'butterfly'),
  ('animals', 'bee'),
  ('animals', 'gorilla'),
  ('animals', 'camel'),
  ('animals', 'sloth'),
  ('animals', 'rabbit'),
  ('animals', 'squirrel'),
  ('animals', 'peacock'),
  ('animals', 'flamingo'),
  ('animals', 'moose'),
  ('animals', 'deer'),
  ('animals', 'raccoon')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('foods', 'Foods', false, true, 1) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('foods', 'pizza'),
  ('foods', 'sushi'),
  ('foods', 'taco'),
  ('foods', 'ramen'),
  ('foods', 'donut'),
  ('foods', 'burger'),
  ('foods', 'pasta'),
  ('foods', 'steak'),
  ('foods', 'pancake'),
  ('foods', 'waffle'),
  ('foods', 'burrito'),
  ('foods', 'quesadilla'),
  ('foods', 'lasagna'),
  ('foods', 'salad'),
  ('foods', 'sandwich'),
  ('foods', 'hot dog'),
  ('foods', 'fried chicken'),
  ('foods', 'macaroni'),
  ('foods', 'ice cream'),
  ('foods', 'brownie'),
  ('foods', 'cupcake'),
  ('foods', 'cheesecake'),
  ('foods', 'popcorn'),
  ('foods', 'pretzel'),
  ('foods', 'nachos'),
  ('foods', 'cereal'),
  ('foods', 'omelet'),
  ('foods', 'bacon'),
  ('foods', 'meatball'),
  ('foods', 'dumpling'),
  ('foods', 'curry'),
  ('foods', 'soup'),
  ('foods', 'lobster'),
  ('foods', 'shrimp'),
  ('foods', 'watermelon'),
  ('foods', 'pineapple'),
  ('foods', 'strawberry'),
  ('foods', 'avocado'),
  ('foods', 'cookie'),
  ('foods', 'chocolate')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('heroes', 'Heroes & Villains', false, true, 2) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('heroes', 'Spider-Man'),
  ('heroes', 'Iron Man'),
  ('heroes', 'Black Widow'),
  ('heroes', 'Thor'),
  ('heroes', 'Loki'),
  ('heroes', 'Batman'),
  ('heroes', 'Superman'),
  ('heroes', 'Wonder Woman'),
  ('heroes', 'Hulk'),
  ('heroes', 'Captain America'),
  ('heroes', 'Black Panther'),
  ('heroes', 'Doctor Strange'),
  ('heroes', 'Deadpool'),
  ('heroes', 'Wolverine'),
  ('heroes', 'Aquaman'),
  ('heroes', 'The Flash'),
  ('heroes', 'Green Lantern'),
  ('heroes', 'Joker'),
  ('heroes', 'Harley Quinn'),
  ('heroes', 'Thanos'),
  ('heroes', 'Venom'),
  ('heroes', 'Darth Vader'),
  ('heroes', 'Luke Skywalker'),
  ('heroes', 'Yoda'),
  ('heroes', 'Princess Leia'),
  ('heroes', 'Mandalorian'),
  ('heroes', 'Shrek'),
  ('heroes', 'Elsa'),
  ('heroes', 'Buzz Lightyear'),
  ('heroes', 'Woody'),
  ('heroes', 'Mr. Incredible'),
  ('heroes', 'Katniss'),
  ('heroes', 'Harry Potter'),
  ('heroes', 'Hermione'),
  ('heroes', 'Gandalf')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('movies', 'Movies & TV', false, true, 3) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('movies', 'Titanic'),
  ('movies', 'Jaws'),
  ('movies', 'Frozen'),
  ('movies', 'Avatar'),
  ('movies', 'Jurassic Park'),
  ('movies', 'Toy Story'),
  ('movies', 'The Lion King'),
  ('movies', 'Home Alone'),
  ('movies', 'The Matrix'),
  ('movies', 'Rocky'),
  ('movies', 'Ghostbusters'),
  ('movies', 'Finding Nemo'),
  ('movies', 'The Avengers'),
  ('movies', 'Star Wars'),
  ('movies', 'Harry Potter'),
  ('movies', 'Shrek'),
  ('movies', 'Moana'),
  ('movies', 'Coco'),
  ('movies', 'Encanto'),
  ('movies', 'The Office'),
  ('movies', 'Friends'),
  ('movies', 'Stranger Things'),
  ('movies', 'Wednesday'),
  ('movies', 'Bluey'),
  ('movies', 'SpongeBob'),
  ('movies', 'Scooby-Doo'),
  ('movies', 'The Simpsons'),
  ('movies', 'Game of Thrones'),
  ('movies', 'Breaking Bad'),
  ('movies', 'Top Gun'),
  ('movies', 'Barbie'),
  ('movies', 'Oppenheimer'),
  ('movies', 'Inside Out'),
  ('movies', 'Cars'),
  ('movies', 'The Incredibles')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('sports', 'Sports', false, true, 4) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('sports', 'football'),
  ('sports', 'basketball'),
  ('sports', 'baseball'),
  ('sports', 'soccer'),
  ('sports', 'golf'),
  ('sports', 'tennis'),
  ('sports', 'volleyball'),
  ('sports', 'hockey'),
  ('sports', 'boxing'),
  ('sports', 'wrestling'),
  ('sports', 'swimming'),
  ('sports', 'surfing'),
  ('sports', 'skiing'),
  ('sports', 'snowboarding'),
  ('sports', 'skateboarding'),
  ('sports', 'gymnastics'),
  ('sports', 'bowling'),
  ('sports', 'fishing'),
  ('sports', 'archery'),
  ('sports', 'karate'),
  ('sports', 'cycling'),
  ('sports', 'running'),
  ('sports', 'rowing'),
  ('sports', 'cricket'),
  ('sports', 'rugby'),
  ('sports', 'lacrosse'),
  ('sports', 'pickleball'),
  ('sports', 'dodgeball'),
  ('sports', 'cheerleading'),
  ('sports', 'weightlifting'),
  ('sports', 'fencing'),
  ('sports', 'horse racing'),
  ('sports', 'table tennis'),
  ('sports', 'billiards'),
  ('sports', 'cornhole')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('places', 'Places', false, true, 5) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('places', 'beach'),
  ('places', 'airport'),
  ('places', 'school'),
  ('places', 'hospital'),
  ('places', 'zoo'),
  ('places', 'museum'),
  ('places', 'library'),
  ('places', 'restaurant'),
  ('places', 'stadium'),
  ('places', 'amusement park'),
  ('places', 'grocery store'),
  ('places', 'movie theater'),
  ('places', 'hotel'),
  ('places', 'campground'),
  ('places', 'mountain'),
  ('places', 'desert'),
  ('places', 'jungle'),
  ('places', 'island'),
  ('places', 'farm'),
  ('places', 'castle'),
  ('places', 'playground'),
  ('places', 'aquarium'),
  ('places', 'mall'),
  ('places', 'bank'),
  ('places', 'fire station'),
  ('places', 'police station'),
  ('places', 'coffee shop'),
  ('places', 'gym'),
  ('places', 'church'),
  ('places', 'office'),
  ('places', 'subway'),
  ('places', 'train station'),
  ('places', 'water park'),
  ('places', 'carnival'),
  ('places', 'barbershop')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('objects', 'Household Objects', false, true, 6) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('objects', 'toaster'),
  ('objects', 'refrigerator'),
  ('objects', 'microwave'),
  ('objects', 'television'),
  ('objects', 'couch'),
  ('objects', 'lamp'),
  ('objects', 'vacuum'),
  ('objects', 'blender'),
  ('objects', 'coffee maker'),
  ('objects', 'dishwasher'),
  ('objects', 'washing machine'),
  ('objects', 'dryer'),
  ('objects', 'mirror'),
  ('objects', 'pillow'),
  ('objects', 'blanket'),
  ('objects', 'toothbrush'),
  ('objects', 'hairbrush'),
  ('objects', 'shower'),
  ('objects', 'bathtub'),
  ('objects', 'remote control'),
  ('objects', 'clock'),
  ('objects', 'fan'),
  ('objects', 'iron'),
  ('objects', 'mop'),
  ('objects', 'broom'),
  ('objects', 'trash can'),
  ('objects', 'doorbell'),
  ('objects', 'bookshelf'),
  ('objects', 'curtain'),
  ('objects', 'rug'),
  ('objects', 'fork'),
  ('objects', 'spoon'),
  ('objects', 'frying pan'),
  ('objects', 'kettle'),
  ('objects', 'flashlight')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('jobs', 'Jobs', false, true, 7) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('jobs', 'teacher'),
  ('jobs', 'doctor'),
  ('jobs', 'nurse'),
  ('jobs', 'firefighter'),
  ('jobs', 'police officer'),
  ('jobs', 'chef'),
  ('jobs', 'pilot'),
  ('jobs', 'soldier'),
  ('jobs', 'lawyer'),
  ('jobs', 'dentist'),
  ('jobs', 'mechanic'),
  ('jobs', 'farmer'),
  ('jobs', 'photographer'),
  ('jobs', 'barber'),
  ('jobs', 'cashier'),
  ('jobs', 'mail carrier'),
  ('jobs', 'lifeguard'),
  ('jobs', 'scientist'),
  ('jobs', 'engineer'),
  ('jobs', 'plumber'),
  ('jobs', 'electrician'),
  ('jobs', 'veterinarian'),
  ('jobs', 'artist'),
  ('jobs', 'musician'),
  ('jobs', 'actor'),
  ('jobs', 'coach'),
  ('jobs', 'judge'),
  ('jobs', 'astronaut'),
  ('jobs', 'detective'),
  ('jobs', 'construction worker')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('games', 'Video Games', false, true, 8) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('games', 'Minecraft'),
  ('games', 'Fortnite'),
  ('games', 'Mario'),
  ('games', 'Zelda'),
  ('games', 'Pokémon'),
  ('games', 'Roblox'),
  ('games', 'Call of Duty'),
  ('games', 'Grand Theft Auto'),
  ('games', 'Among Us'),
  ('games', 'Sonic'),
  ('games', 'Halo'),
  ('games', 'Animal Crossing'),
  ('games', 'The Sims'),
  ('games', 'Madden'),
  ('games', 'FIFA'),
  ('games', 'NBA 2K'),
  ('games', 'Rocket League'),
  ('games', 'Apex Legends'),
  ('games', 'Overwatch'),
  ('games', 'Fall Guys'),
  ('games', 'Pac-Man'),
  ('games', 'Tetris'),
  ('games', 'Donkey Kong'),
  ('games', 'Kirby'),
  ('games', 'Luigi'),
  ('games', 'Bowser'),
  ('games', 'Master Chief'),
  ('games', 'Kratos'),
  ('games', 'Link'),
  ('games', 'Pikachu'),
  ('games', 'Lara Croft'),
  ('games', 'Street Fighter'),
  ('games', 'Mortal Kombat'),
  ('games', 'Skyrim'),
  ('games', 'Destiny')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('music', 'Music', false, true, 9) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('music', 'guitar'),
  ('music', 'piano'),
  ('music', 'drums'),
  ('music', 'violin'),
  ('music', 'trumpet'),
  ('music', 'saxophone'),
  ('music', 'microphone'),
  ('music', 'concert'),
  ('music', 'DJ'),
  ('music', 'rapper'),
  ('music', 'singer'),
  ('music', 'band'),
  ('music', 'orchestra'),
  ('music', 'karaoke'),
  ('music', 'headphones'),
  ('music', 'playlist'),
  ('music', 'album'),
  ('music', 'chorus'),
  ('music', 'melody'),
  ('music', 'rhythm'),
  ('music', 'country'),
  ('music', 'rock'),
  ('music', 'hip-hop'),
  ('music', 'jazz'),
  ('music', 'classical'),
  ('music', 'pop'),
  ('music', 'reggae'),
  ('music', 'dance'),
  ('music', 'festival'),
  ('music', 'record player'),
  ('music', 'harmonica'),
  ('music', 'flute'),
  ('music', 'cello'),
  ('music', 'banjo'),
  ('music', 'tambourine')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('kids', 'Kids', false, true, 10) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('kids', 'playground'),
  ('kids', 'birthday cake'),
  ('kids', 'dinosaur'),
  ('kids', 'unicorn'),
  ('kids', 'pirate'),
  ('kids', 'princess'),
  ('kids', 'robot'),
  ('kids', 'monster'),
  ('kids', 'superhero'),
  ('kids', 'treasure'),
  ('kids', 'balloon'),
  ('kids', 'trampoline'),
  ('kids', 'water slide'),
  ('kids', 'treehouse'),
  ('kids', 'sleepover'),
  ('kids', 'school bus'),
  ('kids', 'lunchbox'),
  ('kids', 'crayon'),
  ('kids', 'building blocks'),
  ('kids', 'teddy bear'),
  ('kids', 'kite'),
  ('kids', 'bubble'),
  ('kids', 'snowman'),
  ('kids', 'tooth fairy'),
  ('kids', 'Santa Claus'),
  ('kids', 'Easter Bunny'),
  ('kids', 'hide-and-seek'),
  ('kids', 'tag'),
  ('kids', 'hopscotch'),
  ('kids', 'roller coaster'),
  ('kids', 'circus'),
  ('kids', 'magic wand'),
  ('kids', 'spaceship'),
  ('kids', 'dragon'),
  ('kids', 'mermaid')
on conflict do nothing;

insert into public.categories (id, label, is_premium, active, sort_order) values ('random', 'Random', false, true, 11) on conflict (id) do nothing;
insert into public.category_words (category_id, word) values
  ('random', 'rainbow'),
  ('random', 'volcano'),
  ('random', 'spaceship'),
  ('random', 'headphones'),
  ('random', 'keyboard'),
  ('random', 'umbrella'),
  ('random', 'backpack'),
  ('random', 'elevator'),
  ('random', 'traffic light'),
  ('random', 'roller coaster'),
  ('random', 'campfire'),
  ('random', 'snowman'),
  ('random', 'lighthouse'),
  ('random', 'treasure chest'),
  ('random', 'robot'),
  ('random', 'pirate'),
  ('random', 'ninja'),
  ('random', 'wizard'),
  ('random', 'dragon'),
  ('random', 'unicorn'),
  ('random', 'tornado'),
  ('random', 'earthquake'),
  ('random', 'fireworks'),
  ('random', 'moon'),
  ('random', 'satellite'),
  ('random', 'submarine'),
  ('random', 'helicopter'),
  ('random', 'motorcycle'),
  ('random', 'tractor'),
  ('random', 'skyscraper'),
  ('random', 'bridge'),
  ('random', 'fountain'),
  ('random', 'maze'),
  ('random', 'telescope'),
  ('random', 'compass'),
  ('random', 'magnet'),
  ('random', 'battery'),
  ('random', 'camera'),
  ('random', 'passport'),
  ('random', 'suitcase'),
  ('random', 'crown'),
  ('random', 'diamond'),
  ('random', 'ghost'),
  ('random', 'zombie'),
  ('random', 'vampire'),
  ('random', 'snow globe'),
  ('random', 'time machine'),
  ('random', 'hot air balloon'),
  ('random', 'waterfall'),
  ('random', 'cactus')
on conflict do nothing;
