export interface ApiRequestContext {
  requestId?: string;
  baseUrl?: string;
  method?: string;
  originalUrl?: string;
  path?: string;
  route?: { path?: unknown };
  url?: string;
}

export interface ApiResponseContext {
  destroyed?: boolean;
  headersSent?: boolean;
  setHeader(name: string, value: string): void;
  writableEnded?: boolean;
}

export interface ExpressErrorResponse extends ApiResponseContext {
  json(body: object): void;
  status(statusCode: number): ExpressErrorResponse;
}

export type ExpressNext = (error?: unknown) => void;
