import {
  cleanText,
  errorResponse,
  findEvent,
  getSupabase,
  json,
  requireMethod,
  requireStaff
} from "./_shared.mjs";

export default async (request) => {
  try {
    requireMethod(request, "GET");
    requireStaff(request);

    const url = new URL(request.url);
    const eventCode = cleanText(url.searchParams.get("event"), 50);
    const supabase = getSupabase();
    const event = await findEvent(supabase, eventCode, { allowClosed: true });

    const [registrationsResult, receiversResult, rentalsResult] = await Promise.all([
      supabase
        .from("registrations")
        .select("id, public_token, member_no, full_name, language, status, created_at")
        .eq("event_id", event.id)
        .eq("status", "registered")
        .order("created_at"),
      supabase
        .from("receivers")
        .select("id, receiver_no, status")
        .eq("event_id", event.id)
        .order("receiver_no"),
      supabase
        .from("rentals")
        .select(`
          id, status, rented_at, returned_at, staff_name, return_staff_name, notes,
          registrations!inner(id, member_no, full_name, language, public_token),
          receivers!inner(id, receiver_no)
        `)
        .eq("event_id", event.id)
        .order("rented_at", { ascending: false })
    ]);

    if (registrationsResult.error) throw registrationsResult.error;
    if (receiversResult.error) throw receiversResult.error;
    if (rentalsResult.error) throw rentalsResult.error;

    const registrations = registrationsResult.data || [];
    const receivers = receiversResult.data || [];
    const rentals = rentalsResult.data || [];

    const activeRentals = rentals.filter((item) => item.status === "rented");
    const everRented = new Set(rentals.map((item) => item.registrations.id));
    const uncollected = registrations.filter((item) => !everRented.has(item.id));

    const activeByReceiver = new Map(
      activeRentals.map((item) => [item.receivers.id, item])
    );

    const receiverRows = receivers.map((receiver) => {
      const active = activeByReceiver.get(receiver.id);
      return {
        ...receiver,
        active_rental: active ? {
          rental_id: active.id,
          member_no: active.registrations.member_no,
          full_name: active.registrations.full_name,
          language: active.registrations.language,
          rented_at: active.rented_at
        } : null
      };
    });

    const languageMap = new Map();
    for (const registration of registrations) {
      const row = languageMap.get(registration.language) || {
        language: registration.language,
        registered: 0,
        picked_up: 0,
        active: 0
      };
      row.registered += 1;
      if (everRented.has(registration.id)) row.picked_up += 1;
      languageMap.set(registration.language, row);
    }

    for (const rental of activeRentals) {
      const row = languageMap.get(rental.registrations.language) || {
        language: rental.registrations.language,
        registered: 0,
        picked_up: 0,
        active: 0
      };
      row.active += 1;
      languageMap.set(rental.registrations.language, row);
    }

    const recent = [...rentals]
      .sort((a, b) => {
        const aTime = new Date(a.returned_at || a.rented_at).getTime();
        const bTime = new Date(b.returned_at || b.rented_at).getTime();
        return bTime - aTime;
      })
      .slice(0, 20);

    const issues = receivers.filter((item) =>
      ["maintenance", "damaged", "lost"].includes(item.status)
    );

    const returnedCount = rentals.filter((item) => item.status === "returned").length;

    return json({
      ok: true,
      event,
      summary: {
        total_receivers: receivers.length,
        registered: registrations.length,
        rented: activeRentals.length,
        available: receivers.filter((item) => item.status === "available").length,
        returned: returnedCount,
        uncollected: uncollected.length,
        issues: issues.length
      },
      languages: [...languageMap.values()].sort((a, b) =>
        b.registered - a.registered || a.language.localeCompare(b.language)
      ),
      active_rentals: activeRentals,
      uncollected,
      receivers: receiverRows,
      recent,
      issues,
      refreshed_at: new Date().toISOString()
    });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: "/api/dashboard" };
