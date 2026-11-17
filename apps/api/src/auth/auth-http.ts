// Install before Nest's body parser, so malformed payloads also get no-store.
export function authNoStore(
  req: {
    url?: string;
    headers: { 'content-length'?: string; 'transfer-encoding'?: string };
  },
  res: {
    setHeader(name: string, value: string): void;
    status(code: number): { json(body: object): void };
  },
  next: () => void,
): void {
  const path = req.url?.split('?')[0]?.replace(/\/+$/, '').toLowerCase();
  if (path === '/auth/bootstrap' || path === '/auth/me') {
    res.setHeader('Cache-Control', 'no-store');
    // Reject payloads before JSON parsing: parser errors must not echo their contents.
    if (
      Number(req.headers['content-length'] ?? 0) > 0 ||
      req.headers['transfer-encoding']
    ) {
      res.status(400).json({
        statusCode: 400,
        message: 'This endpoint accepts no input',
        error: 'Bad Request',
      });
      return;
    }
  }
  next();
}
