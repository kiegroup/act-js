import net from "net";
import express from "express";
import { http } from "follow-redirects";
import { Server } from "http";
import { ResponseMocker } from "@kie/mock-github";
import { networkInterfaces } from "os";
import internal from "stream";

export class ForwardProxy {
  private apis: ResponseMocker<unknown, number>[];
  private app: express.Express;
  private server: Server;
  private logger: (msg: string) => void;
  private currentConnections: Record<number, internal.Duplex>;
  private currentSocketId: number;

  constructor(apis: ResponseMocker<unknown, number>[], verbose = false) {
    this.apis = apis;
    this.app = express();
    this.logger = verbose ? console.log : _msg => undefined;
    this.server = http.createServer(this.app);
    this.currentConnections = {};
    this.currentSocketId = 0;
  }

  /**
   * Start the server and return the ip address and port in the form of a string - ip:port
   * If it is already running then throw an error
   * @returns
   */
  start(): Promise<string> {
    this.initServer();

    return new Promise((resolve, reject) => {
      if (this.server.listening) {
        reject(new Error("Server has already started"));
      } else {
        this.server.listen(0, () => {
          const address = this.server.address();
          const port =
            typeof address === "string" ? address : address!.port.toString();
          const ip = this.getIp();
          this.logger(`forward proxy started at ${ip}:${port}`);
          resolve(`${ip}:${port}`);
        });
      }
    });
  }

  /**
   * Gracefully stop the server.
   * If it wasn't running then throw an error
   * @returns
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server.listening) {
        reject(new Error("Server has not been started"));
      } else {
        this.server.close(err => {
          if (err) {
            reject(err);
          }
        });

        Object.values(this.currentConnections).forEach(socket =>
          socket.destroy()
        );
        resolve();
      }
    });
  }

  /**
   * Return the ip address. Traverses the available network interfaces and returns the first
   * public ipv4 address
   * @returns
   */
  private getIp() {
    const nics = networkInterfaces();
    const publicIps = Object.values(nics).reduce((prev, current) => {
      prev?.push(
        ...(current?.filter(c => !c.internal && c.family === "IPv4") ?? [])
      );
      return prev;
    }, []);

    if (!publicIps || publicIps.length === 0) {
      throw new Error("Could not detect IP address");
    }
    return publicIps[0].address;
  }

  private initServer() {
    // this context is lost in callbacks
    const logger = this.logger;

    // keep track of connected sockets for clean up
    this.server.on("connection", socket => {
      const socketId = this.currentSocketId;
      socket.on("close", () => {
        delete this.currentConnections[socketId];
      });
      this.currentSocketId += 1;
    });

    // forward any https connections intiated via CONNECT as is
    this.server.on("connect", (req, socket) => {
      socket.on("error", logger);
      const host = req.url?.split(":")[0];
      const port = req.url?.split(":")[1];
      logger(`received connect request for ${host}:${port}`);
      if (!host || !port) {
        socket.write("HTTP/1.1 400 Bad request\r\n\r\n");
        return;
      }
      const target = net.createConnection({ host, port: parseInt(port) });
      target.on("error", logger);
      target.on("connect", () => {
        logger(`connected to ${host}:${port}`);
        socket.write("HTTP/1.1 200 OK\r\n\r\n");
        socket.pipe(target);
        target.pipe(socket);
      });
    });

    // mock all apis
    this.apis.forEach(api => api.reply());

    // forward the intercepted api call
    this.app.all("/*", function (req, res) {
      const opts = {
        host: req.hostname,
        path: req.path + new URL(req.url).search,
        method: req.method,
        headers: req.headers,
        agent: false,
      };

      logger(JSON.stringify(opts));

      const request = http.request(opts);

      request.on("response", function (response) {
        // set status code
        if (response.statusCode) {res.status(response.statusCode);}

        // set headers
        if (response.headers) {res.set(response.headers);}

        response.pipe(res);
      });

      req.pipe(request);
    });
  }
}
