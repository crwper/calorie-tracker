


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."add_entry_with_order"("p_day_id" "uuid", "p_name" "text", "p_qty" numeric, "p_unit" "text", "p_kcal" numeric, "p_status" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_next  integer;
  v_id    uuid;
  i       int;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select d.user_id into v_owner
  from public.days d
  where d.id = p_day_id;

  if v_owner is null or v_owner <> v_user then
    raise exception 'forbidden: day not owned by caller' using errcode = '42501';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'invalid qty' using errcode = '22023';
  end if;

  -- Retry a couple of times in case two inserts race the same ordering
  for i in 1..3 loop
    select coalesce(max(e.ordering), -1) + 1
      into v_next
    from public.entries e
    where e.day_id = p_day_id;

    begin
      insert into public.entries (
        day_id, name, qty, unit,
        kcal_snapshot, status, ordering,
        kcal_per_unit_snapshot
      )
      values (
        p_day_id, p_name, p_qty, p_unit,
        p_kcal, p_status, v_next,
        round((p_kcal / p_qty)::numeric, 4)  -- <-- write the per-unit snapshot
      )
      returning id into v_id;

      return v_id; -- success
    exception
      when unique_violation then
        continue; -- someone else grabbed v_next; recompute and retry
    end;
  end loop;

  raise exception 'could not allocate ordering after retries' using errcode = '40001';
end;
$$;


ALTER FUNCTION "public"."add_entry_with_order"("p_day_id" "uuid", "p_name" "text", "p_qty" numeric, "p_unit" "text", "p_kcal" numeric, "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_catalog_items_usage_order"() RETURNS TABLE("id" "uuid", "name" "text", "unit" "text", "kcal_per_unit" numeric, "default_qty" numeric, "created_at" timestamp with time zone, "last_used_date" "date", "first_order_on_last_day" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
WITH last_use AS (
  SELECT e.catalog_item_id AS id, MAX(d.date) AS last_date
  FROM public.entries e
  JOIN public.days d ON d.id = e.day_id
  WHERE d.user_id = auth.uid()
  GROUP BY e.catalog_item_id
),
first_pos AS (
  SELECT e.catalog_item_id AS id, d.date, MIN(e.ordering) AS first_order
  FROM public.entries e
  JOIN public.days d ON d.id = e.day_id
  WHERE d.user_id = auth.uid()
  GROUP BY e.catalog_item_id, d.date
)
SELECT
  ci.id,
  ci.name,
  ci.unit,
  ci.kcal_per_unit,
  ci.default_qty,
  ci.created_at,
  lu.last_date AS last_used_date,
  fp.first_order AS first_order_on_last_day
FROM public.catalog_items ci
LEFT JOIN last_use lu ON lu.id = ci.id
LEFT JOIN first_pos fp ON fp.id = ci.id AND fp.date = lu.last_date
WHERE ci.user_id = auth.uid()
ORDER BY
  lu.last_date DESC NULLS LAST,         -- most recent day used first
  fp.first_order ASC NULLS LAST,        -- earlier first-appearance that day first
  LOWER(BTRIM(ci.name)) ASC;            -- never-used go last, alphabetical
$$;


ALTER FUNCTION "public"."get_catalog_items_usage_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_day"("p_date" "date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();  -- current authenticated user from JWT
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  insert into public.days (user_id, date)
  values (v_user, p_date)
  on conflict (user_id, date)
  do update set date = excluded.date  -- no-op update, ensures we RETURNing a row
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."get_or_create_day"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_entry"("p_entry_id" "uuid", "p_dir" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_day uuid;
  v_pos integer;
  v_neighbor uuid;
  v_neighbor_pos integer;
  v_tmp integer;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  -- Lock the target entry row and verify ownership via parent day
  select e.day_id, e.ordering
    into v_day, v_pos
  from public.entries e
  join public.days d on d.id = e.day_id
  where e.id = p_entry_id
    and d.user_id = v_user
  for update;

  if v_day is null then
    raise exception 'forbidden: entry not owned by caller' using errcode = '42501';
  end if;

  -- Lock the neighbor we will swap with
  if p_dir = 'up' then
    select e.id, e.ordering into v_neighbor, v_neighbor_pos
    from public.entries e
    where e.day_id = v_day and e.ordering < v_pos
    order by e.ordering desc
    limit 1
    for update;
  elsif p_dir = 'down' then
    select e.id, e.ordering into v_neighbor, v_neighbor_pos
    from public.entries e
    where e.day_id = v_day and e.ordering > v_pos
    order by e.ordering asc
    limit 1
    for update;
  else
    raise exception 'invalid direction: %', p_dir using errcode = '22023';
  end if;

  -- No neighbor (already at top/bottom)
  if v_neighbor is null then
    return;
  end if;

  -- Use a guaranteed-unique temporary slot derived from current position.
  -- Our ordering domain is >= 0 in normal use; negatives are reserved for temp swaps.
  v_tmp := -(v_pos + 1);

  -- Three-step swap to satisfy UNIQUE(day_id, ordering)
  -- 1) move neighbor to tmp
  update public.entries
  set ordering = v_tmp
  where id = v_neighbor;

  -- 2) move current into neighbor's slot
  update public.entries
  set ordering = v_neighbor_pos
  where id = p_entry_id;

  -- 3) move neighbor into current's old slot
  update public.entries
  set ordering = v_pos
  where id = v_neighbor;

  return;
end;
$$;


ALTER FUNCTION "public"."move_entry"("p_entry_id" "uuid", "p_dir" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_entries"("p_day_id" "uuid", "p_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_expected int;
  v_seen int;
  v_id uuid;
  v_idx int := 0;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  -- Ensure the day belongs to the caller.
  if not exists (
    select 1 from public.days d
    where d.id = p_day_id and d.user_id = v_user
  ) then
    raise exception 'forbidden: day not owned by caller' using errcode = '42501';
  end if;

  -- Lock all rows for that day.
  perform 1 from public.entries e
  where e.day_id = p_day_id
  for update;

  -- Sanity: require the array to include all entry ids for the day.
  select count(*) into v_expected from public.entries where day_id = p_day_id;
  select coalesce(array_length(p_ids, 1), 0) into v_seen;

  if v_seen <> v_expected then
    raise exception 'mismatch: provided % ids but day has %', v_seen, v_expected using errcode = '22023';
  end if;

  -- Temporary negative to avoid UNIQUE(day_id, ordering) collisions during rewrite.
  update public.entries
  set ordering = -ordering - 1
  where day_id = p_day_id;

  -- Assign 0..N-1 in the given order.
  v_idx := 0;
  foreach v_id in array p_ids loop
    update public.entries
    set ordering = v_idx
    where id = v_id and day_id = p_day_id;
    v_idx := v_idx + 1;
  end loop;

  return;
end;
$$;


ALTER FUNCTION "public"."reorder_entries"("p_day_id" "uuid", "p_ids" "uuid"[]) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."catalog_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "kcal_per_unit" numeric(10,4) NOT NULL,
    "default_qty" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catalog_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "qty" numeric(10,2) NOT NULL,
    "unit" "text" NOT NULL,
    "kcal_snapshot" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ordering" integer NOT NULL,
    "catalog_item_id" "uuid",
    "kcal_per_unit_snapshot" numeric(12,4) NOT NULL,
    CONSTRAINT "entries_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'eaten'::"text"])))
);


ALTER TABLE "public"."entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "measured_at" "date" NOT NULL,
    "method" "text" NOT NULL,
    "weight_kg" numeric(7,3) NOT NULL,
    "me_kg" numeric(7,3),
    "me_and_dog_kg" numeric(7,3),
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "weights_method_check" CHECK (("method" = ANY (ARRAY['vet'::"text", 'home_diff'::"text"])))
);


ALTER TABLE "public"."weights" OWNER TO "postgres";


ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."days"
    ADD CONSTRAINT "days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."days"
    ADD CONSTRAINT "days_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "catalog_items_user_name_unit_key" ON "public"."catalog_items" USING "btree" ("user_id", "lower"("btrim"("name")), "lower"("btrim"("unit")));



CREATE UNIQUE INDEX "entries_day_ordering_key" ON "public"."entries" USING "btree" ("day_id", "ordering");



CREATE INDEX "entries_dayid_order_idx" ON "public"."entries" USING "btree" ("day_id", "ordering");



CREATE INDEX "weights_user_measured_at_idx" ON "public"."weights" USING "btree" ("user_id", "measured_at" DESC, "created_at" DESC);



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE CASCADE;



CREATE POLICY "catalog_delete_own" ON "public"."catalog_items" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "catalog_insert_own" ON "public"."catalog_items" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."catalog_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_select_own" ON "public"."catalog_items" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "catalog_update_own" ON "public"."catalog_items" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."days" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "days_delete_own" ON "public"."days" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "days_insert_own" ON "public"."days" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "days_select_own" ON "public"."days" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "days_update_own" ON "public"."days" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "entries_delete_via_day" ON "public"."entries" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."days" "d"
  WHERE (("d"."id" = "entries"."day_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "entries_insert_via_day" ON "public"."entries" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."days" "d"
  WHERE (("d"."id" = "entries"."day_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "entries_select_via_day" ON "public"."entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."days" "d"
  WHERE (("d"."id" = "entries"."day_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "entries_update_via_day" ON "public"."entries" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."days" "d"
  WHERE (("d"."id" = "entries"."day_id") AND ("d"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."days" "d"
  WHERE (("d"."id" = "entries"."day_id") AND ("d"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."weights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weights_delete_own" ON "public"."weights" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "weights_insert_own" ON "public"."weights" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "weights_select_own" ON "public"."weights" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "weights_update_own" ON "public"."weights" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_entry_with_order"("p_day_id" "uuid", "p_name" "text", "p_qty" numeric, "p_unit" "text", "p_kcal" numeric, "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_entry_with_order"("p_day_id" "uuid", "p_name" "text", "p_qty" numeric, "p_unit" "text", "p_kcal" numeric, "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_entry_with_order"("p_day_id" "uuid", "p_name" "text", "p_qty" numeric, "p_unit" "text", "p_kcal" numeric, "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_catalog_items_usage_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_catalog_items_usage_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_catalog_items_usage_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_day"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_day"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_day"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."move_entry"("p_entry_id" "uuid", "p_dir" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."move_entry"("p_entry_id" "uuid", "p_dir" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_entry"("p_entry_id" "uuid", "p_dir" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_entries"("p_day_id" "uuid", "p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_entries"("p_day_id" "uuid", "p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_entries"("p_day_id" "uuid", "p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."catalog_items" TO "anon";
GRANT ALL ON TABLE "public"."catalog_items" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_items" TO "service_role";



GRANT ALL ON TABLE "public"."days" TO "anon";
GRANT ALL ON TABLE "public"."days" TO "authenticated";
GRANT ALL ON TABLE "public"."days" TO "service_role";



GRANT ALL ON TABLE "public"."entries" TO "anon";
GRANT ALL ON TABLE "public"."entries" TO "authenticated";
GRANT ALL ON TABLE "public"."entries" TO "service_role";



GRANT ALL ON TABLE "public"."weights" TO "anon";
GRANT ALL ON TABLE "public"."weights" TO "authenticated";
GRANT ALL ON TABLE "public"."weights" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;
