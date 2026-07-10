import {
  cleanText,
  errorResponse,
  findEvent,
  getSupabase,
  HttpError,
  json,
  parseToken,
  readJson,
  requireMethod,
  requireStaff
} from "./_shared.mjs";

export default async (request) => {
  try {
    requireMethod(request, "POST");
    requireStaff(request);
    const body = await readJson(request);

    const staffName = cleanText(body.staff_name, 100);
    const receiverNo = cleanText(body.receiver_no, 20);
    const registrationId = cleanText(body.registration_id, 100);
    const token = parseToken(body.token);

    if (!staffName) throw new HttpError(400, "Staff name is required");
    if (!receiverNo) throw new HttpError(400, "Receiver number is required");

    const supabase = getSupabase();
    const event = await findEvent(supabase, body.event_code, { allowClosed: true });

    let resolvedRegistrationId = registrationId;

    if (!resolvedRegistrationId && token) {
      const { data, error } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", event.id)
        .eq("public_token", token)
        .maybeSingle();
      if (error) throw error;
      resolvedRegistrationId = data?.id;
    }

    if (!resolvedRegistrationId) {
      throw new HttpError(400, "Registration is required");
    }

    const { data, error } = await supabase.rpc("rent_receiver", {
      p_event_id: event.id,
      p_registration_id: resolvedRegistrationId,
      p_receiver_no: receiverNo,
      p_staff_name: staffName
    });

    if (error) throw error;

    return json({ ok: true, rental: data?.[0] || null });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: "/api/rent" };
