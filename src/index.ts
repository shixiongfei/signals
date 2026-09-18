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

export * from "./signals.ts";
export * from "./reactive.ts";

import * as signals from "./signals.ts";
import * as reactive from "./reactive.ts";

export default { ...signals, ...reactive };
