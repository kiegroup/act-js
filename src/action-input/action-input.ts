import { ArgumentMap } from "@aj/map/argument-map";
import { ActionEvent } from "@aj/action-event/action-event";

export class ActionInput {
  private input: ArgumentMap;
  private event: ActionEvent;

  constructor(event: ActionEvent) {
    this.input = new ArgumentMap("--input");
    this.event = event;
  }

  get map() {
    return this.input.map;
  }

  toActArguments() {
    if (Object.keys(this.event.event).length > 0) {
      const eventCopy = { ...this.event.event };
      eventCopy.inputs = Object.fromEntries(this.input.map);
      this.event.event = eventCopy;
      return [];
    } else {
      return this.input.toActArguments();
    }
  }
}
