/*
 * types.ts
 *
 * Copyright (c) 2026 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/signals
 */

export type SignalGetter<T> = { get: () => T };
export type SignalSetterFn<T> = (previousValue: T) => T;
export type SignalSetter<T> = { set: (value: T | SignalSetterFn<T>) => void };
export type Signal<T> = SignalGetter<T> & SignalSetter<T>;
export type ReadonlySignal<T> = SignalGetter<T>;
export type Computed<T> = ReadonlySignal<T>;
