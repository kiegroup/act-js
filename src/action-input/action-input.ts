import { ArgumentMap } from "@aj/map/argument-map";
import { ActionEvent } from "@aj/action-event/action-event";

export class ActionInput {
  private input: ArgumentMap;
  private event: ActionEvent;

  constructor(event: ActionEvent) {
    this.input = new ArgumentMap("--input");
    this.event = event;
  }

  set(key: string, val: string) {
    this.input.map.set(key, val);
  }

  delete(key: string) {
    this.input.map.delete(key);
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
