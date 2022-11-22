import { Act } from "@aj/act";
import { MockGithub } from "@kie/mock-github";
import path from "path";

let github: MockGithub;
beforeEach(async () => {
  github = new MockGithub({
    repo: {
      actJS_pull: {
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

  const act = new Act(github.repo.getPath("actJS_pull"));
  const result = await act.runJob("tests");

  expect(result).toMatchObject([
    {
      name: expect.stringMatching(/actions\/checkout@v3/),
      status: 0,
      output: "",
    },
    {
      name: expect.stringMatching(/actions\/setup-node@v3/),
      output: expect.any(String),
      status: 0,
    },
    { name: expect.stringMatching(/Install packages/), status: 0, output: expect.any(String) },
    { name: expect.stringMatching(/Install act/), status: 0, output: expect.any(String) },
    { name: expect.stringMatching(/Test/), status: 1, output: expect.any(String) },
    {
      name: expect.stringMatching(/actions\/checkout@v3/),
      status: 0,
      output: "",
    },
    {
      name: expect.stringMatching(/actions\/setup-node@v3/),
      output: expect.any(String),
      status: 0,
    },
    { name: expect.stringMatching(/Install packages/), status: 0, output: expect.any(String) },
    { name: expect.stringMatching(/Install act/), status: 0, output: expect.any(String) },
    { name: expect.stringMatching(/Test/), status: 1, output: expect.any(String) },

  ]);
});
