/*
 * index.test.ts
 *
 * Copyright (c) 2026 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/signals
 */

import assert from "node:assert";
import { describe, test } from "node:test";
import signals from "./index.ts";

describe("Signals Unit Test", () => {
  const count = signals.signal(0);

  test("test signal", () => {
    assert.strictEqual(count.get(), 0);

    count.set(1);
    assert.strictEqual(count.get(), 1);

    count.set((n) => n + 1);
    assert.strictEqual(count.get(), 2);
  });

  test("test computed", () => {
    const double = signals.computed(() => count.get() * 2);
    const trible = signals.computed(() => count.get() * 3);

    count.set(5);

    assert.strictEqual(double.get(), 10);
    assert.strictEqual(trible.get(), 15);
  });

  test("test effect", () => {
    const output: number[] = [];

    count.set(0);
    const dispose1 = signals.effect(() => {
      output.push(count.get() * 2);
    });

    count.set(2);
    assert.deepStrictEqual(output, [0, 4]);

    dispose1();
    count.set(3);
    assert.deepStrictEqual(output, [0, 4]);

    output.splice(0, output.length);

    count.set(0);
    const dispose2 = signals.effectScope(() => {
      signals.effect(() => {
        output.push(count.get() * 3);
      });
    });

    count.set(2);
    assert.deepStrictEqual(output, [0, 6]);

    count.set(3);
    assert.deepStrictEqual(output, [0, 6, 9]);

    dispose2();
    count.set(4);
    assert.deepStrictEqual(output, [0, 6, 9]);

    output.splice(0, output.length);

    const show = signals.signal(true);

    count.set(0);
    const dispose3 = signals.effect(() => {
      if (show.get()) {
        signals.effect(() => {
          output.push(count.get());
        });
      }
    });

    count.set(2);
    assert.deepStrictEqual(output, [0, 2]);

    show.set(false);

    count.set(3);
    count.set(4);
    assert.deepStrictEqual(output, [0, 2]);

    count.set(0);
    show.set(true);

    count.set(5);
    assert.deepStrictEqual(output, [0, 2, 0, 5]);

    dispose3();
    output.splice(0, output.length);
  });

  test("test batch", () => {
    const output: number[] = [];
    const countdown = signals.signal(10);

    count.set(0);

    const dispose1 = signals.effect(() => {
      output.push(count.get());
    });

    const dispose2 = signals.effect(() => {
      output.push(countdown.get());
    });

    signals.batch(() => {
      count.set((c) => c + 1);
      output.push(-100);
      countdown.set((c) => c - 1);
    });

    assert.deepStrictEqual(output, [0, 10, -100, 1, 9]);

    dispose1();
    dispose2();
  });

  test("test trigger", () => {
    const src1 = signals.signal<number[]>([]);
    const src2 = signals.signal<number[]>([]);
    const total = signals.computed(() => src1.get().length + src2.get().length);

    assert.strictEqual(total.get(), 0);

    src1.get().push(1);
    src2.get().push(2);

    assert.strictEqual(total.get(), 0);

    signals.trigger(() => {
      src1.get();
      src2.get();
    });

    assert.strictEqual(total.get(), 2);
  });

  test("test reactive", () => {
    const output: number[] = [];
    const obj = { count: 0, arr: [-100] };
    const observed = signals.reactive(obj);

    assert.strictEqual(observed === signals.reactive(obj), true);
    assert.strictEqual(observed === signals.reactive(observed), true);

    const dispose1 = signals.effect(() => {
      output.push(observed.count);
    });

    observed.count++;
    observed.count += 100;

    dispose1();
    assert.deepStrictEqual(output, [0, 1, 101]);
    assert.strictEqual(obj.count, 101);

    output.splice(0, output.length);

    const dispose2 = signals.effect(() => {
      output.push(observed.arr.length);
    });

    obj.arr.push(10);

    dispose2();
    assert.deepStrictEqual(output, [1, 2]);
  });
});
