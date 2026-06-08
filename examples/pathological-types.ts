export type BuildTuple<Length extends number, Item, Acc extends Item[] = []> =
  Acc["length"] extends Length ? Acc : BuildTuple<Length, Item, [...Acc, Item]>;

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [Index in keyof T]: DeepReadonly<T[Index]> }
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ExpandUnion<T> = T extends infer Item
  ? Item extends object
    ? { [Key in keyof Item]: Item[Key] } & { tag: keyof Item }
    : Item
  : never;

export type PathologicalPayload = DeepReadonly<
  ExpandUnion<
    | { users: BuildTuple<12, { id: string; flags: Record<"a" | "b" | "c", boolean> }> }
    | { projects: BuildTuple<8, { slug: string; owners: string[]; meta: { active: boolean } }> }
    | { audit: BuildTuple<10, { event: string; actor: string; at: Date }> }
  >
>;

export function consumePathologicalPayload(payload: PathologicalPayload): PathologicalPayload {
  return payload;
}
