import { createServerFn } from "@tanstack/react-start";
import type { Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  accountCode,
  addDays,
  addMinutes,
  buildStarts,
  formatBRL,
  isSport,
  isSurface,
  nowSP,
  slotEnded,
  timeToMinutes,
  weekdayOpen,
} from "@/lib/quadra/format";

type Role = "player" | "owner" | "admin";
type Profile = { user_id: string; display_name: string; role: Role; status: "active" | "suspended" };
type Settings = { fee_bps: number; min_price_cents: number; max_price_cents: number; pix_validation: boolean };

export type Me = {
  displayName: string;
  role: Role;
  status: "active" | "suspended";
  accountCode: string;
  adminCount: number;
  courtCount: number;
};

export type CourtCard = {
  id: string;
  name: string;
  sport: string;
  city: string;
  neighborhood: string;
  indoor: boolean;
  surface: string;
  priceCents: number;
  openGames: number;
};

export type CourtDetail = CourtCard & {
  address: string;
  description: string;
  openFrom: string;
  openUntil: string;
  weekdays: number[];
  status: string;
  ownerName: string;
  isOwner: boolean;
};

export type SlotView = {
  start: string;
  end: string;
  state: "free" | "past" | "held" | "busy";
  mine: boolean;
  bookingId: string | null;
  kind: "private" | "open" | null;
};

export type OpenGameCard = {
  id: string;
  courtId: string;
  courtName: string;
  sport: string;
  city: string;
  neighborhood: string;
  date: string;
  start: string;
  end: string;
  spots: number;
  filled: number;
  note: string;
  hostName: string;
  isHost: boolean;
  joined: boolean;
  status: string;
  shareCents: number;
};

export type AgendaItem = {
  id: string;
  courtName: string;
  sport: string;
  neighborhood: string;
  city: string;
  date: string;
  start: string;
  end: string;
  kind: "private" | "open";
  status: string;
  spots: number;
  filled: number;
  note: string;
  isHost: boolean;
  amountCents: number;
  paymentStatus: string | null;
};

export type Checkout = {
  bookingId: string;
  courtName: string;
  sport: string;
  city: string;
  neighborhood: string;
  date: string;
  start: string;
  end: string;
  kind: "private" | "open";
  status: string;
  note: string;
  isHost: boolean;
  amountCents: number;
  priceCents: number;
  spots: number;
  filled: number;
  payment: null | {
    method: "pix" | "card";
    status: string;
    reference: string;
    last4: string;
  };
  viewerIsAdmin: boolean;
  pixValidation: boolean;
};

export type GameDetail = OpenGameCard & {
  address: string;
  priceCents: number;
  participants: string[];
  paymentStatus: string | null;
  bookingStatus: string;
};

export type OwnerCourt = {
  id: string;
  name: string;
  sport: string;
  city: string;
  neighborhood: string;
  address: string;
  description: string;
  surface: string;
  indoor: boolean;
  priceCents: number;
  openFrom: string;
  openUntil: string;
  weekdays: number[];
  status: string;
};

export type OwnerBooking = {
  id: string;
  courtName: string;
  date: string;
  start: string;
  end: string;
  kind: "private" | "open";
  status: string;
  hostName: string;
  filled: number;
  spots: number;
  paidCount: number;
  priceCents: number;
};

export type OwnerHome = {
  courts: OwnerCourt[];
  bookings: OwnerBooking[];
  minPriceCents: number;
  maxPriceCents: number;
  feeBps: number;
};

export type AdminBundle = {
  settings: { feeBps: number; minPriceCents: number; maxPriceCents: number; pixValidation: boolean };
  stats: { courts: number; activeCourts: number; games: number; pendingPayments: number; users: number; suspended: number };
  courts: {
    id: string;
    name: string;
    sport: string;
    city: string;
    neighborhood: string;
    priceCents: number;
    status: string;
    ownerName: string;
    ownerCode: string;
  }[];
  games: {
    id: string;
    courtName: string;
    date: string;
    start: string;
    kind: "private" | "open";
    status: string;
    hostName: string;
    filled: number;
    spots: number;
    priceCents: number;
  }[];
  payments: {
    id: string;
    amountCents: number;
    method: "pix" | "card";
    status: string;
    reference: string;
    last4: string;
    payerName: string;
    payerCode: string;
    courtName: string;
    date: string;
    start: string;
  }[];
  users: {
    id: string;
    code: string;
    name: string;
    role: Role;
    status: "active" | "suspended";
    createdOn: string;
    courts: number;
    games: number;
  }[];
};

export type Snapshot = {
  catalog: number;
  openGames: number;
  myUpcoming: number;
  myCourts: number;
  next: null | { id: string; courtName: string; date: string; start: string; kind: "private" | "open"; status: string };
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function db(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function fail(message: string): never {
  throw new Error(message);
}

function flag(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function asRole(value: string): Role {
  if (value === "owner" || value === "admin") return value;
  return "player";
}

function asDate(value: unknown): string {
  return String(value).slice(0, 10);
}

function isUnique(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /unique|duplicate|23505/i.test(message);
}

function refId(value: unknown, label: string): string {
  const id = text(value, 80);
  if (id.length < 8) fail(`${label} inválido.`);
  return id;
}

async function countAdmins(sql: Sql): Promise<number> {
  const rows = await sql<{ n: number }>`select count(*)::int as n from profiles where role = 'admin'`;
  return Number(rows[0]?.n ?? 0);
}

async function loadSettings(sql: Sql): Promise<Settings> {
  await sql`insert into platform_settings (id) values (1) on conflict (id) do nothing`;
  const rows = await sql<Settings>`
    select fee_bps, min_price_cents, max_price_cents, pix_validation
    from platform_settings where id = 1
  `;
  const row = rows[0];
  if (!row) fail("Configuração indisponível.");
  return {
    fee_bps: Number(row.fee_bps),
    min_price_cents: Number(row.min_price_cents),
    max_price_cents: Number(row.max_price_cents),
    pix_validation: flag(row.pix_validation),
  };
}

async function ensureProfile(sql: Sql, userId: string, displayName = ""): Promise<Profile> {
  const name = displayName.trim().slice(0, 80);
  await sql`
    insert into profiles (user_id, display_name)
    values (${userId}, ${name || "Jogador"})
    on conflict (user_id) do nothing
  `;
  if (name) {
    await sql`
      update profiles set display_name = ${name}
      where user_id = ${userId} and display_name = 'Jogador'
    `;
  }
  const rows = await sql<Profile>`
    select user_id, display_name, role, status from profiles where user_id = ${userId}
  `;
  const profile = rows[0];
  if (!profile) fail("Não foi possível abrir o seu perfil.");
  return { ...profile, role: asRole(profile.role), status: profile.status === "suspended" ? "suspended" : "active" };
}

function assertActive(profile: Profile) {
  if (profile.status === "suspended") fail("Esta conta está suspensa.");
}

async function requireAdmin(sql: Sql, userId: string): Promise<Profile> {
  const profile = await ensureProfile(sql, userId);
  assertActive(profile);
  if (profile.role !== "admin") fail("Acesso restrito à administração.");
  return profile;
}

async function requireOwner(sql: Sql, userId: string): Promise<Profile> {
  const profile = await ensureProfile(sql, userId);
  assertActive(profile);
  if (profile.role !== "owner" && profile.role !== "admin") {
    fail("Disponível para quem cadastra quadras.");
  }
  return profile;
}

function toMe(profile: Profile, adminCount: number, courtCount: number): Me {
  return {
    displayName: profile.display_name,
    role: profile.role,
    status: profile.status,
    accountCode: accountCode(profile.user_id),
    adminCount,
    courtCount,
  };
}

async function loadMe(sql: Sql, userId: string, displayName = ""): Promise<Me> {
  const profile = await ensureProfile(sql, userId, displayName);
  const adminCount = await countAdmins(sql);
  const courts = await sql<{ n: number }>`select count(*)::int as n from courts where owner_id = ${userId}`;
  return toMe(profile, adminCount, Number(courts[0]?.n ?? 0));
}

function assertPrice(cents: number, settings: Settings, bypass: boolean) {
  if (!Number.isInteger(cents) || cents <= 0) fail("Informe um valor válido.");
  if (bypass) {
    if (cents > 500000) fail("Valor acima do limite operacional.");
    return;
  }
  if (cents < settings.min_price_cents || cents > settings.max_price_cents) {
    fail(
      `O valor por hora precisa ficar entre ${formatBRL(settings.min_price_cents)} e ${formatBRL(settings.max_price_cents)}.`,
    );
  }
}

type CourtRow = {
  id: string;
  owner_id: string;
  name: string;
  sport: string;
  city: string;
  neighborhood: string;
  address: string;
  description: string;
  price_cents: number;
  surface: string;
  indoor: boolean;
  status: string;
  open_from: string;
  open_until: string;
  weekdays: string;
  owner_name?: string;
};

function mapOwnerCourt(row: CourtRow): OwnerCourt {
  return {
    id: row.id,
    name: row.name,
    sport: row.sport,
    city: row.city,
    neighborhood: row.neighborhood,
    address: row.address,
    description: row.description,
    surface: row.surface,
    indoor: flag(row.indoor),
    priceCents: Number(row.price_cents),
    openFrom: row.open_from,
    openUntil: row.open_until,
    weekdays: row.weekdays.split(",").map(Number).filter((day) => day >= 0 && day <= 6),
    status: row.status,
  };
}

type PaymentRow = {
  id: string;
  booking_id: string;
  user_id: string;
  amount_cents: number;
  method: "pix" | "card";
  status: string;
  reference: string;
  last4: string;
};

async function cancelBookingRecords(sql: Sql, bookingId: string) {
  await sql`update bookings set status = 'cancelled' where id = ${bookingId} and status <> 'cancelled'`;
  await sql`
    update payments set status = 'refunded', reviewed_at = now()
    where booking_id = ${bookingId} and status in ('paid', 'validated')
  `;
  await sql`
    update payments set status = 'rejected', reviewed_at = now()
    where booking_id = ${bookingId} and status in ('draft', 'pending')
  `;
}

async function confirmIfHostPaid(sql: Sql, bookingId: string, hostId: string) {
  const rows = await sql<{ status: string }>`
    select status from payments
    where booking_id = ${bookingId} and user_id = ${hostId}
      and status in ('paid', 'validated')
    limit 1
  `;
  if (rows[0]) {
    await sql`
      update bookings set status = 'confirmed'
      where id = ${bookingId} and status = 'awaiting_payment'
    `;
  }
}

async function activePayment(sql: Sql, bookingId: string, userId: string): Promise<PaymentRow | null> {
  const rows = await sql<PaymentRow>`
    select id, booking_id, user_id, amount_cents, method, status, reference, last4
    from payments
    where booking_id = ${bookingId} and user_id = ${userId}
      and status in ('draft', 'pending', 'paid', 'validated')
    order by created_at desc
    limit 1
  `;
  return rows[0] ?? null;
}

type BookingRow = {
  id: string;
  court_id: string;
  host_id: string;
  play_date: string;
  start_time: string;
  end_time: string;
  kind: "private" | "open";
  spots: number;
  price_cents: number;
  host_cents: number;
  share_cents: number;
  note: string;
  status: string;
};

async function joinedBooking(sql: Sql, bookingId: string, userId: string): Promise<BookingRow> {
  const rows = await sql<BookingRow>`
    select b.id, b.court_id, b.host_id, b.play_date, b.start_time, b.end_time, b.kind,
           b.spots, b.price_cents, b.host_cents, b.share_cents, b.note, b.status
    from bookings b
    join participants p on p.booking_id = b.id and p.user_id = ${userId} and p.status = 'joined'
    where b.id = ${bookingId}
  `;
  const booking = rows[0];
  if (!booking) fail("Reserva não encontrada.");
  return {
    ...booking,
    play_date: asDate(booking.play_date),
    spots: Number(booking.spots),
    price_cents: Number(booking.price_cents),
    host_cents: Number(booking.host_cents),
    share_cents: Number(booking.share_cents),
    kind: booking.kind === "open" ? "open" : "private",
  };
}

function amountFor(booking: BookingRow, userId: string): number {
  return booking.host_id === userId ? booking.host_cents : booking.share_cents;
}

export const getMe = createServerFn({ method: "POST" })
  .validator((input: { displayName?: string } | undefined) => ({
    displayName: text(input?.displayName, 80),
  }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<Me> => {
    const sql = await db();
    return loadMe(sql, context.userId, data.displayName);
  });

export const renameMe = createServerFn({ method: "POST" })
  .validator((input: { displayName?: string }) => {
    const displayName = text(input?.displayName, 80);
    if (displayName.length < 2) fail("Use um nome com pelo menos 2 letras.");
    return { displayName };
  })
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<Me> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    assertActive(profile);
    await sql`update profiles set display_name = ${data.displayName} where user_id = ${context.userId}`;
    return loadMe(sql, context.userId);
  });

export const upgradeToOwner = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Me> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    assertActive(profile);
    if (profile.role === "player") {
      await sql`update profiles set role = 'owner' where user_id = ${context.userId} and role = 'player'`;
    }
    return loadMe(sql, context.userId);
  });

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Me> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    assertActive(profile);
    if (profile.role !== "admin") {
      const updated = await sql<{ user_id: string }>`
        update profiles set role = 'admin'
        where user_id = ${context.userId}
          and not exists (select 1 from profiles where role = 'admin')
        returning user_id
      `;
      if (!updated[0]) fail("Já existe uma administração nesta plataforma.");
    }
    return loadMe(sql, context.userId);
  });

export const getSnapshot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Snapshot> => {
    const sql = await db();
    await ensureProfile(sql, context.userId);
    const today = nowSP().date;
    const catalog = await sql<{ n: number }>`select count(*)::int as n from courts where status = 'active'`;
    const games = await sql<{ n: number }>`
      select count(*)::int as n from bookings
      where kind = 'open' and status in ('awaiting_payment', 'confirmed') and play_date >= ${today}::date
    `;
    const mine = await sql<{ n: number }>`
      select count(*)::int as n
      from bookings b
      join participants p on p.booking_id = b.id and p.user_id = ${context.userId} and p.status = 'joined'
      where b.status <> 'cancelled' and b.play_date >= ${today}::date
    `;
    const courts = await sql<{ n: number }>`select count(*)::int as n from courts where owner_id = ${context.userId}`;
    const nextRows = await sql<{
      id: string;
      court_name: string;
      play_date: string;
      start_time: string;
      end_time: string;
      kind: "private" | "open";
      status: string;
    }>`
      select b.id, c.name as court_name, b.play_date, b.start_time, b.end_time, b.kind, b.status
      from bookings b
      join courts c on c.id = b.court_id
      join participants p on p.booking_id = b.id and p.user_id = ${context.userId} and p.status = 'joined'
      where b.status <> 'cancelled' and b.play_date >= ${today}::date
      order by b.play_date, b.start_time
      limit 8
    `;
    const next = nextRows.map((row) => ({ ...row, play_date: asDate(row.play_date) })).find((row) => !slotEnded(row.play_date, row.end_time));
    return {
      catalog: Number(catalog[0]?.n ?? 0),
      openGames: Number(games[0]?.n ?? 0),
      myUpcoming: Number(mine[0]?.n ?? 0),
      myCourts: Number(courts[0]?.n ?? 0),
      next: next
        ? {
            id: next.id,
            courtName: next.court_name,
            date: next.play_date,
            start: next.start_time,
            kind: next.kind === "open" ? "open" : "private",
            status: next.status,
          }
        : null,
    };
  });

export const listCatalog = createServerFn({ method: "POST" })
  .validator((input: { sport?: string; city?: string; q?: string } | undefined) => ({
    sport: text(input?.sport, 32),
    city: text(input?.city, 40).replace(/[%_]/g, ""),
    q: text(input?.q, 40).replace(/[%_]/g, ""),
  }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ courts: CourtCard[]; cities: string[] }> => {
    const sql = await db();
    await ensureProfile(sql, context.userId);
    const today = nowSP().date;
    const sport = isSport(data.sport) ? data.sport : "";
    const city = data.city.toLowerCase();
    const q = data.q.toLowerCase();
    const rows = await sql<CourtRow & { open_games: number }>`
      select c.id, c.owner_id, c.name, c.sport, c.city, c.neighborhood, c.address, c.description,
             c.price_cents, c.surface, c.indoor, c.status, c.open_from, c.open_until, c.weekdays,
             (select count(*)::int from bookings b
               where b.court_id = c.id and b.kind = 'open'
                 and b.status in ('awaiting_payment', 'confirmed')
                 and b.play_date >= ${today}::date) as open_games
      from courts c
      where c.status = 'active'
        and (${sport} = '' or c.sport = ${sport})
        and (${city} = '' or lower(c.city) like ${"%" + city + "%"})
        and (${q} = '' or lower(c.name || ' ' || c.neighborhood) like ${"%" + q + "%"})
      order by c.city, c.name
      limit 80
    `;
    const cityRows = await sql<{ city: string }>`
      select distinct city from courts where status = 'active' order by city
    `;
    return {
      cities: cityRows.map((row) => row.city),
      courts: rows.map((row) => ({
        id: row.id,
        name: row.name,
        sport: row.sport,
        city: row.city,
        neighborhood: row.neighborhood,
        indoor: flag(row.indoor),
        surface: row.surface,
        priceCents: Number(row.price_cents),
        openGames: Number(row.open_games),
      })),
    };
  });

export const getCourt = createServerFn({ method: "POST" })
  .validator((input: { courtId?: string }) => ({ courtId: refId(input?.courtId, "Quadra") }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<CourtDetail> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    const rows = await sql<CourtRow>`
      select c.id, c.owner_id, c.name, c.sport, c.city, c.neighborhood, c.address, c.description,
             c.price_cents, c.surface, c.indoor, c.status, c.open_from, c.open_until, c.weekdays,
             p.display_name as owner_name
      from courts c
      join profiles p on p.user_id = c.owner_id
      where c.id = ${data.courtId}
    `;
    const row = rows[0];
    if (!row) fail("Quadra não encontrada.");
    const isOwner = row.owner_id === context.userId || profile.role === "admin";
    if (row.status !== "active" && !isOwner) fail("Esta quadra não está publicada.");
    return {
      ...mapOwnerCourt(row),
      openGames: 0,
      ownerName: row.owner_name ?? "Quadra",
      isOwner,
    };
  });

export const getSlots = createServerFn({ method: "POST" })
  .validator((input: { courtId?: string; date?: string }) => {
    const date = text(input?.date, 10);
    if (!DATE_RE.test(date)) fail("Data inválida.");
    return { courtId: refId(input?.courtId, "Quadra"), date };
  })
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ closed: boolean; slots: SlotView[]; openGames: OpenGameCard[] }> => {
    const sql = await db();
    await ensureProfile(sql, context.userId);
    const courts = await sql<CourtRow>`
      select id, owner_id, name, sport, city, neighborhood, address, description, price_cents, surface,
             indoor, status, open_from, open_until, weekdays
      from courts where id = ${data.courtId}
    `;
    const court = courts[0];
    if (!court || court.status !== "active") fail("Quadra indisponível.");
    const now = nowSP();
    if (data.date < now.date || data.date > addDays(now.date, 21)) fail("Data fora da janela de reserva.");
    const closed = !weekdayOpen(court.weekdays, data.date);
    const taken = await sql<{
      id: string;
      start_time: string;
      end_time: string;
      status: string;
      kind: "private" | "open";
      host_id: string;
      joined: boolean;
    }>`
      select b.id, b.start_time, b.end_time, b.status, b.kind, b.host_id,
             exists(
               select 1 from participants p
               where p.booking_id = b.id and p.user_id = ${context.userId} and p.status = 'joined'
             ) as joined
      from bookings b
      where b.court_id = ${court.id}
        and b.play_date = ${data.date}::date
        and b.status in ('awaiting_payment', 'confirmed')
    `;
    const slots: SlotView[] = closed
      ? []
      : buildStarts(court.open_from, court.open_until).map((slot) => {
          const past = data.date < now.date || (data.date === now.date && timeToMinutes(slot.start) <= now.minutes);
          const hit = taken.find((row) => row.start_time === slot.start);
          if (!hit) return { ...slot, state: past ? "past" : "free", mine: false, bookingId: null, kind: null };
          return {
            ...slot,
            state: past ? "past" : hit.status === "awaiting_payment" ? "held" : "busy",
            mine: hit.host_id === context.userId || flag(hit.joined),
            bookingId: hit.id,
            kind: hit.kind === "open" ? "open" : "private",
          };
        });
    const games = await sql<{
      id: string;
      start_time: string;
      end_time: string;
      spots: number;
      note: string;
      status: string;
      host_id: string;
      share_cents: number;
      filled: number;
      host_name: string;
      joined: boolean;
    }>`
      select b.id, b.start_time, b.end_time, b.spots, b.note, b.status, b.host_id, b.share_cents,
             (select count(*)::int from participants p where p.booking_id = b.id and p.status = 'joined') as filled,
             pr.display_name as host_name,
             exists(
               select 1 from participants p
               where p.booking_id = b.id and p.user_id = ${context.userId} and p.status = 'joined'
             ) as joined
      from bookings b
      join profiles pr on pr.user_id = b.host_id
      where b.court_id = ${court.id}
        and b.play_date = ${data.date}::date
        and b.kind = 'open'
        and b.status in ('awaiting_payment', 'confirmed')
      order by b.start_time
    `;
    return {
      closed,
      slots,
      openGames: games
        .filter((game) => !slotEnded(data.date, game.end_time, now))
        .map((game) => ({
          id: game.id,
          courtId: court.id,
          courtName: court.name,
          sport: court.sport,
          city: court.city,
          neighborhood: court.neighborhood,
          date: data.date,
          start: game.start_time,
          end: game.end_time,
          spots: Number(game.spots),
          filled: Number(game.filled),
          note: game.note,
          hostName: game.host_name,
          isHost: game.host_id === context.userId,
          joined: flag(game.joined),
          status: game.status,
          shareCents: Number(game.share_cents),
        })),
    };
  });

type SaveInput = {
  id: string;
  name: string;
  sport: string;
  city: string;
  neighborhood: string;
  address: string;
  description: string;
  surface: string;
  indoor: boolean;
  priceCents: number;
  openFrom: string;
  openUntil: string;
  weekdays: number[];
};

function readCourtInput(input: Partial<SaveInput> | undefined, withId: boolean): SaveInput {
  const weekdays = Array.isArray(input?.weekdays)
    ? [...new Set(input.weekdays.map(Number).filter((day) => day >= 0 && day <= 6))]
    : [];
  const openFrom = text(input?.openFrom, 5);
  const openUntil = text(input?.openUntil, 5);
  const name = text(input?.name, 60);
  const sport = text(input?.sport, 32);
  const city = text(input?.city, 40);
  const neighborhood = text(input?.neighborhood, 40);
  const surface = text(input?.surface, 32);
  const priceCents = Number(input?.priceCents);
  if (name.length < 3) fail("Dê um nome para a quadra.");
  if (!isSport(sport)) fail("Escolha o esporte.");
  if (city.length < 2 || neighborhood.length < 2) fail("Informe cidade e bairro.");
  if (!isSurface(surface)) fail("Escolha o piso.");
  if (!TIME_RE.test(openFrom) || !TIME_RE.test(openUntil)) fail("Horário de funcionamento inválido.");
  if (timeToMinutes(openUntil) < timeToMinutes(openFrom) + 60) fail("A quadra precisa ficar aberta por pelo menos 1 hora.");
  if (weekdays.length === 0) fail("Marque ao menos um dia de funcionamento.");
  return {
    id: withId ? refId(input?.id, "Quadra") : "",
    name,
    sport,
    city,
    neighborhood,
    address: text(input?.address, 120),
    description: text(input?.description, 600),
    surface,
    indoor: input?.indoor === true,
    priceCents,
    openFrom,
    openUntil,
    weekdays,
  };
}

export const saveCourt = createServerFn({ method: "POST" })
  .validator((input: Partial<SaveInput> | undefined) => readCourtInput(input, Boolean(input?.id)))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sql = await db();
    const profile = await requireOwner(sql, context.userId);
    const settings = await loadSettings(sql);
    assertPrice(data.priceCents, settings, profile.role === "admin");
    const weekdays = data.weekdays.join(",");
    if (!data.id) {
      const admins = await countAdmins(sql);
      const status = admins === 0 || profile.role === "admin" ? "active" : "pending";
      const id = crypto.randomUUID();
      await sql`
        insert into courts (
          id, owner_id, name, sport, city, neighborhood, address, description, price_cents,
          surface, indoor, status, open_from, open_until, weekdays
        ) values (
          ${id}, ${context.userId}, ${data.name}, ${data.sport}, ${data.city}, ${data.neighborhood},
          ${data.address}, ${data.description}, ${data.priceCents}, ${data.surface}, ${data.indoor},
          ${status}, ${data.openFrom}, ${data.openUntil}, ${weekdays}
        )
      `;
      return { id };
    }
    const owned = await sql<{ id: string }>`
      select id from courts where id = ${data.id} and owner_id = ${context.userId}
    `;
    if (!owned[0]) fail("Você não gerencia esta quadra.");
    await sql`
      update courts set
        name = ${data.name},
        sport = ${data.sport},
        city = ${data.city},
        neighborhood = ${data.neighborhood},
        address = ${data.address},
        description = ${data.description},
        price_cents = ${data.priceCents},
        surface = ${data.surface},
        indoor = ${data.indoor},
        open_from = ${data.openFrom},
        open_until = ${data.openUntil},
        weekdays = ${weekdays}
      where id = ${data.id} and owner_id = ${context.userId}
    `;
    return { id: data.id };
  });

export const setCourtPaused = createServerFn({ method: "POST" })
  .validator((input: { courtId?: string; paused?: boolean }) => ({
    courtId: refId(input?.courtId, "Quadra"),
    paused: input?.paused === true,
  }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await db();
    await requireOwner(sql, context.userId);
    const rows = await sql<{ status: string }>`
      select status from courts where id = ${data.courtId} and owner_id = ${context.userId}
    `;
    const current = rows[0];
    if (!current) fail("Quadra não encontrada.");
    if (current.status === "pending" || current.status === "rejected") {
      fail("Esta quadra ainda não pode ser pausada.");
    }
    const status = data.paused ? "paused" : "active";
    await sql`
      update courts set status = ${status}
      where id = ${data.courtId} and owner_id = ${context.userId}
    `;
    return { ok: true };
  });

export const getOwnerHome = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<OwnerHome> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    if (profile.role !== "owner" && profile.role !== "admin") {
      const settings = await loadSettings(sql);
      return { courts: [], bookings: [], minPriceCents: settings.min_price_cents, maxPriceCents: settings.max_price_cents, feeBps: settings.fee_bps };
    }
    const today = nowSP().date;
    const courts = await sql<CourtRow>`
      select id, owner_id, name, sport, city, neighborhood, address, description, price_cents, surface,
             indoor, status, open_from, open_until, weekdays
      from courts where owner_id = ${context.userId}
      order by created_at desc
    `;
    const bookings = await sql<{
      id: string;
      court_name: string;
      play_date: string;
      start_time: string;
      end_time: string;
      kind: "private" | "open";
      status: string;
      host_name: string;
      filled: number;
      spots: number;
      paid_count: number;
      price_cents: number;
    }>`
      select b.id, c.name as court_name, b.play_date, b.start_time, b.end_time, b.kind, b.status,
             pr.display_name as host_name, b.spots, b.price_cents,
             (select count(*)::int from participants p where p.booking_id = b.id and p.status = 'joined') as filled,
             (select count(*)::int from payments pay where pay.booking_id = b.id and pay.status in ('paid', 'validated')) as paid_count
      from bookings b
      join courts c on c.id = b.court_id and c.owner_id = ${context.userId}
      join profiles pr on pr.user_id = b.host_id
      where b.status <> 'cancelled' and b.play_date >= ${today}::date
      order by b.play_date, b.start_time
      limit 40
    `;
    const settings = await loadSettings(sql);
    return {
      courts: courts.map(mapOwnerCourt),
      bookings: bookings.map((row) => ({
        id: row.id,
        courtName: row.court_name,
        date: asDate(row.play_date),
        start: row.start_time,
        end: row.end_time,
        kind: row.kind === "open" ? "open" : "private",
        status: row.status,
        hostName: row.host_name,
        filled: Number(row.filled),
        spots: Number(row.spots),
        paidCount: Number(row.paid_count),
        priceCents: Number(row.price_cents),
      })),
      minPriceCents: settings.min_price_cents,
      maxPriceCents: settings.max_price_cents,
      feeBps: settings.fee_bps,
    };
  });

const DEMO_COURTS = [
  {
    name: "Arena do Largo",
    sport: "futsal",
    city: "São Paulo",
    neighborhood: "Pinheiros",
    address: "Rua dos Pinheiros, 400",
    description: "Futsal coberto, vestiário e bola. Piso sintético com iluminação uniforme.",
    priceCents: 16000,
    surface: "sintetica",
    indoor: true,
  },
  {
    name: "Society do Bosque",
    sport: "society",
    city: "São Paulo",
    neighborhood: "Vila Mariana",
    address: "Rua do Bosque, 88",
    description: "Campo society com grama sintética, estacionamento na rua e bar ao lado.",
    priceCents: 22000,
    surface: "grama",
    indoor: false,
  },
  {
    name: "Saibro Itaim",
    sport: "tenis",
    city: "São Paulo",
    neighborhood: "Itaim Bibi",
    address: "Rua Joaquim Floriano, 120",
    description: "Quadra de saibro ao ar livre. Raquete não inclusa. Água na recepção.",
    priceCents: 12000,
    surface: "saibro",
    indoor: false,
  },
  {
    name: "Beach do Quebra-Mar",
    sport: "beach",
    city: "Santos",
    neighborhood: "Gonzaga",
    address: "Avenida Presidente Wilson, 250",
    description: "Areia e rede oficial, chuveiro externo e vaga para quatro ou duplas.",
    priceCents: 11000,
    surface: "areia",
    indoor: false,
  },
];

async function insertDemoGame(
  sql: Sql,
  courtId: string,
  hostId: string,
  date: string,
  start: string,
  spots: number,
  note: string,
  priceCents: number,
) {
  const share = Math.floor(priceCents / spots);
  const hostCents = priceCents - share * (spots - 1);
  const id = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  await sql`
    insert into bookings (
      id, court_id, host_id, play_date, start_time, end_time, kind, spots,
      price_cents, host_cents, share_cents, note, status
    ) values (
      ${id}, ${courtId}, ${hostId}, ${date}::date, ${start}, ${addMinutes(start, 60)}, 'open', ${spots},
      ${priceCents}, ${hostCents}, ${share}, ${note}, 'confirmed'
    )
  `;
  await sql`
    insert into participants (booking_id, user_id, status) values (${id}, ${hostId}, 'joined')
  `;
  await sql`
    insert into payments (id, booking_id, user_id, amount_cents, method, status, reference, last4)
    values (
      ${paymentId}, ${id}, ${hostId}, ${hostCents}, 'card', 'paid', ${`QL${id.replace(/-/g, "").slice(0, 10).toUpperCase()}`}, '4242'
    )
  `;
}

export const seedDemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ courts: number; games: number; pending: boolean }> => {
    const sql = await db();
    const profile = await requireOwner(sql, context.userId);
    const existing = await sql<{ n: number }>`select count(*)::int as n from courts where owner_id = ${context.userId}`;
    if (Number(existing[0]?.n ?? 0) > 0) fail("Você já tem quadras cadastradas.");
    const admins = await countAdmins(sql);
    const status = admins === 0 || profile.role === "admin" ? "active" : "pending";
    const today = nowSP().date;
    const ids: { id: string; sport: string; priceCents: number }[] = [];
    for (const court of DEMO_COURTS) {
      const id = crypto.randomUUID();
      await sql`
        insert into courts (
          id, owner_id, name, sport, city, neighborhood, address, description, price_cents,
          surface, indoor, status, open_from, open_until, weekdays
        ) values (
          ${id}, ${context.userId}, ${court.name}, ${court.sport}, ${court.city}, ${court.neighborhood},
          ${court.address}, ${court.description}, ${court.priceCents}, ${court.surface}, ${court.indoor},
          ${status}, '08:00', '23:00', '1,2,3,4,5,6,0'
        )
      `;
      ids.push({ id, sport: court.sport, priceCents: court.priceCents });
    }
    let games = 0;
    if (status === "active") {
      const futsal = ids.find((court) => court.sport === "futsal");
      const beach = ids.find((court) => court.sport === "beach");
      if (futsal) {
        await insertDemoGame(sql, futsal.id, context.userId, addDays(today, 1), "19:00", 10, "Nível intermediário. Bola na quadra.", futsal.priceCents);
        games += 1;
      }
      if (beach) {
        await insertDemoGame(sql, beach.id, context.userId, addDays(today, 2), "18:00", 4, "Duplas. Nível livre.", beach.priceCents);
        games += 1;
      }
    }
    return { courts: ids.length, games, pending: status === "pending" };
  });

export const createBooking = createServerFn({ method: "POST" })
  .validator((input: { courtId?: string; date?: string; start?: string; kind?: string; spots?: number; note?: string }) => {
    const date = text(input?.date, 10);
    const start = text(input?.start, 5);
    const kind = input?.kind === "open" ? "open" : "private";
    if (!DATE_RE.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) fail("Data ou horário inválido.");
    const spots = kind === "open" ? Math.round(Number(input?.spots)) : 1;
    if (kind === "open" && (spots < 2 || spots > 20)) fail("Um jogo aberto precisa de 2 a 20 vagas.");
    return { courtId: refId(input?.courtId, "Quadra"), date, start, kind, spots, note: text(input?.note, 280) };
  })
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ bookingId: string }> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    assertActive(profile);
    const courts = await sql<CourtRow>`
      select id, owner_id, name, sport, city, neighborhood, address, description, price_cents, surface,
             indoor, status, open_from, open_until, weekdays
      from courts where id = ${data.courtId}
    `;
    const court = courts[0];
    if (!court || court.status !== "active") fail("Esta quadra não está disponível.");
    const now = nowSP();
    if (data.date < now.date || data.date > addDays(now.date, 21)) fail("Escolha uma data nos próximos 21 dias.");
    if (!weekdayOpen(court.weekdays, data.date)) fail("A quadra não abre neste dia.");
    const slot = buildStarts(court.open_from, court.open_until).find((item) => item.start === data.start);
    if (!slot) fail("Horário fora do funcionamento da quadra.");
    if (data.date === now.date && timeToMinutes(data.start) <= now.minutes) fail("Esse horário já começou.");
    const price = Number(court.price_cents);
    const share = data.kind === "open" ? Math.floor(price / data.spots) : price;
    const hostCents = price - share * (data.spots - 1);
    const id = crypto.randomUUID();
    try {
      await sql`
        insert into bookings (
          id, court_id, host_id, play_date, start_time, end_time, kind, spots,
          price_cents, host_cents, share_cents, note, status
        ) values (
          ${id}, ${court.id}, ${context.userId}, ${data.date}::date, ${slot.start}, ${slot.end},
          ${data.kind}, ${data.spots}, ${price}, ${hostCents}, ${share}, ${data.note}, 'awaiting_payment'
        )
      `;
      await sql`insert into participants (booking_id, user_id, status) values (${id}, ${context.userId}, 'joined')`;
    } catch (err) {
      await sql`delete from participants where booking_id = ${id}`;
      await sql`delete from bookings where id = ${id}`;
      if (isUnique(err)) fail("Esse horário acabou de ser reservado.");
      throw err;
    }
    return { bookingId: id };
  });

async function filledCount(sql: Sql, bookingId: string): Promise<number> {
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from participants where booking_id = ${bookingId} and status = 'joined'
  `;
  return Number(rows[0]?.n ?? 0);
}

export const getCheckout = createServerFn({ method: "POST" })
  .validator((input: { bookingId?: string }) => ({ bookingId: refId(input?.bookingId, "Reserva") }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<Checkout> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    const booking = await joinedBooking(sql, data.bookingId, context.userId);
    if (booking.status === "cancelled") fail("Esta reserva foi cancelada.");
    const courts = await sql<{ name: string; sport: string; city: string; neighborhood: string }>`
      select name, sport, city, neighborhood from courts where id = ${booking.court_id}
    `;
    const court = courts[0];
    if (!court) fail("Quadra não encontrada.");
    const payment = await activePayment(sql, booking.id, context.userId);
    const settings = await loadSettings(sql);
    return {
      bookingId: booking.id,
      courtName: court.name,
      sport: court.sport,
      city: court.city,
      neighborhood: court.neighborhood,
      date: booking.play_date,
      start: booking.start_time,
      end: booking.end_time,
      kind: booking.kind,
      status: booking.status,
      note: booking.note,
      isHost: booking.host_id === context.userId,
      amountCents: amountFor(booking, context.userId),
      priceCents: booking.price_cents,
      spots: booking.spots,
      filled: await filledCount(sql, booking.id),
      payment: payment
        ? { method: payment.method, status: payment.status, reference: payment.reference, last4: payment.last4 }
        : null,
      viewerIsAdmin: profile.role === "admin",
      pixValidation: settings.pix_validation,
    };
  });

async function ensurePayment(sql: Sql, booking: BookingRow, userId: string, method: "pix" | "card"): Promise<PaymentRow> {
  const current = await activePayment(sql, booking.id, userId);
  if (current) {
    if (current.status === "draft" && current.method !== method) {
      await sql`update payments set method = ${method} where id = ${current.id}`;
      return { ...current, method };
    }
    return current;
  }
  const id = crypto.randomUUID();
  const reference = `QL${id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const amount = amountFor(booking, userId);
  await sql`
    insert into payments (id, booking_id, user_id, amount_cents, method, status, reference)
    values (${id}, ${booking.id}, ${userId}, ${amount}, ${method}, 'draft', ${reference})
  `;
  return { id, booking_id: booking.id, user_id: userId, amount_cents: amount, method, status: "draft", reference, last4: "" };
}

export const preparePix = createServerFn({ method: "POST" })
  .validator((input: { bookingId?: string }) => ({ bookingId: refId(input?.bookingId, "Reserva") }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ reference: string; status: string; amountCents: number }> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    assertActive(profile);
    const booking = await joinedBooking(sql, data.bookingId, context.userId);
    if (booking.status === "cancelled") fail("Esta reserva foi cancelada.");
    const payment = await ensurePayment(sql, booking, context.userId, "pix");
    return { reference: payment.reference, status: payment.status, amountCents: Number(payment.amount_cents) };
  });

export const submitPix = createServerFn({ method: "POST" })
  .validator((input: { bookingId?: string }) => ({ bookingId: refId(input?.bookingId, "Reserva") }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ status: string; reference: string }> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    assertActive(profile);
    const booking = await joinedBooking(sql, data.bookingId, context.userId);
    if (booking.status === "cancelled") fail("Esta reserva foi cancelada.");
    const payment = await ensurePayment(sql, booking, context.userId, "pix");
    if (payment.status === "paid" || payment.status === "validated" || payment.status === "pending") {
      return { status: payment.status, reference: payment.reference };
    }
    const settings = await loadSettings(sql);
    const next = settings.pix_validation ? "pending" : "paid";
    await sql`update payments set status = ${next}, method = 'pix' where id = ${payment.id}`;
    if (next === "paid") await confirmIfHostPaid(sql, booking.id, booking.host_id);
    return { status: next, reference: payment.reference };
  });

export const submitCard = createServerFn({ method: "POST" })
  .validator((input: { bookingId?: string; last4?: string }) => {
    const last4 = text(input?.last4, 4);
    if (!/^\d{4}$/.test(last4)) fail("Não foi possível ler o cartão.");
    return { bookingId: refId(input?.bookingId, "Reserva"), last4 };
  })
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ status: string }> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    assertActive(profile);
    const booking = await joinedBooking(sql, data.bookingId, context.userId);
    if (booking.status === "cancelled") fail("Esta reserva foi cancelada.");
    const payment = await ensurePayment(sql, booking, context.userId, "card");
    if (payment.status === "pending") fail("Há um PIX em análise para esta reserva.");
    if (payment.status === "paid" || payment.status === "validated") return { status: payment.status };
    await sql`
      update payments set status = 'paid', method = 'card', last4 = ${data.last4}
      where id = ${payment.id}
    `;
    await confirmIfHostPaid(sql, booking.id, booking.host_id);
    return { status: "paid" };
  });

export const listGames = createServerFn({ method: "POST" })
  .validator((input: { sport?: string } | undefined) => ({ sport: text(input?.sport, 32) }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<OpenGameCard[]> => {
    const sql = await db();
    await ensureProfile(sql, context.userId);
    const today = nowSP().date;
    const sport = isSport(data.sport) ? data.sport : "";
    const rows = await sql<{
      id: string;
      court_id: string;
      court_name: string;
      sport: string;
      city: string;
      neighborhood: string;
      play_date: string;
      start_time: string;
      end_time: string;
      spots: number;
      filled: number;
      note: string;
      host_id: string;
      host_name: string;
      joined: boolean;
      status: string;
      share_cents: number;
    }>`
      select b.id, b.court_id, c.name as court_name, c.sport, c.city, c.neighborhood,
             b.play_date, b.start_time, b.end_time, b.spots, b.note, b.host_id, b.status, b.share_cents,
             pr.display_name as host_name,
             (select count(*)::int from participants p where p.booking_id = b.id and p.status = 'joined') as filled,
             exists(
               select 1 from participants p
               where p.booking_id = b.id and p.user_id = ${context.userId} and p.status = 'joined'
             ) as joined
      from bookings b
      join courts c on c.id = b.court_id and c.status = 'active'
      join profiles pr on pr.user_id = b.host_id
      where b.kind = 'open'
        and b.status in ('awaiting_payment', 'confirmed')
        and b.play_date >= ${today}::date
        and (${sport} = '' or c.sport = ${sport})
      order by b.play_date, b.start_time
      limit 60
    `;
    const now = nowSP();
    return rows
      .map((row) => ({
        id: row.id,
        courtId: row.court_id,
        courtName: row.court_name,
        sport: row.sport,
        city: row.city,
        neighborhood: row.neighborhood,
        date: asDate(row.play_date),
        start: row.start_time,
        end: row.end_time,
        spots: Number(row.spots),
        filled: Number(row.filled),
        note: row.note,
        hostName: row.host_name,
        isHost: row.host_id === context.userId,
        joined: flag(row.joined),
        status: row.status,
        shareCents: Number(row.share_cents),
      }))
      .filter((game) => !slotEnded(game.date, game.end, now));
  });

export const getGame = createServerFn({ method: "POST" })
  .validator((input: { bookingId?: string }) => ({ bookingId: refId(input?.bookingId, "Jogo") }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<GameDetail> => {
    const sql = await db();
    await ensureProfile(sql, context.userId);
    const rows = await sql<{
      id: string;
      court_id: string;
      court_name: string;
      sport: string;
      city: string;
      neighborhood: string;
      address: string;
      play_date: string;
      start_time: string;
      end_time: string;
      spots: number;
      note: string;
      host_id: string;
      host_name: string;
      status: string;
      kind: string;
      share_cents: number;
      price_cents: number;
    }>`
      select b.id, b.court_id, c.name as court_name, c.sport, c.city, c.neighborhood, c.address,
             b.play_date, b.start_time, b.end_time, b.spots, b.note, b.host_id, b.status, b.kind,
             b.share_cents, b.price_cents, pr.display_name as host_name
      from bookings b
      join courts c on c.id = b.court_id
      join profiles pr on pr.user_id = b.host_id
      where b.id = ${data.bookingId} and b.kind = 'open'
    `;
    const game = rows[0];
    if (!game) fail("Jogo não encontrado.");
    const people = await sql<{ display_name: string; user_id: string; status: string }>`
      select pr.display_name, p.user_id, p.status
      from participants p
      join profiles pr on pr.user_id = p.user_id
      where p.booking_id = ${game.id} and p.status = 'joined'
      order by p.created_at
    `;
    const payment = await activePayment(sql, game.id, context.userId);
    return {
      id: game.id,
      courtId: game.court_id,
      courtName: game.court_name,
      sport: game.sport,
      city: game.city,
      neighborhood: game.neighborhood,
      address: game.address,
      date: asDate(game.play_date),
      start: game.start_time,
      end: game.end_time,
      spots: Number(game.spots),
      filled: people.length,
      note: game.note,
      hostName: game.host_name,
      isHost: game.host_id === context.userId,
      joined: people.some((person) => person.user_id === context.userId),
      status: game.status,
      shareCents: Number(game.share_cents),
      priceCents: Number(game.price_cents),
      participants: people.map((person) => person.display_name),
      paymentStatus: payment?.status ?? null,
      bookingStatus: game.status,
    };
  });

export const joinGame = createServerFn({ method: "POST" })
  .validator((input: { bookingId?: string }) => ({ bookingId: refId(input?.bookingId, "Jogo") }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<{ bookingId: string }> => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    assertActive(profile);
    const rows = await sql<BookingRow>`
      select id, court_id, host_id, play_date, start_time, end_time, kind, spots, price_cents,
             host_cents, share_cents, note, status
      from bookings where id = ${data.bookingId}
    `;
    const booking = rows[0];
    if (!booking || booking.kind !== "open") fail("Jogo não encontrado.");
    if (booking.status === "cancelled") fail("Este jogo foi cancelado.");
    if (booking.host_id === context.userId) fail("Você organiza este jogo.");
    const date = asDate(booking.play_date);
    if (slotEnded(date, booking.end_time)) fail("Este jogo já aconteceu.");
    const existing = await sql<{ status: string }>`
      select status from participants where booking_id = ${booking.id} and user_id = ${context.userId}
    `;
    if (existing[0]?.status === "joined") return { bookingId: booking.id };
    const filled = await filledCount(sql, booking.id);
    if (filled >= Number(booking.spots)) fail("As vagas deste jogo acabaram.");
    if (!existing[0]) {
      await sql`insert into participants (booking_id, user_id, status) values (${booking.id}, ${context.userId}, 'joined')`;
    } else {
      await sql`
        update participants set status = 'joined'
        where booking_id = ${booking.id} and user_id = ${context.userId}
      `;
    }
    return { bookingId: booking.id };
  });

export const leaveGame = createServerFn({ method: "POST" })
  .validator((input: { bookingId?: string }) => ({ bookingId: refId(input?.bookingId, "Jogo") }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    assertActive(profile);
    const booking = await joinedBooking(sql, data.bookingId, context.userId);
    if (booking.host_id === context.userId) fail("Quem organiza cancela o jogo inteiro.");
    await sql`
      update participants set status = 'left'
      where booking_id = ${booking.id} and user_id = ${context.userId}
    `;
    await sql`
      update payments set status = 'refunded', reviewed_at = now()
      where booking_id = ${booking.id} and user_id = ${context.userId} and status in ('paid', 'validated')
    `;
    await sql`
      update payments set status = 'rejected', reviewed_at = now()
      where booking_id = ${booking.id} and user_id = ${context.userId} and status in ('draft', 'pending')
    `;
    return { ok: true };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .validator((input: { bookingId?: string }) => ({ bookingId: refId(input?.bookingId, "Reserva") }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await db();
    const profile = await ensureProfile(sql, context.userId);
    assertActive(profile);
    const booking = await joinedBooking(sql, data.bookingId, context.userId);
    if (booking.host_id !== context.userId) fail("Só quem organizou pode cancelar.");
    if (booking.status === "cancelled") return { ok: true };
    if (slotEnded(booking.play_date, booking.end_time)) fail("Este horário já encerrou.");
    await cancelBookingRecords(sql, booking.id);
    return { ok: true };
  });

export const listAgenda = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AgendaItem[]> => {
    const sql = await db();
    await ensureProfile(sql, context.userId);
    const rows = await sql<{
      id: string;
      court_name: string;
      sport: string;
      neighborhood: string;
      city: string;
      play_date: string;
      start_time: string;
      end_time: string;
      kind: "private" | "open";
      status: string;
      spots: number;
      filled: number;
      note: string;
      host_id: string;
      host_cents: number;
      share_cents: number;
      payment_status: string | null;
    }>`
      select b.id, c.name as court_name, c.sport, c.neighborhood, c.city, b.play_date, b.start_time,
             b.end_time, b.kind, b.status, b.spots, b.note, b.host_id, b.host_cents, b.share_cents,
             (select count(*)::int from participants p where p.booking_id = b.id and p.status = 'joined') as filled,
             (select pay.status from payments pay
               where pay.booking_id = b.id and pay.user_id = ${context.userId}
               order by pay.created_at desc limit 1) as payment_status
      from bookings b
      join courts c on c.id = b.court_id
      join participants me on me.booking_id = b.id and me.user_id = ${context.userId} and me.status = 'joined'
      order by b.play_date desc, b.start_time desc
      limit 40
    `;
    return rows.map((row) => ({
      id: row.id,
      courtName: row.court_name,
      sport: row.sport,
      neighborhood: row.neighborhood,
      city: row.city,
      date: asDate(row.play_date),
      start: row.start_time,
      end: row.end_time,
      kind: row.kind === "open" ? "open" : "private",
      status: row.status,
      spots: Number(row.spots),
      filled: Number(row.filled),
      note: row.note,
      isHost: row.host_id === context.userId,
      amountCents: row.host_id === context.userId ? Number(row.host_cents) : Number(row.share_cents),
      paymentStatus: row.payment_status,
    }));
  });

export const getAdminBundle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminBundle> => {
    const sql = await db();
    await requireAdmin(sql, context.userId);
    const today = nowSP().date;
    const settings = await loadSettings(sql);
    const courtCount = await sql<{ n: number; active: number }>`
      select count(*)::int as n, count(*) filter (where status = 'active')::int as active from courts
    `;
    const gameCount = await sql<{ n: number }>`
      select count(*)::int as n from bookings
      where status <> 'cancelled' and play_date >= ${today}::date
    `;
    const payCount = await sql<{ n: number }>`select count(*)::int as n from payments where status = 'pending'`;
    const userCount = await sql<{ n: number; suspended: number }>`
      select count(*)::int as n, count(*) filter (where status = 'suspended')::int as suspended from profiles
    `;
    const courts = await sql<{
      id: string;
      name: string;
      sport: string;
      city: string;
      neighborhood: string;
      price_cents: number;
      status: string;
      owner_name: string;
      owner_id: string;
    }>`
      select c.id, c.name, c.sport, c.city, c.neighborhood, c.price_cents, c.status,
             p.display_name as owner_name, c.owner_id
      from courts c
      join profiles p on p.user_id = c.owner_id
      order by c.created_at desc
      limit 80
    `;
    const games = await sql<{
      id: string;
      court_name: string;
      play_date: string;
      start_time: string;
      kind: "private" | "open";
      status: string;
      host_name: string;
      filled: number;
      spots: number;
      price_cents: number;
    }>`
      select b.id, c.name as court_name, b.play_date, b.start_time, b.kind, b.status,
             pr.display_name as host_name, b.spots, b.price_cents,
             (select count(*)::int from participants p where p.booking_id = b.id and p.status = 'joined') as filled
      from bookings b
      join courts c on c.id = b.court_id
      join profiles pr on pr.user_id = b.host_id
      where b.play_date >= ${addDays(today, -2)}::date
      order by b.play_date, b.start_time
      limit 80
    `;
    const payments = await sql<{
      id: string;
      amount_cents: number;
      method: "pix" | "card";
      status: string;
      reference: string;
      last4: string;
      payer_name: string;
      user_id: string;
      court_name: string;
      play_date: string;
      start_time: string;
    }>`
      select pay.id, pay.amount_cents, pay.method, pay.status, pay.reference, pay.last4,
             pr.display_name as payer_name, pay.user_id, c.name as court_name, b.play_date, b.start_time
      from payments pay
      join profiles pr on pr.user_id = pay.user_id
      join bookings b on b.id = pay.booking_id
      join courts c on c.id = b.court_id
      order by pay.created_at desc
      limit 80
    `;
    const users = await sql<{
      user_id: string;
      display_name: string;
      role: Role;
      status: "active" | "suspended";
      created_on: string;
      courts: number;
      games: number;
    }>`
      select user_id, display_name, role, status,
             to_char(created_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as created_on,
             (select count(*)::int from courts c where c.owner_id = profiles.user_id) as courts,
             (select count(*)::int from bookings b where b.host_id = profiles.user_id and b.status <> 'cancelled') as games
      from profiles
      order by created_at desc
      limit 80
    `;
    return {
      settings: {
        feeBps: settings.fee_bps,
        minPriceCents: settings.min_price_cents,
        maxPriceCents: settings.max_price_cents,
        pixValidation: settings.pix_validation,
      },
      stats: {
        courts: Number(courtCount[0]?.n ?? 0),
        activeCourts: Number(courtCount[0]?.active ?? 0),
        games: Number(gameCount[0]?.n ?? 0),
        pendingPayments: Number(payCount[0]?.n ?? 0),
        users: Number(userCount[0]?.n ?? 0),
        suspended: Number(userCount[0]?.suspended ?? 0),
      },
      courts: courts.map((court) => ({
        id: court.id,
        name: court.name,
        sport: court.sport,
        city: court.city,
        neighborhood: court.neighborhood,
        priceCents: Number(court.price_cents),
        status: court.status,
        ownerName: court.owner_name,
        ownerCode: accountCode(court.owner_id),
      })),
      games: games.map((game) => ({
        id: game.id,
        courtName: game.court_name,
        date: asDate(game.play_date),
        start: game.start_time,
        kind: game.kind === "open" ? "open" : "private",
        status: game.status,
        hostName: game.host_name,
        filled: Number(game.filled),
        spots: Number(game.spots),
        priceCents: Number(game.price_cents),
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        amountCents: Number(payment.amount_cents),
        method: payment.method,
        status: payment.status,
        reference: payment.reference,
        last4: payment.last4,
        payerName: payment.payer_name,
        payerCode: accountCode(payment.user_id),
        courtName: payment.court_name,
        date: asDate(payment.play_date),
        start: payment.start_time,
      })),
      users: users.map((user) => ({
        id: user.user_id,
        code: accountCode(user.user_id),
        name: user.display_name,
        role: asRole(user.role),
        status: user.status === "suspended" ? "suspended" : "active",
        createdOn: user.created_on,
        courts: Number(user.courts),
        games: Number(user.games),
      })),
    };
  });

export const adminSetCourt = createServerFn({ method: "POST" })
  .validator((input: { courtId?: string; status?: string; priceCents?: number }) => {
    const status = text(input?.status, 16);
    const allowed = ["pending", "active", "paused", "rejected"];
    return {
      courtId: refId(input?.courtId, "Quadra"),
      status: allowed.includes(status) ? status : "",
      priceCents: input?.priceCents == null ? null : Math.round(Number(input.priceCents)),
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await db();
    await requireAdmin(sql, context.userId);
    if (data.status) {
      await sql`update courts set status = ${data.status} where id = ${data.courtId}`;
    }
    if (data.priceCents != null) {
      assertPrice(data.priceCents, await loadSettings(sql), true);
      await sql`update courts set price_cents = ${data.priceCents} where id = ${data.courtId}`;
    }
    return { ok: true };
  });

export const adminReviewPayment = createServerFn({ method: "POST" })
  .validator((input: { paymentId?: string; action?: string }) => {
    const action = input?.action;
    if (action !== "validate" && action !== "reject" && action !== "refund") fail("Ação inválida.");
    return { paymentId: refId(input?.paymentId, "Pagamento"), action };
  })
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await db();
    await requireAdmin(sql, context.userId);
    const rows = await sql<{
      id: string;
      booking_id: string;
      user_id: string;
      status: string;
      host_id: string;
      booking_status: string;
    }>`
      select pay.id, pay.booking_id, pay.user_id, pay.status, b.host_id, b.status as booking_status
      from payments pay
      join bookings b on b.id = pay.booking_id
      where pay.id = ${data.paymentId}
    `;
    const payment = rows[0];
    if (!payment) fail("Pagamento não encontrado.");
    if (data.action === "validate") {
      if (payment.status !== "pending" && payment.status !== "paid") fail("Este pagamento não está pronto para validar.");
      await sql`update payments set status = 'validated', reviewed_at = now() where id = ${payment.id}`;
      await confirmIfHostPaid(sql, payment.booking_id, payment.host_id);
      return { ok: true };
    }
    if (data.action === "reject") {
      if (payment.status !== "pending" && payment.status !== "draft") fail("Só dá para recusar um pagamento em análise.");
      await sql`update payments set status = 'rejected', reviewed_at = now() where id = ${payment.id}`;
      if (payment.user_id === payment.host_id) await cancelBookingRecords(sql, payment.booking_id);
      else {
        await sql`
          update participants set status = 'left'
          where booking_id = ${payment.booking_id} and user_id = ${payment.user_id}
        `;
      }
      return { ok: true };
    }
    if (payment.status !== "paid" && payment.status !== "validated") fail("Só pagamentos confirmados podem ser estornados.");
    await sql`update payments set status = 'refunded', reviewed_at = now() where id = ${payment.id}`;
    if (payment.user_id === payment.host_id) await cancelBookingRecords(sql, payment.booking_id);
    else {
      await sql`
        update participants set status = 'left'
        where booking_id = ${payment.booking_id} and user_id = ${payment.user_id}
      `;
    }
    return { ok: true };
  });

export const adminSetUser = createServerFn({ method: "POST" })
  .validator((input: { userId?: string; role?: string; status?: string }) => {
    const role = text(input?.role, 16);
    const status = text(input?.status, 16);
    return {
      userId: text(input?.userId, 128),
      role: role === "player" || role === "owner" || role === "admin" ? role : "",
      status: status === "active" || status === "suspended" ? status : "",
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await db();
    await requireAdmin(sql, context.userId);
    if (!data.userId) fail("Conta inválida.");
    if (!data.role && !data.status) fail("Nada para atualizar.");
    const rows = await sql<{ role: string; status: string }>`
      select role, status from profiles where user_id = ${data.userId}
    `;
    const target = rows[0];
    if (!target) fail("Conta não encontrada.");
    if (data.status === "suspended" && data.userId === context.userId) fail("Você não pode suspender a própria conta.");
    if (target.role === "admin" && data.role && data.role !== "admin") {
      const admins = await countAdmins(sql);
      if (admins <= 1) fail("A plataforma precisa de pelo menos uma administração.");
    }
    if (data.role) await sql`update profiles set role = ${data.role} where user_id = ${data.userId}`;
    if (data.status) await sql`update profiles set status = ${data.status} where user_id = ${data.userId}`;
    return { ok: true };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .validator((input: { feePercent?: number; minCents?: number; maxCents?: number; pixValidation?: boolean }) => {
    const feePercent = Number(input?.feePercent);
    const minCents = Math.round(Number(input?.minCents));
    const maxCents = Math.round(Number(input?.maxCents));
    if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 30) fail("A taxa fica entre 0% e 30%.");
    if (!Number.isInteger(minCents) || !Number.isInteger(maxCents) || minCents < 100 || maxCents > 500000 || minCents >= maxCents) {
      fail("Revise o intervalo de preços.");
    }
    return { feeBps: Math.round(feePercent * 100), minCents, maxCents, pixValidation: input?.pixValidation !== false };
  })
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await db();
    await requireAdmin(sql, context.userId);
    await loadSettings(sql);
    await sql`
      update platform_settings
      set fee_bps = ${data.feeBps},
          min_price_cents = ${data.minCents},
          max_price_cents = ${data.maxCents},
          pix_validation = ${data.pixValidation}
      where id = 1
    `;
    return { ok: true };
  });
