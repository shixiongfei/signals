/*
 * stores.ts
 *
 * Copyright (c) 2026 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/signals
 */

import { isObject, isPlainObject } from "./internal.ts";
import { action, effectScope } from "./signals.ts";
import { toRaw } from "./reactivity.ts";
import type { Action, ReadonlySignal } from "./signals.ts";

export type Store<T> = {
  [K in keyof T]: T[K] extends ReadonlySignal<any>
    ? T[K]
    : T[K] extends (...args: infer A) => infer R
      ? Action<A, R>
      : T[K] extends
            | Date
            | Map<any, any>
            | Set<any>
            | WeakMap<any, any>
            | WeakSet<any>
            | readonly any[]
        ? T[K]
        : T[K] extends object
          ? Store<T[K]>
          : T[K];
};

const disposeMap = new WeakMap<object, Array<() => void>>();

function actions<T extends object>(target: T, seen = new WeakSet<object>()) {
  if (Object.isFrozen(target)) {
    return target;
  }

  const raw = toRaw(target);

  if (seen.has(raw)) {
    return target;
  }

  seen.add(raw);

  for (const key of Object.keys(raw)) {
    const desc = Object.getOwnPropertyDescriptor(raw, key)!;

    if (!("value" in desc) || !desc.writable) {
      continue;
    }

    const value = desc.value;

    if (typeof value === "function") {
      (raw as any)[key] = action(value);
    } else if (isObject(value) && isPlainObject(value)) {
      actions(value, seen);
    }
  }

  return target;
}

export function store<T extends object>(setup: () => T): Store<T> & Disposable {
  let retval: T | undefined;
  let error: unknown;
  let failed = false;

  const dispose = effectScope(() => {
    try {
      retval = actions(setup());

      const raw = toRaw(retval as T);
      const disposers = disposeMap.get(raw);

      if (disposers) {
        disposers.push(() => dispose());
      } else {
        const created = [() => dispose()];

        Object.defineProperty(raw, Symbol.dispose, {
          value: () => {
            created
              .splice(0)
              .reverse()
              .forEach((dispose) => dispose());
          },
        });

        disposeMap.set(raw, created);
      }
    } catch (err) {
      failed = true;
      error = err;
    }
  });

  if (failed) {
    dispose();

    if (error === undefined) {
      error = new Error("store() setup threw undefined");
    }
    throw error;
  }

  return retval as Store<T> & Disposable;
}
