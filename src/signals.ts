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
import { BRAND_SYMBOL } from "./internal.ts";

type SignalGetter<T> = { (): T };
type SignalSetter<T> = { (value: T): void };

export type Signal<T> = SignalGetter<T> &
  SignalSetter<T> & {
    readonly [BRAND_SYMBOL]: "signal";
  };

export type ReadonlySignal<T> = SignalGetter<T> & {
  readonly [BRAND_SYMBOL]: "signal" | "computed";
};

export type Computed<T> = SignalGetter<T> & {
  readonly [BRAND_SYMBOL]: "computed";
};

export type Effect = { (): void } & {
  readonly [BRAND_SYMBOL]: "effect";
};

export type EffectScope = { (): void } & {
  readonly [BRAND_SYMBOL]: "effect-scope";
};

export type Action<A extends unknown[], R> = { (...args: A): R } & {
  readonly [BRAND_SYMBOL]: "action";
};

export function signal<T>(): Signal<T>;
export function signal<T>(initialValue: T): Signal<T>;
export function signal<T>(initialValue?: T): Signal<T> {
  const state = alien.signal(initialValue);
  Object.defineProperty(state, BRAND_SYMBOL, { value: "signal" });
  return state as Signal<T>;
}

export function computed<T>(
  fn: Signal<T> | Computed<T> | (() => T),
): Computed<T> {
  const getter = alien.computed(fn);
  Object.defineProperty(getter, BRAND_SYMBOL, { value: "computed" });
  return getter as Computed<T>;
}

export function effect(fn: () => void | (() => void)): Effect {
  const dispose = alien.effect(fn);
  Object.defineProperty(dispose, BRAND_SYMBOL, { value: "effect" });
  return dispose as Effect;
}

export function effectScope(fn: () => void): EffectScope {
  const dispose = alien.effectScope(fn);
  Object.defineProperty(dispose, BRAND_SYMBOL, { value: "effect-scope" });
  return dispose as EffectScope;
}

export function batch<T>(fn: () => T): T {
  alien.startBatch();
  try {
    return fn();
  } finally {
    alien.endBatch();
  }
}

export function untracked<T>(fn: Signal<T> | Computed<T> | (() => T)): T {
  const sub = alien.setActiveSub(undefined);
  try {
    return fn();
  } finally {
    alien.setActiveSub(sub);
  }
}

export function peek<T>(getter: Signal<T> | Computed<T>) {
  return untracked(getter);
}

export function update<T>(state: Signal<T>, setter: (previousValue: T) => T) {
  state(setter(untracked(state)));
}

export function action<A extends unknown[], R>(
  fn: (...args: A) => R,
): Action<A, R> {
  function wrapper(this: unknown, ...args: A) {
    return batch(() => untracked(() => fn.apply(this, args)));
  }
  Object.defineProperty(wrapper, BRAND_SYMBOL, { value: "action" });
  return wrapper as Action<A, R>;
}

export function isSignal<T>(value: unknown): value is Signal<T> {
  return (
    typeof value === "function" && (value as any)[BRAND_SYMBOL] === "signal"
  );
}

export function isComputed<T>(value: unknown): value is Computed<T> {
  return (
    typeof value === "function" && (value as any)[BRAND_SYMBOL] === "computed"
  );
}

export function isReadableSignal<T>(
  value: unknown,
): value is ReadonlySignal<T> {
  if (typeof value !== "function") {
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

export function isEffectScope(value: unknown): value is EffectScope {
  return (
    typeof value === "function" &&
    (value as any)[BRAND_SYMBOL] === "effect-scope"
  );
}

export function isAction(value: unknown): value is Action<any, any> {
  return (
    typeof value === "function" && (value as any)[BRAND_SYMBOL] === "action"
  );
}
