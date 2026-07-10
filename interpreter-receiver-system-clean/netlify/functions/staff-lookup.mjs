import {
  cleanText,
  errorResponse,
  findEvent,
  getSupabase,
  HttpError,
  json,
  normalizeMemberNo,
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
    const supabase = getSupabase();
    const event = await findEvent(supabase, body.event_code, { allowClosed: true });

    if (body.receiver_no) {
      const receiverNo = cleanText(body.receiver_no, 20);
      const { data: receiver, error } = await supabase
        .from("receivers")
        .select("*")
        .eq("event_id", event.id)
        .eq("receiver_no", receiverNo)
        .maybeSingle();

      if (error) throw error;
      if (!receiver) throw new HttpError(404, "Receiver not found");

      let rental = null;
      if (receiver.status === "rented") {
        const { data, error: rentalError } = await supabase
          .from("rentals")
          .select(`
            id, status, rented_at, staff_name,
            registrations!inner(id, member_no, full_name, language, public_token)
          `)
          .eq("receiver_id", receiver.id)
          .eq("status", "rented")
          .maybeSingle();

        if (rentalError) throw rentalError;
        rental = data;
      }

      return json({ ok: true, event, receiver, rental });
    }

    const token = parseToken(body.token || body.query);
    const memberNo = normalizeMemberNo(body.member_no || body.query);

    let query = supabase
      .from("registrations")
      .select("*")
      .eq("event_id", event.id);

    if (token && token.includes("-")) {
      query = query.eq("public_token", token);
    } else if (memberNo) {
      query = query.eq("member_no", memberNo);
    } else {
      throw new HttpError(400, "QR token or member number is required");
    }

    const { data: registration, error } = await query.maybeSingle();
    if (error) throw error;
    if (!registration) throw new HttpError(404, "Registration not found");

    const { data: rentals, error: rentalsError } = await supabase
      .from("rentals")
      .select(`
        id, status, rented_at, returned_at, staff_name, return_staff_name, notes,
        receivers!inner(id, receiver_no, status)
      `)
      .eq("registration_id", registration.id)
      .order("rented_at", { ascending: false })
      .limit(5);

    if (rentalsError) throw rentalsError;

    return json({
      ok: true,
      event,
      registration,
      active_rental: rentals?.find((item) => item.status === "rented") || null,
      rental_history: rentals || []
    });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: "/api/staff-lookup" };
