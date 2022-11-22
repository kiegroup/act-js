import { Act } from "@aj/act";
import { MockGithub } from "@kie/mock-github";
import path from "path";

let github: MockGithub;
beforeEach(async () => {
  github = new MockGithub({
    repo: {
      actJS: {
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
          }
        ],
      },
    },
  });
  await github.setup();
});

afterEach(async () => {
  await github.teardown();
});

test("publish workflow", async () => {

  const act = new Act(github.repo.getPath("actJS"));
  const result = await act.setEnv("NPM_TOKEN", "fake_token").runJob("build");

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
    { name: expect.stringMatching(/npm install/), status: 0, output: expect.any(String) },
    { name: expect.stringMatching(/npm run build/), status: 0, output: expect.stringMatching(/tsc && tsc-alias/) },
    { name: expect.stringMatching(/\.\/scripts\/act\.sh \$VERSION/), status: 0, output: expect.any(String) },
    { name: expect.stringMatching(/npm publish --access public/), status: 1, output: expect.any(String) },

  ]);
});
