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
  test("test signal", () => {
    const count = signals.signal(0);

    assert.strictEqual(count.get(), 0);

    count.set(1);
    assert.strictEqual(count.get(), 1);

    count.set((n) => n + 1);
    assert.strictEqual(count.get(), 2);
  });

  test("test computed", () => {
    const count = signals.signal(0);
    const double = signals.computed(() => count.get() * 2);
    const trible = signals.computed(() => count.get() * 3);

    count.set(5);

    assert.strictEqual(double.get(), 10);
    assert.strictEqual(trible.get(), 15);
  });

  test("test effect", () => {
    const output: number[] = [];
    const count = signals.signal(0);

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
    const count = signals.signal(0);
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

  test("test reactive - assigning NaN repeatedly should not notify", () => {
    const output: number[] = [];
    const observed = signals.reactive({ x: NaN });

    const dispose = signals.effect(() => {
      output.push(observed.x);
    });

    observed.x = NaN;

    dispose();

    assert.deepStrictEqual(output, [NaN]);
  });

  test("test reactive - function value should be stored not invoked", () => {
    let calls = 0;

    const fn1 = () => {
      calls++;
      return 1;
    };

    const fn2 = () => {
      calls++;
      return 2;
    };

    const output: unknown[] = [];
    const observed = signals.reactive<{ fn: () => number }>({ fn: fn1 });

    const dispose = signals.effect(() => {
      output.push(observed.fn);
    });

    observed.fn = fn2;

    dispose();

    assert.strictEqual(calls, 0);
    assert.strictEqual(observed.fn, fn2);
    assert.deepStrictEqual(output, [fn1, fn2]);
  });

  test("test reactive - batch should run effect once", () => {
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
    assert.deepStrictEqual(observed.arr, [1, 2]);
    assert.deepStrictEqual(obj.arr, [1, 2]);
  });

  test("test reactive array - sort comparator inside effect should track its own dependencies", () => {
    const observed = signals.reactive({ list: [3, 1, 2], desc: false });
    let runs = 0;

    const dispose = signals.effect(() => {
      runs++;
      observed.list.sort((a, b) => (observed.desc ? b - a : a - b));
    });

    assert.deepStrictEqual(signals.toRaw(observed.list), [1, 2, 3]);

    observed.desc = true;

    dispose();

    assert.deepStrictEqual(signals.toRaw(observed.list), [3, 2, 1]);
    assert.strictEqual(runs, 2);
  });

  test("sort comparator reading the sorted array itself should not retrigger the effect", () => {
    const observed = signals.reactive({ list: [3, 1, 2] });
    let runs = 0;

    const dispose = signals.effect(() => {
      runs++;

      if (runs < 5) {
        observed.list.sort((a, b) => observed.list.length * 0 + (a - b));
      }
    });

    dispose();

    assert.strictEqual(runs, 1);
  });

  test("test reactive array - callbacks of non-mutating array methods inside effect are tracked", () => {
    const output: number[][] = [];
    const observed = signals.reactive({ list: [1, 2, 3], factor: 1 });

    const dispose = signals.effect(() => {
      output.push(observed.list.map((n) => n * observed.factor));
    });

    observed.factor = 2;

    dispose();

    assert.deepStrictEqual(output, [
      [1, 2, 3],
      [2, 4, 6],
    ]);
  });

  test("read should reflect raw mutation regardless of signal existence", () => {
    const raw = { a: 1, b: 1 };
    const observed = signals.reactive(raw);

    const dispose = signals.effect(() => {
      observed.a;
    });

    raw.a = 2;
    raw.b = 2;

    dispose();

    assert.strictEqual(observed.a, 2);
    assert.strictEqual(observed.b, 2);
  });

  test("assigning same value should not notify", () => {
    const output: number[] = [];
    const observed = signals.reactive({ a: 1 });

    const dispose = signals.effect(() => {
      output.push(observed.a);
    });

    observed.a = 1;

    dispose();

    assert.deepStrictEqual(output, [1]);
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

  test("test reactive array - shrink then regrow should keep index subscribers working", () => {
    const output: unknown[] = [];
    const observed = signals.reactive({ arr: [1, 2, 3] });

    const dispose = signals.effect(() => {
      output.push(observed.arr[2]);
    });

    observed.arr.length = 1;
    observed.arr[2] = 9;

    dispose();

    assert.deepStrictEqual(output, [3, undefined, 9]);
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

  test("test reactive array - splice with indexOf of raw item should remove the right item", () => {
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

  test("test reactive array - mutation inside effect should not subscribe to the array", () => {
    const observed = signals.reactive({ count: 0, log: [] as number[] });
    let runs = 0;

    const dispose = signals.effect(() => {
      runs++;
      observed.log.push(observed.count);
    });

    observed.log.push(-1);

    dispose();

    assert.strictEqual(runs, 1);
    assert.deepStrictEqual(observed.log, [0, -1]);
  });

  test("test reactive array - function values stored by mutating methods keep their identity", () => {
    const f1 = () => 1;
    const f2 = () => 2;
    const f3 = () => 3;
    const f4 = () => 4;
    const observed = signals.reactive({ list: [] as Array<() => number> });

    observed.list.push(f1);
    observed.list.unshift(f2);
    observed.list.splice(1, 0, f3);
    observed.list.fill(f4, 2);

    assert.strictEqual(observed.list[0], f2);
    assert.strictEqual(observed.list[1], f3);
    assert.strictEqual(observed.list[2], f4);
    assert.strictEqual(observed.list.includes(f4), true);
    assert.strictEqual(observed.list.indexOf(f2), 0);
  });

  test("test reactive array - shrink sparse array should be fast", () => {
    const observed = signals.reactive({ arr: [] as number[] });

    observed.arr[50_000_000] = 1;

    const start = Date.now();
    observed.arr.length = 0;

    assert.strictEqual(observed.arr.length, 0);
    assert.ok(Date.now() - start < 500);
  });

  test("test reactive - frozen object should not throw on read", () => {
    const observed = signals.reactive(Object.freeze({ a: { x: 1 } }));

    assert.doesNotThrow(() => observed.a);
    assert.strictEqual(observed.a.x, 1);
  });

  test("test reactive - frozen child should be stored raw", () => {
    const child = Object.freeze({ x: { y: 1 } });
    const observed = signals.reactive({ child });

    assert.strictEqual(observed.child, child);
    assert.doesNotThrow(() => observed.child.x);
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

  test("test reactive - delete and re-add inside one user batch should still notify", () => {
    const output: unknown[] = [];
    const observed = signals.reactive<{ foo?: number }>({ foo: 1 });

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    signals.batch(() => {
      delete observed.foo;
      observed.foo = 2;
    });

    dispose();

    assert.deepStrictEqual(output, [1, 2]);
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

  test("Object.hasOwn should react when property is added and deleted", () => {
    const output: boolean[] = [];
    const observed = signals.reactive<{ foo?: number }>({});

    const dispose = signals.effect(() => {
      output.push(Object.hasOwn(observed, "foo"));
    });

    observed.foo = 1;
    delete observed.foo;

    dispose();

    assert.deepStrictEqual(output, [false, true, false]);
  });

  test("Object.hasOwn should not react to value changes", () => {
    const output: boolean[] = [];
    const observed = signals.reactive({ foo: 1 });

    const dispose = signals.effect(() => {
      output.push(Object.hasOwn(observed, "foo"));
    });

    observed.foo = 2;

    dispose();

    assert.deepStrictEqual(output, [true]);
  });

  test("Object.hasOwn on array index should react when array shrinks", () => {
    const output: boolean[] = [];
    const observed = signals.reactive({ arr: [1, 2, 3] });

    const dispose = signals.effect(() => {
      output.push(Object.hasOwn(observed.arr, 2));
    });

    observed.arr.length = 1;

    dispose();

    assert.deepStrictEqual(output, [true, false]);
  });

  test("assigning inside effect should not subscribe to structure", () => {
    const observed = signals.reactive<{ a?: number; b?: number }>({});
    let runs = 0;

    const dispose = signals.effect(() => {
      runs++;
      observed.a = 1;
    });

    observed.b = 1;

    dispose();

    assert.strictEqual(runs, 1);
  });

  test("throwing setter should not leave the write flag set", () => {
    const observed: any = signals.reactive({
      set boom(_: number) {
        throw new Error("boom");
      },
    });

    assert.throws(() => {
      observed.boom = 1;
    });

    const output: boolean[] = [];

    const dispose = signals.effect(() => {
      output.push(Object.hasOwn(observed, "foo"));
    });

    observed.foo = 1;

    dispose();

    assert.deepStrictEqual(output, [false, true]);
  });

  test("in on accessor should react when accessor property is deleted and re-added", () => {
    const output: boolean[] = [];
    const observed: any = signals.reactive({
      get foo() {
        return 1;
      },
    });

    const dispose = signals.effect(() => {
      output.push("foo" in observed);
    });

    delete observed.foo;
    observed.foo = 1;

    dispose();

    assert.deepStrictEqual(output, [true, false, true]);
  });

  test("reads outside effect should not prevent later tracking", () => {
    const observed = signals.reactive({ a: 1, list: [1, 2, 3] });

    assert.strictEqual(observed.a, 1);
    assert.strictEqual(observed.list[1], 2);
    assert.strictEqual("a" in observed, true);
    assert.deepStrictEqual(Object.keys(observed), ["a", "list"]);

    const output: unknown[] = [];

    const dispose = signals.effect(() => {
      output.push([observed.a, observed.list[1], "a" in observed]);
    });

    observed.a = 2;
    observed.list[1] = 20;

    dispose();

    assert.deepStrictEqual(output, [
      [1, 2, true],
      [2, 2, true],
      [2, 20, true],
    ]);
  });

  test("element-moving mutation before subscribing should not break tracking", () => {
    const observed = signals.reactive({
      list: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });

    observed.list.shift();

    const output: number[] = [];

    const dispose = signals.effect(() => {
      output.push(observed.list[0].id);
    });

    observed.list.reverse();

    dispose();

    assert.deepStrictEqual(output, [2, 3]);
  });

  test("computed should track reads", () => {
    const observed = signals.reactive({ a: 1 });
    const double = signals.computed(() => observed.a * 2);

    assert.strictEqual(double.get(), 2);

    observed.a = 5;

    assert.strictEqual(double.get(), 10);
  });

  test("proxy nested in an assigned container stays in raw", () => {
    const observed = signals.reactive({ child: { x: 1 }, list: [] as any[] });

    observed.list = [observed.child];

    assert.throws(() => structuredClone(signals.toRaw(observed)));
  });

  test("locked object property should not throw outside effect", () => {
    const raw: any = {};

    Object.defineProperty(raw, "cfg", { value: { a: 1 } });

    const observed = signals.reactive(raw);

    assert.doesNotThrow(() => observed.cfg);
    assert.strictEqual(observed.cfg.a, 1);
  });

  test("locked object property should not throw inside effect nor with 'in'", () => {
    const raw: any = {};

    Object.defineProperty(raw, "cfg", { value: { a: 1 } });

    const observed = signals.reactive(raw);
    const output: unknown[] = [];

    const dispose = signals.effect(() => {
      output.push(["cfg" in observed, observed.cfg.a]);
    });

    dispose();

    assert.deepStrictEqual(output, [[true, 1]]);
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

describe("Reactive Accessor Unit Test", () => {
  test("getter should depend on multiple properties", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      a: 1,
      b: 2,

      get sum() {
        return this.a + this.b;
      },
    });

    const dispose = signals.effect(() => {
      output.push(observed.sum);
    });

    observed.a = 10;
    observed.b = 20;

    dispose();

    assert.deepStrictEqual(output, [3, 12, 30]);
  });

  test("getter should not rerun effect when unrelated property changes", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      a: 1,
      other: 0,

      get double() {
        return this.a * 2;
      },
    });

    const dispose = signals.effect(() => {
      output.push(observed.double);
    });

    observed.other = 1;
    observed.other = 2;

    dispose();

    assert.deepStrictEqual(output, [2]);
  });

  test("getter depending on another getter should be tracked", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      a: 1,

      get double() {
        return this.a * 2;
      },

      get quad() {
        return this.double * 2;
      },
    });

    const dispose = signals.effect(() => {
      output.push(observed.quad);
    });

    observed.a = 2;

    dispose();

    assert.deepStrictEqual(output, [4, 8]);
  });

  test("setter should notify effect reading the getter", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      _v: 1,

      get v() {
        return this._v;
      },

      set v(x: number) {
        this._v = x * 10;
      },
    });

    const dispose = signals.effect(() => {
      output.push(observed.v);
    });

    observed.v = 2;

    dispose();

    assert.deepStrictEqual(output, [1, 20]);
  });

  test("setter writing multiple properties should run effect once", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      a: 0,
      b: 0,

      get sum() {
        return this.a + this.b;
      },

      set both(x: number) {
        this.a = x;
        this.b = x;
      },
    });

    const dispose = signals.effect(() => {
      output.push(observed.sum);
    });

    observed.both = 2;

    dispose();

    assert.deepStrictEqual(output, [0, 4]);
  });

  test("in on accessor should not rerun effect when getter dependency changes", () => {
    const output: boolean[] = [];
    const observed = signals.reactive({
      a: 1,

      get double() {
        return this.a * 2;
      },
    });

    const dispose = signals.effect(() => {
      output.push("double" in observed);
    });

    observed.a = 2;

    dispose();

    assert.deepStrictEqual(output, [true]);
  });

  test("getter should return fresh value after 'in' check", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      a: 1,

      get double() {
        return this.a * 2;
      },
    });

    assert.strictEqual("double" in observed, true);

    const dispose = signals.effect(() => {
      output.push(observed.double);
    });

    observed.a = 2;

    dispose();

    assert.deepStrictEqual(output, [2, 4]);
  });

  test("getter should stay fresh in effect that also uses 'in'", () => {
    const output: [boolean, number][] = [];
    const observed = signals.reactive({
      a: 1,

      get double() {
        return this.a * 2;
      },
    });

    const dispose = signals.effect(() => {
      output.push(["double" in observed, observed.double]);
    });

    observed.a = 2;

    dispose();

    assert.deepStrictEqual(output, [
      [true, 2],
      [true, 4],
    ]);
  });

  test("in should not invoke own getter nor depend on its dependencies", () => {
    let calls = 0;
    const output: boolean[] = [];
    const observed = signals.reactive({
      a: 1,

      get foo() {
        calls++;
        return this.a;
      },
    });

    const dispose = signals.effect(() => {
      output.push("foo" in observed);
    });

    observed.a = 2;

    dispose();

    assert.strictEqual(calls, 0);
    assert.deepStrictEqual(output, [true]);
  });

  test("getter returning derived array should be tracked", () => {
    const output: number[][] = [];
    const observed = signals.reactive({
      items: [1, 2, 3],

      get evens() {
        return this.items.filter((n) => n % 2 === 0);
      },
    });

    const dispose = signals.effect(() => {
      output.push([...observed.evens]);
    });

    observed.items.push(4);

    dispose();

    assert.deepStrictEqual(output, [[2], [2, 4]]);
  });

  test("getter returning new object should be tracked", () => {
    const output: string[] = [];
    const observed = signals.reactive({
      price: 10,
      qty: 2,

      get summary() {
        return { total: this.price * this.qty, label: `x${this.qty}` };
      },
    });

    const dispose = signals.effect(() => {
      const s = observed.summary;
      output.push(`${s.label}:${s.total}`);
    });

    observed.qty = 3;
    observed.price = 5;

    dispose();

    assert.deepStrictEqual(output, ["x2:20", "x3:30", "x3:15"]);
  });

  test("getter returning shared raw object should be reactive through wrap", () => {
    const output: number[] = [];
    const shared = { n: 1 };
    const observed = signals.reactive({
      get item() {
        return shared;
      },
    });

    const dispose = signals.effect(() => {
      output.push(observed.item.n);
    });

    observed.item.n = 2;

    dispose();

    assert.deepStrictEqual(output, [1, 2]);
  });

  test("getter returning reactive array should keep identity", () => {
    const output: number[] = [];
    const observed = signals.reactive({
      list: [1],

      get view() {
        return this.list;
      },
    });

    assert.strictEqual(observed.view === observed.list, true);

    const dispose = signals.effect(() => {
      output.push(observed.view.length);
    });

    observed.list.push(2);

    dispose();

    assert.deepStrictEqual(output, [1, 2]);
  });

  test("getter over array of objects should react to element and structure changes", () => {
    const output: string[][] = [];
    const observed = signals.reactive({
      users: [
        { name: "a", active: true },
        { name: "b", active: false },
      ],

      get activeNames() {
        return this.users.filter((u) => u.active).map((u) => u.name);
      },
    });

    const dispose = signals.effect(() => {
      output.push([...observed.activeNames]);
    });

    observed.users[1].active = true;
    observed.users.push({ name: "c", active: true });

    dispose();

    assert.deepStrictEqual(output, [["a"], ["a", "b"], ["a", "b", "c"]]);
  });

  test("setter accepting array should notify effect reading the getter", () => {
    const output: string[][] = [];
    const observed = signals.reactive({
      _tags: ["a"] as string[],

      get tags() {
        return this._tags;
      },

      set tags(v: string[]) {
        this._tags = v.map((s) => s.toUpperCase());
      },
    });

    const dispose = signals.effect(() => {
      output.push([...observed.tags]);
    });

    observed.tags = ["x", "y"];
    observed.tags.push("z");

    dispose();

    assert.deepStrictEqual(output, [["a"], ["X", "Y"], ["X", "Y", "z"]]);
  });

  test("test reactive - setter-only property should not cache assigned value", () => {
    const observed: any = signals.reactive({
      _v: 0,

      set v(x: number) {
        this._v = x;
      },
    });

    assert.strictEqual(observed.v, undefined);

    observed.v = 5;

    assert.strictEqual(observed._v, 5);
    assert.strictEqual(observed.v, undefined);
  });

  test("repeated 'in' on accessor should not cache or invoke getter", () => {
    let calls = 0;
    const observed = signals.reactive({
      a: 1,

      get foo() {
        calls++;
        return this.a;
      },
    });

    assert.strictEqual("foo" in observed, true);
    assert.strictEqual("foo" in observed, true);
    assert.strictEqual(calls, 0);

    observed.a = 2;

    assert.strictEqual(observed.foo, 2);
  });
});

describe("Reactive toRaw Unit Test", () => {
  test("toRaw should return the original object and array", () => {
    const obj = { arr: [1, 2], child: { x: 1 } };
    const observed = signals.reactive(obj);

    assert.strictEqual(signals.toRaw(observed), obj);
    assert.strictEqual(signals.toRaw(observed.arr), obj.arr);
    assert.strictEqual(signals.toRaw(observed.child), obj.child);
  });

  test("toRaw should return non-reactive values as is", () => {
    const obj = { a: 1 };
    const d = new Date(0);
    const fn = () => 1;

    assert.strictEqual(signals.toRaw(obj), obj);
    assert.strictEqual(signals.toRaw(d), d);
    assert.strictEqual(signals.toRaw(fn), fn);
    assert.strictEqual(signals.toRaw(1), 1);
    assert.strictEqual(signals.toRaw(null), null);
    assert.strictEqual(signals.toRaw(undefined), undefined);
  });

  test("toRaw should not create a proxy for a plain object", () => {
    const obj = { child: { x: 1 } };

    signals.toRaw(obj);
    signals.toRaw(obj.child);

    const observed = signals.reactive(obj);

    assert.strictEqual(signals.toRaw(observed), obj);
    assert.strictEqual(signals.toRaw(signals.toRaw(observed)), obj);
  });

  test("toRaw should not subscribe the effect", () => {
    const output: number[] = [];
    const observed = signals.reactive({ count: 0 });

    const dispose = signals.effect(() => {
      output.push(signals.toRaw(observed).count);
    });

    observed.count = 1;

    dispose();

    assert.deepStrictEqual(output, [0]);
  });

  test("changes on raw object should bypass reactivity, changes through proxy should be visible on raw", () => {
    const output: number[] = [];
    const observed = signals.reactive({ count: 0 });
    const raw = signals.toRaw(observed);

    const dispose = signals.effect(() => {
      output.push(observed.count);
    });

    raw.count = 5;
    assert.deepStrictEqual(output, [0]);

    observed.count = 6;
    assert.strictEqual(raw.count, 6);
    assert.deepStrictEqual(output, [0, 6]);

    dispose();
  });

  test("toRaw result should be usable with structuredClone", () => {
    const observed = signals.reactive({ list: [{ id: 1 }], n: 2 });

    assert.deepStrictEqual(structuredClone(signals.toRaw(observed)), {
      list: [{ id: 1 }],
      n: 2,
    });
  });

  test("raw array should not contain proxies after element-moving mutations", () => {
    const observed = signals.reactive({ list: [{ id: 1 }, { id: 2 }] });

    observed.list.reverse();

    const raw = signals.toRaw(observed.list);

    assert.strictEqual(
      raw.every((item) => signals.toRaw(item) === item),
      true,
    );
    assert.doesNotThrow(() => structuredClone(raw));
  });

  test("assigning a reactive value should read back the same proxy", () => {
    const child = { x: 1 };
    const obj: any = { child };
    const observed = signals.reactive(obj);

    observed.other = observed.child;

    assert.strictEqual(observed.other, observed.child);
    assert.notStrictEqual(observed.other, child);
    assert.strictEqual(signals.toRaw(observed.other), child);

    const output: number[] = [];

    const dispose = signals.effect(() => {
      output.push(observed.child.x);
    });

    observed.other.x = 2;

    dispose();

    assert.deepStrictEqual(output, [1, 2]);
  });

  test("toRawDeep should remove proxies nested in assigned containers", () => {
    const observed = signals.reactive({ child: { x: 1 }, list: [] as any[] });

    observed.list = [observed.child];

    const plain = signals.toRawDeep(observed);

    assert.doesNotThrow(() => structuredClone(plain));
    assert.deepStrictEqual(plain, { child: { x: 1 }, list: [{ x: 1 }] });
    assert.strictEqual((plain as any).list[0], plain.child);
  });

  test("toRawDeep should keep shared references and cycles", () => {
    const a: any = { n: 1 };
    a.self = a;

    const plain: any = signals.toRawDeep(signals.reactive({ a, again: a }));

    assert.strictEqual(plain.a, plain.again);
    assert.strictEqual(plain.a.self, plain.a);
    assert.notStrictEqual(plain.a, a);
  });

  test("toRawDeep should keep __proto__ as an own key without changing the prototype", () => {
    const observed = signals.reactive(
      JSON.parse('{"__proto__":{"polluted":1}}'),
    );
    const plain: any = signals.toRawDeep(observed);

    assert.strictEqual(Object.hasOwn(plain, "__proto__"), true);
    assert.strictEqual(plain.polluted, undefined);
    assert.strictEqual(({} as any).polluted, undefined);
  });
});

describe("Reactive defineProperty / accessor delete / class", () => {
  test("deleting accessor should notify effect that only reads the getter", () => {
    const output: unknown[] = [];
    const observed: any = signals.reactive({
      a: 1,

      get double() {
        return this.a * 2;
      },
    });

    const dispose = signals.effect(() => {
      output.push(observed.double);
    });

    delete observed.double;
    observed.double = 5;

    dispose();

    assert.deepStrictEqual(output, [2, undefined, 5]);
  });

  test("defineProperty should notify value reader when property is added", () => {
    const output: unknown[] = [];
    const observed: any = signals.reactive({});

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    Object.defineProperty(observed, "foo", {
      value: 1,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    dispose();

    assert.deepStrictEqual(output, [undefined, 1]);
  });

  test("defineProperty should notify Object.keys when property is added", () => {
    const output: string[][] = [];
    const observed: any = signals.reactive({});

    const dispose = signals.effect(() => {
      output.push(Object.keys(observed));
    });

    Object.defineProperty(observed, "foo", {
      value: 1,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    dispose();

    assert.deepStrictEqual(output, [[], ["foo"]]);
  });

  test("defineProperty should notify when existing value is redefined", () => {
    const output: number[] = [];
    const observed = signals.reactive({ foo: 1 });

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    Object.defineProperty(observed, "foo", { value: 2 });

    dispose();

    assert.deepStrictEqual(output, [1, 2]);
  });

  test("defineProperty should notify when data property becomes accessor", () => {
    const output: number[] = [];
    const observed: any = signals.reactive({ foo: 1 });

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    Object.defineProperty(observed, "foo", {
      get: () => 7,
      configurable: true,
    });

    dispose();

    assert.deepStrictEqual(output, [1, 7]);
    assert.strictEqual(observed.foo, 7);
  });

  test("defineProperty should notify when accessor is replaced or becomes data", () => {
    const output: number[] = [];
    const observed: any = signals.reactive({
      get foo() {
        return 1;
      },
    });

    const dispose = signals.effect(() => {
      output.push(observed.foo);
    });

    Object.defineProperty(observed, "foo", {
      get: () => 2,
      configurable: true,
    });
    Object.defineProperty(observed, "foo", {
      value: 3,
      writable: true,
      configurable: true,
    });

    dispose();

    assert.deepStrictEqual(output, [1, 2, 3]);
  });

  test("defineProperty should store raw value", () => {
    const child = { x: 1 };
    const raw: any = { child };
    const observed: any = signals.reactive(raw);

    Object.defineProperty(observed, "other", {
      value: observed.child,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    assert.strictEqual(raw.other, child);
    assert.strictEqual(observed.other, observed.child);
  });

  test("defineProperty on non-configurable property should throw", () => {
    const observed: any = signals.reactive({});

    Object.defineProperty(observed, "k", { value: 1 });

    assert.throws(
      () => Object.defineProperty(observed, "k", { value: 2 }),
      TypeError,
    );
  });

  test("defineProperty length should shrink array and notify", () => {
    const output: unknown[] = [];
    const observed = signals.reactive({ arr: [1, 2, 3] });

    const dispose = signals.effect(() => {
      output.push([observed.arr.length, observed.arr[2]]);
    });

    Object.defineProperty(observed.arr, "length", { value: 1 });

    dispose();

    assert.deepStrictEqual(output, [
      [3, 3],
      [1, undefined],
    ]);
  });

  test("defineProperty index beyond length should notify length", () => {
    const output: number[] = [];
    const observed = signals.reactive({ arr: [1] });

    const dispose = signals.effect(() => {
      output.push(observed.arr.length);
    });

    Object.defineProperty(observed.arr, "3", {
      value: 9,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    dispose();

    assert.deepStrictEqual(output, [1, 4]);
  });

  test("class instance should be stored raw", () => {
    class Counter {
      #n = 0;

      inc() {
        return ++this.#n;
      }
    }

    const c = new Counter();
    const observed = signals.reactive({ c, list: [c] });

    assert.strictEqual(observed.c, c);
    assert.strictEqual(observed.list[0], c);
    assert.strictEqual(observed.c.inc(), 1);
  });

  test("null-prototype object should still be reactive", () => {
    const output: number[] = [];
    const dict = Object.assign(Object.create(null), { a: 1 });
    const observed = signals.reactive({ dict });

    const dispose = signals.effect(() => {
      output.push(observed.dict.a);
    });

    observed.dict.a = 2;

    dispose();

    assert.deepStrictEqual(output, [1, 2]);
  });

  test("Object.freeze(observed) should not break reads of nested objects", () => {
    const observed = signals.reactive({ a: { x: 1 }, list: [{ y: 2 }] });

    const dispose = signals.effect(() => {
      observed.a;
      observed.list[0];
    });

    Object.freeze(observed);
    Object.freeze(observed.list);

    dispose();

    assert.doesNotThrow(() => observed.a);
    assert.doesNotThrow(() => observed.list[0]);
    assert.strictEqual(observed.a.x, 1);
    assert.strictEqual(observed.list[0].y, 2);
  });

  test("Object.freeze(raw) after a tracked read should not break reads of nested objects", () => {
    const raw = { a: { x: 1 } };
    const observed = signals.reactive(raw);

    const dispose = signals.effect(() => {
      observed.a;
    });

    Object.freeze(raw);

    dispose();

    assert.doesNotThrow(() => observed.a);
    assert.strictEqual(observed.a, raw.a);
  });
});

describe("Reactive differential test", () => {
  const snap = (v: any): any => {
    if (Array.isArray(v)) {
      const out: any[] = [];

      for (let i = 0; i < v.length; i++) {
        out.push(snap(v[i]));
      }

      return out;
    }

    if (v !== null && typeof v === "object") {
      const out: any = {};

      for (const k of Object.keys(v)) {
        out[k] = snap(v[k]);
      }

      return out;
    }

    return v;
  };

  const isNode = (v: any) => v !== null && typeof v === "object";

  const make = (kind: number, n: number): any =>
    kind === 0 ? n : kind === 1 ? { a: n } : [n, n + 1];

  const run = (seed: number, steps: number) => {
    let s = seed;
    const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const int = (n: number) => Math.floor(rand() * n);

    const build = () => ({
      o: { x: 1, list: [1, 2, 3] },
      arr: [{ a: 1 }, 2, [3]],
    });
    const mirror: any = build();
    const observed: any = signals.reactive(build());

    let latest: any;

    const dispose = signals.effect(() => {
      latest = snap(observed);
    });

    for (let step = 0; step < steps; step++) {
      const path: (string | number)[] = [];
      let m: any = mirror;

      for (;;) {
        const keys: (string | number)[] = Array.isArray(m)
          ? m.map((_: any, i: number) => i).filter((i: number) => isNode(m[i]))
          : Object.keys(m).filter((k) => isNode(m[k]));

        if (keys.length === 0 || rand() < 0.4) break;

        const k = keys[int(keys.length)];
        path.push(k);
        m = m[k];
      }

      let p: any = observed;

      for (const k of path) {
        p = p[k];
      }

      const kind = int(3);
      const n = int(100);
      const op = int(8);
      const idx = int(6);
      const key = `k${int(4)}`;

      const apply = (node: any) => {
        if (Array.isArray(node)) {
          switch (op) {
            case 0:
              node.push(make(kind, n));
              break;
            case 1:
              node.pop();
              break;
            case 2:
              node.shift();
              break;
            case 3:
              node.unshift(make(kind, n));
              break;
            case 4:
              node.splice(idx % (node.length + 1), 1);
              break;
            case 5:
              node.reverse();
              break;
            case 6:
              node.length = idx % (node.length + 1);
              break;
            default:
              if (node.length > 0) {
                node[idx % node.length] = make(kind, n);
              }
          }
        } else if (op < 5) {
          node[key] = make(kind, n);
        } else if (op < 7) {
          delete node[key];
        } else {
          node.x = make(0, n);
        }
      };

      apply(m);
      apply(p);

      assert.deepStrictEqual(latest, snap(mirror), `seed ${seed} step ${step}`);
      assert.deepStrictEqual(snap(observed), snap(mirror));
    }

    dispose();
  };

  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    test(`random operations match native object, seed ${seed}`, () => {
      run(seed, 500);
    });
  }
});
