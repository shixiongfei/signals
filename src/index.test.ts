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
});

describe("Reactive Unit Test", () => {
  test("test reactive", () => {
    const output: number[] = [];
    const obj = { count: 0, arr: [-100] };
    const observed = signals.reactive(obj);

    assert.strictEqual(observed === signals.reactive(obj), true);
    assert.strictEqual(observed === signals.reactive(observed), true);
    assert.strictEqual(observed.arr === signals.reactive(observed.arr), true);

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

    observed.arr.push(10);

    dispose2();
    assert.deepStrictEqual(output, [1, 2]);
  });

  test("batch should run effect once", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      arr: [1, 2, 3],
    });

    const dispose = signals.effect(() => {
      output.push(observed.arr[0]);
    });

    signals.batch(() => {
      observed.arr[0] = 10;
      observed.arr[0] = 20;
      observed.arr[0] = 30;
    });

    dispose();

    assert.deepStrictEqual(output, [1, 30]);
  });

  test("test reactive array - read and write", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      arr: [1, 2, 3],
    });

    const dispose = signals.effect(() => {
      output.push(observed.arr[0]);
    });

    observed.arr[0] = 10;
    observed.arr[1] = 20;

    dispose();

    assert.deepStrictEqual(output, [1, 10]);
    assert.strictEqual(observed.arr[0], 10);
    assert.strictEqual(observed.arr[1], 20);
  });

  test("test reactive array - push", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      arr: [1, 2],
    });

    const dispose = signals.effect(() => {
      output.push(observed.arr.length);
    });

    observed.arr.push(3);
    observed.arr.push(4);

    dispose();

    assert.deepStrictEqual(output, [2, 3, 4]);
    assert.deepStrictEqual(observed.arr, [1, 2, 3, 4]);
  });

  test("test reactive array - pop", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      arr: [1, 2, 3],
    });

    const dispose = signals.effect(() => {
      output.push(observed.arr.length);
    });

    observed.arr.pop();
    observed.arr.pop();

    dispose();

    assert.deepStrictEqual(output, [3, 2, 1]);
    assert.deepStrictEqual(observed.arr, [1]);
  });

  test("test reactive array - shift and unshift", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      arr: [2, 3],
    });

    const dispose = signals.effect(() => {
      output.push(observed.arr[0]);
    });

    observed.arr.unshift(1);
    observed.arr.shift();

    dispose();

    assert.deepStrictEqual(output, [2, 1, 2]);
    assert.deepStrictEqual(observed.arr, [2, 3]);
  });

  test("test reactive array - splice", () => {
    const output: unknown[] = [];
    const observed = signals.reactive({
      arr: [1, 2, 3, 4],
    });

    const dispose = signals.effect(() => {
      output.push([observed.arr.length, observed.arr[1], observed.arr[2]]);
    });

    observed.arr.splice(1, 1, 20, 30);

    dispose();

    assert.deepStrictEqual(output, [
      [4, 2, 3],
      [5, 20, 30],
    ]);

    assert.deepStrictEqual(observed.arr, [1, 20, 30, 3, 4]);
  });

  test("test reactive array - length", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      arr: [1, 2, 3],
    });

    const dispose = signals.effect(() => {
      output.push(observed.arr.length);
    });

    observed.arr.length = 5;
    observed.arr.length = 1;

    dispose();

    assert.deepStrictEqual(output, [3, 5, 1]);
    assert.strictEqual(observed.arr.length, 1);
  });

  test("test reactive array - new index", () => {
    const output: unknown[] = [];
    const observed = signals.reactive({
      arr: [] as number[],
    });

    const dispose = signals.effect(() => {
      output.push(observed.arr[0]);
    });

    observed.arr.push(10);
    observed.arr[0] = 20;

    dispose();

    assert.deepStrictEqual(output, [undefined, 10, 20]);
  });

  test("test reactive array - independent index", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      arr: [1, 2],
    });

    const dispose = signals.effect(() => {
      output.push(observed.arr[0]);
    });

    observed.arr[1] = 20;
    observed.arr[1] = 30;

    dispose();

    assert.deepStrictEqual(output, [1]);
  });

  test("test reactive array - raw object bypasses reactivity", () => {
    const output: number[] = [];
    const obj = { arr: [1] };
    const observed = signals.reactive(obj);

    const dispose = signals.effect(() => {
      output.push(observed.arr.length);
    });

    obj.arr.push(2);

    dispose();

    assert.deepStrictEqual(output, [1]);
    assert.deepStrictEqual(observed.arr, [1]);
    assert.deepStrictEqual(obj.arr, [1, 2]);
  });

  test("test reactive - prototype property should not create signal", () => {
    const proto = { foo: 1 };
    const obj = Object.create(proto);
    const observed = signals.reactive(obj);
    const output: number[] = [];

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    assert.deepStrictEqual(output, [1]);

    proto.foo = 2;

    assert.deepStrictEqual(output, [1]);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(obj, "foo"), false);

    dispose();
  });

  test("test reactive - missing property should create dependency", () => {
    const observed = signals.reactive<{ foo?: number }>({});
    const output: unknown[] = [];

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    observed.foo = 1;

    dispose();

    assert.deepStrictEqual(output, [undefined, 1]);
  });
});
