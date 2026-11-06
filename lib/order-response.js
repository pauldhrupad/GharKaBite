export const privateOrderHeaders = { "Cache-Control": "private, no-store" };

export function privateOrderJson(data, options = {}) {
  return Response.json(data, { ...options, headers: privateOrderHeaders });
}

export function orderResponse(order) {
  const data = { ...order, paymentProofRevision: order.paymentProofRevision ?? null, paymentHasScreenshot: Boolean(order.paymentScreenshotUrl) };
  delete data.paymentScreenshotUrl;
  delete data.paymentDetails;
  return data;
}
