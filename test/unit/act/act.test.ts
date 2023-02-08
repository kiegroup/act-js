import path from "path";
import { Act } from "@aj/act/act";
import { Mockapi } from "@aj/mockapi/mockapi";
import fs from "fs";
import { homedir } from "os";

const resources = path.resolve(__dirname, "..", "resources", "act");

describe("list", () => {
  test("without event", async () => {
    const act = new Act();
    const list = await act.list(undefined, undefined, resources);
    // act seems to behave a bit differently in different env - In GHA the pull request worklow is listed while on local machin it isn't
    expect(list).toEqual(
      expect.arrayContaining([
        {
          jobId: "push1",
          jobName: "push1",
          workflowName: "Act Push Test 1",
          workflowFile: "push1.yml",
          events: "push",
        },
        {
          jobId: "push2",
          jobName: "push2",
          workflowName: "Act Push Test 2",
          workflowFile: "push2.yml",
          events: "push",
        },
      ])
    );
  });

  test("with event", async () => {
    const act = new Act();
    const list = await act.list("pull_request", __dirname, resources);
    expect(list).toStrictEqual([
      {
        jobId: "pr",
        jobName: "pr",
        workflowName: "Pull Request",
        workflowFile: "pull_request.yml",
        events: "pull_request",
      },
    ]);
  });
});

describe("run", () => {
  test("run with job", async () => {
    const act = new Act();
    const output = await act
      .setSecret("SECRET1", "secret1")
      .setEnv("ENV1", "env")
      .runJob("push1", { workflowFile: resources, cwd: __dirname });

    expect(output).toMatchObject([
      {
        name: "Main echo \"push 1\"",
        status: 0,
        output: "push 1",
      },
      {
        name: "Main secrets",
        output: "***",
        status: 0,
      },
      {
        name: "Main env",
        output: "env",
        status: 0,
      },
      { name: "Main pass", status: 0, output: "pass" },
      { name: "Main fail", status: 1, output: "fail" },
    ]);
  });

  test("run with event", async () => {
    const act = new Act();
    const output = await act
      .setSecret("SECRET1", "secret1")
      .setEnv("ENV1", "env")
      .runEvent("pull_request", { workflowFile: resources });

    expect(output).toStrictEqual([
      {
        name: "Main echo \"pull request\"",
        status: 0,
        output: "pull request",
      },
      {
        name: "Main secrets",
        output: "***",
        status: 0,
      },
      {
        name: "Main env",
        output: "env",
        status: 0,
      },
      { name: "Main pass", status: 0, output: "pass" },
      { name: "Main fail", status: 1, output: "fail" },
    ]);
  });

  test("run with proxy", async () => {
    const mockapi = new Mockapi({
      google: {
        baseUrl: "http://google.com",
        endpoints: {
          root: {
            get: {
              path: "/",
              method: "get",
              parameters: {
                query: [],
                path: [],
                body: [],
              },
            },
          },
        },
      },
    });

    const act = new Act();
    const output = await act.runJob("mock", {
      workflowFile: resources,
      mockApi: [
        mockapi.mock.google.root
          .get()
          .setResponse({ status: 200, data: "mock response" }),
      ],
    });
    expect(output).toStrictEqual([
      {
        name: "Main https api call",
        status: 0,
        output: expect.stringMatching(/<HTML><HEAD>.+/),
      },
      {
        name: "Main http api call",
        status: 0,
        output: "mock response",
      },
    ]);
  });

  test("run job with mocked step", async () => {
    const original = fs.readFileSync(path.join(resources, "push1.yml"), "utf8");
    const act = new Act(__dirname, resources);
    const output = await act.runJob("push1", {
      mockSteps: {
        push1: [
          {
            name: "secrets",
            mockWith: "echo secrets",
          },
          {
            run: "echo $ENV1",
            mockWith: "echo some env",
          },
        ],
      },
    });
    expect(output).toMatchObject([
      {
        name: "Main echo \"push 1\"",
        status: 0,
        output: "push 1",
      },
      {
        name: "Main secrets",
        output: "secrets",
        status: 0,
      },
      {
        name: "Main env",
        output: "some env",
        status: 0,
      },
      { name: "Main pass", status: 0, output: "pass" },
      { name: "Main fail", status: 1, output: "fail" },
    ]);
    fs.writeFileSync(path.join(resources, "push1.yml"), original);
  });

  test("run event with mocked step", async () => {
    const original = fs.readFileSync(
      path.join(resources, "pull_request.yml"),
      "utf8"
    );
    const act = new Act(undefined, resources);
    const output = await act.runEvent("pull_request", {
      mockSteps: {
        pr: [
          {
            name: "secrets",
            mockWith: "echo secrets",
          },
          {
            run: "echo $ENV1",
            mockWith: "echo some env",
          },
        ],
      },
    });
    expect(output).toStrictEqual([
      {
        name: "Main echo \"pull request\"",
        status: 0,
        output: "pull request",
      },
      {
        name: "Main secrets",
        output: "secrets",
        status: 0,
      },
      {
        name: "Main env",
        output: "some env",
        status: 0,
      },
      { name: "Main pass", status: 0, output: "pass" },
      { name: "Main fail", status: 1, output: "fail" },
    ]);
    fs.writeFileSync(path.join(resources, "pull_request.yml"), original);
  });

  test("run with event json", async () => {
    const act = new Act();
    const output = await act
      .setEvent({ some_event: "some_event" })
      .runJob("event", { workflowFile: resources });

    expect(output).toMatchObject([
      {
        name: "Main event",
        status: 0,
        output: "some_event",
      },
    ]);
  });

  test("run with group annotations", async () => {
    const act = new Act();
    const output = await act.runJob("groups", { workflowFile: resources });

    expect(output).toStrictEqual([
      {
        name: "Main Group 1 of log lines",
        status: 0,
        output: "Inside group 1",
        groups: [
          {
            name: "Group 1",
            output: "Inside group 1",
          },
        ],
      },
      {
        name: "Main Group 2 of log lines",
        status: 0,
        output: "Inside group 2 part 1\nInside group 2 part 2",
        groups: [
          {
            name: "Group 2 part 1",
            output: "Inside group 2 part 1",
          },
          {
            name: "Group 2 part 2",
            output: "Inside group 2 part 2",
          },
        ],
      },
    ]);
  });

  test("run with input", async () => {
    const act = new Act();
    const output = await act
      .setInput("some_input", "some_input")
      .runEventAndJob("workflow_dispatch", "input", { workflowFile: resources });

    expect(output).toMatchObject([
      {
        name: "Main input",
        status: 0,
        output: "some_input",
      },
    ]);
  });

  test("run with input and event json", async () => {
    const act = new Act();
    const output = await act
      .setInput("some_input", "some_input")
      .setEvent({ some_event: "some_event" })
      .runEventAndJob("workflow_dispatch", "event-and-input", { workflowFile: resources });

    expect(output).toMatchObject([
      {
        name: "Main event",
        status: 0,
        output: "some_event",
      },
      {
        name: "Main input",
        status: 0,
        output: "some_input",
      },
    ]);
  });
});

describe("initialization", () => {
  test("actrc exists", () => {
    jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
    expect(() => {
      new Act();
    }).not.toThrowError();
  });

  test.each([
    [
      "micro",
      "micro",
      "-P ubuntu-latest=node:16-buster-slim\n-P ubuntu-20.04=node:16-buster-slim\n-P ubuntu-18.04=node:16-buster-slim\n-P ubuntu-22.04=node:16-bullseye-slim",
    ],
    [
      "medium",
      "medium",
      "-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest\n-P ubuntu-20.04=ghcr.io/catthehacker/ubuntu:act-20.04\n-P ubuntu-18.04=ghcr.io/catthehacker/ubuntu:act-18.04\n-P ubuntu-22.04=ghcr.io/catthehacker/ubuntu:act-22.04",
    ],
    [
      "large",
      "large",
      "-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:full-latest\n-P ubuntu-20.04=ghcr.io/catthehacker/ubuntu:full-20.04\n-P ubuntu-18.04=ghcr.io/catthehacker/ubuntu:full-18.04",
    ],
    [
      "default",
      undefined,
      "-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest\n-P ubuntu-20.04=ghcr.io/catthehacker/ubuntu:act-20.04\n-P ubuntu-18.04=ghcr.io/catthehacker/ubuntu:act-18.04\n-P ubuntu-22.04=ghcr.io/catthehacker/ubuntu:act-22.04",
    ],
  ])(
    "actrc does not exist. make with - %p image",
    (_title: string, image: string | undefined, expected: string) => {
      jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);
      const writeMock = jest
        .spyOn(fs, "writeFileSync")
        .mockImplementationOnce((_file, data) => data);
      expect(() => {
        new Act(undefined, undefined, image);
      }).not.toThrowError();
      expect(writeMock).toHaveBeenCalledWith(
        path.join(homedir(), ".actrc"),
        expected
      );
    }
  );
});
