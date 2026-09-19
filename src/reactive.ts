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

import { batch, signal, trigger } from "./signals.ts";
import type { Signal } from "./signals.ts";

const RAW = Symbol("RAW");
const ITERATE = Symbol("ITERATE");
const proxyMap = new WeakMap<object, object>();

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
    return proxyMap.get(target) as T;
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

      let state = signalMap.get(key);

      if (!state) {
        state = signal(wrap(Reflect.get(obj, key, receiver)));
        signalMap.set(key, state);
      }

      return state.get();
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
        const hadKey = key in obj;
        const length = Array.isArray(obj) ? obj.length : 0;
        const ok = Reflect.set(obj, key, value, receiver);

        if (ok) {
          let state = signalMap.get(key);

          if (state) {
            state.set(wrap(value));
          } else {
            state = signal(wrap(value));
            signalMap.set(key, state);
          }

          if (!hadOwn && !hadKey) {
            trigger(state.get);
            triggerIterate();
          }

          if (Array.isArray(obj) && obj.length !== length) {
            signalMap.get("length")?.set(obj.length);

            for (let i = obj.length; i < length; i++) {
              signalMap.get(String(i))?.set(undefined);
            }

            triggerIterate();
          }
        }

        return ok;
      });
    },

    deleteProperty(obj, key) {
      if (key === RAW) {
        return true;
      }

      return batch(() => {
        const hadOwn = hasOwn(obj, key);
        const deleted = Reflect.deleteProperty(obj, key);

        if (deleted) {
          const state = signalMap.get(key);

          if (state) {
            state.set(undefined);

            if (hadOwn && !hasOwn(obj, key)) {
              trigger(state.get);
            }
          }

          if (hadOwn) {
            triggerIterate();
          }
        }

        return deleted;
      });
    },

    has(obj, key) {
      if (key === RAW) {
        return true;
      }

      const result = Reflect.has(obj, key);

      if (!result || hasOwn(obj, key)) {
        let state = signalMap.get(key);

        if (!state) {
          state = signal(wrap(Reflect.get(obj, key, proxy)));
          signalMap.set(key, state);
        }

        state.get();
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
