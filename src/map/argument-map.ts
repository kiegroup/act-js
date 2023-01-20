export class ArgumentMap {
  private _map: Map<string, string>;
  private prefix: string;
  constructor(prefix: string) {
    this._map = new Map<string, string>();
    this.prefix = prefix;
  }

  get map() {
    return this._map;
  }

  /**
   * Appends prefix to each key,value to produce a string of arguments to be passed to act
   * @returns
   */
  toActArguments(): string[] {
    const args = [];
    for (const [key, val] of this._map.entries()) {
      args.push(this.prefix, `${key}=${val}`);
    }
    return args;
  }
}