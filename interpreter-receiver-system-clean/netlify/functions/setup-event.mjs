import {
  cleanText,
  errorResponse,
  getSupabase,
  HttpError,
  json,
  readJson,
  requireMethod,
  requireStaff
} from "./_shared.mjs";

export default async (request) => {
  try {
    requireMethod(request, "POST");
    requireStaff(request);
    const body = await readJson(request);

    const code = cleanText(body.code, 50).toUpperCase();
    const name = cleanText(body.name, 200);
    const location = cleanText(body.location, 200);
    const eventDate = cleanText(body.event_date, 20) || null;
    const receiverStart = Number(body.receiver_start);
    const receiverEnd = Number(body.receiver_end);
    const receiverDigits = Number(body.receiver_digits || 3);
    const registrationOpen = body.registration_open !== false;

    if (!/^[A-Z0-9-]{3,50}$/.test(code)) {
      throw new HttpError(400, "Event code must use letters, numbers, and hyphens");
    }
    if (name.length < 2) throw new HttpError(400, "Event name is required");
    if (!Number.isInteger(receiverStart) || !Number.isInteger(receiverEnd)) {
      throw new HttpError(400, "Receiver range must be whole numbers");
    }
    if (!Number.isInteger(receiverDigits) || receiverDigits < 1 || receiverDigits > 6) {
      throw new HttpError(400, "Receiver digits must be between 1 and 6");
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("setup_event", {
      p_code: code,
      p_name: name,
      p_event_date: eventDate,
      p_location: location || null,
      p_receiver_start: receiverStart,
      p_receiver_end: receiverEnd,
      p_receiver_digits: receiverDigits,
      p_registration_open: registrationOpen
    });

    if (error) throw error;

    const event = Array.isArray(data) ? data[0] : data;
    if (!event) throw new HttpError(500, "Event setup returned no data");

    return json({ ok: true, event });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: "/api/setup-event" };
