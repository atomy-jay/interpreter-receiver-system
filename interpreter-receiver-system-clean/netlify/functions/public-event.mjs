import { cleanText, errorResponse, findEvent, getSupabase, json, requireMethod } from "./_shared.mjs";

export default async (request) => {
  try {
    requireMethod(request, "GET");
    const url = new URL(request.url);
    const code = cleanText(url.searchParams.get("code"), 50);
    const supabase = getSupabase();
    const event = await findEvent(supabase, code);

    const { count, error } = await supabase
      .from("receivers")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event.id);

    if (error) throw error;

    return json({
      ok: true,
      event: {
        code: event.code,
        name: event.name,
        event_date: event.event_date,
        location: event.location,
        registration_open: event.registration_open,
        receiver_count: count || 0
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: "/api/public-event" };
