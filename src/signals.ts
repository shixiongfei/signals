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
import { BRAND_SYMBOL, isObject } from "./internal.ts";

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

type ValidStore<T> = {
  [K in keyof T]: T[K] extends ReadonlySignal<unknown>
    ? T[K]
    : T[K] extends Effect | EffectScope
      ? never
      : T[K] extends (...args: any[]) => unknown
        ? T[K]
        : T[K] extends object
          ? ValidStore<T[K]>
          : never;
};

export type Store<T> = {
  [K in keyof T]: T[K] extends ReadonlySignal<unknown>
    ? T[K]
    : T[K] extends (...args: infer A) => infer R
      ? Action<A, R>
      : Store<T[K]>;
} & { readonly [BRAND_SYMBOL]: "store" };

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
  if ((fn as any)[BRAND_SYMBOL] !== undefined) {
    return fn as Action<A, R>;
  }

  function wrapper(this: unknown, ...args: A) {
    return batch(() => untracked(() => fn.apply(this, args)));
  }
  Object.defineProperty(wrapper, BRAND_SYMBOL, { value: "action" });
  return wrapper as Action<A, R>;
}

function actions(target: Record<string, unknown>) {
  Object.defineProperty(target, BRAND_SYMBOL, { value: "store" });

  for (const key of Object.keys(target)) {
    const value = target[key];
    const brand = (value as any)?.[BRAND_SYMBOL];

    if (brand === "signal" || brand === "computed" || brand === "action") {
      continue;
    }

    if (typeof value === "function") {
      if (brand !== undefined) {
        throw new TypeError(
          `store.${key} is a ${brand} and cannot be placed in a store`,
        );
      }
      target[key] = action(value as (...args: unknown[]) => unknown);
    } else if (isObject(value)) {
      if (brand !== undefined) {
        throw new TypeError(
          `store.${key} is a ${brand} and cannot be placed in a store`,
        );
      }
      actions(value as Record<string, unknown>);
    } else {
      throw new TypeError(
        `store.${key} must be a signal, a function, or a nested object`,
      );
    }
  }
}

export function store<T extends object>(
  setup: () => T & ValidStore<T>,
): Store<T> & Disposable {
  let retval: T | undefined;
  let error: unknown;

  const dispose = effectScope(() => {
    try {
      const value = setup() as Record<string, unknown>;

      if (!isObject(value)) {
        throw new TypeError(
          `store() setup must return an object, got ${value === null ? "null" : typeof value}`,
        );
      }

      const brand = (value as any)[BRAND_SYMBOL];

      if (brand !== undefined) {
        throw new TypeError(
          `store() setup must return a plain object, got one branded as "${brand}"`,
        );
      }

      actions(value);

      retval = value as T;
    } catch (err) {
      error = err;
    }
  });

  if (!retval) {
    dispose();

    if (!error) {
      error = new Error("store() setup threw a falsy value");
    }
    throw error;
  }

  Object.defineProperty(retval, Symbol.dispose, {
    value: () => dispose(),
  });

  return retval as Store<T> & Disposable;
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
