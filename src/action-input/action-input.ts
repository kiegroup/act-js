import { ArgumentMap } from "@aj/map/argument-map";
import { ActionEvent } from "@aj/action-event/action-event";

export class ActionInput {
  private input: ArgumentMap<string>;
  private event: ActionEvent;

  constructor(event: ActionEvent) {
    this.input = new ArgumentMap<string>("--input");
    this.event = event;
  }

  get map() {
    return this.input.map;
  }

  toActArguments() {
    if (Object.keys(this.event.event).length > 0) {
      const eventCopy = { ...this.event.event };
      // Merge inputs with existing event entries
      eventCopy.inputs = { 
        ...(eventCopy.inputs || {}), 
        ...Object.fromEntries(this.input.map) 
      };
      this.event.event = eventCopy;
      return [];
    } else {
      return this.input.toActArguments();
    }
  }
}