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
export * from "./reactivity.ts";

import * as types from "./types.ts";
import * as signals from "./signals.ts";
import * as reactivity from "./reactivity.ts";

export default { ...types, ...signals, ...reactivity };
