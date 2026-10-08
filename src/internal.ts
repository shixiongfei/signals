/*
 * internal.ts
 *
 * Copyright (c) 2026 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/signals
 */

import * as alien from "alien-signals";

export const BRAND_SYMBOL = Symbol.for("SHIXIONGFEI-SIGNALS");

export const isObject = (value: unknown): value is object =>
  value !== null && typeof value === "object";

export function capture<A extends unknown[], R>(fn: (...args: A) => R) {
  const sub = alien.getActiveSub();

  return function wrapper(this: unknown, ...args: A) {
    const prev = alien.setActiveSub(sub);
    try {
      return fn.apply(this, args);
    } finally {
      alien.setActiveSub(prev);
    }
  };
}

export function tracking() {
  return alien.getActiveSub() !== undefined;
}
