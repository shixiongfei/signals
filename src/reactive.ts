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

import { signal } from "./signals.ts";
import type { Signal } from "./signals.ts";

const RAW = Symbol("RAW");
const proxyMap = new WeakMap<object, any>();

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map((k) => (Symbol as any)[k])
    .filter((v) => typeof v === "symbol"),
);

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

  if (proxyMap.has(target)) {
    return proxyMap.get(target);
  }

  if (isReactive(target)) {
    return target;
  }

  const signalMap = new Map<PropertyKey, Signal<any>>();
  const wrap = <T>(value: T) => (isObject(value) ? reactive(value) : value);

  const getSignal = <T>(key: PropertyKey, initial: T): Signal<T> => {
    let state = signalMap.get(key);

    if (!state) {
      state = signal(wrap(initial));
      signalMap.set(key, state);
    }

    return state;
  };

  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      if (key === RAW) {
        return obj;
      }

      if (isBuiltInSymbol(key) || !hasOwn(obj, key)) {
        return Reflect.get(obj, key, receiver);
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

      const wrapped = wrap(value);
      const state = signalMap.get(key);

      if (state) {
        state.set(wrapped);
      } else {
        signalMap.set(key, signal(wrapped));
      }

      return Reflect.set(obj, key, value, receiver);
    },

    deleteProperty(obj, key) {
      signalMap.delete(key);
      return Reflect.deleteProperty(obj, key);
    },

    has(obj, key) {
      return Reflect.has(obj, key);
    },

    ownKeys(obj) {
      return Reflect.ownKeys(obj);
    },

    getOwnPropertyDescriptor(obj, key) {
      return Reflect.getOwnPropertyDescriptor(obj, key);
    },

    defineProperty(obj, key, descriptor) {
      return Reflect.defineProperty(obj, key, descriptor);
    },
  });

  Object.defineProperty(proxy, RAW, {
    value: target,
    enumerable: false,
    writable: false,
    configurable: true,
  });

  proxyMap.set(target, proxy);

  return proxy;
}
