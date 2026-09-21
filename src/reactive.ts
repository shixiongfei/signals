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

import { batch, signal, tracker, tracking, untrack } from "./signals.ts";
import type { Signal } from "./signals.ts";

const RAW = Symbol("RAW");
const ITERATE = Symbol("ITERATE");
const NOTIFY = Symbol("NOTIFY");

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

export function reactive<T>(target: T): T {
  if (!isObject(target) || Object.isFrozen(target)) {
    return target;
  }

  if (isReactive(target)) {
    return target;
  }

  if (proxyMap.has(target)) {
    return proxyMap.get(target) as T;
  }

  const signalMap = new Map<PropertyKey, Signal<number>>();

  let functionMap: Map<PropertyKey, Function> | undefined;
  let writing = false;

  const getSignal = (key: PropertyKey) => {
    let state = signalMap.get(key);

    if (!state) {
      state = signal(0);
      signalMap.set(key, state);
    }

    return state;
  };

  const increment = (version: number) => version + 1;

  const bump = (key: PropertyKey) => {
    signalMap.get(key)?.set(increment);
  };

  const triggerIterate = () => bump(ITERATE);

  const trackIterate = () => {
    if (tracking()) {
      getSignal(ITERATE).get();
    }
  };

  const syncLength = (obj: any[], length: number) => {
    bump("length");

    if (length - obj.length > signalMap.size) {
      for (const [k, removed] of signalMap) {
        if (typeof k === "string") {
          const i = Number(k);

          if (i >= obj.length && i < length && String(i) === k) {
            removed.set(increment);
            signalMap.delete(k);
          }
        }
      }
    } else {
      for (let i = obj.length; i < length; i++) {
        const k = String(i);
        const removed = signalMap.get(k);

        if (removed) {
          removed.set(increment);
          signalMap.delete(k);
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

      if (key === NOTIFY) {
        return (keys: PropertyKey[]) =>
          batch(() => {
            if (keys.length === 0) {
              triggerIterate();
              return;
            }

            for (const k of keys) {
              bump(typeof k === "number" ? String(k) : k);
            }
          });
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
                if (key === "sort" && typeof args[0] === "function") {
                  const track = tracker();
                  const compare = args[0];

                  args[0] = (a: unknown, b: unknown) =>
                    track(() => compare(a, b));
                }

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

      const state = signalMap.get(key);

      if (state) {
        state.get();

        const value = Reflect.get(obj, key, receiver);

        if (!Object.isExtensible(obj) && propKind(obj, key) === LOCKED) {
          return value;
        }

        return wrap(value);
      }

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
          getSignal(ITERATE).get();
        }

        return wrap(value);
      }

      if (tracked) {
        getSignal(key).get();
      }

      return wrap(value);
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
        const state = signalMap.get(key);
        const oldValue = state && hadOwn ? Reflect.get(obj, key) : undefined;
        const prev = writing;
        let ok: boolean;

        if (
          Array.isArray(obj) &&
          key === "length" &&
          typeof value !== "number"
        ) {
          value = Number(value);
        }

        const raw = toRaw(value);

        writing = true;

        try {
          ok = Reflect.set(obj, key, raw, receiver);
        } finally {
          writing = prev;
        }

        if (ok) {
          if (state && (!hadOwn || !Object.is(oldValue, raw))) {
            bump(key);
          }

          if (!hadOwn && !hadKey) {
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

        if (deleted && hadOwn) {
          bump(key);
          signalMap.delete(key);
          triggerIterate();
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
            getSignal(ITERATE).get();
            return result;
          }

          state = getSignal(key);
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
            if (
              !("value" in after) ||
              (!after.configurable && !after.writable)
            ) {
              state.set(increment);
              signalMap.delete(key);
            } else if (
              !before ||
              !("value" in before) ||
              !Object.is(before.value, after.value)
            ) {
              state.set(increment);
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

export function notify<T>(value: T, ...keys: PropertyKey[]) {
  if (isObject(value)) {
    (value as any)[NOTIFY]?.(keys);
  }
}

export function mutate<T extends object>(
  obj: T,
  fn: (obj: T) => PropertyKey | PropertyKey[] | undefined,
) {
  batch(() => {
    const changed = fn(obj);

    if (changed === undefined) {
      return;
    }

    if (Array.isArray(changed)) {
      notify(obj, ...changed);
    } else {
      notify(obj, changed);
    }
  });
}

export function toRaw<T>(value: T): T {
  return isObject(value) ? (value as any)[RAW] || value : value;
}

function _toRawDeep<T>(value: T, seen: WeakMap<object, unknown>): T {
  const raw = toRaw(value);

  if (!isObject(raw) || !(Array.isArray(raw) || isPlainObject(raw))) {
    return raw;
  }

  if (seen.has(raw)) {
    return seen.get(raw) as T;
  }

  const out = Array.isArray(raw)
    ? []
    : Object.create(Object.getPrototypeOf(raw));

  seen.set(raw, out);

  for (const key of Object.keys(raw)) {
    Object.defineProperty(out, key, {
      value: _toRawDeep((raw as any)[key], seen),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  if (Array.isArray(raw)) {
    out.length = raw.length;
  }

  return out;
}

export function toRawDeep<T>(value: T) {
  return _toRawDeep<T>(value, new WeakMap<object, unknown>());
}
