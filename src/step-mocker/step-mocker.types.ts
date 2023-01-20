export type GithubWorkflowStep = {
  /**
   * A name for your step to display on GitHub.
   */
  name?: string;

  /**
   * An identifier for your step.
   */
  id?: string;

  /**
   * Selects an action to run as part of a step in your job. An action is a reusable unit of code. You can use an action defined in the same repository as the workflow, a public repository, or in a published Docker container image.
   */
  uses?: string;

  /**
   * Runs command line programs using the operating system's shell. If you do not provide a name, the step name will default to the run command. Commands run using non-login shells by default.
   */
  run?: string;

  [k: string]: unknown;
};

export type GithubWorkflowJob = {
  /**
   * Each job must have an id to associate with the job. The key job_id is a string and its value is a map of the job's configuration data. You must replace <job_id> with a string that is unique to the jobs object. The <job_id> must start with a letter or _ and contain only alphanumeric characters, -, or _.
   */
  [k: string]: {
    /**
     * The name of the job displayed on GitHub.
     */
    name?: string;

    /**
     * A job contains a sequence of tasks called steps. Steps can run commands, run setup tasks, or run an action in your repository, a public repository, or an action published in a Docker registry. Not all steps run actions, but all actions are run as a step. Each step runs in its own process in the virtual environment and has access to the workspace and filesystem. Because steps are run in their own process, changes to environment variables are not preserved between steps. GitHub provides built-in steps to set up and complete a job.
     */
    steps: GithubWorkflowStep[];
    [k: string]: unknown;
  };
};

export type GithubWorkflow = {
  /**
   * The name of your workflow. GitHub displays the names of your workflows on your repository's actions page. If you omit this field, GitHub sets the name to the workflow's filename.
   */
  name?: string;

  /**
   * A workflow run is made up of one or more jobs. Jobs run in parallel by default. To run jobs sequentially, you can define dependencies on other jobs using the jobs.<job_id>.needs keyword.
   */
  jobs: GithubWorkflowJob;
  [k: string]: unknown;
};

export type MockStep = {
  [job: string]: StepIdentifier[];
};

export type StepIdentifierUsingName = { name: string; mockWith: string };
export type StepIdentifierUsingId = { id: string; mockWith: string };
export type StepIdentifierUsingUses = { uses: string; mockWith: string };
export type StepIdentifierUsingRun = { run: string; mockWith: string };
export type StepIdentifier =
  | StepIdentifierUsingName
  | StepIdentifierUsingId
  | StepIdentifierUsingUses
  | StepIdentifierUsingRun;

export function isStepIdentifierUsingName(
  step: StepIdentifier
): step is StepIdentifierUsingName {
  return Object.prototype.hasOwnProperty.call(step, "name");
}

export function isStepIdentifierUsingId(
  step: StepIdentifier
): step is StepIdentifierUsingId {
  return Object.prototype.hasOwnProperty.call(step, "id");
}

export function isStepIdentifierUsingUses(
  step: StepIdentifier
): step is StepIdentifierUsingUses {
  return Object.prototype.hasOwnProperty.call(step, "uses");
}

export function isStepIdentifierUsingRun(
  step: StepIdentifier
): step is StepIdentifierUsingUses {
  return Object.prototype.hasOwnProperty.call(step, "run");
}
