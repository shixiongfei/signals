/*
 * reactive.ts
 *
 * Copyright (c) 2026 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/signals
 */

import { batch, signal } from "./signals.ts";
import type { Signal } from "./signals.ts";

const RAW = Symbol("RAW");
const ITERATE = Symbol("ITERATE");
const proxyMap = new WeakMap<object, any>();

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map((k) => (Symbol as any)[k])
    .filter((v) => typeof v === "symbol"),
);

const arrayMutations = new Set<PropertyKey>([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);

const isBuiltInSymbol = (key: PropertyKey) =>
  typeof key === "symbol" && builtInSymbols.has(key);

const isObject = (value: unknown) =>
  value !== null && typeof value === "object";

const isReactive = (value: unknown) =>
  isObject(value) && (value as any)[RAW] !== undefined;

const hasOwn = (obj: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(obj, key);

export function reactive<T extends object>(target: T): T {
  if (!isObject(target)) {
    return target;
  }

  if (isReactive(target)) {
    return target;
  }

  if (proxyMap.has(target)) {
    return proxyMap.get(target);
  }

  const signalMap = new Map<PropertyKey, Signal<any>>();
  const mutatorMap = new Map<PropertyKey, Function>();

  const wrap = <T>(value: T) => (isObject(value) ? reactive(value) : value);

  const getSignal = <T>(key: PropertyKey, initial: T): Signal<T> => {
    let state = signalMap.get(key);

    if (!state) {
      state = signal(wrap(initial));
      signalMap.set(key, state);
    }

    return state;
  };

  const triggerIterate = () => {
    getSignal(ITERATE, 0).set((value) => value + 1);
  };

  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      if (key === RAW) {
        return obj;
      }

      if (isBuiltInSymbol(key)) {
        return Reflect.get(obj, key, receiver);
      }

      if (!hasOwn(obj, key)) {
        if (Array.isArray(obj) && arrayMutations.has(key)) {
          let fn = mutatorMap.get(key);

          if (!fn) {
            const method = Reflect.get(obj, key, receiver) as Function;

            fn = (...args: any[]) => {
              return batch(() => Reflect.apply(method, receiver, args));
            };

            mutatorMap.set(key, fn);
          }

          return fn;
        }

        if (key in obj) {
          return Reflect.get(obj, key, receiver);
        }
      }

      return getSignal(key, (obj as any)[key]).get();
    },

    set(obj, key, value, receiver) {
      if (key === RAW) {
        return true;
      }

      if (isBuiltInSymbol(key)) {
        return Reflect.set(obj, key, value, receiver);
      }

      return batch(() => {
        const hadOwn = hasOwn(obj, key);
        const ok = Reflect.set(obj, key, value, receiver);

        if (ok) {
          const wrapped = wrap(value);
          const state = signalMap.get(key);

          if (state) {
            state.set(wrapped);
          } else {
            signalMap.set(key, signal(wrapped));
          }

          if (!hadOwn) {
            triggerIterate();
          }
        }

        return ok;
      });
    },

    deleteProperty(obj, key) {
      return batch(() => {
        const hadOwn = hasOwn(obj, key);
        const deleted = Reflect.deleteProperty(obj, key);

        if (deleted) {
          const state = signalMap.get(key);

          if (state) {
            state.set(undefined);
          }

          if (hadOwn) {
            triggerIterate();
          }
        }

        return deleted;
      });
    },

    has(obj, key) {
      const result = Reflect.has(obj, key);

      if (!result || hasOwn(obj, key)) {
        getSignal(key, (obj as any)[key]).get();
      }

      return result;
    },

    ownKeys(obj) {
      getSignal(ITERATE, 0).get();
      return Reflect.ownKeys(obj);
    },
  });

  proxyMap.set(target, proxy);
  return proxy;
}
