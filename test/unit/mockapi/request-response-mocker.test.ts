import axios from "axios";
import { EndpointMethod } from "@kie/mock-github";
import { MockapiRequestMocker } from "@aj/mockapi/request/request-mocker";

const url = "http://localhost:8001";
const instance = axios.create({
  baseURL: url,
});

describe.each(["get", "post", "delete", "put", "patch"])(
  "Method - %p",
  (method: string) => {
    test("with path parameters", async () => {
      const requestMocker = new MockapiRequestMocker(url, {
        path: "/path/{param1}/path/{param2}/path/{param3}",
        method: method as EndpointMethod,
        parameters: {
          path: ["param1", "param2", "param3"],
          query: [],
          body: [],
        },
      });
      requestMocker
        .request({
          param1: "hello",
          param2: /(w|W)orld\d/,
        } as any)
        .reply({ status: 200, data: { msg: "hello world" } });

      const { status, data } = await instance({
        method,
        url: "path/hello/path/world2/path/any",
      });
      expect(status).toBe(200);
      expect(data).toStrictEqual({ msg: "hello world" });

      // reuse same mocker with repeat
      requestMocker
        .request({
          param1: "hello",
          param2: /(w|W)orld\d/,
        } as any)
        .reply({ status: 200, data: { msg: "hello world" }, repeat: 3 });

      // incorrect param1 - should be an exact match
      await expect(
        instance({ method, url: "path/Hello/path/world2/path/any" })
      ).rejects.toThrowError();

      // incorrect param2 - does not match the regex
      await expect(
        instance({ method, url: "path/hello/path/world/path/any" })
      ).rejects.toThrowError();

      // incorrect param3 - not passed
      await expect(
        instance({ method, url: "path/hello/path/world2/path/" })
      ).rejects.toThrowError();
    });

    test("no path parameters passed", async () => {
      const requestMocker = new MockapiRequestMocker(url, {
        path: "/path/{param1}/path/{param2}/path",
        method: method as EndpointMethod,
        parameters: {
          path: ["param1", "param2"],
          query: [],
          body: [],
        },
      });
      requestMocker
        .request()
        .reply({ status: 200, data: { msg: "hello world" } });

      const { status, data } = await instance({
        method,
        url: "path/hello/path/world2/path",
      });
      expect(status).toBe(200);
      expect(data).toStrictEqual({ msg: "hello world" });
    });

    test("no path parameters defined. Exact path match", async () => {
      const requestMocker = new MockapiRequestMocker(url, {
        path: "/path/hello/world",
        method: method as EndpointMethod,
        parameters: {
          path: [],
          query: [],
          body: [],
        },
      });
      requestMocker
        .request()
        .reply({ status: 200, data: { msg: "hello world" }, repeat: 2 });

      const { status, data } = await instance({
        method,
        url: "/path/hello/world",
      });
      expect(status).toBe(200);
      expect(data).toStrictEqual({ msg: "hello world" });

      await expect(
        instance({
          method,
          url: "/path/hello/worlD",
        })
      ).rejects.toThrowError();
    });

    test("with url queries", async () => {
      const requestMocker = new MockapiRequestMocker(url, {
        path: "/query/{param1}/query",
        method: method as EndpointMethod,
        parameters: {
          path: ["param1"],
          query: ["query1", "query2", "query3"],
          body: [],
        },
      });

      requestMocker
        .request({
          query1: "hello",
          query2: /\d/,
        } as any)
        .reply({ status: 200, data: { msg: "hello world" } });

      const { status, data } = await instance({
        method,
        url: "/query/any/query?query1=hello",
        params: { query2: 1 },
      });
      expect(status).toBe(200);
      expect(data).toStrictEqual({ msg: "hello world" });

      requestMocker
        .request({
          query1: "hello",
          query2: /\d/,
        } as any)
        .reply({ status: 200, data: { msg: "hello world" }, repeat: 3 });

      await expect(
        instance({ method, url: "/query/any/query?query1=hell&query2=2" })
      ).rejects.toThrowError();
      await expect(
        instance({ method, url: "/query/any/query?query1=hello&query2=hello" })
      ).rejects.toThrowError();
      await expect(
        instance({
          method,
          url: "/query/any/query?query1=hello&query2=1&query3=hello",
        })
      ).rejects.toThrowError();
    });

    test("no url queries", async () => {
      const requestMocker = new MockapiRequestMocker(url, {
        path: "/query/{param1}/query",
        method: method as EndpointMethod,
        parameters: {
          path: ["param1"],
          query: ["query1", "query2", "query3"],
          body: [],
        },
      });

      requestMocker
        .request()
        .reply({ status: 200, data: { msg: "hello world" } });

      const { status, data } = await instance({
        method,
        url: "/query/any/query?query1=hello",
        params: { query2: 1 },
      });
      expect(status).toBe(200);
      expect(data).toStrictEqual({ msg: "hello world" });
    });

    test("setResponse: singular response", async () => {
      const requestMocker = new MockapiRequestMocker(url, {
        path: "/response/{param1}/response",
        method: method as EndpointMethod,
        parameters: {
          path: ["param1"],
          query: ["query1", "query2", "query3"],
          body: [],
        },
      });

      requestMocker
        .request()
        .setResponse({ status: 200, data: { msg: "hello world" } })
        .reply();

      const { status, data } = await instance({
        method,
        url: "/response/any/response?query1=hello",
        params: { query2: 1 },
      });
      expect(status).toBe(200);
      expect(data).toStrictEqual({ msg: "hello world" });
    });

    test("setResponse: multiple response", async () => {
      const requestMocker = new MockapiRequestMocker(url, {
        path: "/response/{param1}/response",
        method: method as EndpointMethod,
        parameters: {
          path: ["param1"],
          query: ["query1", "query2", "query3"],
          body: [],
        },
      });

      requestMocker
        .request()
        .setResponse([
          { status: 200, data: { msg: "hello world" } },
          { status: 201, data: { msg: "another response" } },
        ])
        .reply();

      const response1 = await instance({
        method,
        url: "/response/any/response?query1=hello",
        params: { query2: 1 },
      });
      expect(response1.status).toBe(200);
      expect(response1.data).toStrictEqual({ msg: "hello world" });

      const response2 = await instance({
        method,
        url: "/response/any/response?query1=hello",
        params: { query2: 1 },
      });
      expect(response2.status).toBe(201);
      expect(response2.data).toStrictEqual({ msg: "another response" });
    });
  }
);

describe.each(["post", "delete", "put", "patch"])(
  "Method - %p",
  (method: string) => {
    test("with request body", async () => {
      const requestMocker = new MockapiRequestMocker(url, {
        path: "/body/{param1}/body",
        method: method as EndpointMethod,
        parameters: {
          path: ["param1"],
          query: ["query1"],
          body: ["body1", "body2"],
        },
      });

      requestMocker
        .request({
          body1: "hello",
          body2: /\d/,
        } as any)
        .reply({ status: 200, data: { msg: "hello world" } });

      const { status, data } = await instance({
        method,
        url: "/body/any/body",
        data: { body1: "hello", body2: 2 },
      });
      expect(status).toBe(200);
      expect(data).toStrictEqual({ msg: "hello world" });

      requestMocker
        .request({
          body1: "hello",
          body2: /\d/,
        } as any)
        .reply({ status: 200, data: { msg: "hello world" }, repeat: 3 });

      await expect(
        instance({
          method,
          url: "/body/any/body?query1=hell",
          data: { body1: "hell", body2: 2 },
        })
      ).rejects.toThrowError();
      await expect(
        instance({
          method,
          url: "/body/any/body?query1=hello",
          data: { body1: "hello", body2: "world" },
        })
      ).rejects.toThrowError();
      await expect(
        instance({
          method,
          url: "/body/any/body",
          data: { body1: "hello", body2: 2, body3: "world" },
        })
      ).rejects.toThrowError();
    });

    test("no request body", async () => {
      const requestMocker = new MockapiRequestMocker(url, {
        path: "/body/{param1}/body",
        method: method as EndpointMethod,
        parameters: {
          path: ["param1"],
          query: ["query1"],
          body: ["body1", "body2"],
        },
      });

      requestMocker
        .request()
        .reply({ status: 200, data: { msg: "hello world" } });

      const { status, data } = await instance({
        method,
        url: "/body/any/body",
        data: { body1: "hello", body2: 2 },
      });
      expect(status).toBe(200);
      expect(data).toStrictEqual({ msg: "hello world" });
    });
  }
);
