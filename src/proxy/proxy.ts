import net from "net";
import express from "express";
import { http } from "follow-redirects";
import { Server } from "http";
import { ResponseMocker } from "@kie/mock-github";
import { networkInterfaces } from "os";
import internal from "stream";
import { LOCALHOST } from "@aj/proxy/proxy.types";

export class ForwardProxy {
  private apis: ResponseMocker<unknown, number>[];
  private app: express.Express;
  private server: Server;
  private logger: (msg: string) => void;
  private currentConnections: Record<number, internal.Duplex>;
  private currentSocketId: number;
  private secondaryProxy?: {
    proxy: ForwardProxy,
    proxyAddress: string
  };
  private shouldHandleConnect: boolean;

  constructor(apis: ResponseMocker<unknown, number>[], verbose = false, shouldHandleConnect = true) {
    this.apis = apis;
    this.app = express();
    this.logger = verbose ? console.log.bind(undefined, "[act-js API Mocker]") : _msg => undefined;
    this.server = http.createServer(this.app);
    this.currentConnections = {};
    this.currentSocketId = 0;
    this.shouldHandleConnect = shouldHandleConnect;
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

        if (this.secondaryProxy) {
          this.secondaryProxy.proxy.stop().then(resolve);
        } else {
          resolve();
        }
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
    // keep track of connected sockets for clean up
    this.server.on("connection", socket => {
      const socketId = this.currentSocketId;
      socket.on("close", () => {
        delete this.currentConnections[socketId];
      });
      this.currentSocketId += 1;
    });

    if (this.shouldHandleConnect) {
      this.handleCONNECT();
    } else {
      // reject connect if received and the proxy was initialized not to accept connect requests
      this.server.on("connect", (_, socket) => {
        socket.write("HTTP/1.1 400 Bad request\r\n\r\n");
      });
    }

    this.handleAPIInterception();
  }

  /**
   * forward any http(s) connections intiated via CONNECT as is
   */
  private handleCONNECT() {
    this.server.on("connect", async (req, socket) => {
      socket.on("error", this.logger);

      const host = req.url?.split(":")[0];
      const port = req.url?.split(":")[1];
      this.logger(`received connect request for ${host}:${port}`);
      if (!host || !port) {
        socket.write("HTTP/1.1 400 Bad request\r\n\r\n");
        return;
      }

      let targetHost = host, targetPort = port;

      // if connect request was issued for http target, then we handle it by accepting the connect,
      // spinning up a secondary proxy and piping the request to the secondary proxy
      if (port === "80") {        
        if (!this.secondaryProxy) {
          // NOTE: make sure to disable CONNECT handling in the secondary proxy to avoid spinning up infinite proxies
          // this can happen if the client is malicious and keeps on sending CONNECT requests
          const proxy = new ForwardProxy(this.apis, false, false);
          const proxyAddress = await proxy.start();
          this.secondaryProxy = { proxy, proxyAddress };
        }
        const [_, secondaryProxyPort] = this.secondaryProxy.proxyAddress.split(":");
        targetHost = LOCALHOST;
        targetPort = secondaryProxyPort;
      } 

      const target = net.createConnection({ host: targetHost, port: parseInt(targetPort) });
      target.on("error", this.logger);
      target.on("connect", () => {
        this.logger(`connected to ${targetHost}:${targetPort}`);
        socket.write("HTTP/1.1 200 OK\r\n\r\n");
        socket.pipe(target);
        target.pipe(socket);
      });
    });
  }

  private handleAPIInterception() {
    // mock all apis
    this.apis.forEach(api => api.reply());

    // forward the intercepted api call
    this.app.all("/*", (req, res) => {
      let path = req.path;

      // for http connections initiated via CONNECT, req.url resolves to be the path and not the entire url
      try {
        path += new URL(req.url).search;
      } catch (err) {
        path += new URL(`http://${req.hostname}${req.url}`).search;
      }
      
      const opts = {
        host: req.hostname,
        path,
        method: req.method,
        headers: req.headers,
        agent: false,
      };

      this.logger(JSON.stringify(opts));

      const request = http.request(opts);

      request.on("response", response => {
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
