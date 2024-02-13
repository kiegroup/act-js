import axios from "axios";
import path from "path";
import { Mockapi } from "@aj/mockapi/mockapi";

describe("from file", () => {
  const resources = path.resolve(process.cwd(), "test", "unit", "resources", "mockapi");

  test("success", async () => {
    const mockapi = new Mockapi(
      path.join(resources, "api-schema-correct.json")
    );
    mockapi.mock.google.root
      .get({ search: /test.*/ })
      .reply({ status: 200, data: { message: "worked" } });
    const { status, data, invalid } = await axios.get(
      "https://google.com/?search=test123"
    );
    expect(status).toBe(200);
    expect(data).toStrictEqual({ message: "worked" });
    expect(() => mockapi.mock.google.noroot.get()).toThrowError();
  });

  test("failure", () => {
    expect(
      () => new Mockapi(path.join(resources, "api-schema-incorrect.json"))
    ).toThrowError();
  });
});

describe("from arguments", () => {
  test("success", async () => {
    const mockapi = new Mockapi({
      google: {
        baseUrl: "https://google.com",
        endpoints: {
          root: {
            get: {
              path: "/",
              method: "get",
              parameters: {
                path: [],
                query: ["logo"],
                body: [],
              },
            },
          },
        },
      },
    });
    mockapi.mock.google.root
      .get({ logo: /test.*/ })
      .reply({ status: 200, data: { message: "worked" } });
    const { status, data } = await axios.get(
      "https://google.com/?logo=test1234"
    );
    expect(status).toBe(200);
    expect(data).toStrictEqual({ message: "worked" });
    expect(() => mockapi.mock.google.noroot.get()).toThrowError();
  });
});
