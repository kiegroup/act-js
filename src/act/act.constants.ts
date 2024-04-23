import { Step } from "@aj/act/act.type";
import path from "path";

export const DEFAULT_JOB: Step = {
  name: "",
  status: -1,
  output: "",
  outputs: {},
};

export const ACT_BINARY = process.env["ACT_BINARY"] ?? path.resolve(__dirname, "..", "..", "bin", "act");