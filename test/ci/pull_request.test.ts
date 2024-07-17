import { Act } from "@aj/act/act";
import { MockGithub } from "@kie/mock-github";
import path from "path";

let github: MockGithub;
beforeEach(async () => {
  github = new MockGithub({
    repo: {
      pull_request: {
        files: [
          {
            src: path.resolve(__dirname, "..", "..", ".github"),
            dest: ".github",
          },
          {
            src: path.resolve(__dirname, "..", "..", "package.json"),
            dest: "package.json",
          },
          {
            src: path.resolve(__dirname, "..", "..", "package-lock.json"),
            dest: "package-lock.json",
          },
          {
            src: path.resolve(__dirname, "..", "..", "tsconfig.json"),
            dest: "tsconfig.json",
          },
          {
            src: path.resolve(__dirname, "..", "..", "jest.config.ts"),
            dest: "jest.config.ts",
          },
          {
            src: path.resolve(__dirname, "..", "..", "test"),
            dest: "test",
          },
          {
            src: path.resolve(__dirname, "..", "..", "src"),
            dest: "src",
          },
          {
            src: path.resolve(__dirname, "..", "..", "scripts"),
            dest: "scripts",
          },
        ],
      },
    },
  });
  await github.setup();
});

afterEach(async () => {
  await github.teardown();
});

test("pull request workflow", async () => {

  const act = new Act(github.repo.getPath("pull_request"));
  const result = await act.setMatrix("node-version", ["18.x"]).runJob("unit", {
    mockSteps: {
      unit: [
        {
          name: "Test",
          mockWith: "echo ran tests"
        }
      ]
    }
  });

  expect(result).toMatchObject([
    {
      name: "Main actions/checkout@v3",
      status: 0,
      output: "",
    },
    {
      name: "Main actions/setup-node@v3",
      output: expect.any(String),
      status: 0,
    },
    { name: "Main Install packages", status: 0, output: expect.any(String) },
    { name: "Main Test", status: 0, output: "ran tests" },
    {
      name: "Post actions/setup-node@v3",
      output: "",
      status: 0,
    }
  ]);
});
