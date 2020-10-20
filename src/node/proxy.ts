//   private readonly proxy = proxy.createProxyServer({})
//     this.proxy.on("error", (error, _request, response) => {
//       response.writeHead(HttpCode.ServerError)
//       response.end(error.message)
//     })
//     // Intercept the response to rewrite absolute redirects against the base path.
//     this.proxy.on("proxyRes", (response, request: ProxyRequest) => {
//       if (response.headers.location && response.headers.location.startsWith("/") && request.base) {
//         response.headers.location = request.base + response.headers.location
//       }
//     })

//   /**
//    * Proxy a request to the target.
//    */
//   private doProxy(
//     route: Route,
//     request: http.IncomingMessage,
//     response: http.ServerResponse,
//     options: ProxyOptions,
//   ): void
//   /**
//    * Proxy a web socket to the target.
//    */
//   private doProxy(
//     route: Route,
//     request: http.IncomingMessage,
//     response: { socket: net.Socket; head: Buffer },
//     options: ProxyOptions,
//   ): void
//   /**
//    * Proxy a request or web socket to the target.
//    */
//   private doProxy(
//     route: Route,
//     request: http.IncomingMessage,
//     response: http.ServerResponse | { socket: net.Socket; head: Buffer },
//     options: ProxyOptions,
//   ): void {
//     const port = parseInt(options.port, 10)
//     if (isNaN(port)) {
//       throw new HttpError(`"${options.port}" is not a valid number`, HttpCode.BadRequest)
//     }

//     // REVIEW: Absolute redirects need to be based on the subpath but I'm not
//     // sure how best to get this information to the `proxyRes` event handler.
//     // For now I'm sticking it on the request object which is passed through to
//     // the event.
//     ;(request as ProxyRequest).base = options.strip

//     const isHttp = response instanceof http.ServerResponse
//     const base = options.strip ? route.fullPath.replace(options.strip, "") : route.fullPath
//     const path = normalize("/" + (options.prepend || "") + "/" + base, true)
//     const proxyOptions: proxy.ServerOptions = {
//       changeOrigin: true,
//       ignorePath: true,
//       target: `${isHttp ? "http" : "ws"}://127.0.0.1:${port}${path}${
//         Object.keys(route.query).length > 0 ? `?${querystring.stringify(route.query)}` : ""
//       }`,
//       ws: !isHttp,
//     }

//     if (response instanceof http.ServerResponse) {
//       this.proxy.web(request, response, proxyOptions)
//     } else {
//       this.proxy.ws(request, response.socket, response.head, proxyOptions)
//     }
//   }

//   /**
//    * Get the value that should be used for setting a cookie domain. This will
//    * allow the user to authenticate only once. This will use the highest level
//    * domain (e.g. `coder.com` over `test.coder.com` if both are specified).
//    */

//   /**
//    * Return a response if the request should be proxied. Anything that ends in a
//    * proxy domain and has a *single* subdomain should be proxied. Anything else
//    * should return `undefined` and will be handled as normal.
//    *
//    * For example if `coder.com` is specified `8080.coder.com` will be proxied
//    * but `8080.test.coder.com` and `test.8080.coder.com` will not.
//    *
//    * Throw an error if proxying but the user isn't authenticated.
//    */
//   public maybeProxy(route: ProviderRoute, request: http.IncomingMessage): HttpResponse | undefined {
//     // Split into parts.
//     const host = request.headers.host || ""
//     const idx = host.indexOf(":")
//     const domain = idx !== -1 ? host.substring(0, idx) : host
//     const parts = domain.split(".")

//     // There must be an exact match.
//     const port = parts.shift()
//     const proxyDomain = parts.join(".")
//     if (!port || !this.proxyDomains.has(proxyDomain)) {
//       return undefined
//     }

//     // Must be authenticated to use the proxy.
//     route.provider.ensureAuthenticated(request)

//     return {
//       proxy: {
//         port,
//       },
//     }
//   }
// }
