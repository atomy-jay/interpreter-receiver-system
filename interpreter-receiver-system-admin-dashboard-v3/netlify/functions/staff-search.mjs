import {
  cleanText,
  errorResponse,
  findEvent,
  getSupabase,
  HttpError,
  json,
  requireMethod,
  requireStaff
} from "./_shared.mjs";

export default async (request) => {
  try {
    requireMethod(request, "GET");
    requireStaff(request);

    const url = new URL(request.url);
    const q = cleanText(url.searchParams.get("q"), 120);
    const safeQuery = q.replace(/[,%()]/g, " ").trim();
    const eventCode = cleanText(url.searchParams.get("event"), 50);

    if (safeQuery.length < 2) throw new HttpError(400, "Enter at least 2 characters");

    const supabase = getSupabase();
    const event = await findEvent(supabase, eventCode, { allowClosed: true });

    const memberDigits = safeQuery.replace(/\D/g, "");

    let query = supabase
      .from("registrations")
      .select("id, public_token, member_no, full_name, language, status")
      .eq("event_id", event.id)
      .limit(20);

    if (memberDigits.length >= 3) {
      query = query.ilike("member_no", `%${memberDigits}%`);
    } else {
      query = query.ilike("full_name", `%${safeQuery}%`);
    }

    const { data, error } = await query.order("full_name");
    if (error) throw error;

    return json({ ok: true, event, results: data || [] });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: "/api/staff-search" };
