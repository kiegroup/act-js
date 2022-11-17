import { Mockapi, Moctokit } from "@kie/mock-github"

export type Workflow = {
  jobId: string;
  jobName: string;
  workflowName: string;
  workflowFile: string;
  events: string;
};

export type Step = {
  name: string;
  status: number;
  output: string;
};

export type RunOpts = {
  cwd?: string;
  artifactServer?: {
    path: string;
    port: string;
  };
  mockApi?: ResponseMocker[];
};

export type ResponseMocker = ReturnType<typeof Mockapi.prototype.mock["any"]["any"]["any"]> | ReturnType<Extract<typeof Moctokit.prototype.rest>>;

type Extract<T extends typeof Moctokit.prototype.rest> = {
  [K in keyof T]:  {
    [W in keyof T[K]]: T[K][W]
  }[keyof T[K]]
}[keyof T];
