export type PrimitiveBox<T> = {
  value: T;
  createdAt: Date;
};

export type ApiResult<T> =
  | { ok: true; payload: PrimitiveBox<T>; meta: { source: "cache" | "network"; retries: number } }
  | { ok: false; error: { code: number; message: string; causes?: string[] } };

export type DeepUserProfile<TFlags extends string> = {
  id: string;
  account: {
    name: string;
    email: string;
    flags: Record<TFlags, boolean>;
  };
  permissions: Array<{
    resource: "billing" | "projects" | "admin";
    scope: "read" | "write" | "owner";
    inheritedFrom?: DeepUserProfile<TFlags>;
  }>;
};

export function unwrapResult<T>(result: ApiResult<T>): T | undefined {
  return result.ok ? result.payload.value : undefined;
}
