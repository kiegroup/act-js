export class ArgumentMap<T extends string | string[]> {
  private _map: Map<string, T>;
  private prefix: string;
  private delimiter: string;

  constructor(prefix: string, delimiter = "=") {
    this._map = new Map<string, T>();
    this.prefix = prefix;
    this.delimiter = delimiter;
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
      if (Array.isArray(val)) {
        val.forEach(v =>
          args.push(this.prefix, `${key}${this.delimiter}${v}`)
        );
      } else {
        args.push(this.prefix, `${key}${this.delimiter}${val}`);
      }
    }
    return args;
  }
}
