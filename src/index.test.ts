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
    assert.strictEqual(Array.isArray(observed.arr), true);

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
    const observed = signals.reactive({ arr: [1, 2, 3] });

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
    const observed = signals.reactive({ arr: [1, 2, 3] });

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
    const observed = signals.reactive({ arr: [1, 2] });

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
    const observed = signals.reactive({ arr: [1, 2, 3] });

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
    const observed = signals.reactive({ arr: [2, 3] });

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
    const observed = signals.reactive({ arr: [1, 2, 3, 4] });

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
    const observed = signals.reactive({ arr: [1, 2, 3] });

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
    const observed = signals.reactive({ arr: [] as number[] });

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
    const observed = signals.reactive({ arr: [1, 2] });

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

  test("test reactive array - assign at length should notify length", () => {
    const output: number[] = [];
    const observed = signals.reactive({ arr: [1, 2] });

    const dispose = signals.effect(() => {
      output.push(observed.arr.length);
    });

    observed.arr[2] = 3;

    dispose();

    assert.deepStrictEqual(output, [2, 3]);
  });

  test("test reactive array - shrink length should notify removed index", () => {
    const output: unknown[] = [];
    const observed = signals.reactive({ arr: [1, 2, 3] });

    const dispose = signals.effect(() => {
      output.push(observed.arr[2]);
    });

    observed.arr.length = 1;

    dispose();

    assert.deepStrictEqual(output, [3, undefined]);
  });

  test("test reactive array - shrink length should not leave stale index value", () => {
    const observed = signals.reactive({ arr: [1, 2, 3] });

    assert.strictEqual(observed.arr[2], 3);

    observed.arr.length = 1;

    assert.strictEqual(observed.arr[2], undefined);
  });

  test("test reactive array - shrink length should react to Object.keys", () => {
    const output: string[][] = [];
    const observed = signals.reactive({ arr: [1, 2, 3] });

    const dispose = signals.effect(() => {
      output.push(Object.keys(observed.arr));
    });

    observed.arr.length = 1;

    dispose();

    assert.deepStrictEqual(output, [["0", "1", "2"], ["0"]]);
  });

  test("test reactive array - shrink length should notify has for undefined element", () => {
    const output: boolean[] = [];
    const observed = signals.reactive<{ arr: (number | undefined)[] }>({
      arr: [1, undefined],
    });

    const dispose = signals.effect(() => {
      output.push(1 in observed.arr);
    });

    observed.arr.length = 1;

    dispose();

    assert.deepStrictEqual(output, [true, false]);
  });

  test("test reactive array - indexOf and includes should find raw item", () => {
    const item = { id: 1 };
    const observed = signals.reactive({ list: [{ id: 0 }, item] });

    assert.strictEqual(observed.list.indexOf(item), 1);
    assert.strictEqual(observed.list.includes(item), true);
  });

  test("test reactive array - push inside effect should not retrigger itself", () => {
    const observed = signals.reactive({ arr: [] as number[] });
    let runs = 0;

    const dispose = signals.effect(() => {
      runs++;

      if (runs < 5) {
        observed.arr.push(runs);
      }
    });

    dispose();

    assert.strictEqual(runs, 1);
  });

  test("test reactive array - length assigned with same numeric string should stay number", () => {
    const observed = signals.reactive({ arr: [1, 2, 3] });

    (observed.arr as any).length = "3";

    assert.strictEqual(observed.arr.length, 3);
  });

  test("test reactive array - indexOf, lastIndexOf and includes should accept raw and proxy", () => {
    const a = { id: 0 };
    const b = { id: 1 };
    const observed = signals.reactive({ list: [a, b, 2] as unknown[] });
    const proxyB = observed.list[1];

    assert.strictEqual(observed.list.indexOf(b), 1);
    assert.strictEqual(observed.list.indexOf(proxyB), 1);
    assert.strictEqual(observed.list.lastIndexOf(b), 1);
    assert.strictEqual(observed.list.lastIndexOf(proxyB), 1);
    assert.strictEqual(observed.list.includes(b), true);
    assert.strictEqual(observed.list.includes(proxyB), true);

    assert.strictEqual(observed.list.indexOf(2), 2);
    assert.strictEqual(observed.list.indexOf({ id: 1 }), -1);
    assert.strictEqual(observed.list.includes({ id: 1 }), false);
  });

  test("test reactive array - indexOf with fromIndex should still work", () => {
    const a = { id: 0 };
    const observed = signals.reactive({ list: [a, a] });

    assert.strictEqual(observed.list.indexOf(a, 1), 1);
    assert.strictEqual(observed.list.indexOf(a, 2), -1);
  });

  test("array - splice with indexOf of raw item should remove the right item", () => {
    const a = { id: 0 };
    const b = { id: 1 };
    const observed = signals.reactive({ list: [a, b] });

    observed.list.splice(observed.list.indexOf(a), 1);

    assert.strictEqual(observed.list.length, 1);
    assert.strictEqual(observed.list[0].id, 1);
  });

  test("test reactive array - indexOf with raw item should be tracked", () => {
    const b = { id: 1 };
    const output: number[] = [];
    const observed = signals.reactive({ list: [{ id: 0 }, b] });

    const dispose = signals.effect(() => {
      output.push(observed.list.indexOf(b));
    });

    observed.list.unshift({ id: 9 });

    dispose();

    assert.deepStrictEqual(output, [1, 2]);
  });

  test("test reactive array - sort and reverse should notify index readers", () => {
    const output: number[] = [];
    const observed = signals.reactive({ arr: [3, 1, 2] });

    const dispose = signals.effect(() => {
      output.push(observed.arr[0]);
    });

    observed.arr.sort();
    observed.arr.reverse();

    dispose();

    assert.deepStrictEqual(output, [3, 1, 3]);
  });

  test("test reactive array - for...of should be tracked", () => {
    const output: number[][] = [];
    const observed = signals.reactive({ arr: [1, 2] });

    const dispose = signals.effect(() => {
      const items: number[] = [];

      for (const item of observed.arr) {
        items.push(item);
      }

      output.push(items);
    });

    observed.arr.push(3);

    dispose();

    assert.deepStrictEqual(output, [
      [1, 2],
      [1, 2, 3],
    ]);
  });

  test("test reactive array - growing length should not notify Object.keys", () => {
    const output: string[][] = [];
    const observed = signals.reactive({ arr: [1, 2, 3] });

    const dispose = signals.effect(() => {
      output.push(Object.keys(observed.arr));
    });

    observed.arr.length = 5;

    dispose();

    assert.deepStrictEqual(output, [["0", "1", "2"]]);
  });

  test("test reactive array - search should miss raw item that is reactive elsewhere", () => {
    const other = { id: 9 };
    const observed = signals.reactive({ list: [{ id: 0 }], other });

    observed.other;

    assert.strictEqual(observed.list.indexOf(other), -1);
    assert.strictEqual(observed.list.includes(other), false);
  });

  test("test reactive array - lastIndexOf fromIndex should be preserved", () => {
    const a = { id: 0 };
    const observed = signals.reactive({ list: [a, a] });

    assert.strictEqual(observed.list.lastIndexOf(a), 1);
    assert.strictEqual(observed.list.lastIndexOf(a, 0), 0);
  });

  test("test reactive - prototype property should not create signal", () => {
    const proto = Object.create({ foo: 1 });
    const observed = signals.reactive(proto);
    const output: number[] = [];

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    observed.foo = 2;

    dispose();

    assert.deepStrictEqual(output, [1]);
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

  test("test reactive - delete property", () => {
    const output: unknown[] = [];
    const observed = signals.reactive<{ foo?: number }>({ foo: 1 });

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [1, undefined]);
  });

  test("test reactive - delete and set property again", () => {
    const output: unknown[] = [];
    const observed = signals.reactive<{ foo?: number }>({ foo: 1 });

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    delete observed.foo;
    observed.foo = 2;

    dispose();

    assert.deepStrictEqual(output, [1, undefined, 2]);
  });

  test("test reactive - delete missing property", () => {
    const output: unknown[] = [];
    const observed = signals.reactive<{ foo?: number }>({});

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [undefined]);
  });

  test("test reactive - should not react to delete prototype property", () => {
    const proto = Object.create({ foo: 1 });
    const observed = signals.reactive(proto);

    const output: unknown[] = [];

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [1]);
  });

  test("test reactive - should not react to change and delete prototype property", () => {
    const proto = Object.create({ foo: 1 });
    const observed = signals.reactive(proto);

    const output: unknown[] = [];

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    observed.foo = 2;
    delete observed.foo;
    observed.foo = 3;

    dispose();

    assert.deepStrictEqual(output, [1]);
  });

  test("test reactive - delete array index", () => {
    const output: unknown[] = [];
    const observed = signals.reactive([10, 20]);

    const dispose = signals.effect(() => {
      output.push(observed[0]);
    });

    delete observed[0];
    observed[0] = 30;

    dispose();

    assert.deepStrictEqual(output, [10, undefined, 30]);
  });
});

describe("Reactive Structure Unit Test", () => {
  test("for...in should react to new property", () => {
    const output: string[][] = [];

    const observed = signals.reactive<{ foo: number; bar?: number }>({
      foo: 1,
    });

    const dispose = signals.effect(() => {
      const keys: string[] = [];

      for (const key in observed) {
        keys.push(key);
      }

      output.push(keys);
    });

    observed.bar = 2;

    dispose();

    assert.deepStrictEqual(output, [["foo"], ["foo", "bar"]]);
  });

  test("for...in should react to deleted property", () => {
    const output: string[][] = [];

    const observed = signals.reactive<{ foo?: number; bar?: number }>({
      foo: 1,
      bar: 2,
    });

    const dispose = signals.effect(() => {
      const keys: string[] = [];

      for (const key in observed) {
        keys.push(key);
      }

      output.push(keys);
    });

    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [["foo", "bar"], ["bar"]]);
  });

  test("for...in should not react to existing property value changes", () => {
    const output: string[][] = [];
    const observed = signals.reactive({ foo: 1 });

    const dispose = signals.effect(() => {
      const keys: string[] = [];

      for (const key in observed) {
        keys.push(key);
      }

      output.push(keys);
    });

    observed.foo = 2;

    dispose();

    assert.deepStrictEqual(output, [["foo"]]);
  });

  test("for...in should not react to prototype property changes", () => {
    const proto = Object.create({ foo: 1 });
    const observed = signals.reactive(proto);
    const output: string[][] = [];

    const dispose = signals.effect(() => {
      const keys: string[] = [];

      for (const key in observed) {
        keys.push(key);
      }

      output.push(keys);
    });

    observed.foo = 2;

    dispose();

    assert.deepStrictEqual(output, [["foo"]]);
  });

  test("for...in should not react to prototype property deleted", () => {
    const proto = Object.create({ foo: 1 });
    const observed = signals.reactive(proto);
    const output: string[][] = [];

    const dispose = signals.effect(() => {
      const keys: string[] = [];

      for (const key in observed) {
        keys.push(key);
      }

      output.push(keys);
    });

    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [["foo"]]);
  });

  test("for...in and property value dependency should run once", () => {
    const output: unknown[] = [];
    const observed = signals.reactive<{ foo?: number }>({});

    const dispose = signals.effect(() => {
      const keys: string[] = [];

      for (const key in observed) {
        keys.push(key);
      }

      output.push([observed.foo, keys]);
    });

    observed.foo = 1;

    dispose();

    assert.deepStrictEqual(output, [
      [undefined, []],
      [1, ["foo"]],
    ]);
  });

  test("has should react when missing property is added", () => {
    const output: boolean[] = [];
    const observed = signals.reactive<{ foo?: number }>({});

    const dispose = signals.effect(() => {
      output.push("foo" in observed);
    });

    observed.foo = 1;

    dispose();

    assert.deepStrictEqual(output, [false, true]);
  });

  test("has should react when property is deleted", () => {
    const output: boolean[] = [];
    const observed = signals.reactive<{ foo?: number }>({ foo: 1 });

    const dispose = signals.effect(() => {
      output.push("foo" in observed);
    });

    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [true, false]);
  });

  test("has should only depend on the requested property", () => {
    const output: boolean[] = [];
    const observed = signals.reactive<{ foo?: number; bar?: number }>({});

    const dispose = signals.effect(() => {
      output.push("foo" in observed);
    });

    observed.bar = 1;
    observed.bar = 2;

    dispose();

    assert.deepStrictEqual(output, [false]);
  });

  test("has property dependency should be batched together", () => {
    const output: unknown[] = [];
    const observed = signals.reactive<{ foo?: number }>({});

    const dispose = signals.effect(() => {
      output.push(["foo" in observed, observed.foo]);
    });

    observed.foo = 1;

    dispose();

    assert.deepStrictEqual(output, [
      [false, undefined],
      [true, 1],
    ]);
  });

  test("has should react when property with undefined value is deleted", () => {
    const output: boolean[] = [];
    const observed = signals.reactive<{ foo?: number }>({ foo: undefined });

    const dispose = signals.effect(() => {
      output.push("foo" in observed);
    });

    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [true, false]);
  });

  test("has should react when property is added with undefined value", () => {
    const output: boolean[] = [];
    const observed = signals.reactive<{ foo?: number }>({});

    const dispose = signals.effect(() => {
      output.push("foo" in observed);
    });

    observed.foo = undefined;

    dispose();

    assert.deepStrictEqual(output, [false, true]);
  });

  test("Object.keys should react to structural changes", () => {
    const output: string[][] = [];

    const observed = signals.reactive<{ bar?: number; foo?: number }>({
      foo: 1,
    });

    const dispose = signals.effect(() => {
      output.push(Object.keys(observed));
    });

    observed.bar = 2;
    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [["foo"], ["foo", "bar"], ["bar"]]);
  });

  test("Object.entries should react to structural changes", () => {
    const output: [string, unknown][][] = [];

    const observed = signals.reactive<{ foo: number; bar?: number }>({
      foo: 1,
    });

    const dispose = signals.effect(() => {
      output.push(Object.entries(observed));
    });

    observed.bar = 2;

    dispose();

    assert.deepStrictEqual(output, [
      [["foo", 1]],
      [
        ["foo", 1],
        ["bar", 2],
      ],
    ]);
  });

  test("Object.values should react to structural changes", () => {
    const output: number[][] = [];

    const observed = signals.reactive<{ foo: number; bar?: number }>({
      foo: 1,
    });

    const dispose = signals.effect(() => {
      output.push(Object.values(observed));
    });

    observed.bar = 2;

    dispose();

    assert.deepStrictEqual(output, [[1], [1, 2]]);
  });

  test("Reflect.ownKeys should react to structural changes", () => {
    const output: PropertyKey[][] = [];

    const observed = signals.reactive<{ foo?: number; bar?: number }>({
      foo: 1,
    });

    const dispose = signals.effect(() => {
      output.push(Reflect.ownKeys(observed));
    });

    observed.bar = 2;
    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [["foo"], ["foo", "bar"], ["bar"]]);
  });

  test("new property should batch property and iteration dependencies", () => {
    const output: unknown[] = [];
    const observed = signals.reactive<{ foo?: number }>({});

    const dispose = signals.effect(() => {
      output.push([observed.foo, Object.keys(observed)]);
    });

    observed.foo = 1;

    dispose();

    assert.deepStrictEqual(output, [
      [undefined, []],
      [1, ["foo"]],
    ]);
  });

  test("updating existing property should only trigger property dependency", () => {
    const output: unknown[] = [];
    const observed = signals.reactive({ foo: 1 });

    const dispose = signals.effect(() => {
      output.push([observed.foo, Object.keys(observed)]);
    });

    observed.foo = 2;
    observed.foo = 3;

    dispose();

    assert.deepStrictEqual(output, [
      [1, ["foo"]],
      [2, ["foo"]],
      [3, ["foo"]],
    ]);
  });

  test("delete should batch property and iteration dependencies", () => {
    const output: unknown[] = [];
    const observed = signals.reactive<{ foo?: number }>({ foo: 1 });

    const dispose = signals.effect(() => {
      output.push([observed.foo, Object.keys(observed)]);
    });

    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [
      [1, ["foo"]],
      [undefined, []],
    ]);
  });

  test("delete and re-add should trigger once per mutation", () => {
    const output: unknown[] = [];
    const observed = signals.reactive<{ foo?: number }>({ foo: 1 });

    const dispose = signals.effect(() => {
      output.push([observed.foo, Object.keys(observed)]);
    });

    delete observed.foo;
    observed.foo = 2;

    dispose();

    assert.deepStrictEqual(output, [
      [1, ["foo"]],
      [undefined, []],
      [2, ["foo"]],
    ]);
  });

  test("user batch and internal mutation batch should not cause duplicate effects", () => {
    const output: unknown[] = [];
    const observed = signals.reactive<{ foo?: number; bar?: number }>({});

    const dispose = signals.effect(() => {
      output.push([observed.foo, observed.bar, Object.keys(observed)]);
    });

    signals.batch(() => {
      observed.foo = 1;
      observed.bar = 2;
    });

    dispose();

    assert.deepStrictEqual(output, [
      [undefined, undefined, []],
      [1, 2, ["foo", "bar"]],
    ]);
  });

  test("Date, Map, Set and RegExp should be stored raw", () => {
    const d = new Date(0);
    const m = new Map([[1, 2]]);
    const s = new Set([1]);
    const r = /a/;
    const observed = signals.reactive({ d, m, s, r });

    assert.strictEqual(observed.d, d);
    assert.strictEqual(observed.m, m);
    assert.strictEqual(observed.s, s);
    assert.strictEqual(observed.r, r);

    assert.strictEqual(observed.d.getTime(), 0);
    assert.strictEqual(observed.m.get(1), 2);
    assert.strictEqual(observed.s.has(1), true);
    assert.strictEqual(observed.r.test("a"), true);
  });

  test("raw object inside array should be stored raw", () => {
    const d = new Date(0);
    const observed = signals.reactive({ list: [d] });

    assert.strictEqual(observed.list[0], d);
    assert.strictEqual(observed.list.indexOf(d), 0);
  });

  test("replacing a Date field should still notify", () => {
    const output: number[] = [];
    const observed = signals.reactive({ d: new Date(0) });

    const dispose = signals.effect(() => {
      output.push(observed.d.getTime());
    });

    observed.d = new Date(5);

    dispose();

    assert.deepStrictEqual(output, [0, 5]);
  });
});
