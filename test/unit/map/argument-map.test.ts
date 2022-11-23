import { ArgumentMap } from "@aj/map/argument-map";

test("toActArguments - at least 1 key,value pair defined", () => {
  const prefix = "prefix";
  const map = new ArgumentMap(prefix);
  map.map.set("key1", "val1");
  map.map.set("key2", "val2");
  map.map.set("key3", "val3");

  expect(map.toActArguments()).toStrictEqual([
    prefix,
    "key1=val1",
    prefix,
    "key2=val2",
    prefix,
    "key3=val3",
  ]);
});

test("toActArguments - no key,value pair defined", () => {
  const map = new ArgumentMap("prefix");
  expect(map.toActArguments()).toStrictEqual([]);
});
