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

import { batch, signal, tracking, trigger, untrack } from "./signals.ts";
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

const arraySearches = new Set<PropertyKey>([
  "indexOf",
  "lastIndexOf",
  "includes",
]);

const isBuiltInSymbol = (key: PropertyKey) =>
  typeof key === "symbol" && builtInSymbols.has(key);

const isObject = (value: unknown) =>
  value !== null && typeof value === "object";

const isPlainObject = (value: object) => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const isProxiable = (value: unknown) =>
  isObject(value) &&
  (Array.isArray(value) || isPlainObject(value)) &&
  !Object.isFrozen(value);

const isReactive = (value: unknown) =>
  isObject(value) && (value as any)[RAW] !== undefined;

const hasOwn = (obj: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(obj, key);

const wrap = (value: any) => (isProxiable(value) ? reactive(value) : value);

const NORMAL = 0;
const ACCESSOR = 1;
const LOCKED = 2;

const propKind = (obj: object, key: PropertyKey) => {
  const desc = Object.getOwnPropertyDescriptor(obj, key);

  if (desc === undefined) {
    return NORMAL;
  }

  if (!("value" in desc)) {
    return ACCESSOR;
  }

  return !desc.configurable && !desc.writable ? LOCKED : NORMAL;
};

export function reactive<T extends object>(target: T): T {
  if (!isObject(target) || Object.isFrozen(target)) {
    return target;
  }

  if (isReactive(target)) {
    return target;
  }

  if (proxyMap.has(target)) {
    return proxyMap.get(target) as T;
  }

  const signalMap = new Map<PropertyKey, Signal<any>>();

  let functionMap: Map<PropertyKey, Function> | undefined;
  let writing = false;

  const getSignal = <T>(key: PropertyKey, initial: T): Signal<T> => {
    let state = signalMap.get(key);

    if (!state) {
      state = signal(wrap(initial));
      signalMap.set(key, state);
    }

    return state;
  };

  const trackIterate = () => {
    if (tracking()) {
      getSignal(ITERATE, 0).get();
    }
  };

  const triggerIterate = () => {
    signalMap.get(ITERATE)?.set((value: number) => value + 1);
  };

  const syncLength = (obj: any[], length: number) => {
    signalMap.get("length")?.set(obj.length);

    if (length - obj.length > signalMap.size) {
      for (const [k, removed] of signalMap) {
        if (typeof k === "string") {
          const i = Number(k);

          if (i >= obj.length && i < length && String(i) === k) {
            removed.set(undefined);
            trigger(removed.get);
          }
        }
      }
    } else {
      for (let i = obj.length; i < length; i++) {
        const removed = signalMap.get(String(i));

        if (removed) {
          removed.set(undefined);
          trigger(removed.get);
        }
      }
    }

    if (obj.length < length) {
      triggerIterate();
    }
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
        if (Array.isArray(obj)) {
          if (!functionMap) {
            functionMap = new Map();
          }

          if (arrayMutations.has(key)) {
            let fn = functionMap.get(key);

            if (!fn) {
              const method = Reflect.get(obj, key, receiver) as Function;

              fn = (...args: any[]) => {
                return batch(() =>
                  untrack(() => Reflect.apply(method, receiver, args)),
                );
              };

              functionMap.set(key, fn);
            }

            return fn;
          }

          if (arraySearches.has(key)) {
            let fn = functionMap.get(key);

            if (!fn) {
              const method = Reflect.get(obj, key, receiver) as Function;

              fn = (...args: any[]) => {
                args[0] = wrap(args[0]);
                return Reflect.apply(method, receiver, args);
              };

              functionMap.set(key, fn);
            }

            return fn;
          }
        }

        if (key in obj) {
          return Reflect.get(obj, key, receiver);
        }
      }

      let state = signalMap.get(key);

      if (!state) {
        const value = Reflect.get(obj, key, receiver);
        const tracked = tracking();

        if (!tracked && !isProxiable(value)) {
          return value;
        }

        const kind = propKind(obj, key);

        if (kind === LOCKED) {
          return value;
        }

        if (kind === ACCESSOR) {
          if (tracked) {
            getSignal(ITERATE, 0).get();
          }

          return wrap(value);
        }

        if (!tracked) {
          return wrap(value);
        }

        state = signal(wrap(value));
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
        const prev = writing;
        let ok: boolean;

        if (
          Array.isArray(obj) &&
          key === "length" &&
          typeof value !== "number"
        ) {
          value = Number(value);
        }

        writing = true;

        try {
          ok = Reflect.set(obj, key, toRaw(value), receiver);
        } finally {
          writing = prev;
        }

        if (ok) {
          const state = signalMap.get(key);

          if (state) {
            const wrapped = wrap(value);
            state.set(() => wrapped);
          }

          if (!hadOwn && !hadKey) {
            if (state) {
              trigger(state.get);
            }

            triggerIterate();
          }

          if (Array.isArray(obj) && obj.length !== length) {
            syncLength(obj, length);
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
          }

          if (hadOwn) {
            if (state) {
              trigger(state.get);
            }

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
          if (!tracking()) {
            return result;
          }

          const kind = propKind(obj, key);

          if (kind === LOCKED) {
            return result;
          }

          if (kind === ACCESSOR) {
            getSignal(ITERATE, 0).get();
            return result;
          }

          state = signal(wrap(Reflect.get(obj, key, proxy)));
          signalMap.set(key, state);
        }

        state.get();
      }

      return result;
    },

    ownKeys(obj) {
      trackIterate();
      return Reflect.ownKeys(obj);
    },

    getOwnPropertyDescriptor(obj, key) {
      if (!writing && !isBuiltInSymbol(key)) {
        trackIterate();
      }

      return Reflect.getOwnPropertyDescriptor(obj, key);
    },

    defineProperty(obj, key, desc) {
      if (writing || isBuiltInSymbol(key)) {
        return Reflect.defineProperty(obj, key, desc);
      }

      return batch(() => {
        const before = Object.getOwnPropertyDescriptor(obj, key);
        const hadKey = key in obj;
        const length = Array.isArray(obj) ? obj.length : 0;

        const ok = Reflect.defineProperty(
          obj,
          key,
          "value" in desc ? { ...desc, value: toRaw(desc.value) } : desc,
        );

        if (ok) {
          const after = Object.getOwnPropertyDescriptor(obj, key)!;
          const state = signalMap.get(key);

          if (state) {
            if (state) {
              if (
                !("value" in after) ||
                (!after.configurable && !after.writable)
              ) {
                trigger(state.get);
                signalMap.delete(key);
              } else {
                const wrapped = wrap(after.value);
                state.set(() => wrapped);

                if (!before) {
                  trigger(state.get);
                }
              }
            }
          }

          const changed =
            before !== undefined &&
            (before.get !== after.get ||
              before.set !== after.set ||
              before.enumerable !== after.enumerable ||
              "value" in before !== "value" in after);

          if (before ? changed : !hadKey) {
            triggerIterate();
          }

          if (Array.isArray(obj) && obj.length !== length) {
            syncLength(obj, length);
          }
        }

        return ok;
      });
    },
  });

  proxyMap.set(target, proxy);
  return proxy;
}

export function toRaw<T>(value: T): T {
  return isObject(value) ? ((value as any)[RAW] ?? value) : value;
}
