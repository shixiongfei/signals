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

export type SignalGetterOptions = { untrack?: boolean };
export type SignalGetter<T> = { get: (options?: SignalGetterOptions) => T };
export type SignalSetterFn<T> = (previousValue: T) => T;
export type SignalSetter<T> = { set: (value: T | SignalSetterFn<T>) => void };
export type Signal<T> = SignalGetter<T> & SignalSetter<T>;
export type Computed<T> = SignalGetter<T>;

function getter<T>(state: () => T) {
  const untrack = () => {
    const sub = alien.setActiveSub(undefined);
    try {
      return state();
    } finally {
      alien.setActiveSub(sub);
    }
  };

  return (options?: SignalGetterOptions) => {
    return !options?.untrack ? state() : untrack();
  };
}

export function signal<T>(initialValue: T): Signal<T> {
  const state = alien.signal(initialValue);
  const get = getter<T>(state);

  const set = (value: T | SignalSetterFn<T>) => {
    typeof value === "function"
      ? state((value as SignalSetterFn<T>)(get({ untrack: true })))
      : state(value);
  };

  return { get, set };
}

export function computed<T>(fn: () => T): Computed<T> {
  const get = getter<T>(alien.computed(fn));
  return { get };
}

export function effect(fn: () => void) {
  return alien.effect(fn);
}

export function effectScope(fn: () => void) {
  return alien.effectScope(fn);
}

export function batch(fn: () => void) {
  alien.startBatch();
  try {
    fn();
  } finally {
    alien.endBatch();
  }
}

export function trigger(fn: () => void) {
  alien.trigger(fn);
}
