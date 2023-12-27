import { OutputParser } from "@aj/output-parser/output-parser";
import path from "path";
import fs from "fs";

describe("parseOutput", () => {
  const resources = path.resolve(process.cwd(), "test", "unit", "resources", "output-parser");

  describe("groups", () => {
    test("some groups", async () => {
      const output = fs.readFileSync(path.join(resources, "act-groups-sorted.log")).toString();
      const parser = new OutputParser(output);
  
      const result = parser.parseOutput();
  
      expect(result).toStrictEqual([
        {
          "groups": [
            {
              "name": "Unit Tests",
              "output": "1231 tests executed."
            },
            {
              "name": "Integration Tests",
              "output": "32 tests executed."
            }
          ],
          "name": "Main Testing",
          "output": "1231 tests executed.\n32 tests executed.",
          "status": 0
        },
        {
          "groups": [
            {
              "name": "Lint",
              "output": "No linting errors found."
            }
          ],
          "name": "Main Lint",
          "output": "No linting errors found.",
          "status": 0
        }
      ]);
    });

    test("interleaved groups", async () => {
      const output = fs.readFileSync(path.join(resources, "act-groups-interleaved.log")).toString();
      const parser = new OutputParser(output);

      const result = parser.parseOutput();

      expect(result).toStrictEqual([
        {
          "groups": [
            {
              "name": "Unit Tests",
              "output": "1231 tests executed."
            },
            {
              "name": "Integration Tests",
              "output": "32 tests executed."
            }
          ],
          "name": "Main Testing",
          "output": "1231 tests executed.\n32 tests executed.",
          "status": 0
        },
        {
          "groups": [
            {
              "name": "Lint",
              "output": "No linting errors found."
            }
          ],
          "name": "Main Lint",
          "output": "No linting errors found.",
          "status": 0
        }
      ]);
    });

    test("mixed groups", async () => {
      const output = fs.readFileSync(path.join(resources, "act-groups-mixed.log")).toString();
      const parser = new OutputParser(output);
  
      const result = parser.parseOutput();
  
      expect(result).toStrictEqual([
        {
          "groups": [
            {
              "name": "Unit Tests",
              "output": "1231 tests executed."
            },
            {
              "name": "Integration Tests",
              "output": "32 tests executed."
            }
          ],
          "name": "Main Testing",
          "output": "1231 tests executed.\n32 tests executed.",
          "status": 0
        },
        {
          "name": "Main Lint",
          "output": "No problems found.",
          "status": 0
        }
      ]);
    });
  });
});
