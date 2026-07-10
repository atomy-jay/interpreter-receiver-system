import {
  baseUrl,
  cleanText,
  errorResponse,
  findEvent,
  getSupabase,
  HttpError,
  json,
  normalizeMemberNo,
  readJson,
  requireMethod
} from "./_shared.mjs";

const allowedLanguages = new Set([
  "English", "German", "Russian", "Romanian", "Spanish",
  "Turkish", "Italian", "French", "Korean", "Other"
]);

export default async (request) => {
  try {
    requireMethod(request, "POST");
    const body = await readJson(request);

    const memberNo = normalizeMemberNo(body.member_no);
    const fullName = cleanText(body.full_name, 120);
    const email = cleanText(body.email, 200).toLowerCase();
    const phone = cleanText(body.phone, 50);
    const language = cleanText(body.language, 50);
    const uiLanguage = cleanText(body.ui_language || "en", 10).toLowerCase();
    const consent = body.consent === true;

    if (!/^\d{8}$/.test(memberNo)) {
      throw new HttpError(400, "Member number must contain exactly 8 digits");
    }
    if (fullName.length < 2) {
      throw new HttpError(400, "Full name is required");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "Invalid email address");
    }
    if (!allowedLanguages.has(language)) {
      throw new HttpError(400, "Please select a valid interpretation language");
    }
    if (!consent) {
      throw new HttpError(400, "Agreement is required");
    }

    const supabase = getSupabase();
    const event = await findEvent(supabase, body.event_code);

    const { data: existing, error: existingError } = await supabase
      .from("registrations")
      .select("*")
      .eq("event_id", event.id)
      .eq("member_no", memberNo)
      .maybeSingle();

    if (existingError) throw existingError;

    let registration;

    if (existing) {
      const { data, error } = await supabase
        .from("registrations")
        .update({
          full_name: fullName,
          email: email || null,
          phone: phone || null,
          language,
          ui_language: uiLanguage,
          consent: true,
          consent_at: new Date().toISOString(),
          status: "registered"
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw error;
      registration = data;
    } else {
      const { data, error } = await supabase
        .from("registrations")
        .insert({
          event_id: event.id,
          member_no: memberNo,
          full_name: fullName,
          email: email || null,
          phone: phone || null,
          language,
          ui_language: uiLanguage,
          consent: true,
          consent_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (error) throw error;
      registration = data;
    }

    const ticketUrl = `${baseUrl(request)}/ticket?t=${registration.public_token}`;

    return json({
      ok: true,
      registration: {
        token: registration.public_token,
        member_no: registration.member_no,
        full_name: registration.full_name,
        language: registration.language,
        event_name: event.name,
        event_date: event.event_date,
        location: event.location,
        ticket_url: ticketUrl
      }
    }, existing ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: "/api/register" };
