import { Moctokit } from "@kie/mock-github";
import { Mockapi  } from "@aj/mockapi/mockapi";

export type ResponseMocker = ReturnType<typeof Mockapi.prototype.mock["any"]["any"]["any"]> | ReturnType<Extract<typeof Moctokit.prototype.rest>>;
export const LOCALHOST = "127.0.0.1";

type Extract<T extends typeof Moctokit.prototype.rest> = {
  [K in keyof T]:  {
    [W in keyof T[K]]: T[K][W]
  }[keyof T[K]]
}[keyof T];