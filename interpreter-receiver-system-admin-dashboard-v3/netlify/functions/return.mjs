import {
  cleanText,
  errorResponse,
  findEvent,
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

    const receiverNo = cleanText(body.receiver_no, 20);
    const staffName = cleanText(body.staff_name, 100);
    const returnStatus = cleanText(body.return_status || "returned", 20);
    const notes = cleanText(body.notes, 500);

    if (!receiverNo) throw new HttpError(400, "Receiver number is required");
    if (!staffName) throw new HttpError(400, "Staff name is required");

    const supabase = getSupabase();
    const event = await findEvent(supabase, body.event_code, { allowClosed: true });

    const { data, error } = await supabase.rpc("return_receiver", {
      p_event_id: event.id,
      p_receiver_no: receiverNo,
      p_return_status: returnStatus,
      p_staff_name: staffName,
      p_notes: notes || null
    });

    if (error) throw error;

    return json({ ok: true, return: data?.[0] || null });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: "/api/return" };
