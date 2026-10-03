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

const BRAND_SYMBOL = Symbol.for("SHIXIONGFEI-SIGNALS");

type SignalGetter<T> = {
  get: () => T;
  peek: () => T;
};

type SignalSetter<T> = {
  set: (value: T) => void;
  update: (fn: (previousValue: T) => T) => void;
};

export type Signal<T> = SignalGetter<T> &
  SignalSetter<T> & { readonly [BRAND_SYMBOL]: "signal" };

export type ReadonlySignal<T> = SignalGetter<T> & {
  readonly [BRAND_SYMBOL]: "signal" | "computed";
};

export type Computed<T> = SignalGetter<T> & {
  readonly [BRAND_SYMBOL]: "computed";
};

export type Effect = { (): void } & { readonly [BRAND_SYMBOL]: "effect" };

export function signal<T>(initialValue: T): Signal<T> {
  const state = alien.signal(initialValue);
  const get = () => state();
  const peek = () => untracked<T>(state);
  const set = (value: T) => state(value);
  const update = (fn: (previousValue: T) => T) => state(fn(peek()));

  return { get, peek, set, update, [BRAND_SYMBOL]: "signal" };
}

export function computed<T>(fn: () => T): Computed<T> {
  const get = alien.computed(fn);
  const peek = () => untracked<T>(get);

  return { get, peek, [BRAND_SYMBOL]: "computed" };
}

export function effect(fn: () => void): Effect {
  const dispose = alien.effect(fn);

  Object.defineProperty(dispose, BRAND_SYMBOL, { value: "effect" });

  return dispose as Effect;
}

export function batch<T>(fn: () => T): T {
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

export function capture<T, A extends unknown[]>(fn: (...args: A) => T) {
  const sub = alien.getActiveSub();

  return (...args: A) => {
    const prev = alien.setActiveSub(sub);

    try {
      return fn(...args);
    } finally {
      alien.setActiveSub(prev);
    }
  };
}

export function untracked<T>(fn: () => T): T {
  const sub = alien.setActiveSub(undefined);
  try {
    return fn();
  } finally {
    alien.setActiveSub(sub);
  }
}

export function isSignal<T>(value: unknown): value is Signal<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as any)[BRAND_SYMBOL] === "signal"
  );
}

export function isComputed<T>(value: unknown): value is Computed<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as any)[BRAND_SYMBOL] === "computed"
  );
}

export function isReadableSignal<T>(
  value: unknown,
): value is ReadonlySignal<T> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const brand = (value as any)[BRAND_SYMBOL];
  return brand === "signal" || brand === "computed";
}

export function isEffect(value: unknown): value is Effect {
  return (
    typeof value === "function" && (value as any)[BRAND_SYMBOL] === "effect"
  );
}
