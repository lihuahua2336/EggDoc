export function redirectNoStore(location: string) {
  return new Response(null, {
    status: 302,
    headers: { "Cache-Control": "no-store", Location: location },
  });
}
