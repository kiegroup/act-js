import path from "path";
import { Act } from "@aj/act";
import { Mockapi } from "@kie/mock-github";

const resources = path.resolve(__dirname, "resources");

describe("cwd", () => {
  test("set", () => {
    const act = new Act();
    expect(act.setCwd("dirname")).toBe(act);
    expect(act.getCwd()).toBe("dirname");
  });
  test("get", () => {
    const act = new Act();
    expect(act.getCwd()).toBe(process.cwd());
  });
});

describe("list", () => {
  test("without event", async () => {
    const act = new Act();
    const list = await act.list(undefined, resources);
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
    const list = await act.list("pull_request", resources);
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
      .runJob("push1", { cwd: resources });

    // act seems to behave a bit differently in different env - In GHA, name has a prefix Main
    expect(output).toMatchObject([
      {
        name: expect.stringMatching(/echo "push 1"/),
        status: 0,
        output: "push 1",
      },
      {
        name: expect.stringMatching(/secrets/),
        output: "***",
        status: 0,
      },
      {
        name: expect.stringMatching(/env/),
        output: "env",
        status: 0,
      },
      { name: expect.stringMatching(/pass/), status: 0, output: "pass" },
      { name: expect.stringMatching(/fail/), status: 1, output: "fail" },
    ]);
  });

  test("run with event", async () => {
    const act = new Act();
    const output = await act
      .setSecret("SECRET1", "secret1")
      .setEnv("ENV1", "env")
      .runEvent("pull_request", { cwd: resources });
    // act seems to behave a bit differently in different env - In GHA, name has a prefix Main
    expect(output).toStrictEqual([
      {
        name: expect.stringMatching(/echo "pull request"/),
        status: 0,
        output: "pull request",
      },
      {
        name: expect.stringMatching(/secrets/),
        output: "***",
        status: 0,
      },
      {
        name: expect.stringMatching(/env/),
        output: "env",
        status: 0,
      },
      { name: expect.stringMatching(/pass/), status: 0, output: "pass" },
      { name: expect.stringMatching(/fail/), status: 1, output: "fail" },
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
      cwd: resources,
      mockApi: [
        mockapi.mock.google.root
          .get()
          .setResponse({ status: 200, data: "mock response" }),
      ],
    });
    // act seems to behave a bit differently in different env - In GHA, name has a prefix Main
    expect(output).toStrictEqual([
      {
        name: expect.stringMatching(/api call/),
        status: 0,
        output: "mock response",
      }
    ]);
  });
});
