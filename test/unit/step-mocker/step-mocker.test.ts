import { StepMocker } from "@aj/step-mocker/step-mocker";
import { GithubWorkflow } from "@aj/step-mocker/step-mocker.types";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { parse, stringify } from "yaml";

jest.mock("fs");
const readFileSyncMock = readFileSync as jest.Mock;
const existsSyncMock = existsSync as jest.Mock;
const writeFileSyncMock = writeFileSync as jest.Mock;
const resources = path.resolve(__dirname, "..", "resources", "step-mocker");

describe("getWorkflowPath", () => {
  test("found in the current directory", async () => {
    existsSyncMock.mockReturnValueOnce(true);
    readFileSyncMock.mockReturnValueOnce("name: Workflow");
    writeFileSyncMock.mockReturnValueOnce(undefined);
    const cwd = __dirname;
    const workflowFile = "workflow.yaml";
    const stepMocker = new StepMocker(workflowFile, cwd);
    await stepMocker.mock({});
    expect(existsSyncMock).toHaveBeenCalledWith(path.join(cwd, workflowFile));
    expect(readFileSyncMock).toHaveBeenCalledWith(
      path.join(cwd, workflowFile),
      "utf8"
    );
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      path.join(cwd, workflowFile),
      "name: Workflow\n",
      "utf8"
    );
  });

  test("found in workflow directory when cwd is in a .github dir", async () => {
    existsSyncMock.mockReturnValueOnce(false);
    readFileSyncMock.mockReturnValueOnce("name: Workflow");
    writeFileSyncMock.mockReturnValueOnce(undefined);
    const cwd = path.join(__dirname, ".github");
    const workflowFile = "workflow.yaml";
    const stepMocker = new StepMocker(workflowFile, cwd);
    await stepMocker.mock({});
    expect(existsSyncMock).toHaveBeenCalledWith(path.join(cwd, workflowFile));
    expect(readFileSyncMock).toHaveBeenCalledWith(
      path.join(cwd, "workflows", workflowFile),
      "utf8"
    );
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      path.join(cwd, "workflows", workflowFile),
      "name: Workflow\n",
      "utf8"
    );
  });

  test("found in the .github/workflows directory", async () => {
    existsSyncMock.mockReturnValueOnce(false).mockReturnValueOnce(true);
    readFileSyncMock.mockReturnValueOnce("name: Workflow");
    writeFileSyncMock.mockReturnValueOnce(undefined);
    const cwd = __dirname;
    const workflowFile = "workflow.yaml";
    const stepMocker = new StepMocker(workflowFile, cwd);
    await stepMocker.mock({});
    expect(existsSyncMock).toHaveBeenNthCalledWith(
      1,
      path.join(cwd, workflowFile)
    );
    expect(existsSyncMock).toHaveBeenNthCalledWith(
      2,
      path.join(cwd, ".github", "workflows", workflowFile)
    );
    expect(readFileSyncMock).toHaveBeenCalledWith(
      path.join(cwd, ".github", "workflows", workflowFile),
      "utf8"
    );
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      path.join(cwd, ".github", "workflows", workflowFile),
      "name: Workflow\n",
      "utf8"
    );
  });

  test("could not find workflow", async () => {
    existsSyncMock.mockReturnValueOnce(false).mockReturnValueOnce(false);
    readFileSyncMock.mockReturnValueOnce("name: Workflow");
    writeFileSyncMock.mockReturnValueOnce(undefined);
    const cwd = __dirname;
    const workflowFile = "workflow.yaml";
    const stepMocker = new StepMocker(workflowFile, cwd);
    await expect(stepMocker.mock({})).rejects.toThrowError();
    expect(existsSyncMock).toHaveBeenNthCalledWith(
      1,
      path.join(cwd, workflowFile)
    );
    expect(existsSyncMock).toHaveBeenNthCalledWith(
      2,
      path.join(cwd, ".github", "workflows", workflowFile)
    );
  });
});

describe("locateSteps", () => {
  beforeEach(() => {
    existsSyncMock.mockReturnValueOnce(true);
    writeFileSyncMock.mockReturnValueOnce(undefined);
  });

  test("no job found using wrong name", async () => {
    readFileSyncMock.mockReturnValueOnce(
      await readFile(path.join(resources, "steps.yaml"), "utf8")
    );
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await expect(
      stepMocker.mock({
        incorrectName: [
          {
            name: "step",
            mockWith: "echo step",
          },
        ],
      })
    ).rejects.toThrowError(`Could not find step {"name":"step"} in job incorrectName\nin ${path.join(__dirname, "workflow.yaml")}`);
  });

  test("step found using id", async () => {
    const data = await readFile(path.join(resources, "steps.yaml"), "utf8");
    readFileSyncMock.mockReturnValueOnce(data);
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await stepMocker.mock({
      name: [
        {
          id: "echo",
          mockWith: "echo step",
        },
      ],
    });
    const workflow = stringify(
      parse(data.replace("echo \"pull request\"", "echo step"))
    );
    expect(writeFileSyncMock).toHaveBeenLastCalledWith(
      path.join(__dirname, "workflow.yaml"),
      workflow,
      "utf8"
    );
  });

  test("no step found using incorrect id", async () => {
    readFileSyncMock.mockReturnValueOnce(
        await readFile(path.join(resources, "steps.yaml"), "utf8")
    );
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await expect(
        stepMocker.mock({
          name: [
            {
              id: "not-echo",
              mockWith: "echo step",
            },
          ],
        })
    ).rejects.toThrowError(`Could not find step {"id":"not-echo"} in job name\nin ${path.join(__dirname, "workflow.yaml")}`);
  });

  test("step found using name", async () => {
    const data = await readFile(path.join(resources, "steps.yaml"), "utf8");
    readFileSyncMock.mockReturnValueOnce(data);
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await stepMocker.mock({
      name: [
        {
          name: "secrets",
          mockWith: "echo step",
        },
      ],
    });
    const workflow = stringify(parse(data.replace("echo $TEST1", "echo step")));
    expect(writeFileSyncMock).toHaveBeenLastCalledWith(
      path.join(__dirname, "workflow.yaml"),
      workflow,
      "utf8"
    );
  });

  test("no step found using incorrect name", async () => {
    readFileSyncMock.mockReturnValueOnce(
        await readFile(path.join(resources, "steps.yaml"), "utf8")
    );
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await expect(
        stepMocker.mock({
          name: [
            {
              name: "Incorrect Name",
              mockWith: "echo step",
            },
          ],
        })
    ).rejects.toThrowError(`Could not find step {"name":"Incorrect Name"} in job name\nin ${path.join(__dirname, "workflow.yaml")}`);
  });

  test("step found using uses", async () => {
    const data = await readFile(path.join(resources, "steps.yaml"), "utf8");
    readFileSyncMock.mockReturnValueOnce(data);
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await stepMocker.mock({
      name: [
        {
          uses: "actions/checkout@v3",
          mockWith: "echo step",
        },
      ],
    });
    const workflow = stringify(
      parse(data.replace("uses: actions/checkout@v3", "run: echo step"))
    );
    expect(writeFileSyncMock).toHaveBeenLastCalledWith(
      path.join(__dirname, "workflow.yaml"),
      workflow,
      "utf8"
    );
  });

  test("no step found using incorrect uses", async () => {
    readFileSyncMock.mockReturnValueOnce(
        await readFile(path.join(resources, "steps.yaml"), "utf8")
    );
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await expect(
        stepMocker.mock({
          name: [
            {
              uses: "invalid/action@v0",
              mockWith: "echo step",
            },
          ],
        })
    ).rejects.toThrowError(`Could not find step {"uses":"invalid/action@v0"} in job name\nin ${path.join(__dirname, "workflow.yaml")}`);
  });

  test("step found using run", async () => {
    const data = await readFile(path.join(resources, "steps.yaml"), "utf8");
    readFileSyncMock.mockReturnValueOnce(data);
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await stepMocker.mock({
      name: [
        {
          run: "echo run",
          mockWith: "echo step",
        },
      ],
    });
    const workflow = stringify(parse(data.replace("echo run", "echo step")));
    expect(writeFileSyncMock).toHaveBeenLastCalledWith(
      path.join(__dirname, "workflow.yaml"),
      workflow,
      "utf8"
    );
  });

  test("no step found using incorrect run", async () => {
    readFileSyncMock.mockReturnValueOnce(
        await readFile(path.join(resources, "steps.yaml"), "utf8")
    );
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await expect(
        stepMocker.mock({
          name: [
            {
              run: "echo incorrect",
              mockWith: "echo step",
            },
          ],
        })
    ).rejects.toThrowError(`Could not find step {"run":"echo incorrect"} in job name\nin ${path.join(__dirname, "workflow.yaml")}`);
  });

  test("step found using index", async () => {
    const data = await readFile(path.join(resources, "steps.yaml"), "utf8");
    readFileSyncMock.mockReturnValueOnce(data);
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await stepMocker.mock({
      name: [
        {
          index: 1,
          mockWith: "echo step",
        },
      ],
    });
    const workflow = stringify(parse(data.replace("echo $TEST1", "echo step")));
    expect(writeFileSyncMock).toHaveBeenLastCalledWith(
      path.join(__dirname, "workflow.yaml"),
      workflow,
      "utf8"
    );
  });

  test("no step found using incorrect index", async () => {
    readFileSyncMock.mockReturnValueOnce(
        await readFile(path.join(resources, "steps.yaml"), "utf8")
    );
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await expect(
        stepMocker.mock({
          name: [
            {
              index: 42,
              mockWith: "echo step",
            },
          ],
        })
    ).rejects.toThrowError(`Could not find step {"index":42} in job name\nin ${path.join(__dirname, "workflow.yaml")}`);
  });

  test.each([
    ["index", 0, 0],
    ["name", "secrets", 0]
  ])("step found using before: %p", async (_title, before, index) => {
    const data = await readFile(path.join(resources, "steps.yaml"), "utf8");
    readFileSyncMock.mockReturnValueOnce(data);
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    const mockWith = {
      name: "added new step",
      run: "echo new step"
    };
    await stepMocker.mock({
      name: [
        {
          before,
          mockWith,
        },
      ],
    });
    const outputWorkflow = parse(data) as GithubWorkflow;
    outputWorkflow.jobs["name"].steps.splice(index, 0, mockWith); 
    expect(writeFileSyncMock).toHaveBeenLastCalledWith(
      path.join(__dirname, "workflow.yaml"),
      stringify(outputWorkflow),
      "utf8"
    );
  });

  test.each([
    ["index", 3, 4],
    ["name", "secrets", 2]
  ])("step found using after: %p", async (_title, after, index) => {
    const data = await readFile(path.join(resources, "steps.yaml"), "utf8");
    readFileSyncMock.mockReturnValueOnce(data);
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    const mockWith = {
      name: "added new step",
      run: "echo new step"
    };
    await stepMocker.mock({
      name: [
        {
          after,
          mockWith,
        },
      ],
    });
    const outputWorkflow = parse(data) as GithubWorkflow;
    outputWorkflow.jobs["name"].steps.splice(index, 0, mockWith); 
    expect(writeFileSyncMock).toHaveBeenLastCalledWith(
      path.join(__dirname, "workflow.yaml"),
      stringify(outputWorkflow),
      "utf8"
    );
  });

});

describe("update step", () => {
  beforeEach(async () => {
    existsSyncMock.mockReturnValueOnce(true);
    writeFileSyncMock.mockReturnValueOnce(undefined);
    readFileSyncMock.mockReturnValueOnce(
      await readFile(path.join(resources, "steps.yaml"), "utf8")
    );
  });

  test("mockWith is a string", async () => {
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await stepMocker.mock({
      name: [
        {
          run: "echo run",
          mockWith: "echo step",
        },
        {
          uses: "actions/checkout@v3",
          mockWith: "echo checkout"
        }
      ],
    });

    expect(parse(writeFileSyncMock.mock.calls[0][1])).toMatchObject({
      jobs: {
        name: {
          steps: expect.arrayContaining([
            {
              run: "echo checkout",
            },
            {
              run: "echo step",
            },
          ]),
        },
      },
    });
  });

  test("mockWith is a Step", async () => {
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    await stepMocker.mock({
      name: [
        {
          uses: "actions/checkout@v3",
          mockWith: {
            uses: "actions/setup-node",
            with: {
              nodeVersion: 16
            }
          }
        },
        {
          name: "secrets",
          mockWith: {
            env: {
              TEST1: "val",
            },
            name: undefined // try deleting the field
          }
        }
      ],
    });
    expect(parse(writeFileSyncMock.mock.calls[0][1])).toMatchObject({
      jobs: {
        name: {
          steps: expect.arrayContaining([
            {
              run: "echo $TEST1",
              env: {
                TEST1: "val"
              }
            },
            {
              uses: "actions/setup-node",
              with: {
                nodeVersion: 16
              }
            },
          ]),
        },
      },
    });
  });
});

describe("add step", () => {
  beforeEach(() => {
    existsSyncMock.mockReturnValueOnce(true);
    writeFileSyncMock.mockReturnValueOnce(undefined);
  });
  test.each([
    ["index", 0, 0],
    ["name", "secrets", 0]
  ])("step found using before: %p", async (_title, before, index) => {
    const data = await readFile(path.join(resources, "steps.yaml"), "utf8");
    readFileSyncMock.mockReturnValueOnce(data);
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    const mockWith = {
      name: "added new step",
      run: "echo new step"
    };
    await stepMocker.mock({
      name: [
        {
          before,
          mockWith,
        },
      ],
    });
    const outputWorkflow = parse(data) as GithubWorkflow;
    outputWorkflow.jobs["name"].steps.splice(index, 0, mockWith); 
    expect(writeFileSyncMock).toHaveBeenLastCalledWith(
      path.join(__dirname, "workflow.yaml"),
      stringify(outputWorkflow),
      "utf8"
    );
  });

  test.each([
    ["index", 3, 4],
    ["name", "secrets", 2]
  ])("step found using after: %p", async (_title, after, index) => {
    const data = await readFile(path.join(resources, "steps.yaml"), "utf8");
    readFileSyncMock.mockReturnValueOnce(data);
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    const mockWith = {
      name: "added new step",
      run: "echo new step"
    };
    await stepMocker.mock({
      name: [
        {
          after,
          mockWith,
        },
      ],
    });
    const outputWorkflow = parse(data) as GithubWorkflow;
    outputWorkflow.jobs["name"].steps.splice(index, 0, mockWith); 
    expect(writeFileSyncMock).toHaveBeenLastCalledWith(
      path.join(__dirname, "workflow.yaml"),
      stringify(outputWorkflow),
      "utf8"
    );
  });

  test("multiple add steps with indexing", async () => {
    const data = await readFile(path.join(resources, "steps.yaml"), "utf8");
    readFileSyncMock.mockReturnValueOnce(data);
    const stepMocker = new StepMocker("workflow.yaml", __dirname);
    const mockWith = {
      name: "added new step",
      run: "echo new step"
    };
    await stepMocker.mock({
      name: [
        {
          after: 1,
          mockWith
        },
        {
          before: 0,
          mockWith,
        },
        {
          before: 2,
          mockWith
        },
        {
          index: 3,
          mockWith: "echo updated"
        }
      ],
    });
    const outputWorkflow = parse(data) as GithubWorkflow;
    outputWorkflow.jobs["name"].steps[ outputWorkflow.jobs["name"].steps.length - 1].run = "echo updated";
    outputWorkflow.jobs["name"].steps.splice(0, 0, {...mockWith});
    outputWorkflow.jobs["name"].steps.splice(3, 0, {...mockWith}); 
    outputWorkflow.jobs["name"].steps.splice(3, 0, {...mockWith}); 
    expect(writeFileSyncMock).toHaveBeenLastCalledWith(
      path.join(__dirname, "workflow.yaml"),
      stringify(outputWorkflow),
      "utf8"
    );
  });
});
