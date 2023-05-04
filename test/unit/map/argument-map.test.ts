import { ArgumentMap } from "@aj/map/argument-map";

describe("toActArguments", () => {
  test.each([
    ["without delimiter", undefined],
    ["with delimiter", ":"],
  ])("at least 1 key, 1 string value pair defined %p", (_title, delimiter) => {
    const prefix = "prefix";
    const map = new ArgumentMap<string>(prefix, delimiter);
    map.map.set("key1", "val1");
    map.map.set("key2", "val2");
    map.map.set("key3", "val3");

    expect(map.toActArguments()).toStrictEqual([
      prefix,
      `key1${delimiter ?? "="}val1`,
      prefix,
      `key2${delimiter ?? "="}val2`,
      prefix,
      `key3${delimiter ?? "="}val3`,
    ]);
  });

  test("no key,value pair defined", () => {
    const map = new ArgumentMap<string>("prefix");
    expect(map.toActArguments()).toStrictEqual([]);
  });

  test.each([
    ["without delimiter", undefined],
    ["with delimiter", ":"],
  ])("at least 1 key, 1 array of string value pair defined %p", (_title, delimiter) => {
    const prefix = "prefix";
    const map = new ArgumentMap<string[]>(prefix, delimiter);
    map.map.set("key1", ["val1", "val2"]);
    map.map.set("key2", ["val2"]);

    expect(map.toActArguments()).toStrictEqual([
      prefix,
      `key1${delimiter ?? "="}val1`,
      prefix,
      `key1${delimiter ?? "="}val2`,
      prefix,
      `key2${delimiter ?? "="}val2`,
    ]);
  });
});
