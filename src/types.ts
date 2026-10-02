/*
 * types.ts
 *
 * Copyright (c) 2026 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/signals
 */

export type SignalGetter<T> = { get: () => T };
export type SignalSetterFn<T> = (previousValue: T) => T;
export type SignalSetter<T> = { set: (value: T | SignalSetterFn<T>) => void };
export type Signal<T> = SignalGetter<T> & SignalSetter<T>;
export type ReadonlySignal<T> = SignalGetter<T>;
export type Computed<T> = ReadonlySignal<T>;

export interface SignalProvider {
  signal<T>(initialValue: T): Signal<T>;
  computed<T>(fn: () => T): Computed<T>;
  effect(fn: () => void): () => void;
  batch<T>(fn: () => T): T;
  tracking(): boolean;
  untracked<T>(fn: () => T): T;
}

export interface ReactivityProvider {
  reactive<T>(target: T): T;
  notify<T>(value: T, ...keys: PropertyKey[]): void;

  mutate<T extends object>(
    obj: T,
    fn: (obj: T) => PropertyKey | PropertyKey[] | undefined,
  ): void;

  toRaw<T>(value: T): T;
  toRawDeep<T>(value: T): T;
}
