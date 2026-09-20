/*
 * signals.ts
 *
 * Copyright (c) 2026 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/signals
 */

import * as alien from "alien-signals";

export type SignalGetter<T> = { get: () => T };
export type SignalSetterFn<T> = (previousValue: T) => T;
export type SignalSetter<T> = { set: (value: T | SignalSetterFn<T>) => void };
export type Signal<T> = SignalGetter<T> & SignalSetter<T>;
export type Computed<T> = SignalGetter<T>;

export function signal<T>(initialValue: T): Signal<T> {
  const state = alien.signal(initialValue);
  const get = () => state();

  const set = (value: T | SignalSetterFn<T>) => {
    typeof value === "function"
      ? state((value as SignalSetterFn<T>)(untrack<T>(state)))
      : state(value);
  };

  return { get, set };
}

export function computed<T>(fn: () => T): Computed<T> {
  const get = alien.computed(fn);
  return { get };
}

export function effect(fn: () => void) {
  return alien.effect(fn);
}

export function effectScope(fn: () => void) {
  return alien.effectScope(fn);
}

export function batch<T>(fn: () => T) {
  alien.startBatch();
  try {
    return fn();
  } finally {
    alien.endBatch();
  }
}

export function tracking() {
  return alien.getActiveSub() !== undefined;
}

export function untrack<T>(fn: () => T): T {
  const sub = alien.setActiveSub(undefined);
  try {
    return fn();
  } finally {
    alien.setActiveSub(sub);
  }
}

export function trigger(fn: () => void) {
  alien.trigger(fn);
}
