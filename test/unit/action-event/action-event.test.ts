import { ActionEvent } from "@aj/action-event/action-event";
import { existsSync, readFileSync } from "fs";

describe("toActArguments", () => {
  test("empty json", async () => {
    const event = new ActionEvent();
    await expect(event.toActArguments()).resolves.toStrictEqual([]);
    await expect(event.removeEvent()).resolves.not.toThrowError();
  });

  test("some json content", async () => {
    const event = new ActionEvent();
    event.event = {
      pull_request: {
        head: {
          ref: "branch",
        },
      },
    };
    const args = await event.toActArguments();
    expect(args.length).toBe(2);
    expect(args[0]).toBe("-e");
    expect(readFileSync(args[1], "utf8")).toBe(JSON.stringify(event.event));
    await expect(event.removeEvent()).resolves.not.toThrowError();
    expect(existsSync(args[1])).toBe(false);
  });
});
