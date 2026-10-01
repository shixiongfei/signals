/*
 * index.ts
 *
 * Copyright (c) 2026 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/signals
 */

export * from "./types.ts";
export * from "./signals.ts";

import * as types from "./types.ts";
import * as signals from "./signals.ts";
import { createReactivity } from "./reactivity.ts";

const reactivity = createReactivity(signals);

export const reactive = reactivity.reactive;
export const notify = reactivity.notify;
export const mutate = reactivity.mutate;
export const toRaw = reactivity.toRaw;
export const toRawDeep = reactivity.toRawDeep;

export default { ...types, ...signals, ...reactivity };
