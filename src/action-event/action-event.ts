import { tmpdir } from "os";
import { mkdtemp, rm, writeFile } from "fs/promises";
import path from "path";
import { EventJSON } from "@aj/action-event/action-event.types";

export class ActionEvent {
  private _event: EventJSON;
  private tmpPath?: string;

  constructor() {
    this._event = {};
  }

  get event() {
    return this._event;
  }

  set event(event: EventJSON) {
    this._event = event;
  }

  async toActArguments() {
    if (Object.keys(this.event).length > 0) {
      const tmpPath = await mkdtemp(`${tmpdir()}${path.sep}`);
      this.tmpPath = tmpPath;
      const eventPath = path.join(tmpPath, "event.json");
      await writeFile(eventPath, JSON.stringify(this.event));
      return ["-e", eventPath];
    }
    return [];
  }

  async removeEvent() {
    if (this.tmpPath) {
      await rm(this.tmpPath, { recursive: true });
      this.tmpPath = undefined;
    }
  }
}
