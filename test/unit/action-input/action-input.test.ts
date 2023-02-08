import { ActionEvent } from "@aj/action-event/action-event";
import { ActionInput } from "@aj/action-input/action-input";

describe("toActArguments", () => {
  test("event payload is defined", () => {
    const event = new ActionEvent();
    const input = new ActionInput(event);

    event.event = {
      pull_request: {
        head: {
          ref: "branch",
        },
      },
    };

    input.map.set("INPUT1", "value1");
    expect(input.toActArguments()).toStrictEqual([]);
    expect(event.event).toStrictEqual({
      pull_request: {
        head: {
          ref: "branch",
        },
      },
      inputs: {
        INPUT1: "value1",
      },
    });
  });

  test("event payload is not defined", () => {
    const event = new ActionEvent();
    const input = new ActionInput(event);
    input.map.set("INPUT1", "value1");
    input.map.set("INPUT2", "value2");
    expect(input.toActArguments()).toStrictEqual([
      "--input",
      "INPUT1=value1",
      "--input",
      "INPUT2=value2",
    ]);
  });
});
